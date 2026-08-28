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

async function connectWithRetry(
  initialAddress: string,
  maxAttempts = 10
): Promise<{ connection: NativeConnection; resolvedAddress: string }> {
  const candidateAddresses = [initialAddress];

  // If initial address is an in-cluster DNS name and running outside or fallback needed:
  if (initialAddress.includes(".cluster.local") || !process.env.KUBERNETES_SERVICE_HOST) {
    if (!candidateAddresses.includes("127.0.0.1:7233")) candidateAddresses.push("127.0.0.1:7233");
    if (!candidateAddresses.includes("temporal-workload.tail703aea.ts.net:7233")) {
      candidateAddresses.push("temporal-workload.tail703aea.ts.net:7233");
    }
    if (!candidateAddresses.includes("100.91.170.67:7233")) {
      candidateAddresses.push("100.91.170.67:7233");
    }
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    for (const address of candidateAddresses) {
      try {
        console.log(`[supportv8-worker] (attempt ${attempt}/${maxAttempts}) connecting to Temporal at ${address}...`);
        const connection = await NativeConnection.connect({ address });
        return { connection, resolvedAddress: address };
      } catch (err: any) {
        console.warn(`[supportv8-worker] failed to connect to ${address}: ${err?.message || err}`);
      }
    }

    if (attempt < maxAttempts) {
      const backoffMs = Math.min(attempt * 1500, 10000);
      console.log(`[supportv8-worker] retrying in ${backoffMs}ms...`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }

  throw new Error(`[supportv8-worker] Could not connect to Temporal cluster after ${maxAttempts} attempts across [${candidateAddresses.join(", ")}]`);
}

async function main() {
  const address = TEMPORAL_ADDRESS || process.env.TEMPORAL_ADDRESS || "temporal-workload-frontend.default.svc.cluster.local:7233";

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

  const { connection, resolvedAddress } = await connectWithRetry(address);

  const worker = await Worker.create({
    connection,
    namespace: TEMPORAL_NAMESPACE,
    taskQueue: TASK_QUEUE,
    workflowsPath: new URL("./workflows.ts", import.meta.url).pathname,
    activities,
    maxConcurrentActivityTaskExecutions: 25,
  });

  console.log(
    `[supportv8-worker] connected to ${resolvedAddress} ns=${TEMPORAL_NAMESPACE} queue=${TASK_QUEUE}`
  );

  // Register periodic Schedules (idempotent)
  try {
    const clientConnection = await Connection.connect({ address: resolvedAddress });
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
