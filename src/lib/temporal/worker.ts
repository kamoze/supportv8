import http from "node:http";
import { NativeConnection, Worker } from "@temporalio/worker";
import { Client, Connection } from "@temporalio/client";
import * as activities from "./activities";
import { TASK_QUEUE, TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE } from "./config";
import { ensureTemporalSchedules } from "./schedules";

// Health check server for Kubernetes readiness & liveness probes
function startHealthServer(port: number, isHealthy: () => boolean) {
  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/live" || req.url === "/ready") {
      if (isHealthy()) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
      } else {
        res.writeHead(503, { "Content-Type": "text/plain" });
        res.end("not ready");
      }
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
    }
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[supportv8-worker] health probe server listening on 0.0.0.0:${port}`);
  });

  return server;
}

async function main() {
  const address = TEMPORAL_ADDRESS || process.env.TEMPORAL_ADDRESS;
  if (!address) {
    console.error("[supportv8-worker] TEMPORAL_ADDRESS is required to run the worker process");
    process.exit(1);
  }

  let healthy = false;
  const healthPort = parseInt(process.env.HEALTH_PORT || "8080", 10);
  const healthServer = startHealthServer(healthPort, () => healthy);

  const isDebug = process.env.LOG_LEVEL === "debug" || process.env.DEBUG === "*";
  if (isDebug) {
    console.log("[supportv8-worker][DEBUG] Running with debug mode active:", {
      address,
      namespace: TEMPORAL_NAMESPACE,
      taskQueue: TASK_QUEUE,
      healthPort,
      nodeEnv: process.env.NODE_ENV,
      logLevel: process.env.LOG_LEVEL,
      debug: process.env.DEBUG,
    });
  }

  console.log(`[supportv8-worker] connecting to Temporal cluster at ${address}...`);
  const connection = await NativeConnection.connect({ address });

  const worker = await Worker.create({
    connection,
    namespace: TEMPORAL_NAMESPACE,
    taskQueue: TASK_QUEUE,
    workflowsPath: new URL("./workflows.ts", import.meta.url).pathname,
    activities,
    maxConcurrentActivityTaskExecutions: 25,
  });

  console.log(
    `[supportv8-worker] connected to ${address} ns=${TEMPORAL_NAMESPACE} queue=${TASK_QUEUE}`
  );

  // Register periodic Schedules (idempotent)
  try {
    const clientConnection = await Connection.connect({ address });
    const client = new Client({ connection: clientConnection, namespace: TEMPORAL_NAMESPACE });
    const res = await ensureTemporalSchedules(client);
    console.log(
      `[supportv8-worker] registered schedules: created=[${res.created.join(", ")}] existing=[${res.existing.join(", ")}]`
    );
    await clientConnection.close();
  } catch (err) {
    console.warn("[supportv8-worker] schedule registration warning:", err);
  }

  healthy = true;

  const shutdown = async () => {
    console.log("[supportv8-worker] shutting down gracefully...");
    healthy = false;
    healthServer.close();
    await worker.shutdown();
    await connection.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  console.log(`[supportv8-worker] listening for workflow tasks on queue "${TASK_QUEUE}"`);
  await worker.run();
}

main().catch((err) => {
  console.error("[supportv8-worker] fatal worker exception:", err);
  process.exit(1);
});
