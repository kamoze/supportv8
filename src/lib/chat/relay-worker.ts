import http from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { PostgresChatOutboxStore } from "./outbox-store";
import { chatRealtime } from "./realtime";
import { createChatRelayWorkerId, processChatOutboxBatch } from "./relay";

const healthPort = Number(process.env.HEALTH_PORT || 8081);
const batchSize = Number(process.env.CHAT_RELAY_BATCH_SIZE || 100);
const idleDelayMs = Number(process.env.CHAT_RELAY_IDLE_DELAY_MS || 250);
const workerId = createChatRelayWorkerId();
const store = new PostgresChatOutboxStore();
let healthy = false;
let stopping = false;

const healthServer = http.createServer((request, response) => {
  if (request.url !== "/health" && request.url !== "/ready" && request.url !== "/live") {
    response.writeHead(404).end("not found");
    return;
  }
  response.writeHead(healthy ? 200 : 503, { "Content-Type": "text/plain" });
  response.end(healthy ? "ok" : "not ready");
});

async function shutdown() {
  if (stopping) return;
  stopping = true;
  healthy = false;
  healthServer.close();
  await Promise.allSettled([store.close(), chatRealtime.close()]);
}

async function main() {
  healthServer.listen(healthPort, "0.0.0.0");
  healthy = true;
  console.log(`[supportv8-chat-relay] ready worker=${workerId} port=${healthPort}`);

  while (!stopping) {
    try {
      const result = await processChatOutboxBatch(store, chatRealtime, workerId, batchSize);
      if (result.failed > 0) {
        console.warn(`[supportv8-chat-relay] batch claimed=${result.claimed} delivered=${result.delivered} failed=${result.failed}`);
      }
      if (result.claimed === 0) await delay(idleDelayMs);
    } catch (error) {
      healthy = false;
      console.error("[supportv8-chat-relay] polling failure", error);
      await delay(1_000);
      healthy = true;
    }
  }
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());

main()
  .then(() => shutdown())
  .catch(async (error) => {
    console.error("[supportv8-chat-relay] fatal error", error);
    await shutdown();
    process.exit(1);
  });
