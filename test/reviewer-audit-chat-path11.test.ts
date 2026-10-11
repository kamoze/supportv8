import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as chat } from "../src/app/api/chat/route";
import { clearAcquisitionState } from "../src/lib/platform/acquisition";
import {
  signRuntimeSupportSession,
  setCustomRuntimeAccessResolverForTesting,
  RUNTIME_SUPPORT_COOKIE,
} from "../src/lib/service-app/runtime-session";
import {
  clearConversationStoreForTesting,
  admitAgenticTurn,
} from "../src/lib/platform/conversation";
import { clearScenarioStoreForTesting } from "../src/lib/platform/scenarios";
import { ragIngestion } from "../src/lib/services/rag-ingestion-service";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
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
  folder = mkdtempSync(join(tmpdir(), "support-r11-chat-path-"));
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
  setCustomRuntimeAccessResolverForTesting(null);
  rmSync(folder, { recursive: true, force: true });
});

it("SP119 client turn ID cannot escape its operation directory", () => {
  const escape = "escaped-" + randomUUID();
  const r = admitAgenticTurn({
    tenantSlug: "tenant-a",
    actorId: "actor-a",
    clientTurnId: "../" + escape,
    threadId: randomUUID(),
    employeeId: "hire-a",
    prompt: "Synthetic harmless file boundary",
    activeHires: ["hire-a"],
    isPrivate: true,
    participants: ["actor-a"],
  });
  const escapedFile = join(folder, escape + ".json");
  const wasEscaped = existsSync(escapedFile);
  console.log("SP119", { status: r.status, escaped: wasEscaped, error: r.error });
  expect(wasEscaped).toBe(false);
  expect(r.success).toBe(false);
  expect(r.status).toBe(400);
});

it("SP120 actual chat route must not write a client-selected parent file", async () => {
  const escape = "http-escape-" + randomUUID();
  const queryRagSpy = vi
    .spyOn(ragIngestion, "queryRag")
    .mockResolvedValue({ answer: "Synthetic harmless result", citations: [] } as any);
  const r = await chat(
    req("/api/chat", {
      query: "Synthetic file boundary",
      employeeId: "emp_rag_intelligence",
      clientTurnId: "../" + escape,
      threadId: randomUUID(),
      isPrivate: true,
      participants: ["review-owner-a"],
    })
  );
  const escapedFile = join(folder, escape + ".json");
  const wasEscaped = existsSync(escapedFile);
  const body = await r.clone().json();
  console.log("SP120", { status: r.status, escaped: wasEscaped, body });
  expect(wasEscaped).toBe(false);
  expect(r.status).toBe(400);
  expect(queryRagSpy).not.toHaveBeenCalled();
});

it("SP120 variants: rejects absolute paths and encoded separators", async () => {
  const queryRagSpy = vi
    .spyOn(ragIngestion, "queryRag")
    .mockResolvedValue({ answer: "Synthetic harmless result", citations: [] } as any);

  // Variant 1: Absolute path
  const rAbs = await chat(
    req("/api/chat", {
      query: "Synthetic file boundary",
      employeeId: "emp_rag_intelligence",
      clientTurnId: "/etc/passwd",
      threadId: randomUUID(),
      isPrivate: true,
      participants: ["review-owner-a"],
    })
  );
  expect(rAbs.status).toBe(400);

  // Variant 2: URL encoded traversal
  const rEncoded = await chat(
    req("/api/chat", {
      query: "Synthetic file boundary",
      employeeId: "emp_rag_intelligence",
      clientTurnId: "%2e%2e%2fescape",
      threadId: randomUUID(),
      isPrivate: true,
      participants: ["review-owner-a"],
    })
  );
  expect(rEncoded.status).toBe(400);

  // Variant 3: Backslash traversal
  const rBackslash = await chat(
    req("/api/chat", {
      query: "Synthetic file boundary",
      employeeId: "emp_rag_intelligence",
      clientTurnId: "..\\escape",
      threadId: randomUUID(),
      isPrivate: true,
      participants: ["review-owner-a"],
    })
  );
  expect(rBackslash.status).toBe(400);

  expect(queryRagSpy).not.toHaveBeenCalled();
});

it("SP120-positive normal chat identity keeps valid response", async () => {
  vi.spyOn(ragIngestion, "queryRag").mockResolvedValue({
    answer: "Synthetic allowed result",
    citations: [],
  } as any);
  const validTurnId = "turn_" + randomUUID().replace(/-/g, "");
  const r = await chat(
    req("/api/chat", {
      query: "Synthetic positive control",
      employeeId: "emp_rag_intelligence",
      clientTurnId: validTurnId,
      threadId: randomUUID(),
      isPrivate: true,
      participants: ["review-owner-a"],
    })
  );
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.data.answer).toBe("Synthetic allowed result");
  expect(json.data.turnId).toBeDefined();
});
