import http from "node:http";
import { PostgresChatOutboxStore } from "./outbox-store";
import { chatRealtime } from "./realtime";
import { createChatRelayWorkerId, processChatOutboxBatch } from "./relay";
import { PostgresRuntimeDeliveryStore } from "./runtime-outbox-store";
import { RedisRuntimePublisher } from "./runtime-realtime";
import { processRuntimeDeliveryBatch } from "./runtime-relay";
import { createRelayAdapters, readRelayConfig, RelayRunner } from "./relay-runner";

async function main() {
  // Validate all opt-in settings before constructing either source's clients.
  const config = readRelayConfig();
  const workerId = createChatRelayWorkerId();
  const adapters = createRelayAdapters(config, {
    support: batchSize => {
      const store = new PostgresChatOutboxStore();
      return {
        name: "supportv8",
        process: () => processChatOutboxBatch(store, chatRealtime, workerId, batchSize),
        close: async () => { await Promise.allSettled([store.close(), chatRealtime.close()]); },
        forceClose: () => { store.forceClose(); chatRealtime.forceClose(); },
      };
    },
    runtime: ({ databaseUrl, redisUrl, batchSize }) => {
      const store = new PostgresRuntimeDeliveryStore(databaseUrl);
      const publisher = new RedisRuntimePublisher(redisUrl);
      return {
        name: "agenticos",
        process: () => processRuntimeDeliveryBatch(store, publisher, batchSize),
        close: async () => { await Promise.allSettled([store.close(), publisher.close()]); },
        forceClose: () => { store.forceClose(); publisher.forceClose(); },
      };
    },
  });
  const runner = new RelayRunner(adapters, {
    log: (source, category, counts) => console.warn(`[shared-chat-relay] source=${source} category=${category}${counts
      ? ` claimed=${counts.claimed} delivered=${counts.delivered} failed=${counts.failed}` : ""}`),
  });
  const healthServer = http.createServer((request, response) => {
    if (!["/health", "/ready", "/live"].includes(request.url ?? "")) {
      response.writeHead(404).end("not found"); return;
    }
    const health = runner.health();
    response.writeHead((request.url === "/live" ? health.live : health.ready) ? 200 : 503,
      { "Content-Type": "application/json" });
    response.end(JSON.stringify(health));
  });
  let shuttingDown = false;
  const shutdown = async (code: number) => {
    if (shuttingDown) return;
    shuttingDown = true;
    const stopped = runner.stop();
    healthServer.close();
    await stopped;
    healthServer.closeAllConnections();
    process.exit(code);
  };
  process.once("SIGTERM", () => void shutdown(0));
  process.once("SIGINT", () => void shutdown(0));
  healthServer.once("error", () => {
    console.error("[shared-chat-relay] health_server_failed");
    void shutdown(1);
  });
  healthServer.listen(config.healthPort, "0.0.0.0");
  runner.start();
  console.log("[shared-chat-relay] started");
}

main().catch(() => {
  console.error("[shared-chat-relay] startup_failed: Invalid chat relay configuration");
  process.exit(1);
});
