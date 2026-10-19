import {pgClient} from '@/lib/db/pg-client';
import {sqlBudgetForSignal} from '@/lib/db/operational-sql-budget';
import { credentialFromEnv, endpoint, readJson, type Credential } from './operational-workload';
import { publisherAudience, publisherScope, PublisherError } from './operational-contract';
import { currentLocalSource } from './operational-source';
import type { OutboxRow } from './operational-outbox';
let credential: Credential | undefined;
export async function sendOperationalFact(row: OutboxRow, signal: AbortSignal): Promise<{
    status: number;
    body: unknown;
}> {
    const env = process.env;
    if (env.SUPPORT_OPERATIONAL_PUBLISHER_ENABLED !== 'true')
        throw Error('signals_configuration_required');
    const origin = endpoint(env.SUPPORT_OPERATIONAL_RUNTIME_URL ?? '');
    if (origin.pathname !== '/')
        throw Error('signals_configuration_required');
    credential ??= credentialFromEnv('SUPPORT_OPERATIONAL_RUNTIME', publisherAudience, publisherScope, env);
    if (!credential)
        throw Error('signals_configuration_required');
    const token = await credential(signal);
    if (!await currentLocalSource(row.provenance,pgClient,sqlBudgetForSignal(signal)))
        throw Error('operational_source_denied');
    signal.throwIfAborted();
    const response = await fetch(new URL('/api/signals/operational/intake', origin), { method: 'POST', redirect: 'error', cache: 'no-store', signal, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ event: row.event, provenance: row.provenance }) });
    if (response.status !== 200 && response.status !== 202)
        throw new PublisherError(response.status, [400, 413].includes(response.status) ? 'invalid_operational_event' : response.status === 409 ? 'operational_provenance_conflict' : response.status === 403 ? 'operational_source_denied' : 'delivery_unavailable');
    return { status: response.status, body: await readJson(response, signal, 8192) };
}
