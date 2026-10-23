#!/usr/bin/env tsx
/**
 * SupportV8 TasksV8 Outcome Receipt & Link Query CLI (UAT Fixture).
 *
 * Usage:
 *   npx tsx scripts/uat/query-tasksv8-receipt.ts --tenant <tenantId> --event <eventId> [--ticket <ticketId>]
 */
import { PostgresClient } from '../../src/lib/db/pg-client';
import { PostgresTasksv8Store } from '../../src/lib/tasksv8/store';

interface ParsedArgs {
  tenantId: string;
  eventId?: string;
  ticketId?: string;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: Partial<ParsedArgs> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--tenant' && i + 1 < args.length) {
      result.tenantId = args[++i];
    } else if ((arg === '--event' || arg === '--eventId') && i + 1 < args.length) {
      result.eventId = args[++i];
    } else if ((arg === '--ticket' || arg === '--ticketId') && i + 1 < args.length) {
      result.ticketId = args[++i];
    }
  }

  if (!result.tenantId) {
    console.error('Missing required argument: --tenant <tenantId>');
    process.exit(1);
  }
  if (!result.eventId && !result.ticketId) {
    console.error('At least one of --event <eventId> or --ticket <ticketId> is required');
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
    let receipt = null;
    let link = null;

    if (args.eventId) {
      receipt = await store.outcomeReceipt(tenantId, args.eventId);
    }

    if (args.ticketId) {
      link = await store.getLink({ tenantId }, args.ticketId);
    } else if (receipt && receipt.payload && receipt.payload.data) {
      const sourceRef = receipt.payload.data.sourceReferences?.find((r: any) => r.system === 'supportv8');
      const ticketId = sourceRef?.recordId;
      if (ticketId) {
        link = await store.getLink({ tenantId }, ticketId);
      }
    }

    if (!receipt && !link) {
      console.error(`Outcome receipt or link not found for tenant=${tenantId} event=${args.eventId ?? 'any'} ticket=${args.ticketId ?? 'any'}`);
      process.exit(1);
    }

    console.log(JSON.stringify({ ok: true, receipt, link }, null, 2));
  } finally {
    const pool = (client as any).pool;
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  }
}

main().catch((err) => {
  console.error('query-tasksv8-receipt error:', err);
  process.exit(1);
});
