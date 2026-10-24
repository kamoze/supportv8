import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as scenarios } from "../src/app/api/scenarios/route";
import { middleware } from "../src/middleware";
import { signRuntimeSupportSession, setCustomRuntimeAccessResolverForTesting, RUNTIME_SUPPORT_COOKIE } from "../src/lib/service-app/runtime-session";
import { clearScenarioStoreForTesting, acquireScenarioForTenant } from "../src/lib/platform/scenarios";
import { marketplaceService } from "../src/lib/services/marketplace-service";
import { randomUUID } from "node:crypto";

const secret = "review-only-fixture-not-production";
const workspaceId = "tenant_rt_" + "a".repeat(48);

function req(path: string, body: any, actor = "review-owner-a") {
  const token = signRuntimeSupportSession(
    {
      accountId: "acct-a",
      tenantId: workspaceId,
      workspaceId,
      verticalId: "runtime",
      installationId: "fixture-install-a",
      sub: actor,
      roleCap: "support:manage",
      tenantDomain: "tenant-a",
    },
    secret
  );
  return new NextRequest("https://tenant-a.support.servicev8.com" + path, {
    method: "POST",
    headers: {
      host: "tenant-a.support.servicev8.com",
      cookie: `${RUNTIME_SUPPORT_COOKIE}=${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.SUPPORTV8_RUNTIME_SESSION_SECRET = secret;
  delete process.env.DATABASE_URL;
  delete process.env.WORKFLOW_DISPATCH_URL;
  clearScenarioStoreForTesting();
  setCustomRuntimeAccessResolverForTesting(async (scope) => ({
    ...scope,
    capability: "support:manage",
    email: "review@example.test",
    domain: "tenant-a",
  } as any));
  vi.stubGlobal("fetch", async () => {
    throw Error("External network disabled in fixture");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setCustomRuntimeAccessResolverForTesting(null);
});

async function createConfig(overrides: any = {}) {
  vi.spyOn(marketplaceService, "getWorkforceCatalog").mockReturnValue([
    { id: "emp_support_lead", isHired: true },
  ] as any);
  vi.spyOn(marketplaceService, "isAgentHired").mockReturnValue(true);
  acquireScenarioForTenant("tenant-a", "sc_support_triage", {
    status: "active",
    dispatcherId: "fixture-dispatcher",
    assignedConnectors: ["fixture-connection"],
  });
  const r = await scenarios(
    req("/api/scenarios", {
      action: "save",
      scenarioId: "sc_support_triage",
      name: "Synthetic",
      participants: ["emp_support_lead"],
      parameters: { priority: "normal" },
      ...overrides,
    })
  );
  expect(r.status).toBe(200);
  return (await r.json()).data;
}

// SP116: Owner 2xx with empty, pending, or rejected body must NOT manufacture running status
it.each([
  ["empty", {}],
  ["pending", { status: "pending" }],
  ["rejected", { status: "rejected" }],
])("SP116 owner 2xx %s cannot manufacture running scenario", async (label, reply) => {
  const c = await createConfig();
  vi.stubGlobal("fetch", async () => Response.json(reply));
  const r = await scenarios(
    req("/api/scenarios", {
      action: "run",
      configId: c.id,
      idempotencyKey: randomUUID(),
    })
  );
  const b = await r.json();
  console.log("SP116", label, r.status, b);
  expect(b.data?.status).not.toBe("running");
});

// SP117: Identical retry must not re-dispatch changed revision to owner
it("SP117 identical retry must not re-dispatch changed revision", async () => {
  const c = await createConfig();
  const calls: any[] = [];
  vi.stubGlobal("fetch", async (_: any, o: any) => {
    calls.push(JSON.parse(o.body));
    return Response.json({
      status: "accepted",
      operationId: "controlled-execution",
      receipt: "controlled-receipt",
    });
  });
  const body = { action: "run", configId: c.id, idempotencyKey: randomUUID() };
  const first = await scenarios(req("/api/scenarios", body));
  expect(first.status).toBe(200);

  // Edit scenario config (bumps revision to 2)
  await scenarios(
    req("/api/scenarios", {
      action: "save",
      id: c.id,
      scenarioId: "sc_support_triage",
      name: "Synthetic",
      participants: ["emp_support_lead"],
      parameters: { priority: "urgent" },
    })
  );

  // Retry with original idempotency key
  const retry = await scenarios(req("/api/scenarios", body));
  const b = await retry.json();
  console.log("SP117", { calls, result: b });
  expect(b.data.pinnedRevision).toBe(1);
  expect(calls).toHaveLength(1);
});

// SP118: Current hire projection rejects before dispatch (effects === 0)
it("SP118 current hire projection rejects before dispatch", async () => {
  const c = await createConfig();
  vi.spyOn(marketplaceService, "getWorkforceCatalog").mockReturnValue([
    { id: "emp_support_lead", isHired: false },
  ] as any);
  let effects = 0;
  vi.stubGlobal("fetch", async () => {
    effects++;
    return Response.json({ status: "accepted" });
  });
  const r = await scenarios(
    req("/api/scenarios", {
      action: "run",
      configId: c.id,
      idempotencyKey: randomUUID(),
    })
  );
  console.log("SP118", { status: r.status, effects, body: await r.clone().json() });
  expect(r.status).toBeGreaterThanOrEqual(400);
  expect(effects).toBe(0);
});

// Positive control: Accepted owner dispatch returns running status with authentic receipt
it("SP116-positive authentic accepted receipt yields running status", async () => {
  const c = await createConfig();
  let calls = 0;
  vi.stubGlobal("fetch", async (_: any, o: any) => {
    calls++;
    return Response.json({
      status: "accepted",
      operationId: "op-valid",
      receipt: "rcpt-valid",
    });
  });
  const r = await scenarios(
    req("/api/scenarios", {
      action: "run",
      configId: c.id,
      idempotencyKey: randomUUID(),
    })
  );
  expect(r.status).toBe(200);
  const b = await r.json();
  expect(b.success).toBe(true);
  expect(b.data.status).toBe("running");
  expect(calls).toBe(1);
});

// Conflicting configId replay under same idempotency key returns 409
it("rejection on conflicting configId under same idempotency key without dispatch", async () => {
  const c1 = await createConfig();
  const c2 = await createConfig({ name: "Synthetic 2" });
  let calls = 0;
  vi.stubGlobal("fetch", async () => {
    calls++;
    return Response.json({ status: "accepted" });
  });
  const key = randomUUID();
  const r1 = await scenarios(
    req("/api/scenarios", {
      action: "run",
      configId: c1.id,
      idempotencyKey: key,
    })
  );
  expect(r1.status).toBe(200);
  expect(calls).toBe(1);

  // Conflicting run under same idempotency key
  const r2 = await scenarios(
    req("/api/scenarios", {
      action: "run",
      configId: c2.id,
      idempotencyKey: key,
    })
  );
  expect(r2.status).toBe(409);
  expect(calls).toBe(1); // No new dispatch call
});

it("middleware permits Runtime-session POST /api/scenarios through scopedRuntimeMutations", () => {
  const request = req("/api/scenarios", { action: "save" });
  const res = middleware(request);
  expect(res.status).not.toBe(403);
});
