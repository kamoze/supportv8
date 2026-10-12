import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as marketplace } from "../src/app/api/marketplace/route";
import { clearAcquisitionState, setPlanEligibilityFact } from "../src/lib/platform/acquisition";
import { signRuntimeSupportSession, setCustomRuntimeAccessResolverForTesting, RUNTIME_SUPPORT_COOKIE } from "../src/lib/service-app/runtime-session";
import { clearConversationStoreForTesting } from "../src/lib/platform/conversation";
import { clearScenarioStoreForTesting } from "../src/lib/platform/scenarios";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
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
  folder = mkdtempSync(join(tmpdir(), "support-r9-"));
  process.env.SUPPORTV8_RUNTIME_SESSION_SECRET = secret;
  process.env.SUPPORTV8_CONVERSATION_FILE = join(folder, "conversations.json");
  delete process.env.DATABASE_URL;
  delete process.env.REVIEW_CALLS;
  clearAcquisitionState();
  clearConversationStoreForTesting();
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
  delete process.env.MARKETPLACE_URL;
  delete process.env.SUPPORTV8_CONVERSATION_FILE;
  delete process.env.REVIEW_CALLS;
  delete process.env.AUDIT_OWNER_REQUEST;
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

it.each([
  "missing-owner-client-without-request-operation",
  "missing-operation-both-sides",
  "missing-version-both-sides",
  "missing-expiry",
  "non-iso-expiry",
  "impossible-calendar-date",
  "slug-as-canonical-id",
  "complete-control",
])("SP121 complete receipt contract %s", async (mode) => {
  eligible();
  const clientAcquisitionId = randomUUID(),
    operationId = randomUUID(),
    installationId = randomUUID();
  const body: any = {
    action: "app_acquire",
    offerId: offer,
    clientAcquisitionId,
    operationId,
    productVersion: "1.0.0",
  };
  const reply: any = ownerReply({
    clientAcquisitionId,
    operationId,
    installationId,
    productVersion: "1.0.0",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });

  if (mode === "missing-owner-client-without-request-operation") {
    delete body.operationId;
    delete reply.operationId;
    delete reply.clientAcquisitionId;
  }
  if (mode === "missing-operation-both-sides") {
    delete body.operationId;
    delete reply.operationId;
  }
  if (mode === "missing-version-both-sides") {
    delete body.productVersion;
    delete reply.productVersion;
  }
  if (mode === "missing-expiry") delete reply.expiresAt;
  if (mode === "non-iso-expiry") reply.expiresAt = "December 1, 2099";
  if (mode === "impossible-calendar-date") reply.expiresAt = "2028-02-31T00:00:00.000Z";
  if (mode === "slug-as-canonical-id") reply.tenantId = "tenant-a";

  vi.stubGlobal("fetch", async () => Response.json(reply));
  const r = await marketplace(req("/api/marketplace", body)),
    value = await r.json();
  console.log("SP121", { mode, status: r.status, body, reply, value });
  if (mode === "complete-control") {
    expect(r.status).toBe(200);
    expect(value.data.installationId).toBe(installationId);
  } else {
    expect(r.status).toBeGreaterThanOrEqual(400);
  }
});

it("SP122 app process restart preserves accepted acquisition identity", async () => {
  eligible();
  const clientAcquisitionId = randomUUID(),
    operationId = randomUUID(),
    installationId = randomUUID();
  const body = {
    action: "app_acquire",
    offerId: offer,
    clientAcquisitionId,
    operationId,
    productVersion: "1.0.0",
  };
  vi.stubGlobal("fetch", async () =>
    Response.json(
      ownerReply({
        clientAcquisitionId,
        operationId,
        installationId,
        productVersion: "1.0.0",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })
    )
  );
  const first = await marketplace(req("/api/marketplace", body));
  expect(first.status).toBe(200);

  const child = spawnSync(
    process.execPath,
    ["--import", "tsx", "audit13-acquisition-worker.ts"],
    {
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "test",
        HOME: folder,
        TMPDIR: folder,
        SUPPORTV8_CONVERSATION_FILE: join(folder, "child.json"),
        REVIEW_INSTALLATION_ID: installationId,
      },
      encoding: "utf8",
      timeout: 15000,
    }
  );
  console.log("SP122", {
    first: await first.json(),
    childExit: child.status,
    stdout: child.stdout,
    stderr: child.stderr,
  });
  expect(child.status).toBe(0);
  const last = JSON.parse(child.stdout.trim().split("\n").at(-1)!);
  expect(last.status).toBe(200);
});

it("SP123 capture actual owner request for committed receiver pairing", async () => {
  eligible();
  const clientAcquisitionId = randomUUID(),
    operationId = randomUUID();
  const reqLog = join(folder, "audit-owner-req.json");
  process.env.AUDIT_OWNER_REQUEST = reqLog;
  vi.stubGlobal("fetch", async (url: any, o: any) => {
    writeFileSync(
      reqLog,
      JSON.stringify({
        url: String(url),
        headers: o.headers,
        body: JSON.parse(o.body),
      })
    );
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
});
