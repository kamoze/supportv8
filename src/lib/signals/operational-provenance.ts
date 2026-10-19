import type { CloudEventInput } from './operational-contract';
/** Evidence pinned by an authorized adapter, never permission by itself. */
export type OperationalProvenance = Readonly<{
    contract: 'servicev8.operational-provenance.v1';
    accountId: string;
    tenantId: string;
    installationId: string;
    productId: 'servicev8.service-app.supportv8';
    productVersion: string;
    target: {
        readonly kind: 'service';
        readonly targetAppId: 'runtime';
    };
    sourceBinding: string;
    workspaceId: string;
    baseManifestDigest: string;
    descriptorDigest: string;
    nativeBinding: {
        readonly kind: 'support-permanent-tuple';
    };
}>;
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const identifier = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/.test(v);
const digest = (v: unknown) => typeof v === 'string' && /^sha256:[a-f0-9]{64}$/.test(v);
/** Structural/scope validation only. Registry and native owner checks belong to admission. */
export function validateOperationalProvenance(value: unknown, tenantId: string, accountId: string, event: CloudEventInput): asserts value is OperationalProvenance {
    if (!exact(value, ['contract', 'accountId', 'tenantId', 'installationId', 'productId', 'productVersion', 'target', 'sourceBinding', 'workspaceId', 'baseManifestDigest', 'descriptorDigest', 'nativeBinding']) ||
        value.contract !== 'servicev8.operational-provenance.v1' ||
        !['accountId', 'tenantId', 'installationId', 'workspaceId'].every(k => identifier(value[k])) ||
        value.accountId !== accountId || value.tenantId !== tenantId || value.sourceBinding !== event.source ||
        !['accountId', 'tenantId', 'installationId', 'workspaceId'].every(k => event.data?.[k] === value[k]) ||
        !digest(value.baseManifestDigest) || !digest(value.descriptorDigest) ||
        !exact(value.target, ['kind', 'targetAppId']) || value.target.kind !== 'service' || value.target.targetAppId !== 'runtime') {
        throw Error('invalid_operational_provenance');
    }
    const binding = value.nativeBinding;
    // Support's DB forbids rebinding, hard deletion and tombstone recovery. The
    // complete pinned tuple identifies its incarnation; no invented epoch/hash.
    const support = value.productId === 'servicev8.service-app.supportv8' && value.productVersion === '1.0.0' && value.sourceBinding === 'urn:servicev8:app:supportv8' &&
        exact(binding, ['kind']) && binding.kind === 'support-permanent-tuple';
    if (!support)
        throw Error('invalid_operational_provenance');
}
