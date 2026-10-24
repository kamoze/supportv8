import { createHash } from 'node:crypto';
export const exact = (v: unknown, keys: string[]): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
import { validateOperationalProvenance, type OperationalProvenance } from './operational-provenance';
export type CloudEventInput = {
    specversion: string;
    id: string;
    source: string;
    type: string;
    subject: string;
    time: string;
    datacontenttype: string;
    data: Record<string, unknown>;
};
// Consumer validation of Registry 3d847ae's closed v1 contract. This is neither
// a catalog nor an authority store; extensions require an owner contract review.
export const publisherAudience = 'servicev8-runtime-operational-signals';
export const publisherScope = 'runtime:operational-signals:write';
export const publisherProducts = { supportv8: { productId: 'servicev8.service-app.supportv8', productVersion: '1.0.0' } } as const;
export type OperationalSourceSelection = Pick<OperationalProvenance, 'accountId' | 'tenantId' | 'installationId' | 'productId' | 'productVersion' | 'sourceBinding' | 'workspaceId'>;
export type PublisherApp = keyof typeof publisherProducts;
export const canonicalJson = (v: unknown): string => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(canonicalJson).join(',')}]` : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`).join(',')}}`;
export const descriptorDigest = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v)).digest('hex')}`;
const digest = (v: unknown) => typeof v === 'string' && /^sha256:[a-f0-9]{64}$/.test(v);
export class PublisherError extends Error {
    constructor(readonly status: number, readonly code: string) { super(code); }
}
export function unavailable(): never { throw new PublisherError(503, 'operational_authority_unavailable'); }
export function denied(): never { throw new PublisherError(403, 'operational_source_denied'); }
export function stale(): never { throw new PublisherError(409, 'operational_provenance_conflict'); }
function invalid(): never { throw new PublisherError(400, 'invalid_operational_event'); }
type Field = {
    type: 'opaque' | 'string' | 'integer';
    required: boolean;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
};
export type EventSchema = {
    type: string;
    subject: {
        prefix: string;
        idField: string;
        maxIdLength: number;
    };
    fields: Record<string, Field>;
};
const opaque = (required = true): Field => ({ type: 'opaque', required, maxLength: 192 });
const label = (): Field => ({ type: 'string', required: true, maxLength: 64 });
const integer = (): Field => ({ type: 'integer', required: true, minimum: 0, maximum: Number.MAX_SAFE_INTEGER });
const definition = (app: string, suffix: string, prefix: string, idField: string, fields: Record<string, Field>): EventSchema => ({ type: `com.servicev8.business.${app}.${suffix}.v1`, subject: { prefix, idField, maxIdLength: 192 }, fields });
const support = [
    definition('support', 'ticket-created', 'ticket:', 'ticketId', { ticketId: opaque(), ticketRef: opaque(), status: label(), priority: label() }),
    definition('support', 'ticket-escalated', 'ticket:', 'ticketId', { ticketId: opaque(), ticketRef: opaque(), priority: label() }),
    definition('support', 'ticket-resolved', 'ticket:', 'ticketId', { ticketId: opaque(), ticketRef: opaque(), status: label() }),
];
const scopeKeys = ['accountId', 'tenantId', 'installationId', 'workspaceId'] as const;
function boundedSchema(v: unknown, depth = 0): void {
    if (depth > 8)
        unavailable();
    if (typeof v === 'string') {
        if (v.length > 256 || /[\x00-\x1f\x7f]/.test(v))
            unavailable();
        return;
    }
    if (typeof v === 'number') {
        if (!Number.isSafeInteger(v))
            unavailable();
        return;
    }
    if (typeof v === 'boolean' || v === null)
        return;
    if (!v || typeof v !== 'object' || Object.keys(v).length > 32)
        unavailable();
    for (const [k, child] of Object.entries(v)) {
        if (k.length > 192)
            unavailable();
        boundedSchema(child, depth + 1);
    }
}
export function parsePublication(value: unknown): {
    event: CloudEventInput;
    provenance: OperationalProvenance;
} {
    if (!exact(value, ['event', 'provenance']))
        invalid();
    const e = value.event;
    if (!exact(e, ['specversion', 'id', 'source', 'type', 'subject', 'time', 'datacontenttype', 'data']) || e.specversion !== '1.0' || e.datacontenttype !== 'application/json' || typeof e.id !== 'string' || e.id.length < 1 || e.id.length > 192 || /[\x00-\x1f\x7f]/.test(e.id) || typeof e.time !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.test(e.time) || !Number.isFinite(Date.parse(e.time)) || !e.data || typeof e.data !== 'object' || Array.isArray(e.data))
        invalid();
    try {
        validateOperationalProvenance(value.provenance, value.provenance?.tenantId, value.provenance?.accountId, e as CloudEventInput);
    }
    catch {
        invalid();
    }
    return { event: e as CloudEventInput, provenance: value.provenance };
}
export function validateSelectedCertificate(value: unknown, p: OperationalSourceSelection, app: PublisherApp): EventSchema[] {
    boundedSchema(value);
    const reasons = ['installation_absent', 'installation_ambiguous', 'installation_scope_mismatch', 'installation_unqualified', 'entitlement_inactive', 'entitlement_expired', 'installation_inactive', 'product_unqualified', 'base_manifest_absent', 'descriptor_absent', 'descriptor_unqualified', 'target_mismatch', 'capability_mismatch'];
    if (exact(value, ['status', 'reason']) && value.status === 'unsupported' && reasons.includes(value.reason))
        denied();
    if (!exact(value, ['status', 'installation', 'kind', 'productId', 'productVersion', 'baseManifestDigest', 'descriptorDigest', 'publisherId', 'descriptor', 'authority', 'requiredChecks']) || value.status !== 'supported' || value.kind !== 'operational-sources' || value.publisherId !== 'servicev8' || value.authority !== 'catalog-metadata-only' || canonicalJson(value.requiredChecks) !== canonicalJson(['current-native-workspace-binding', 'deployed-producer-qualification', 'source-owner-authority', 'human-read-policy']) || !digest(value.baseManifestDigest) || !digest(value.descriptorDigest))
        unavailable();
    const expected = { accountId: p.accountId, tenantId: p.tenantId, installationId: p.installationId, ...publisherProducts[app], target: { kind: 'service', targetAppId: 'runtime' } };
    if (canonicalJson(value.installation) !== canonicalJson(expected) || value.productId !== expected.productId || value.productVersion !== expected.productVersion)
        unavailable();
    const d = value.descriptor;
    if (!d || !Array.isArray(d.requiredCapabilities) || d.requiredCapabilities.length > 32 || !d.requiredCapabilities.every((value: unknown) => typeof value === 'string') || canonicalJson([...d.requiredCapabilities].sort()) !== canonicalJson(d.requiredCapabilities) || !Array.isArray(d.events) || d.events.length < 1 || d.events.length > 12)
        unavailable();
    const expectedDescriptor = { contract: 'servicev8.operational-sources.v1', ...publisherProducts[app], target: expected.target, sourceBinding: `urn:servicev8:app:${app}`, producer: { appId: app, contract: 'servicev8.native-business-facts.v1' }, requiredCapabilities: d.requiredCapabilities, envelope: { specversion: '1.0', datacontenttype: 'application/json' }, compatibility: 'support-manual-ticket-scalar-projection', occurrence: 'cloudevents.time.native-transition', scopeFields: { accountId: 'verified.accountId', tenantId: 'verified.tenantId', installationId: 'verified.installationId', workspaceId: 'verified.workspaceId' }, projection: 'closed-scalar-facts', events: d.events };
    if (canonicalJson(d) !== canonicalJson(expectedDescriptor) || descriptorDigest(d) !== value.descriptorDigest)
        unavailable();
    const allowed = support, seen = new Set<string>();
    for (const event of d.events) {
        if (!event || typeof event.type !== 'string' || seen.has(event.type) || !allowed.some(e => canonicalJson(e) === canonicalJson(event)))
            unavailable();
        seen.add(event.type);
    }
    return d.events;
}
export function validateCertificate(value: unknown, p: OperationalProvenance, app: PublisherApp): EventSchema[] {
    const schemas = validateSelectedCertificate(value, p, app);
    const certificate = value as Record<string, unknown>;
    if (p.baseManifestDigest !== certificate.baseManifestDigest || p.descriptorDigest !== certificate.descriptorDigest)
        stale();
    return schemas;
}
export function validateDeclaredEvent(event: CloudEventInput, schemas: EventSchema[]) {
    const schema = schemas.find(s => s.type === event.type);
    if (!schema)
        invalid();
    if (Object.keys(event.data).some(k => !scopeKeys.includes(k as typeof scopeKeys[number]) && !Object.hasOwn(schema.fields, k)))
        invalid();
    for (const [key, field] of Object.entries(schema.fields)) {
        const value = event.data[key];
        if (value === undefined) {
            if (field.required)
                invalid();
            continue;
        }
        if (field.type === 'integer') {
            if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > Number.MAX_SAFE_INTEGER)
                invalid();
        }
        else if (typeof value !== 'string' || value.length < 1 || value.length > field.maxLength! || /[\x00-\x1f\x7f]/.test(value))
            invalid();
    }
    if (event.subject !== schema.subject.prefix + event.data[schema.subject.idField])
        invalid();
}
export const SUPPORT_READINESS_MANIFEST = { schemaVersion: 'servicev8.managed-support.v1', operations: [{ name: 'support_ticket_lookup', capability: 'ticket.read', access: 'read', approval: 'never', inputSchema: 'support.ticket-reference.v1', outputSchema: 'support.ticket-status.v1' }] };
export const supportedSupportSchemas = support;
