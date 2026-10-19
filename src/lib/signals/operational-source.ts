import {sqlBudgetForSignal,operationalBudgetScope,type OperationalSqlBudget} from '@/lib/db/operational-sql-budget';
import { pgClient, type PostgresClient } from '@/lib/db/pg-client';
import type { ManagedSupportRegistrationJob } from '@/lib/service-app/managed-support-registration';
import { canonicalJson, PublisherError, publisherProducts, validateSelectedCertificate, validateCertificate, validateDeclaredEvent, parsePublication, type EventSchema } from './operational-contract';
import type { OperationalProvenance } from './operational-provenance';
import { credentialFromEnv, endpoint, readJson, type Credential } from './operational-workload';
import type { OutboxRow } from './operational-outbox';
export type SourceTarget = {
    accountId: string;
    tenantId: string;
    installationId: string;
    workspaceId: string;
};
export type SourceResolution = {
    pin: OperationalProvenance;
    certificate: Record<string, unknown>;
    schemas: EventSchema[];
};
/** Queries only the exact permanent local tuple under tenant RLS. Never a hire. */
export async function currentLocalSource(target: SourceTarget, client: PostgresClient = pgClient,budget:OperationalSqlBudget=sqlBudgetForSignal()): Promise<boolean> {
    return client.withWorkspaceProvisioningSession({ tenantId: target.workspaceId, accountId: target.accountId, registryTenantId: target.tenantId }, async (db) => (await db.query(`select w.installation_id from supportv8.runtime_support_workspaces w
 join supportv8.tenants t on t.id=w.native_tenant_id and t.domain=w.native_domain and t.servicev8_account_id=w.account_id
 join supportv8.managed_support_registration_jobs j on j.installation_id=w.installation_id and j.acquisition_id=w.operation_id and j.account_id=w.account_id and j.registry_tenant_id=w.registry_tenant_id and j.native_workspace_id=w.native_tenant_id
 where w.installation_id=$1 and w.account_id=$2 and w.registry_tenant_id=$3 and w.native_tenant_id=$4 and w.vertical_id='runtime' and w.state='workspace_created' and w.deleted_at is null and j.state='ready' and j.desired_state='active' and j.observed_generation=0`, [target.installationId, target.accountId, target.tenantId, target.workspaceId])).length === 1,budget);
}
export function sourceResolver(input: {
    registryUrl: string;
    credential: Credential;
    request?: typeof fetch;
    local?: (target: SourceTarget,signal:AbortSignal) => Promise<boolean>;
}) {
    const origin = endpoint(input.registryUrl);
    if (origin.pathname !== '/')
        throw Error('signals_configuration_required');
    return async (target: SourceTarget, signal: AbortSignal): Promise<SourceResolution> => {
        const selection = { ...target, ...publisherProducts.supportv8, sourceBinding: 'urn:servicev8:app:supportv8' };
        const url = new URL(`/v1/projections/installations/${encodeURIComponent(target.installationId)}/operational-sources`, origin);
        url.search = new URLSearchParams({ accountId: target.accountId, tenantId: target.tenantId }).toString();
        const observe = async () => { if (!await (input.local ?? ((t,s)=>currentLocalSource(t,pgClient,sqlBudgetForSignal(s))))(target,signal))
            throw new PublisherError(403, 'operational_source_denied'); const token = await input.credential(signal); signal.throwIfAborted(); const response = await (input.request ?? fetch)(url, { method: 'GET', redirect: 'error', cache: 'no-store', signal, headers: { authorization: `Bearer ${token}`, accept: 'application/json' } }); if (response.status !== 200 || response.redirected)
            throw new PublisherError(503, 'operational_authority_unavailable'); const certificate = await readJson(response, signal); const schemas = validateSelectedCertificate(certificate, selection, 'supportv8'); const pin: OperationalProvenance = { contract: 'servicev8.operational-provenance.v1', ...selection, target: { kind: 'service', targetAppId: 'runtime' }, baseManifestDigest: certificate.baseManifestDigest, descriptorDigest: certificate.descriptorDigest, nativeBinding: { kind: 'support-permanent-tuple' } }; return { pin, schemas, certificate }; };
        const first = await observe(), current = await observe();
        if (canonicalJson(first.pin) !== canonicalJson(current.pin))
            throw new PublisherError(409, 'operational_provenance_conflict');
        if (!await (input.local ?? ((t,s)=>currentLocalSource(t,pgClient,sqlBudgetForSignal(s))))(target,signal))
            throw new PublisherError(403, 'operational_source_denied');
        signal.throwIfAborted();
        return current;
    };
}
let resolver: ReturnType<typeof sourceResolver> | undefined;
export function defaultSource(target: SourceTarget, signal: AbortSignal) { if (!resolver) {
    const env = process.env;
    const url = env.SUPPORT_OPERATIONAL_REGISTRY_URL, credential = credentialFromEnv('SUPPORT_OPERATIONAL_REGISTRY', 'servicev8-registry', 'registry:installations:read', env);
    if (!url || !credential)
        throw Error('signals_configuration_required');
    resolver = sourceResolver({ registryUrl: url, credential });
} return resolver(target, signal); }
export async function verifyOutboxSource(row: OutboxRow, signal: AbortSignal): Promise<boolean> { const { event, provenance } = parsePublication({ event: row.event, provenance: row.provenance }); if (provenance.productId !== 'servicev8.service-app.supportv8')
    return false; const current = await defaultSource(provenance, signal); if (canonicalJson(current.pin) !== canonicalJson(provenance))
    return false; validateDeclaredEvent(event, validateCertificate(current.certificate, provenance, 'supportv8')); return true; }
/** Called while the existing registration lease is held, outside SQL transactions. */
export async function qualifySupportSource(job: ManagedSupportRegistrationJob, worker: string, options: {
    client?: PostgresClient;
    resolve?: ReturnType<typeof sourceResolver>;
    enabled?: boolean;
    signal?:AbortSignal;
} = {}): Promise<void> {
    if (!(options.enabled ?? process.env.SUPPORT_OPERATIONAL_QUALIFICATION_ENABLED === 'true') || job.state !== 'ready' || job.desiredState === 'permanently_revoked')
        return;
    const client = options.client ?? pgClient, target = { accountId: job.accountId, tenantId: job.registryTenantId, installationId: job.installationId, workspaceId: job.workspaceId };
    const controller = operationalBudgetScope(10000,options.signal);
    try {
        const current = await (options.resolve ?? defaultSource)(target, controller.signal);
        validateCertificate(current.certificate, current.pin, 'supportv8');
        controller.signal.throwIfAborted();
        await client.withWorkspaceProvisioningSession({ tenantId: target.workspaceId, accountId: target.accountId, registryTenantId: target.tenantId }, db => db.query('select supportv8.qualify_operational_source($1,$2,$3,$4)', [worker, job.installationId, current.pin, current.certificate]),sqlBudgetForSignal(controller.signal));
        console.info('[Support operational qualification]', { code: 'qualification_observed' });
    }
    catch (error) {
        console.warn('[Support operational qualification]', { code: error instanceof PublisherError ? error.code : 'qualification_unavailable' });
    }
    finally {
        controller.dispose();
    }
}
