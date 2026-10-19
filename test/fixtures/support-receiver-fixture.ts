/** Owned synthetic SQL receiver only. This is not Runtime admission/normalization. */
import type { Pool } from 'pg';
import type { OutboxRow } from '@/lib/signals/operational-outbox';
export async function recordFixtureReceipt(pool: Pool, row: OutboxRow) {
    const client = await pool.connect();
    try {
        await client.query('begin');
        const receipt = { ok: true, duplicate: false, receiptId: 'receipt-' + row.event.id, inputDigest: row.input_digest, tenantId: row.provenance.tenantId, accountId: row.provenance.accountId, sourceBinding: row.event.source, sourceEventId: row.event.id, eventType: row.event.type, subject: row.event.subject, receivedAt: new Date().toISOString(), status: 'accepted' };
        const inserted = await client.query('insert into support_receiver_fixture.receipts(event_id,digest,pin,ack) values($1,$2,$3,$4) on conflict(event_id) do nothing returning event_id', [row.event.id, row.input_digest, row.provenance, receipt]);
        const saved = (await client.query('select * from support_receiver_fixture.receipts where event_id=$1', [row.event.id])).rows[0];
        if (saved.digest !== row.input_digest || JSON.stringify(saved.pin) !== JSON.stringify(JSON.parse(JSON.stringify(row.provenance)))) {
            // JSONB key order must be compared structurally rather than serialized order.
            const { canonicalJson } = await import('@/lib/signals/operational-contract');
            if (saved.digest !== row.input_digest || canonicalJson(saved.pin) !== canonicalJson(row.provenance))
                throw Error('fixture_identity_conflict');
        }
        await client.query('insert into support_receiver_fixture.normalized(event_id) values($1) on conflict do nothing', [row.event.id]);
        await client.query('commit');
        const duplicate = inserted.rowCount === 0;
        return { status: duplicate ? 200 : 202, body: { ...saved.ack, duplicate, status: duplicate ? 'duplicate' : 'accepted' } };
    }
    catch (error) {
        await client.query('rollback');
        throw error;
    }
    finally {
        client.release();
    }
}
