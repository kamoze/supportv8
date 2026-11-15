// Domain-role unit cases isolate the current canonical authority. The real host,
// Registry and persisted binding composition is tested separately.
vi.mock("@/lib/auth/canonical-request-workspace",()=>({authorizeCanonicalRequestWorkspace:vi.fn(async()=>({nativeTenantId:"tenant_acme",slug:"acme",accountId:"account-acme"}))}));
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/keycloak", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/keycloak")>();
  return {
    ...actual,
    verifySupportAccessToken: vi.fn(),
  };
});

vi.mock("@/lib/service-app/runtime-session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/service-app/runtime-session")>();
  return {
    ...actual,
    authorizeRuntimeSupportRequest: vi.fn(),
  };
});

import { verifySupportAccessToken } from "@/lib/auth/keycloak";
import { authorizeRuntimeSupportRequest } from "@/lib/service-app/runtime-session";
import {
  RequestAuthError,
  normalizeTenantSlug,
  resolveRequestTenant,
  tenantIdFromSlug,
  tenantSlugFromHostname,
  tenantSlugFromId,
} from "@/lib/auth/request-tenant";
import {
  authorizeMvpRead,
  authorizeMvpManage,
  requestAuthResponse,
} from "@/lib/auth/route-authorization";
import {
  browserTenantSlugFromHostname,
  resolveBrowserWorkspace,
} from "@/lib/tenant-host";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

function tokenWithRoles(roles: string[]): string {
  const payload = Buffer.from(
    JSON.stringify({ realm_access: { roles } }),
  ).toString("base64url");
  return `header.${payload}.signature`;
}

describe("trusted request tenant normalization", () => {
  it("maps hosted tenant domains to canonical database IDs", () => {
    expect(tenantSlugFromHostname("acme-movers.support.servicev8.com")).toBe(
      "acme-movers",
    );
    expect(tenantIdFromSlug("acme-movers")).toBe("tenant_acme_movers");
    expect(tenantSlugFromId("tenant_acme_movers")).toBe("acme-movers");
  });

  it("does not assign a tenant from the shared root host", () => {
    expect(tenantSlugFromHostname("support.servicev8.com")).toBeNull();
    expect(tenantSlugFromHostname("localhost:3005")).toBeNull();
  });

  it("locks the browser workspace to every valid hosted tenant, including acme", () => {
    expect(browserTenantSlugFromHostname("acme.support.servicev8.com")).toBe(
      "acme",
    );
    expect(
      browserTenantSlugFromHostname("fresh-customer.support.servicev8.com"),
    ).toBe("fresh-customer");
    expect(
      browserTenantSlugFromHostname("ACME.support.servicev8.internal:3005"),
    ).toBe("acme");
    expect(browserTenantSlugFromHostname("support.servicev8.com")).toBeNull();
    expect(
      browserTenantSlugFromHostname("www.support.servicev8.com"),
    ).toBeNull();
    expect(
      browserTenantSlugFromHostname("victim.support.attacker.tld"),
    ).toBeNull();
  });

  it("rejects chat intake from a forged or unknown Host header", () => {
    const response = middleware(
      new NextRequest("https://victim.support.attacker.tld/api/chat/session", {
        headers: { host: "victim.support.attacker.tld" },
      }),
    );

    expect(response.status).toBe(421);
  });

  it("accepts a valid tenant host and stamps its canonical tenant context", () => {
    const response = middleware(
      new NextRequest("https://acme.support.servicev8.com/api/chat/session", {
        headers: { host: "acme.support.servicev8.com" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-servicev8-tenant-domain")).toBe("acme");
  });

  it("allows only the intentional demo chat mutations", () => {
    const token = tokenWithRoles(["support_demo_operator"]);
    const blocked = middleware(
      new NextRequest("https://acme.support.servicev8.com/api/policies", {
        method: "POST",
        headers: {
          host: "acme.support.servicev8.com",
          cookie: `sv8_access_token=${token}`,
        },
      }),
    );
    const allowed = middleware(
      new NextRequest("https://acme.support.servicev8.com/api/chat/message", {
        method: "POST",
        headers: {
          host: "acme.support.servicev8.com",
          cookie: `sv8_access_token=${token}`,
        },
      }),
    );
    const draftAllowed = middleware(
      new NextRequest("https://acme.support.servicev8.com/api/chat/draft", {
        method: "POST",
        headers: {
          host: "acme.support.servicev8.com",
          cookie: `sv8_access_token=${token}`,
        },
      }),
    );
    const runtimeLogoutAllowed = middleware(
      new NextRequest(
        "https://acme.support.servicev8.com/auth/runtime/logout",
        {
          method: "POST",
          headers: {
            host: "acme.support.servicev8.com",
            cookie: `sv8_access_token=${token}; __Host-sv8_runtime_support=runtime-session`,
          },
        },
      ),
    );

    expect(blocked.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(draftAllowed.status).toBe(200);
    expect(runtimeLogoutAllowed.status).toBe(200);
  });

  it("applies the demo mutation firewall to bearer tokens as well as cookies", () => {
    const response = middleware(
      new NextRequest("https://acme.support.servicev8.com/api/credits", {
        method: "POST",
        headers: {
          host: "acme.support.servicev8.com",
          authorization: `Bearer ${tokenWithRoles(["support_demo_operator"])}`,
        },
      }),
    );

    expect(response.status).toBe(403);
  });

  it("does not use an unverified token to grant write access", () => {
    const response = middleware(
      new NextRequest("https://acme.support.servicev8.com/api/policies", {
        method: "POST",
        headers: {
          host: "acme.support.servicev8.com",
          cookie: `sv8_access_token=${tokenWithRoles(["support_operator"])}`,
        },
      }),
    );

    // The signed-token check remains the responsibility of the route. The
    // middleware only adds an early denial for restricted demo tokens.
    expect(response.status).toBe(200);
  });

  it("keeps the hosted tenant authoritative across URL and saved-session state", () => {
    expect(
      resolveBrowserWorkspace({
        hostname: "acme.support.servicev8.com",
        tenantParam: "meridian",
        activeTenant: "meridian",
      }),
    ).toEqual({ tenantSlug: "acme", viewMode: "tenant_landing" });

    expect(
      resolveBrowserWorkspace({
        hostname: "acme.support.servicev8.com",
        activeTenant: "acme",
      }),
    ).toEqual({ tenantSlug: "acme", viewMode: "cockpit" });
  });

  it("rejects empty and malformed tenant domains", () => {
    expect(() => normalizeTenantSlug("---")).toThrow("Invalid tenant domain");
    expect(() => tenantSlugFromId("postgres")).toThrow("valid tenant claim");
  });
});

it('a Runtime cookie cannot reach legacy global mutations, even with a manager browser label',()=>{
 for(const path of ['/api/policies','/api/workforce','/api/credits','/api/voice/session']) {
  const response=middleware(new NextRequest(`https://acme.support.servicev8.com${path}`,{method:'POST',headers:{host:'acme.support.servicev8.com',cookie:'__Host-sv8_runtime_support=unverified'}}));
  expect(response.status).toBe(403);
 }
});
it('allows scoped tenant mutations like knowledge, marketplace, and customers to reach tenant storage with a Runtime session', () => {
  for (const path of ['/api/knowledge', '/api/knowledge/upload', '/api/marketplace', '/api/customers', '/api/customers/cust_test123']) {
    const response = middleware(
      new NextRequest(`https://acme.support.servicev8.com${path}`, {
        method: 'POST',
        headers: {
          host: 'acme.support.servicev8.com',
          cookie: '__Host-sv8_runtime_support=unverified',
        },
      }),
    );
    expect(response.status).toBe(200);
  }
});
it('stale demo metadata cannot deny a handoff before its native route verifies authority',()=>{
 const response=middleware(new NextRequest('https://acme.support.servicev8.com/api/issues',{method:'POST',headers:{host:'acme.support.servicev8.com',cookie:`__Host-sv8_runtime_support=unverified; sv8_access_token=${tokenWithRoles(['support_demo_operator'])}`}}));
 expect(response.status).not.toBe(403);
});

it('allows website chat and operator chat mutations to reach tenant storage with a Runtime session', () => {
  for (const path of ['/api/chat/session', '/api/chat/message', '/api/chat/draft', '/api/chat/stream']) {
    const response = middleware(
      new NextRequest(`https://acme.support.servicev8.com${path}`, {
        method: 'POST',
        headers: {
          host: 'acme.support.servicev8.com',
          cookie: '__Host-sv8_runtime_support=unverified',
        },
      }),
    );
    expect(response.status).not.toBe(403);
  }
});

describe("resolveRequestTenant enforcement and forgery resistance", () => {
  it("throws 401 when unauthenticated in production with requireAuthentication", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const req = new NextRequest("https://acme.support.servicev8.com/api/problems", {
        headers: { host: "acme.support.servicev8.com" },
      });
      await expect(
        resolveRequestTenant(req, { requireAuthentication: true }),
      ).rejects.toMatchObject({
        status: 401,
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("forged headers and query parameters cannot override an authenticated token", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      vi.mocked(verifySupportAccessToken).mockResolvedValue({
        sub: "usr_acme",
        preferred_username: "operator@acme.com",
        tenant_id: "tenant_acme",
        azp: "supportv8-acme",
        realm_access: { roles: ["support_cx_lead", "support_operator"] },
      });

      const req = new NextRequest(
        "https://acme.support.servicev8.com/api/problems?tenant=meridian",
        {
          headers: {
            host: "acme.support.servicev8.com",
            authorization: "Bearer valid-acme-token",
            "x-tenant-slug": "meridian",
            "x-tenant-id": "tenant_meridian",
          },
        },
      );

      const context = await resolveRequestTenant(req, { requireAuthentication: true });
      expect(context.tenantId).toBe("tenant_acme");
      expect(context.tenantSlug).toBe("acme");
      expect(context.authenticated).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("forged headers and query parameters cannot override an authenticated runtime session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      vi.mocked(authorizeRuntimeSupportRequest).mockResolvedValue({
        session: {
          version: "servicev8.support-session.v1",
          aud: "supportv8-runtime-session",
          tenantDomain: "acme",
          workspaceId: "tenant_acme",
          sub: "usr_acme",
          accountId: "acct_acme",
          tenantId: "tenant_acme",
          verticalId: "runtime",
          installationId: "inst_acme",
          roleCap: "support:manage",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        role: "support:manage",
        access: {
          accountId: "acct_acme",
          tenantId: "tenant_acme",
          verticalId: "runtime",
          installationId: "inst_acme",
          workspaceId: "tenant_acme",
          subject: "usr_acme",
          email: "operator@acme.com",
          domain: "acme",
          capability: "support:manage",
          poolAccountId: "acct_acme",
        },
      });

      const req = new NextRequest(
        "https://acme.support.servicev8.com/api/problems?tenant=meridian",
        {
          headers: {
            host: "acme.support.servicev8.com",
            cookie: "__Host-sv8_runtime_support=runtime-session-token",
            "x-tenant-slug": "meridian",
            "x-tenant-id": "tenant_meridian",
          },
        },
      );

      const context = await resolveRequestTenant(req, { requireAuthentication: true });
      expect(context.tenantId).toBe("tenant_acme");
      expect(context.tenantSlug).toBe("acme");
      expect(context.authenticated).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("MVP route authorization roles and responses", () => {
  it("authorizeMvpRead permits support_observer, support_operator, and support_cx_lead", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      for (const role of ["support_observer", "support_operator", "support_cx_lead"]) {
        vi.mocked(verifySupportAccessToken).mockResolvedValue({
          sub: "usr_test",
          preferred_username: "user@acme.com",
          tenant_id: "tenant_acme",
          azp: "supportv8-acme",
          realm_access: { roles: [role] },
        });

        const req = new NextRequest("https://acme.support.servicev8.com/api/problems", {
          headers: {
            host: "acme.support.servicev8.com",
            authorization: "Bearer valid-token",
          },
        });

        const ctx = await authorizeMvpRead(req);
        expect(ctx.tenantId).toBe("tenant_acme");
        expect(ctx.authenticated).toBe(true);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("authorizeMvpRead rejects authenticated identity with no permitted role with 403", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      vi.mocked(verifySupportAccessToken).mockResolvedValue({
        sub: "usr_test",
        preferred_username: "user@acme.com",
        tenant_id: "tenant_acme",
        azp: "supportv8-acme",
        realm_access: { roles: ["support_contractor"] },
      });

      const req = new NextRequest("https://acme.support.servicev8.com/api/problems", {
        headers: {
          host: "acme.support.servicev8.com",
          authorization: "Bearer valid-token",
        },
      });

      await expect(authorizeMvpRead(req)).rejects.toMatchObject({
        status: 403,
        message: "Forbidden",
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("authorizeMvpManage permits support_operator and support_cx_lead, but rejects support_observer with 403", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      for (const role of ["support_operator", "support_cx_lead"]) {
        vi.mocked(verifySupportAccessToken).mockResolvedValue({
          sub: "usr_test",
          preferred_username: "user@acme.com",
          tenant_id: "tenant_acme",
          azp: "supportv8-acme",
          realm_access: { roles: [role] },
        });

        const req = new NextRequest("https://acme.support.servicev8.com/api/problems", {
          headers: {
            host: "acme.support.servicev8.com",
            authorization: "Bearer valid-token",
          },
        });

        const ctx = await authorizeMvpManage(req);
        expect(ctx.tenantId).toBe("tenant_acme");
      }

      vi.mocked(verifySupportAccessToken).mockResolvedValue({
        sub: "usr_test",
        preferred_username: "user@acme.com",
        tenant_id: "tenant_acme",
        azp: "supportv8-acme",
        realm_access: { roles: ["support_observer"] },
      });

      const reqObserver = new NextRequest("https://acme.support.servicev8.com/api/problems", {
        headers: {
          host: "acme.support.servicev8.com",
          authorization: "Bearer valid-token",
        },
      });

      await expect(authorizeMvpManage(reqObserver)).rejects.toMatchObject({
        status: 403,
        message: "Forbidden",
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("requestAuthResponse generates correct JSON response for RequestAuthError and ignores generic errors", async () => {
    const err401 = new RequestAuthError("Unauthorized", 401);
    const res401 = requestAuthResponse(err401);
    expect(res401?.status).toBe(401);
    const body401 = await res401?.json();
    expect(body401).toEqual({ success: false, error: "Unauthorized" });

    const err403 = new RequestAuthError("Forbidden", 403);
    const res403 = requestAuthResponse(err403);
    expect(res403?.status).toBe(403);
    const body403 = await res403?.json();
    expect(body403).toEqual({ success: false, error: "Forbidden" });

    expect(requestAuthResponse(new Error("generic error"))).toBeUndefined();
  });
});


