import { describe, it, expect, vi } from 'vitest';
import { relayQuery } from '@/lib/chat/relay-query';

function fixture(failAt?: string, rollbackFails = false) {
  const client = { query: vi.fn(async (sql: string) => {
    if (sql === failAt || (rollbackFails && sql === 'ROLLBACK')) throw new Error('database failure');
    return { rows: sql === 'SELECT $1 AS value' ? [{ value: 7 }] : [] };
  }), release: vi.fn() };
  const pool = { connect: vi.fn(async () => client) };
  return { client, pool };
}
describe('relay queries through transaction-pooled PgBouncer', () => {
  it('commits before returning rows with a transaction-local server timeout', async () => {
    const { client, pool } = fixture();
    expect(await relayQuery(pool as never, 'SELECT $1 AS value', [7])).toEqual({ rows: [{ value: 7 }] });
    expect(client.query.mock.calls).toEqual([['BEGIN'], ["SET LOCAL statement_timeout = '5s'"], ['SELECT $1 AS value', [7]], ['COMMIT']]);
    expect(client.release).toHaveBeenCalledTimes(1); expect(client.release).toHaveBeenCalledWith(false);
  });
  it.each(['BEGIN', "SET LOCAL statement_timeout = '5s'", 'SELECT $1 AS value', 'COMMIT'])('rolls back and releases after %s fails', async failAt => {
    const { client, pool } = fixture(failAt);
    await expect(relayQuery(pool as never, 'SELECT $1 AS value', [7])).rejects.toThrow('database failure');
    expect(client.query.mock.calls.at(-1)).toEqual(['ROLLBACK']);
    expect(client.release).toHaveBeenCalledTimes(1); expect(client.release).toHaveBeenCalledWith(false);
  });
  it('discards a connection when rollback fails', async () => {
    const { client, pool } = fixture('SELECT $1 AS value', true);
    await expect(relayQuery(pool as never, 'SELECT $1 AS value', [7])).rejects.toThrow('database failure');
    expect(client.release).toHaveBeenCalledTimes(1); expect(client.release).toHaveBeenCalledWith(true);
  });
  it('does not invent a client after pool acquisition fails', async () => {
    const pool = { connect: vi.fn().mockRejectedValue(new Error('pool timeout')) };
    await expect(relayQuery(pool as never, 'SELECT 1')).rejects.toThrow('pool timeout');
  });
});
