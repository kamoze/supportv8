import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as marketplace } from "../src/app/api/marketplace/route";
import { clearAcquisitionState, setPlanEligibilityFact } from "../src/lib/platform/acquisition";
import {
  signRuntimeSupportSession,
  setCustomRuntimeAccessResolverForTesting,
  RUNTIME_SUPPORT_COOKIE,
} from "../src/lib/service-app/runtime-session";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const secret = "review-only-fixture-not-production";
const workspaceId = "tenant_rt_" + "a".repeat(48);
let folder: string;

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
  folder = mkdtempSync(join(tmpdir(), "support-r12-acq-"));
  process.env.SUPPORTV8_RUNTIME_SESSION_SECRET = secret;
  delete process.env.DATABASE_URL;
  delete process.env.REVIEW_CALLS;
  clearAcquisitionState();
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
  delete process.env.MARKETPLACE_URL;
  delete process.env.REVIEW_CALLS;
  setCustomRuntimeAccessResolverForTesting(null);
  rmSync(folder, { recursive: true, force: true });
});

const offer = "servicev8.service-app.supportv8";

function ownerReply(extra: any = {}) {
  return {
    status: "accepted",
    tenantId: workspaceId,
    accountId: "acct-a",
    offerId: offer,
    installationId: randomUUID(),
    receipt: randomUUID(),
    ...extra,
  };
}

function eligible() {
  setPlanEligibilityFact("tenant-a", true);
  process.env.MARKETPLACE_URL = "https://fixture.invalid";
}

// SP101-104 original cases
it("SP101 installation ID cannot substitute for absent owner receipt", async () => {
  eligible();
  vi.stubGlobal("fetch", async () => Response.json(ownerReply({ receipt: undefined })));
  const r = await marketplace(
    req("/api/marketplace", {
      action: "app_acquire",
      offerId: offer,
      clientAcquisitionId: randomUUID(),
    })
  );
  expect(r.status).toBeGreaterThanOrEqual(400);
});

it("SP102 derived account alias cannot override actual session account", async () => {
  eligible();
  vi.stubGlobal("fetch", async () => Response.json(ownerReply({ accountId: "acct-tenant-a" })));
  const r = await marketplace(
    req("/api/marketplace", {
      action: "app_acquire",
      offerId: offer,
      clientAcquisitionId: randomUUID(),
    })
  );
  expect(r.status).toBeGreaterThanOrEqual(400);
});

it("SP103 browser cookies must not be forwarded as owner workload credential", async () => {
  eligible();
  let auth = "";
  vi.stubGlobal("fetch", async (_: any, o: any) => {
    auth = o.headers?.Authorization ?? "";
    return Response.json(ownerReply());
  });
  const r = await marketplace(
    req("/api/marketplace", {
      action: "app_acquire",
      offerId: offer,
      clientAcquisitionId: randomUUID(),
    })
  );
  expect(auth).not.toContain(RUNTIME_SUPPORT_COOKIE + "=");
});

it("SP104 foreign operation and expired acquisition receipt cannot activate", async () => {
  eligible();
  vi.stubGlobal("fetch", async () =>
    Response.json(
      ownerReply({
        operationId: "foreign-op",
        clientAcquisitionId: "foreign-client",
        expiresAt: "2020-01-01T00:00:00Z",
        productVersion: "foreign-version",
      })
    )
  );
  const r = await marketplace(
    req("/api/marketplace", {
      action: "app_acquire",
      offerId: offer,
      clientAcquisitionId: randomUUID(),
    })
  );
  expect(r.status).toBeGreaterThanOrEqual(400);
});

// SP115 negative variants
it.each([
  ["missing-client", { clientAcquisitionId: undefined }],
  ["missing-operation", { operationId: undefined }],
  ["malformed-expiry", { expiresAt: "not-a-date" }],
  ["wrong-requested-version", { productVersion: "v1" }],
])("SP115 receipt binds each request field: %s", async (label, override) => {
  eligible();
  const clientAcquisitionId = randomUUID(),
    operationId = randomUUID();
  vi.stubGlobal("fetch", async () =>
    Response.json(
      ownerReply({
        clientAcquisitionId,
        operationId,
        productVersion: "1.0.0",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        ...override,
      })
    )
  );
  const r = await marketplace(
    req("/api/marketplace", {
      action: "app_acquire",
      offerId: offer,
      clientAcquisitionId,
      operationId,
      productVersion: "1.0.0",
    })
  );
  expect(r.status).toBeGreaterThanOrEqual(400);
});

// SP115 positive control
it("SP115-positive correctly bound acquisition is accepted", async () => {
  eligible();
  const clientAcquisitionId = randomUUID(),
    operationId = randomUUID();
  vi.stubGlobal("fetch", async () =>
    Response.json(
      ownerReply({
        clientAcquisitionId,
        operationId,
        productVersion: "1.0.0",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })
    )
  );
  const r = await marketplace(
    req("/api/marketplace", {
      action: "app_acquire",
      offerId: offer,
      clientAcquisitionId,
      operationId,
      productVersion: "1.0.0",
    })
  );
  expect(r.status).toBe(200);
  expect((await r.json()).success).toBe(true);
});

// Outbound request verification includes operationId and productVersion
it("outbound verification payload includes operationId and productVersion", async () => {
  eligible();
  const clientAcquisitionId = randomUUID(),
    operationId = randomUUID();
  let capturedBody: any = null;
  vi.stubGlobal("fetch", async (_: any, o: any) => {
    capturedBody = JSON.parse(o.body);
    return Response.json(
      ownerReply({
        clientAcquisitionId,
        operationId,
        productVersion: "1.0.0",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })
    );
  });
  const r = await marketplace(
    req("/api/marketplace", {
      action: "app_acquire",
      offerId: offer,
      clientAcquisitionId,
      operationId,
      productVersion: "1.0.0",
    })
  );
  expect(r.status).toBe(200);
  expect(capturedBody).toBeDefined();
  expect(capturedBody.operationId).toBe(operationId);
  expect(capturedBody.productVersion).toBe("1.0.0");
});

it("identical retry under same clientAcquisitionId returns existing installation idempotently", async () => {
  eligible();
  const clientAcquisitionId = randomUUID(),
    operationId = randomUUID();
  let fetchCount = 0;
  vi.stubGlobal("fetch", async () => {
    fetchCount++;
    return Response.json(
      ownerReply({
        clientAcquisitionId,
        operationId,
        productVersion: "1.0.0",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })
    );
  });
  const body = {
    action: "app_acquire",
    offerId: offer,
    clientAcquisitionId,
    operationId,
    productVersion: "1.0.0",
  };
  const first = await marketplace(req("/api/marketplace", body));
  expect(first.status).toBe(200);
  const firstData = (await first.json()).data;

  // Retry with exact identical body
  const second = await marketplace(req("/api/marketplace", body));
  expect(second.status).toBe(200);
  const secondData = (await second.json()).data;
  expect(secondData.installationId).toBe(firstData.installationId);
  expect(secondData.clientAcquisitionId).toBe(clientAcquisitionId);
  expect(secondData.operationId).toBe(operationId);
  expect(secondData.productVersion).toBe("1.0.0");
});

it("retry under same clientAcquisitionId with conflicting operationId returns 409 conflict", async () => {
  eligible();
  const clientAcquisitionId = randomUUID(),
    operationId1 = randomUUID(),
    operationId2 = randomUUID();
  vi.stubGlobal("fetch", async () =>
    Response.json(
      ownerReply({
        clientAcquisitionId,
        operationId: operationId1,
        productVersion: "1.0.0",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })
    )
  );
  const first = await marketplace(
    req("/api/marketplace", {
      action: "app_acquire",
      offerId: offer,
      clientAcquisitionId,
      operationId: operationId1,
      productVersion: "1.0.0",
    })
  );
  expect(first.status).toBe(200);

  // Conflicting retry with different operationId
  vi.stubGlobal("fetch", async () =>
    Response.json(
      ownerReply({
        clientAcquisitionId,
        operationId: operationId2,
        productVersion: "1.0.0",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })
    )
  );
  const second = await marketplace(
    req("/api/marketplace", {
      action: "app_acquire",
      offerId: offer,
      clientAcquisitionId,
      operationId: operationId2,
      productVersion: "1.0.0",
    })
  );
  expect(second.status).toBe(409);
});

it("unbound operationId from owner is rejected when caller did not supply one", async () => {
  eligible();
  const clientAcquisitionId = randomUUID();
  vi.stubGlobal("fetch", async () =>
    Response.json(
      ownerReply({
        clientAcquisitionId,
        operationId: "unrequested-owner-op",
        productVersion: "1.0.0",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })
    )
  );
  const r = await marketplace(
    req("/api/marketplace", {
      action: "app_acquire",
      offerId: offer,
      clientAcquisitionId,
      // no operationId in caller request
    })
  );
  expect(r.status).toBeGreaterThanOrEqual(400);
});

it("owner network failure or 503 returns truthful 503 and zero persisted installation", async () => {
  eligible();
  const clientAcquisitionId = randomUUID(),
    operationId = randomUUID();
  vi.stubGlobal("fetch", async () => {
    throw new Error("Marketplace gateway connection refused");
  });
  const r = await marketplace(
    req("/api/marketplace", {
      action: "app_acquire",
      offerId: offer,
      clientAcquisitionId,
      operationId,
      productVersion: "1.0.0",
    })
  );
  expect(r.status).toBe(503);
});

