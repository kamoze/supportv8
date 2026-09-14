import type { Pool, QueryResult, QueryResultRow } from 'pg';

/** PgBouncer accepts the connection; the transaction owns the server timeout. */
export async function relayQuery<Row extends QueryResultRow = QueryResultRow>(
  pool: Pool, text: string, values: unknown[] = [],
): Promise<QueryResult<Row>> {
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '5s'");
    const result = await client.query<Row>(text, values);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { discard = true; }
    throw error;
  } finally {
    client.release(discard);
  }
}
