#!/usr/bin/env tsx
/**
 * SupportV8 TasksV8 Escalation Link Seeder (UAT Fixture).
 *
 * Usage:
 *   npx tsx scripts/uat/seed-tasksv8-link.ts --tenant <tenantId> --ticket <ticketId> [--summary <summary>]
 */
import { PostgresClient } from '../../src/lib/db/pg-client';
import { PostgresTasksv8Store } from '../../src/lib/tasksv8/store';

interface ParsedArgs {
  tenantId: string;
  ticketId: string;
  summary?: string;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: Partial<ParsedArgs> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--tenant' && i + 1 < args.length) {
      result.tenantId = args[++i];
    } else if (arg === '--ticket' && i + 1 < args.length) {
      result.ticketId = args[++i];
    } else if (arg === '--summary' && i + 1 < args.length) {
      result.summary = args[++i];
    }
  }

  if (!result.tenantId) {
    console.error('Missing required argument: --tenant <tenantId>');
    process.exit(1);
  }
  if (!result.ticketId) {
    console.error('Missing required argument: --ticket <ticketId>');
    process.exit(1);
  }

  return result as ParsedArgs;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let tenantId = args.tenantId;
  if (!tenantId.startsWith('tenant_')) {
    tenantId = `tenant_${tenantId.replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`;
  }

  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.SUPPORTV8_DATABASE_URL ||
    'postgres://localhost:5432/support_records_review_test';

  const client = new PostgresClient(databaseUrl);
  const store = new PostgresTasksv8Store(client);

  try {
    // 1. Ensure issue exists in supportv8.issues (if table exists)
    await client.withTenantSession(tenantId, async (db) => {
      await db.query(
        `INSERT INTO supportv8.issues (
           id, tenant_id, source_status, priority, summary,
           created_at, updated_at
         ) VALUES ($1, $2, 'open', 'high', $3, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [args.ticketId, tenantId, args.summary ?? `Escalation ${args.ticketId}`]
      ).catch(() => {
        // Table may have different schema or be managed separately
      });
    });

    // 2. Record escalation link and outbox entry
    const { link, outboxItem } = await store.recordEscalation(
      { tenantId, accountId: `${tenantId}-account` },
      { id: args.ticketId, summary: args.summary ?? `Escalation ${args.ticketId}` }
    );

    const output = {
      ok: true,
      tenantId,
      ticketId: args.ticketId,
      link,
      outboxEventId: outboxItem.eventId,
    };

    console.log(JSON.stringify(output, null, 2));
  } finally {
    const pool = (client as any).pool;
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  }
}

main().catch((err) => {
  console.error('seed-tasksv8-link error:', err);
  process.exit(1);
});
