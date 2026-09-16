import { createHmac, randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import {
  verifyRuntimeSupportHandoffToken,
  type RuntimeSupportHandoffClaims,
} from "@/lib/service-app/runtime-handoff-claims";
import { handleRuntimeSupportHandoff } from "@/lib/service-app/runtime-handoff";
import {
  authorizeRuntimeSupportRequest,
  runtimeSupportCookie,
  signRuntimeSupportSession,
  verifyRuntimeSupportSession,
} from "@/lib/service-app/runtime-session";
import {
  handleRuntimeTicketCreate,
  handleRuntimeTicketDetail,
  handleRuntimeTicketList,
  handleRuntimeTicketUpdate,
} from "@/lib/service-app/runtime-http";
const secret = "handoff-secret-that-is-at-least-thirty-two-bytes";
const sessionSecret = "session-secret-that-is-at-least-thirty-two-bytes";
const now = 1_800_000_000,
  workspaceId = `tenant_rt_${"a".repeat(48)}`;
const claims: RuntimeSupportHandoffClaims = {
  version: "servicev8.support-handoff.v1",
  iss: "runtime",
  aud: "supportv8-service-app",
  sub: "member-1",
  accountId: "acct-1",
  tenantId: "registry-1",
  verticalId: "runtime",
  installationId: "install-1",
  externalWorkspaceId: workspaceId,
  tenantDomain: "synthetic-support",
  role: "support:manage",
  destination:
    "https://synthetic-support.support.servicev8.com/auth/runtime/handoff",
  iat: now - 1,
  exp: now + 59,
  jti: randomUUID(),
};
function jwt(
  body: unknown = claims,
  header: unknown = { alg: "HS256", typ: "JWT" },
) {
  const h = Buffer.from(JSON.stringify(header)).toString("base64url"),
    p = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`;
}
const access = {
  accountId: claims.accountId,
  tenantId: claims.tenantId,
  verticalId: "runtime" as const,
  installationId: claims.installationId,
  workspaceId,
  subject: claims.sub,
  capability: "support:manage" as const,
  email: "synthetic@example.test",
  domain: claims.tenantDomain,
};
describe("Runtime to Support exact handoff claims", () => {
  it("accepts only the exact canonical bounded contract", () => {
    expect(verifyRuntimeSupportHandoffToken(jwt(), secret, now)).toEqual(
      claims,
    );
    for (const update of [
      { aud: "other" },
      { exp: now },
      { iat: now + 1 },
      { exp: now + 61 },
      {
        destination: "https://other.support.servicev8.com/auth/runtime/handoff",
      },
      { role: "support:admin" },
      { externalWorkspaceId: "tenant_rt_short" },
      { extra: true },
    ])
      expect(
        verifyRuntimeSupportHandoffToken(
          jwt({ ...claims, ...update }),
          secret,
          now,
        ),
      ).toBeNull();
  });
  it("rejects tampering, unknown algorithms and noncanonical segments", () => {
    expect(
      verifyRuntimeSupportHandoffToken(`${jwt()}x`, secret, now),
    ).toBeNull();
    expect(
      verifyRuntimeSupportHandoffToken(
        jwt(claims, { alg: "none", typ: "JWT" }),
        secret,
        now,
      ),
    ).toBeNull();
    expect(
      verifyRuntimeSupportHandoffToken(jwt().replace(/\./, "=."), secret, now),
    ).toBeNull();
  });
});
describe("Runtime handoff admission", () => {
  const request = (
    query = `token=${encodeURIComponent(jwt())}`,
    init?: RequestInit,
  ) => {
    const headers = new Headers(init?.headers);
    if (!headers.has("host"))
      headers.set("host", "synthetic-support.support.servicev8.com");
    return new Request(`http://127.0.0.1:3000/auth/runtime/handoff?${query}`, {
      ...init,
      headers,
    });
  };
  const deps = () => ({
    handoffSecret: secret,
    sessionSecret,
    now: () => now,
    replay: { consume: vi.fn(async () => true) },
    resolve: vi.fn(async () => access),
  });
  it("issues the host-only cookie after current access and single use", async () => {
    const d = deps(),
      response = await handleRuntimeSupportHandoff(request(), d);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?view=cockpit&handoff=runtime");
    expect(response.headers.get("set-cookie")).toMatch(
      /^__Host-sv8_runtime_support=.*; Path=\/; Max-Age=28800; HttpOnly; Secure; SameSite=Lax$/,
    );
    expect(d.resolve).toHaveBeenCalledOnce();
    expect(d.replay.consume).toHaveBeenCalledOnce();
  });
  it.each([
    [
      "duplicate",
      `token=${encodeURIComponent(jwt())}&token=${encodeURIComponent(jwt())}`,
    ],
    ["extra", `token=${encodeURIComponent(jwt())}&next=/`],
  ])("rejects %s query without a session", async (_n, q) => {
    const response = await handleRuntimeSupportHandoff(request(q), deps());
    expect(response.status).toBe(401);
    expect(response.headers.has("set-cookie")).toBe(false);
  });
  it("rejects wrong host, prefetch, replay and revoked access without a session", async () => {
    const d = deps();
    for (const [req, change] of [
      [
        new Request(
          `http://127.0.0.1:3000/auth/runtime/handoff?token=${encodeURIComponent(jwt())}`,
          { headers: { host: "other.support.servicev8.com" } },
        ),
        {},
      ],
      [request(undefined, { headers: { purpose: "prefetch" } }), {}],
      [request(), { replay: { consume: async () => false } }],
      [request(), { resolve: async () => null }],
    ] as const) {
      const response = await handleRuntimeSupportHandoff(req, {
        ...d,
        ...change,
      });
      expect(response.status).toBe(401);
      expect(response.headers.has("set-cookie")).toBe(false);
    }
  });
  it("uses the actual Host boundary and ignores forwarded host claims", async () => {
    const mismatch = await handleRuntimeSupportHandoff(
      request(undefined, {
        headers: {
          host: "other.support.servicev8.com",
          "x-forwarded-host": "synthetic-support.support.servicev8.com",
        },
      }),
      deps(),
    );
    expect(mismatch.status).toBe(401);
    const forged = await handleRuntimeSupportHandoff(
      request(undefined, {
        headers: {
          "x-forwarded-host": "other.support.servicev8.com",
          "x-tenant-domain": "other",
        },
      }),
      deps(),
    );
    expect(forged.status).toBe(303);
  });
  it.each([
    undefined,
    "support.servicev8.com",
    "synthetic-support.support.servicev8.com:443",
    "bad.example",
  ])("rejects missing or invalid Host %s", async (host) => {
    const headers = new Headers();
    if (host) headers.set("host", host);
    const response = await handleRuntimeSupportHandoff(
      new Request(
        `http://127.0.0.1:3000/auth/runtime/handoff?token=${encodeURIComponent(jwt())}`,
        { headers },
      ),
      deps(),
    );
    expect(response.status).toBe(401);
    expect(response.headers.has("set-cookie")).toBe(false);
  });
  it("returns 405 for non-GET", async () =>
    expect(
      (
        await handleRuntimeSupportHandoff(
          request(undefined, { method: "POST" }),
          deps(),
        )
      ).status,
    ).toBe(405));
});
describe("dedicated runtime session", () => {
  const input = {
    accountId: claims.accountId,
    tenantId: claims.tenantId,
    verticalId: "runtime" as const,
    installationId: claims.installationId,
    workspaceId,
    sub: claims.sub,
    roleCap: "support:manage" as const,
    tenantDomain: claims.tenantDomain,
  };
  it("is exact, host-bound and capped to eight hours", () => {
    const token = signRuntimeSupportSession(input, sessionSecret, now)!;
    expect(
      verifyRuntimeSupportSession(
        token,
        sessionSecret,
        "synthetic-support.support.servicev8.com",
        now,
      )?.roleCap,
    ).toBe("support:manage");
    expect(
      verifyRuntimeSupportSession(
        token,
        sessionSecret,
        "other.support.servicev8.com",
        now,
      ),
    ).toBeNull();
    expect(
      signRuntimeSupportSession(input, sessionSecret, now, 28_801),
    ).toBeNull();
  });
  it("rechecks current authority and intersects a downgrade on every call", async () => {
    const token = signRuntimeSupportSession(input, sessionSecret, now)!,
      request = new Request("http://127.0.0.1:3000/api/runtime/tickets", {
        headers: {
          host: "synthetic-support.support.servicev8.com",
          cookie: runtimeSupportCookie(token),
        },
      }),
      resolve = vi.fn(async () => ({
        ...access,
        capability: "support:read" as const,
      }));
    expect(
      (
        await authorizeRuntimeSupportRequest(request, {
          secret: sessionSecret,
          now: () => now,
          resolve,
        })
      )?.role,
    ).toBe("support:read");
    expect(resolve).toHaveBeenCalledOnce();
    resolve.mockImplementationOnce(async () => null as never);
    expect(
      await authorizeRuntimeSupportRequest(request, {
        secret: sessionSecret,
        now: () => now,
        resolve,
      }),
    ).toBeNull();
  });
  it("does not accept a legacy cookie", async () =>
    expect(
      await authorizeRuntimeSupportRequest(
        new Request("http://127.0.0.1:3000/runtime", {
          headers: {
            host: "synthetic-support.support.servicev8.com",
            cookie: "sv8_access_token=legacy",
          },
        }),
        { secret: sessionSecret, now: () => now, resolve: async () => access },
      ),
    ).toBeNull());
});
describe("runtime ticket HTTP boundary", () => {
  const auth = async () => ({
    session: {
      ...claims,
      workspaceId,
      sub: claims.sub,
      version: "servicev8.support-session.v1" as const,
      aud: "supportv8-runtime-session" as const,
      roleCap: "support:read" as const,
      tenantDomain: claims.tenantDomain,
    },
    access,
    role: "support:read" as const,
  });
  it("wires bounded list and detail reads with no-store responses", async () => {
    const list = vi.fn(async () => ({ tickets: [] })),
      response = await handleRuntimeTicketList(
        new Request(
          "https://synthetic-support.support.servicev8.com/api/runtime/tickets?limit=25",
        ),
        { authorize: auth as never, list },
      );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(
      (list.mock.calls as unknown as Array<[unknown, unknown]>)[0]?.[1],
    ).toEqual({ limit: 25 });
    const get = vi.fn(async () => null);
    expect(
      (
        await handleRuntimeTicketDetail(
          new Request(
            "https://synthetic-support.support.servicev8.com/api/runtime/tickets/a",
          ),
          "a",
          { authorize: auth as never, get },
        )
      ).status,
    ).toBe(404);
  });
  it("sanitizes auth, query and availability failures", async () => {
    expect(
      (
        await handleRuntimeTicketList(
          new Request("https://x/api/runtime/tickets"),
          { authorize: async () => null },
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await handleRuntimeTicketList(
          new Request("https://x/api/runtime/tickets?limit=1&limit=2"),
          { authorize: auth as never },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handleRuntimeTicketList(
          new Request("https://x/api/runtime/tickets"),
          {
            authorize: auth as never,
            list: async () => {
              throw new Error("database details");
            },
          },
        )
      ).status,
    ).toBe(503);
  });
  it("permits only current managers to create and update tickets", async () => {
    const manage = async () => ({
      ...(await auth()),
      role: "support:manage" as const,
    });
    const create = vi.fn(async () => ({ id: "ticket-new" }) as never);
    const created = await handleRuntimeTicketCreate(
      new Request(
        "https://synthetic-support.support.servicev8.com/api/runtime/tickets",
        {
          method: "POST",
          headers: {
            host: "synthetic-support.support.servicev8.com",
            origin: "https://synthetic-support.support.servicev8.com",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            customerName: "Synthetic Customer",
            summary: "Needs help",
            priority: "high",
          }),
        },
      ),
      { authorize: manage as never, create },
    );
    expect(created.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId }),
      {
        customerName: "Synthetic Customer",
        summary: "Needs help",
        priority: "high",
      },
    );
    const update = vi.fn(async () => ({ id: "ticket-1" }) as never);
    expect(
      (
        await handleRuntimeTicketUpdate(
          new Request(
            "https://synthetic-support.support.servicev8.com/api/runtime/tickets/ticket-1",
            {
              method: "PATCH",
              headers: {
                host: "synthetic-support.support.servicev8.com",
                origin: "https://synthetic-support.support.servicev8.com",
                "content-type": "application/json",
              },
              body: JSON.stringify({ status: "resolved" }),
            },
          ),
          "ticket-1",
          { authorize: manage as never, update },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await handleRuntimeTicketCreate(
          new Request(
            "https://synthetic-support.support.servicev8.com/api/runtime/tickets",
            {
              method: "POST",
              headers: {
                host: "synthetic-support.support.servicev8.com",
                origin: "https://synthetic-support.support.servicev8.com",
                "content-type": "application/json",
              },
              body: "{}",
            },
          ),
          { authorize: auth as never, create },
        )
      ).status,
    ).toBe(403);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["missing origin", undefined, { customerName: "A", summary: "B" }],
    [
      "cross origin",
      "https://evil.example",
      { customerName: "A", summary: "B" },
    ],
    [
      "unknown field",
      "https://synthetic-support.support.servicev8.com",
      { customerName: "A", summary: "B", tenantId: workspaceId },
    ],
  ])("rejects %s before storage", async (_name, origin, body) => {
    const manage = async () => ({
      ...(await auth()),
      role: "support:manage" as const,
    });
    const create = vi.fn();
    const headers: Record<string, string> = {
      host: "synthetic-support.support.servicev8.com",
      "content-type": "application/json",
    };
    if (origin) headers.origin = origin;
    const response = await handleRuntimeTicketCreate(
      new Request(
        "https://synthetic-support.support.servicev8.com/api/runtime/tickets",
        { method: "POST", headers, body: JSON.stringify(body) },
      ),
      { authorize: manage as never, create },
    );
    expect(response.status).toBe(
      origin?.includes("synthetic-support") ? 400 : 403,
    );
    expect(create).not.toHaveBeenCalled();
  });
  it("stops reading a chunked oversized write before storage", async () => {
    const manage = async () => ({
        ...(await auth()),
        role: "support:manage" as const,
      }),
      create = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"summary":"'));
        controller.enqueue(new Uint8Array(17_000));
        controller.close();
      },
    });
    const response = await handleRuntimeTicketCreate(
      new Request(
        "https://synthetic-support.support.servicev8.com/api/runtime/tickets",
        {
          method: "POST",
          headers: {
            host: "synthetic-support.support.servicev8.com",
            origin: "https://synthetic-support.support.servicev8.com",
            "content-type": "application/json",
          },
          body,
          duplex: "half",
        } as RequestInit,
      ),
      { authorize: manage as never, create },
    );
    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
  it("returns a truthful conflict for sources requiring their native editor",async()=>{
    const manage=async()=>({...(await auth()),role:"support:manage" as const});
    const response=await handleRuntimeTicketUpdate(new Request("https://synthetic-support.support.servicev8.com/api/runtime/tickets/chat-1",{method:"PATCH",headers:{host:"synthetic-support.support.servicev8.com",origin:"https://synthetic-support.support.servicev8.com","content-type":"application/json"},body:JSON.stringify({status:"resolved"})}),"chat-1",{authorize:manage as never,update:async()=>{throw new Error("unsupported_ticket_source")}});
    expect(response.status).toBe(409);expect(await response.json()).toEqual({error:"ticket source requires its native editor"});
  });
});

describe("legacy and runtime route isolation", () => {
  it("rejects an unverifiable runtime cookie at the native boundary", async () => {
    const token = signRuntimeSupportSession(
      {
        accountId: claims.accountId,
        tenantId: claims.tenantId,
        verticalId: "runtime",
        installationId: claims.installationId,
        workspaceId,
        sub: claims.sub,
        roleCap: "support:read",
        tenantDomain: claims.tenantDomain,
      },
      sessionSecret,
      now,
    )!;
    await expect(resolveRequestTenant(
      new Request("http://127.0.0.1:3000/api/issues", {
        headers: {
          host: "synthetic-support.support.servicev8.com",
          cookie: runtimeSupportCookie(token),
        },
      }),
    )).rejects.toThrow("Invalid or revoked workspace session");
  });
  it("wires the actual route exports to the dedicated boundaries", async () => {
    const handoff = await import("@/app/auth/runtime/handoff/route");
    const list = await import("@/app/api/runtime/tickets/route");
    const detail = await import("@/app/api/runtime/tickets/[id]/route");
    const headers = { host: "synthetic-support.support.servicev8.com" };
    expect(
      (
        await handoff.POST(
          new Request("http://127.0.0.1:3000/auth/runtime/handoff", {
            method: "POST",
            headers,
          }),
        )
      ).status,
    ).toBe(405);
    expect(
      (
        await list.GET(
          new Request("http://127.0.0.1:3000/api/runtime/tickets", { headers }),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await detail.GET(
          new Request("http://127.0.0.1:3000/api/runtime/tickets/a", {
            headers,
          }),
          { params: Promise.resolve({ id: "a" }) },
        )
      ).status,
    ).toBe(401);
  });
});

describe("runtime logout", () => {
  it("requires same origin and clears only the runtime cookie with matching attributes", async () => {
    const { POST } = await import("@/app/auth/runtime/logout/route");
    const denied = await POST(
      new Request("http://127.0.0.1:3000/auth/runtime/logout", {
        method: "POST",
        headers: {
          host: "synthetic-support.support.servicev8.com",
          origin: "https://other.example",
          "sec-fetch-site": "cross-site",
        },
      }),
    );
    expect(denied.status).toBe(403);
    expect(denied.headers.has("set-cookie")).toBe(false);
    const response = await POST(
      new Request("http://127.0.0.1:3000/auth/runtime/logout", {
        method: "POST",
        headers: {
          host: "synthetic-support.support.servicev8.com",
          origin: "https://synthetic-support.support.servicev8.com",
          "sec-fetch-site": "same-origin",
        },
      }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toBe(
      "__Host-sv8_runtime_support=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    );
    expect(response.headers.get("set-cookie")).not.toContain(
      "sv8_access_token",
    );
  });
});
