import { AsyncLocalStorage } from 'node:async_hooks';
import { Client, type ClientConfig, type PoolClient, type QueryResultRow } from 'pg';

/** Only new operational worker SQL opts in; native business sessions are unchanged. */
export type OperationalSqlBudget = { deadline: number; signal?: AbortSignal };
export type OperationalSqlPool = {
  connect(): Promise<Pick<PoolClient, 'query' | 'release'>>;
  readonly totalCount?: number;
  readonly idleCount?: number;
  readonly waitingCount?: number;
  readonly options?: { max?: number };
};
const connectingBudget = new AsyncLocalStorage<{budget:OperationalSqlBudget;constructing:boolean}>();
const signalDeadlines = new WeakMap<AbortSignal, number>();
const deadlineError = () => Error('operational_sql_deadline');
export function remainingSqlBudget(budget: OperationalSqlBudget): number {
  if (budget.signal?.aborted) throw deadlineError();
  const remaining = Math.floor(budget.deadline - Date.now());
  if (!Number.isFinite(remaining) || remaining < 1) throw deadlineError();
  return remaining;
}
export function sqlBudgetForSignal(signal?: AbortSignal, maxMs = 2000): OperationalSqlBudget {
  return { signal, deadline: Math.min(Date.now() + maxMs, signal ? signalDeadlines.get(signal) ?? Infinity : Infinity) };
}
export function operationalBudgetScope(maxMs: number, parent?: AbortSignal) {
  const controller = new AbortController();
  const deadline = Math.min(Date.now() + maxMs, parent ? signalDeadlines.get(parent) ?? Infinity : Infinity);
  signalDeadlines.set(controller.signal, deadline);
  const abort = () => controller.abort();
  parent?.addEventListener('abort', abort, { once: true });
  if (parent?.aborted) abort();
  const timer = setTimeout(abort, Math.max(0, deadline - Date.now()));
  return { deadline, signal: controller.signal, dispose() { clearTimeout(timer); parent?.removeEventListener('abort', abort); controller.abort(); } };
}

/** Public pg Client factory. ALS surrounds connect only, never native SQL work.
 * Refuse queued checkout below so a later unrelated release cannot construct a
 * socket outside its original budget context. No pg-pool private state changes.
 */
export class OperationalPgClient extends Client {
  constructor(config: ClientConfig = {}) {
    const context = connectingBudget.getStore();
    const budget = context?.constructing ? context.budget : undefined;
    const remaining = budget ? remainingSqlBudget(budget) : undefined;
    super(remaining === undefined ? config : { ...config, connectionTimeoutMillis: Math.min(config.connectionTimeoutMillis || remaining, remaining) });
    if (!budget) return;
    const abort = () => { this.connection.stream.destroy(deadlineError()); };
    const timer = setTimeout(abort, remaining!);
    const cleanup = () => { clearTimeout(timer); budget.signal?.removeEventListener('abort', abort); this.removeListener('connect', cleanup); this.removeListener('end', cleanup); };
    budget.signal?.addEventListener('abort', abort, { once: true });
    this.once('connect', cleanup);
    this.once('end', cleanup);
    if (budget.signal?.aborted) abort();
  }
}

async function acquire(pool: OperationalSqlPool, budget: OperationalSqlBudget) {
  remainingSqlBudget(budget);
  if ((pool.waitingCount ?? 0) > 0 || (pool.totalCount !== undefined && pool.idleCount === 0 && pool.totalCount >= (pool.options?.max ?? 10)))
    throw Error('operational_sql_pool_busy');
  return new Promise<Pick<PoolClient, 'query' | 'release'>>((resolve, reject) => {
    let settled = false;
    const cleanup = () => { clearTimeout(timer); budget.signal?.removeEventListener('abort', abort); };
    const abort = () => { if (!settled) { settled = true; cleanup(); reject(deadlineError()); } };
    const timer = setTimeout(abort, remainingSqlBudget(budget));
    budget.signal?.addEventListener('abort', abort, { once: true });
    if (budget.signal?.aborted) { abort(); return; }
    // Real production pools use the budget-aware factory above. If an injected
    // pool returns a delayed checkout, destroy it instead of leaking/reusing it.
    try {
      const context={budget,constructing:true};
      let connection:ReturnType<OperationalSqlPool["connect"]>;
      try { connection=connectingBudget.run(context,()=>pool.connect()); }
      finally { context.constructing=false; }
      connection.then(client => {
        if (settled) { client.release(true); return; }
        try { remainingSqlBudget(budget); } catch { client.release(true); abort(); return; }
        settled = true; cleanup(); resolve(client);
      }, error => { if (!settled) { settled = true; cleanup(); reject(error); } });
    } catch (error) { settled = true; cleanup(); reject(error); }
  });
}

/** Actual cancellation destroys the borrowed connection; no bare promise race.
 * All server limits are SET LOCAL, safe with PgBouncer transaction pooling.
 */
export async function withOperationalSql<T>(pool: OperationalSqlPool, budget: OperationalSqlBudget,
  work: (query: <R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]) => Promise<R[]>) => Promise<T>): Promise<T> {
  const client = await acquire(pool, budget);
  let released = false;
  const release = (destroy: boolean) => { if (!released) { released = true; client.release(destroy); } };
  const abort = () => release(true);
  const timer = setTimeout(abort, Math.max(1, budget.deadline - Date.now()));
  budget.signal?.addEventListener('abort', abort, { once: true });
  const raw = async <R extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<R[]> => {
    remainingSqlBudget(budget);
    if (released) throw deadlineError();
    try { return (await client.query<R>({ text, values })).rows; }
    catch (error) { release(true); throw error; }
  };
  const query = async <R extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) => {
    const remaining = remainingSqlBudget(budget);
    await raw("SELECT set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true)", [String(remaining), String(Math.min(1000, remaining))]);
    return raw<R>(text, values);
  };
  try {
    if (budget.signal?.aborted) { abort(); throw deadlineError(); }
    await raw('BEGIN');
    const result = await work(query);
    await raw('COMMIT');
    return result;
  } catch (error) { release(true); throw error; }
  finally { clearTimeout(timer); budget.signal?.removeEventListener('abort', abort); release(false); }
}
