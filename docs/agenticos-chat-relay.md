# AgenticOS in the shared chat relay

The existing SupportV8 relay worker now runs an independent AgenticOS notification loop when explicitly enabled. PostgreSQL remains authoritative for delivery leases and durable conversation sequences. This change does not activate Runtime in production or implement Runtime SSE/browser recovery.

## Configuration

SupportV8 continues using `DATABASE_URL`, `CHAT_REDIS_URL`, and `CHAT_RELAY_BATCH_SIZE` (default 100, range 1–200). `HEALTH_PORT` defaults to 8081. Each empty batch sleeps 250 ms; a failed batch or claim sleeps 1000 ms. `CHAT_RELAY_IDLE_DELAY_MS` is no longer used.

| Variable | Requirement |
| --- | --- |
| `RUNTIME_CHAT_RELAY_ENABLED` | Omit or set `false` to disable; set exactly `true` to enable. Other values fail startup. |
| `RUNTIME_CHAT_RELAY_DATABASE_URL` | Required when enabled; separate restricted Runtime relay credential, through shared PgBouncer in production. |
| `RUNTIME_CHAT_REDIS_PUBLISH_URL` | Required when enabled; separate Runtime publisher ACL credential, `redis://` or `rediss://`, DB 0 only. Query parameters and fragments are rejected so they cannot override Redis client options. |
| `RUNTIME_CHAT_RELAY_BATCH_SIZE` | Optional, default 25, integer 1–100 when enabled. |

Disabled Runtime constructs no Runtime clients and does not require its credentials. No SupportV8 credential fallback exists. Invalid enabled configuration fails before constructing clients, with a fixed, secret-free startup error.

Runtime PostgreSQL uses one connection, a 5-second connection timeout, a 5-second statement timeout, and a 6-second query timeout. The application name is `agenticos-chat-relay`. Database URL parameters cannot override these bounds or the application name; transport settings such as `sslmode=require` remain allowed. Its only SQL calls are:

```sql
SELECT * FROM runtime_chat.claim_delivery($1);
SELECT runtime_chat.complete_delivery($1,$2) AS completed;
SELECT runtime_chat.fail_delivery($1,$2) AS failed;
```

Grant only schema USAGE and these function EXECUTEs to the dedicated relay role. The separate KEDA credential may use `runtime_chat.delivery_backlog()`; this worker does not call it. Runtime migration 0016 owns the 30-second lease and 5-second failure retry. A batch processes records sequentially: if a slow batch outlives a lease, guarded completion returns false and is counted as failed. Subsequent claims safely recover it.

## Redis and recovery

For each valid claim, one MULTI/EXEC performs XADD with `MAXLEN ~ 1000`, EXPIRE 86400 seconds, and PUBLISH. Every command reply must confirm success before the database lease is completed. An expired/replaced lease cannot count as delivered. Failed publication attempts guarded failure release; another record still proceeds if release fails.

Keys are `sv8:chat:stream:v1:agenticos:<scopeHash>` and channels are `sv8:chat:live:v1:agenticos:<scopeHash>`. The publisher ACL allows only PING, QUIT, XADD, EXPIRE, PUBLISH, MULTI and EXEC, with key pattern `~sv8:chat:stream:v1:agenticos:*` and channel pattern `&sv8:chat:live:v1:agenticos:*`. Credentials use Redis authentication; no CLIENT, INFO, SELECT or Lua command is required. Runtime Redis uses lazy connection, disabled ready checks/client info/offline queue, DB 0, 5-second connect/command timeouts, max one request retry, and reconnect delay capped at 1 second.

The exact notification is:

```json
{"eventId":"11111111-1111-4111-8111-111111111111","threadId":"22222222-2222-4222-8222-222222222222","sequence":"9007199254740993","eventType":"message.created"}
```

The sequence always stays a canonical positive decimal string up to PostgreSQL's bigint maximum. No scope hash, lease, account/member ID, transcript, execution claim, or model content is serialized. UUIDs, scope hashes, sequence and storage event types are validated. Malformed SQL claims reject the batch without publication; their leases expire for recovery.

A crash after publication but before database acknowledgment can publish the same durable event again. Consumers must deduplicate by event ID and recover through authorized PostgreSQL sequence reads. Redis stream IDs are transport bookkeeping. Stream trimming/expiry and delivery retries never authorize re-running execution or external effects.

## Health and shutdown

Each source has at most one batch in flight and its own loop, so a stuck or failing source cannot block the other. `/live` reflects whether the process is stopping. `/ready` and `/health` return 200 if any configured source had an empty successful claim or confirmed delivery in the last 30 seconds, otherwise 503. Initial readiness is false. JSON includes fixed source names, source readiness, attempt counts, and claimed/delivered/failed counts. Logs use fixed categories and counts without raw provider errors.

SIGTERM/SIGINT stop new claims immediately. Each source drains and closes independently; one common 10-second deadline bounds the whole shutdown, including resource closure. At the deadline, PostgreSQL connections and Redis transports are forcibly disconnected, HTTP connections close, and the worker exits. SupportV8's publication format and channels are preserved; its SQL operations now also have bounded statement/query timeouts and its transports support deadline cleanup.

## Local verification and activation boundary

Focused tests cover SQL mapping/precision, payload validation, transaction failures, stale acknowledgments, failure isolation, configuration, independent progress, readiness expiry, and bounded cleanup. Existing SupportV8 tests remain applicable.

The opt-in `test/runtime-chat-redis-integration.test.ts` reads only `TEST_RUNTIME_CHAT_REDIS_URL`. It refuses non-loopback servers and requires an explicit port and DB 0. Use a fresh local Redis process with an unused port and empty temporary directory; never point it at existing Redis. For example, after starting that disposable process:

```sh
TEST_RUNTIME_CHAT_REDIS_URL=redis://127.0.0.1:YOUR_UNUSED_PORT/0 npx vitest run test/runtime-chat-redis-integration.test.ts
```

The test creates a randomized restricted publisher ACL user, subscribes before publication, checks Pub/Sub and stream records, verifies expiry, publishes a second copy with a fresh lease to simulate a crash before acknowledgment, and checks cross-namespace denials. It removes its stream/user and disconnects its clients. The process owner must then stop the disposable Redis server and remove its temporary directory. The default suite skips this integration test.

This integration passed against a freshly started loopback Redis process with persistence disabled; the process and temporary directory were removed. This proves the local Redis publication contract and publisher ACL compatibility. PostgreSQL role/lease semantics are covered in Runtime's storage integration tests; these adapter tests verify the fixed SQL boundary with injected clients. No new production PostgreSQL or Redis was touched.

Activation still requires GitOps credentials/grants, Redis ACL provisioning and network policy, scaling from both sources, Runtime authorized SSE/cursor recovery, reconnect/crash/revocation/load evidence, and deployment verification. A passing local adapter test is not evidence of production shared delivery.
