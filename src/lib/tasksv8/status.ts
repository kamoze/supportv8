import type { PostgresClient } from '../db/pg-client';
import { taskWorkFact, type TaskWorkOutboxRow } from './store';
import type { TaskWorkSourceFact } from './policy';

export type TaskWorkReadScope = { tenantId: string; accountId: string; registryTenantId: string };

/** Read one ticket and at most its latest native request, under the normal forced-RLS session. */
export async function readSupportTaskWorkStatus(client: PostgresClient, scope: TaskWorkReadScope, issueId: string) {
  const rows = await client.withWorkspaceProvisioningSession(scope, db => db.query<{
    snapshot: unknown; native_row: TaskWorkOutboxRow | null; current: boolean; status: unknown;
  }>(`
    SELECT jsonb_build_object('id',i.id,'summary',i.summary,'status',i.source_status,'priority',i.priority,'updatedAt',i.updated_at) snapshot,
      to_jsonb(o) native_row, (o.id IS NULL OR EXISTS(SELECT 1 FROM supportv8.task_work_fact(o.id))) current,
      CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object(
        'requestId',o.id,'sourceRevision',o.source_revision,'workId',o.work_id,
        'intake',jsonb_build_object('eventId',o.event->>'id','state',o.state,'receipt',o.receipt),
        'outcome',CASE WHEN r.receipt_id IS NULL THEN NULL ELSE jsonb_build_object(
          'eventId',r.event_id,'receipt',jsonb_build_object('receiptId',r.receipt_id,'eventId',r.event_id,
            'state','recorded','scope',jsonb_build_object('accountId',r.account_id,'tenantId',r.registry_tenant_id),
            'workId',r.work_id,'payloadDigest',r.payload_digest)) END) END status
    FROM supportv8.issues i
    LEFT JOIN LATERAL (SELECT * FROM supportv8.task_work_outbox
      WHERE native_workspace_id=i.tenant_id AND issue_id=i.id AND account_id=$3 AND registry_tenant_id=$4
      ORDER BY source_revision DESC LIMIT 1) o ON true
    LEFT JOIN supportv8.task_work_outcomes r ON r.intake_id=o.id AND r.native_workspace_id=o.native_workspace_id
      AND r.account_id=o.account_id AND r.registry_tenant_id=o.registry_tenant_id AND r.work_id=o.work_id
    WHERE i.id=$1 AND i.tenant_id=$2`, [issueId, scope.tenantId, scope.accountId, scope.registryTenantId]));
  if (rows.length !== 1) return null;
  const row = rows[0];
  if (!row.current) throw Object.assign(Error('task_work_source_changed'), { code: '42501' });
  const fact: TaskWorkSourceFact | null = row.native_row ? taskWorkFact(row.native_row) : null;
  return { ticket: row.snapshot, taskWork: row.status, fact };
}
