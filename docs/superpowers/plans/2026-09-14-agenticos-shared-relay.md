# AgenticOS Shared Relay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Runtime's reference-only notifications through the existing SupportV8 relay with independent source progress and scoped credentials.

**Architecture:** Add a dedicated Runtime SQL adapter and Redis publisher, then run it beside the existing Support adapter in the same worker. PostgreSQL leases remain authoritative; Redis only signals saved changes. All new Runtime behavior is explicitly enabled.

**Tech Stack:** Existing TypeScript, pg, ioredis, Vitest, Node HTTP.

**Spec:** `docs/superpowers/specs/2026-09-14-agenticos-shared-relay.md`

## Global Constraints

- Preserve SupportV8 wire format and channels; no new dependencies or deployments.
- Runtime credentials are separate and opt-in; no Support credential fallback.
- Runtime SQL pool max1; connection timeout5000ms, statement timeout5000ms, query timeout6000ms.
- Exact notification: `{eventId,threadId,sequence,eventType}`; canonical decimal string sequence at most9223372036854775807.
- Exact stream/channel namespace: `sv8:chat:{stream|live}:v1:agenticos:<scopeHash>`.
- Atomic MULTI/EXEC: XADD MAXLEN ~1000; EXPIRE86400; PUBLISH. Check all results before completing the lease.
- Independent loops, one batch in flight per source; Runtime default25/max100; empty delay250ms; error delay1000ms; readiness any successful source within30seconds; bounded shutdown10seconds.
- No raw errors, credentials, transcripts or execution claims in notifications/logs.

## File structure

Create `src/lib/chat/runtime-outbox-store.ts` for Runtime SQL mapping and validation; `runtime-realtime.ts` for scoped atomic publication; `runtime-relay.ts` for Runtime batch processing; `relay-runner.ts` for configuration, independently progressing loops and health/lifecycle. Modify `relay-worker.ts` to wire both sources and HTTP health. Touch existing outbox-store only if necessary to bound cleanup/query behavior; retain Support contracts. Add focused tests in `test/runtime-chat-relay.test.ts`, `test/chat-relay-runner.test.ts`, and opt-in `test/runtime-chat-redis-integration.test.ts`. Document configuration and real versus unverified evidence in `docs/agenticos-chat-relay.md`.

### Task 1: Runtime adapter and independent shared worker

**Interfaces:**

```ts
interface RuntimeDeliveryEvent {
  eventId: string; threadId: string; sequence: string; eventType: string;
  scopeHash: string; leaseId: string;
}
interface RuntimeDeliveryStore {
  claim(limit: number): Promise<RuntimeDeliveryEvent[]>;
  complete(eventId: string, leaseId: string): Promise<boolean>;
  fail(eventId: string, leaseId: string): Promise<boolean>;
  close(): Promise<void>;
}
interface RelayBatchResult { claimed: number; delivered: number; failed: number }
interface RelayAdapter {
  name: 'supportv8' | 'agenticos';
  process(): Promise<RelayBatchResult>;
  close(): Promise<void>;
}
```

Export `PostgresRuntimeDeliveryStore`, `RedisRuntimePublisher`, `processRuntimeDeliveryBatch(store,publisher,limit=25)` and testable runner/config helpers. Exact helper naming is local to this task; report exported names for downstream use. Use injected pg/Redis clients or factories for deterministic tests without adding dependencies.

- [ ] Write focused failing tests for the spec contract. Core examples:

```ts
expect(JSON.parse(redisPayload)).toEqual({eventId,threadId,sequence:'9007199254740993',eventType:'message.created'});
expect(store.completed).toEqual([]); // when any EXEC command failed
expect(result.delivered).toBe(0); // when DB completion returns false
// Start both loops, hold source A's promise unresolved, allow B two attempts,
// then assert B advanced while A still has exactly one attempt in flight.
```

Run `npx vitest run test/runtime-chat-relay.test.ts test/chat-relay-runner.test.ts`; record expected failures before implementing.

- [ ] Implement strict SQL mapping with parameterized fixed function calls and private pool. Validate event types/IDs/sequence/hash before publication; reject malformed rows without emitting their contents. No query of transcript tables.

```ts
await pool.query('SELECT * FROM runtime_chat.claim_delivery($1)', [limit]);
await pool.query('SELECT runtime_chat.complete_delivery($1,$2) AS completed', [eventId,leaseId]);
await pool.query('SELECT runtime_chat.fail_delivery($1,$2) AS failed', [eventId,leaseId]);
```

- [ ] Implement the publisher and batch semantics. Select only four payload fields explicitly (never spread the claim). Validate config/db0, use specified ACL-compatible options, inspect every EXEC reply. On failure attempt guarded fail and continue; false completion cannot increment delivered.

```ts
const payload = JSON.stringify({eventId:event.eventId,threadId:event.threadId,sequence:event.sequence,eventType:event.eventType});
const replies = await redis.multi()
  .xadd(stream, 'MAXLEN', '~', 1000, '*', 'event', payload)
  .expire(stream, 86400)
  .publish(channel, payload).exec();
```

- [ ] Implement independent loop runner/config/health and wire existing worker. Start loops together rather than awaiting batches serially. Expose clock/sleep seams for deterministic failure/health tests; ensure shutdown stops new claims and bounds resource closure. Enabled Runtime missing/invalid config is a startup error with fixed message. Disabled Runtime creates no clients. Preserve Support publisher/store interface and existing Support tests.

```ts
const running = adapters.map(adapter => runAdapter(adapter, signal));
await Promise.allSettled(running);
```

- [ ] Add and run real isolated Redis integration. Subscribe before publish, inspect stream event and TTL, publish same event twice to represent crash-before-ack; assert one stable eventId in both copies, exact four fields, and no execution interaction. Opt-in URL must be explicit and never auto-read production CHAT_REDIS_URL. Use local Redis process or root-provided isolated service; document command and cleanup. Unit tests additionally inject partial/null/error EXEC and stale DB acknowledgment.
- [ ] Run focused tests during iteration; then `npm test` and `npm run typecheck` once on completed change. Include exact counts/skips and real Redis evidence in report. Read own diff for secret leaks and scope creep. Update docs, commit all implementation changes, and report. Do not push, merge, deploy, mutate production, or spawn child agents.
