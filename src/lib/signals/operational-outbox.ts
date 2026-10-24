import {OperationalPgClient,withOperationalSql,sqlBudgetForSignal,operationalBudgetScope,type OperationalSqlBudget} from '@/lib/db/operational-sql-budget';
import { Pool, type QueryResultRow } from 'pg';
import { descriptorDigest, exact, parsePublication, PublisherError, type CloudEventInput } from './operational-contract';
import type { OperationalProvenance } from './operational-provenance';
export const inputDigest = descriptorDigest;
export type OutboxRow = QueryResultRow & {
    id: string;
    native_workspace_id: string;
    event: CloudEventInput;
    input_digest: string;
    provenance: OperationalProvenance;
    lease_owner: string;
    lease_generation: string;
    lease_token: string;
    attempt_count: number;
};
export function validateReceipt(status: number, body: unknown, event: CloudEventInput, pin: Pick<OperationalProvenance, 'accountId' | 'tenantId'>): Record<string, unknown> {
    const duplicate = status === 200;
    const identity = { tenantId: pin.tenantId, accountId: pin.accountId, sourceBinding: event.source, sourceEventId: event.id, eventType: event.type, subject: event.subject };
    if ((status !== 200 && status !== 202) || !exact(body, ['ok', 'duplicate', 'receiptId', 'inputDigest', 'tenantId', 'accountId', 'sourceBinding', 'sourceEventId', 'eventType', 'subject', 'receivedAt', 'status']) || body.ok !== true || body.duplicate !== duplicate || body.status !== (duplicate ? 'duplicate' : 'accepted') || typeof body.receiptId !== 'string' || !body.receiptId.trim() || body.receiptId.length > 512 || /[\x00-\x1f\x7f]/.test(body.receiptId) || body.inputDigest !== inputDigest(event) || typeof body.receivedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.test(body.receivedAt) || !Number.isFinite(Date.parse(body.receivedAt)) || Object.entries(identity).some(([k, v]) => body[k] !== v))
        throw Error('signals_invalid_receipt');
    return body;
}
export class OperationalOutboxStore {
    private readonly pool: Pool;
    private readonly owned: boolean;
    constructor(pool: Pool | string = process.env.DATABASE_URL ?? '') { this.owned = typeof pool === 'string'; if (typeof pool === 'string' && !pool)
        throw Error('DATABASE_URL is required'); this.pool = typeof pool === 'string' ? new Pool({ connectionString: pool, max: 4, connectionTimeoutMillis: 1000, Client:OperationalPgClient, allowExitOnIdle: process.env.NODE_ENV === 'test' }) : pool; }
    async claim(owner: string, limit = 8, budget:OperationalSqlBudget=sqlBudgetForSignal()): Promise<OutboxRow[]> { return withOperationalSql(this.pool,budget,query=>query<OutboxRow>('select * from supportv8.claim_operational_outbox($1,$2)',[owner,limit])); }
    async finish(row: OutboxRow, result: 'retry' | 'delivered' | 'quarantined', code: string | null, ack: Record<string, unknown> | null = null, httpStatus: number | null = null,budget:OperationalSqlBudget=sqlBudgetForSignal()) { await withOperationalSql(this.pool,budget,query=>query('select supportv8.finish_operational_outbox($1,$2,$3,$4,$5,$6,$7,$8)', [row.id, row.lease_owner, row.lease_generation, row.lease_token, result, code, ack, httpStatus])); }
    async close() { if (this.owned)
        await this.pool.end(); }
}
export type DeliveryOptions = {
    store: OperationalOutboxStore;
    enabled: boolean;
    limit?: number;
    owner?: string;
    signal?: AbortSignal;
    verify: (row: OutboxRow, signal: AbortSignal) => Promise<boolean>;
    send: (row: OutboxRow, signal: AbortSignal) => Promise<{
        status: number;
        body: unknown;
    }>;
};
/** Bounded shared worker batch. Only the current lease can record ACK or failure. */
export async function drainOperationalOutbox(options: DeliveryOptions): Promise<{
    claimed: number;
    delivered: number;
    retried: number;
}> {
    const counts = { claimed: 0, delivered: 0, retried: 0 };
    if (!options.enabled)
        return counts;
    const activity = operationalBudgetScope(20000, options.signal);
    try {
    const rows = await options.store.claim(options.owner ?? `support-outbox:${crypto.randomUUID()}`, options.limit ?? 8, sqlBudgetForSignal(activity.signal));
    counts.claimed = rows.length;
    // A claim is 30 seconds; all bounded 10-second attempts start together.
    await Promise.all(rows.map(async (row) => {
        let code = 'delivery_unavailable';
        const attempt = operationalBudgetScope(10000,activity.signal);
        const controller = attempt;
        try {
            const publication = parsePublication({ event: row.event, provenance: row.provenance });
            if (publication.provenance.productId !== 'servicev8.service-app.supportv8' || inputDigest(publication.event) !== row.input_digest)
                throw Error('invalid_persisted_event');
            if (!await options.verify(row, controller.signal))
                code = 'operational_source_denied';
            else {
                const response = await options.send(row, controller.signal);
                controller.signal.throwIfAborted();
                const ack = validateReceipt(response.status, response.body, row.event, row.provenance);
                await options.store.finish(row, 'delivered', null, ack, response.status,sqlBudgetForSignal(attempt.signal));
                counts.delivered++;
                return;
            }
        }
        catch (error) {
            code = error instanceof PublisherError ? (error.status === 400 ? 'invalid_persisted_event' : error.status === 409 ? 'provenance_conflict' : error.code) : error instanceof Error && ['signals_invalid_receipt', 'invalid_persisted_event'].includes(error.message) ? error.message : 'delivery_unavailable';
        }
        finally {
            attempt.dispose();
        }
        await options.store.finish(row, ['invalid_persisted_event', 'provenance_conflict'].includes(code) ? 'quarantined' : 'retry', code,null,null,sqlBudgetForSignal(activity.signal)).catch(() => { code = 'lease_lost'; });
        counts.retried++;
    }));
    console.info('[Support operational outbox]', counts);
    return counts;
    } finally { activity.dispose(); }
}
