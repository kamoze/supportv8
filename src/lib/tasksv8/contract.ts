export function exact(v:unknown, keys:readonly string[]):v is Record<string,unknown> {return !!v && typeof v==='object' && !Array.isArray(v) && Object.keys(v).length===keys.length && keys.every(k=>Object.hasOwn(v,k));}
export function identifier(v:unknown):v is string {return typeof v==='string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/.test(v);}
function timestamp(v:unknown):v is string {return typeof v==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString()===v;}

/** Closed native lifecycle facts; these operations never authorize execution. */
export const taskWorkProfile = 'servicev8.task-work.v1';
export const taskWorkActor = { type: 'system_automation', id: 'tasks-work-lifecycle' } as const;
export const taskWorkOperations = {
  support_intake: { producer: 'supportv8', audience: 'servicev8-tasks', scope: 'tasks:work-intake', sourceSystem: 'supportv8' },
  dominion_intake: { producer: 'dominion', audience: 'servicev8-tasks', scope: 'tasks:work-intake', sourceSystem: 'dominion' },
  dominion_verification: { producer: 'dominion', audience: 'servicev8-tasks', scope: 'tasks:verification-events', sourceSystem: 'dominion' },
  support_outcome: { producer: 'tasks', audience: 'supportv8', scope: 'supportv8:task-outcomes', sourceSystem: 'supportv8' },
  dominion_outcome: { producer: 'tasks', audience: 'dominion', scope: 'dominion:task-outcomes', sourceSystem: 'dominion' },
} as const;
export type TaskWorkOperation = keyof typeof taskWorkOperations;
export type TaskWorkSelector = { operation: TaskWorkOperation; provenanceRef: string };
export type TaskWorkRequest = TaskWorkSelector & { schemaVersion: 1; correlationId: string };
export type TaskWorkBinding = TaskWorkSelector & {
  profile: typeof taskWorkProfile; accountId: string; tenantId: string; sourceSystem: 'supportv8' | 'dominion';
  sourceRecordId: string; sourceRevision: number; workId: string | null; eventId: string; payloadDigest: string;
};
export type TaskWorkPolicy = TaskWorkBinding & { evaluatedAt: string; expiresAt: string };
const bindingKeys = ['profile','operation','provenanceRef','accountId','tenantId','sourceSystem','sourceRecordId','sourceRevision','workId','eventId','payloadDigest'] as const;
export const taskWorkUuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
function operation(v: unknown): v is TaskWorkOperation { return typeof v === 'string' && Object.hasOwn(taskWorkOperations,v); }
export function parseTaskWorkRequest(v: unknown): TaskWorkRequest | null {
  if (!exact(v,['schemaVersion','operation','provenanceRef','correlationId']) || v.schemaVersion!==1 || !operation(v.operation) || !taskWorkUuid(v.provenanceRef) || !identifier(v.correlationId)) return null;
  return { schemaVersion:1, operation:v.operation, provenanceRef:v.provenanceRef, correlationId:v.correlationId };
}
export function parseTaskWorkBinding(v: unknown): TaskWorkBinding | null {
  if (!exact(v,bindingKeys) || v.profile!==taskWorkProfile || !operation(v.operation) || !taskWorkUuid(v.provenanceRef)
    || !['accountId','tenantId','sourceRecordId','eventId'].every(k=>identifier(v[k]))
    || v.sourceSystem!==taskWorkOperations[v.operation].sourceSystem || !Number.isSafeInteger(v.sourceRevision) || Number(v.sourceRevision)<0
    || (v.workId===null ? !v.operation.endsWith('_intake') : !identifier(v.workId))
    || typeof v.payloadDigest!=='string' || !/^[a-f0-9]{64}$/.test(v.payloadDigest) || /^0+$/.test(v.payloadDigest)) return null;
  return structuredClone(v) as TaskWorkBinding;
}
export function taskWorkBinding(p: TaskWorkPolicy): TaskWorkBinding { return Object.fromEntries(bindingKeys.map(k=>[k,p[k]])) as TaskWorkBinding; }
export function parseTaskWorkPolicy(v: unknown, selector: TaskWorkSelector, now=Date.now()): TaskWorkPolicy | null {
  if (!exact(v,[...bindingKeys,'evaluatedAt','expiresAt']) || v.operation!==selector.operation || v.provenanceRef!==selector.provenanceRef
    || !parseTaskWorkBinding(Object.fromEntries(bindingKeys.map(k=>[k,v[k]]))) || !timestamp(v.evaluatedAt) || !timestamp(v.expiresAt)
    || Date.parse(v.evaluatedAt)>now || Date.parse(v.expiresAt)<=now || Date.parse(v.expiresAt)<=Date.parse(v.evaluatedAt)
    || Date.parse(v.expiresAt)-Date.parse(v.evaluatedAt)>30000) return null;
  return structuredClone(v) as TaskWorkPolicy;
}
