import { Pool } from 'pg';
import { OperationalOutboxStore, drainOperationalOutbox } from '@/lib/signals/operational-outbox';
import { recordFixtureReceipt } from './support-receiver-fixture';
const pool = new Pool({ connectionString: process.argv[2] });
const mode = process.argv[3];
class CrashStore extends OperationalOutboxStore {
    override async finish(...args: Parameters<OperationalOutboxStore['finish']>) { if (mode === 'after-ack' && args[1] === 'delivered')
        process.exit(74); return super.finish(...args); }
}
await drainOperationalOutbox({ store: new CrashStore(pool), enabled: true, limit: 1, owner: 'crashing-worker', verify: async () => true, send: async (row) => { if (mode === 'before-receipt')
        process.exit(72); const receipt = await recordFixtureReceipt(pool, row); if (mode === 'after-receipt')
        process.exit(73); return receipt; } });
await pool.end();
