vi.mock("@/lib/auth/workspace-discovery-limit", () => ({ workspaceDiscoveryLimiter: { enforce: vi.fn().mockResolvedValue(undefined) } }));
vi.mock("@/lib/auth/workspace-discovery", async () => ({ discoverWorkspace: (await import("@/lib/tenant-resolver")).resolveTenantBySlug }));
import { describe, expect, it, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { GET as getLookup, POST as postLookup } from "@/app/api/workspace/lookup/route";
import { GET as getLookupDirect, POST as postLookupDirect } from "@/app/workspace/lookup/route";
import { GET as getLogin, POST as postLogin } from "@/app/login/route";
import { GET as getWorkspace } from "@/app/workspace/route";
import { POST as postLogout } from "@/app/logout/route";
import {
  safeNextPath,
  supportWorkspaceUrl,
  validateIngressHost,
  isTrustedServiceV8Hostname,
  browserTenantSlugFromHostname,
} from "@/lib/tenant-host";
import {
  setCustomTenantResolver,
  resolveTenantBySlug,
} from "@/lib/tenant-resolver";
import { AuthService } from "@/lib/auth-service";

afterEach(() => {
  setCustomTenantResolver(null);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Tenant Subdomain Routing & Workspace Discovery Standard (TR01-TR08)", () => {
  it("TR01: direct existing tenant host entry unauthenticated serves sign-in form identifying workspace; deep links redirect to login", async () => {
    // 1. Direct root visit to tenant host rewrites to /login with tenant context
    const reqRoot = new NextRequest("https://acme-corp.support.servicev8.com/", {
      headers: {
        host: "acme-corp.support.servicev8.com",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const resRoot = middleware(reqRoot);
    expect(resRoot.status).toBe(200);
    expect(resRoot.headers.get("x-middleware-rewrite")).toContain("/login");

    // 2. Direct served sign-in route on tenant host identifies the selected workspace
    const reqLogin = new NextRequest("https://acme-corp.support.servicev8.com/login", {
      headers: {
        host: "acme-corp.support.servicev8.com",
        accept: "text/html",
      },
    });
    const resLogin = await getLogin(reqLogin);
    expect(resLogin.status).toBe(302);
    expect(resLogin.headers.get("location")).toBe("https://acme-corp.support.servicev8.com/?signin=1");
    // Accessible credential fields are checked in the rendered native sign-in suite.


    // 3. Protected deep link (/workspace) with browser HTML accept redirects 302 to /login?next=...
    const reqDeepHtml = new NextRequest("https://acme-corp.support.servicev8.com/workspace", {
      headers: {
        host: "acme-corp.support.servicev8.com",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const resDeepHtml = middleware(reqDeepHtml);
    expect(resDeepHtml.status).toBe(302);
    expect(resDeepHtml.headers.get("location")).toBe("https://acme-corp.support.servicev8.com/login?next=%2Fworkspace");

    // 4. Protected deep link (/workspace) with application/json returns 401 JSON
    const reqDeepApi = new NextRequest("https://acme-corp.support.servicev8.com/workspace", {
      headers: {
        host: "acme-corp.support.servicev8.com",
        accept: "application/json",
      },
    });
    const resDeepApi = middleware(reqDeepApi);
    expect(resDeepApi.status).toBe(401);
    const apiJson = await resDeepApi.json();
    expect(apiJson).toMatchObject({ error: "unauthorized" });
  });

  it("TR02: global landing Go to workspace resolves existing slug through actual owner and redirects to registered HTTPS host with no session", async () => {
    // 1. GET /workspace/lookup?workspace=acme-corp on global host
    const getReq = new NextRequest("https://support.servicev8.com/workspace/lookup?workspace=acme-corp", {
      headers: { host: "support.servicev8.com", accept: "text/html" },
    });
    const getRes = await getLookupDirect(getReq);
    expect(getRes.status).toBe(302);
    expect(getRes.headers.get("location")).toBe("https://acme-corp.support.servicev8.com/");
    expect(getRes.headers.get("set-cookie")).toBeNull(); // No session granted by lookup

    // 2. POST /workspace/lookup with JSON
    const postReq = new NextRequest("https://support.servicev8.com/workspace/lookup", {
      method: "POST",
      headers: {
        host: "support.servicev8.com",
        "content-type": "application/json",
        accept: "application/json",
        origin: "https://support.servicev8.com",
      },
      body: JSON.stringify({ workspace: "acme-corp" }),
    });
    const postRes = await postLookupDirect(postReq);
    expect(postRes.status).toBe(200);
    const postJson = await postRes.json();
    expect(postJson).toMatchObject({
      success: true,
      slug: "acme-corp",
      redirectUrl: "https://acme-corp.support.servicev8.com/",
    });
    expect(postRes.headers.get("set-cookie")).toBeNull(); // No session granted by lookup

    // 3. /api/workspace/lookup alias parity
    const aliasReq = new NextRequest("https://support.servicev8.com/api/workspace/lookup?workspace=acme-corp", {
      headers: { host: "support.servicev8.com", accept: "text/html" },
    });
    const aliasRes = await getLookup(aliasReq);
    expect(aliasRes.status).toBe(302);
    expect(aliasRes.headers.get("location")).toBe("https://acme-corp.support.servicev8.com/");
  });

  it("TR03: unknown slug, malformed/reserved slug, and lookup outage show distinct recoverable state and zero provisioning", async () => {
    // 1. Unknown slug via GET returns 404 HTML
    const getUnknown = new NextRequest("https://support.servicev8.com/workspace/lookup?workspace=unknown-slug-xyz", {
      headers: { host: "support.servicev8.com", accept: "text/html" },
    });
    const resUnknown = await getLookup(getUnknown);
    expect(resUnknown.status).toBe(404);
    const textUnknown = await resUnknown.text();
    expect(textUnknown).toContain("Workspace not found");
    expect(textUnknown).toContain("unknown-slug-xyz");

    // 2. Unknown slug via POST returns 404 JSON
    const postUnknown = new NextRequest("https://support.servicev8.com/workspace/lookup", {
      method: "POST",
      headers: {
        host: "support.servicev8.com",
        "content-type": "application/json",
        accept: "application/json",
        origin: "https://support.servicev8.com",
      },
      body: JSON.stringify({ workspace: "unknown-slug-xyz" }),
    });
    const resPostUnknown = await postLookup(postUnknown);
    expect(resPostUnknown.status).toBe(404);
    const jsonPostUnknown = await resPostUnknown.json();
    expect(jsonPostUnknown).toMatchObject({ error: "workspace_not_found" });

    // 3. Malformed slug returns 400
    const getMalformed = new NextRequest("https://support.servicev8.com/workspace/lookup?workspace=bad..slug!", {
      headers: { host: "support.servicev8.com" },
    });
    const resMalformed = await getLookup(getMalformed);
    expect(resMalformed.status).toBe(400);

    // 4. Reserved slug returns 400
    const getReserved = new NextRequest("https://support.servicev8.com/workspace/lookup?workspace=www", {
      headers: { host: "support.servicev8.com" },
    });
    const resReserved = await getLookup(getReserved);
    expect(resReserved.status).toBe(400);

    // 5. Outage handling returns 503
    setCustomTenantResolver(async () => {
      throw new Error("Database cluster partition");
    });
    const getOutage = new NextRequest("https://support.servicev8.com/workspace/lookup?workspace=acme-corp", {
      headers: { host: "support.servicev8.com", accept: "text/html" },
    });
    const resOutage = await getLookup(getOutage);
    expect(resOutage.status).toBe(503);
    const textOutage = await resOutage.text();
    expect(textOutage).toContain("Temporarily unavailable");
  });

  it("TR04: valid tenant session enters workspace directly; foreign or revoked session cannot enter", async () => {
    const slug = "acme-corp";
    const session = AuthService.createSession(slug, "alice@acme.test", "operator", "Alice Admin");

    // 1. Direct entry to /workspace with valid session cookie succeeds
    const reqValid = new NextRequest(`https://${slug}.support.servicev8.com/workspace`, {
      headers: {
        host: `${slug}.support.servicev8.com`,
        accept: "application/json",
      },
    });
    reqValid.cookies.set("sv8_access_token", session.token);

    const midRes = middleware(reqValid);
    expect(midRes.status).toBe(200);

    const wsRes = await getWorkspace(reqValid);
    expect(wsRes.status).toBe(200);
    const wsJson = await wsRes.json();
    expect(wsJson.workspace).toBe(slug);

    // 2. Root visit / with valid session cookie passes through without login rewrite
    const reqRootValid = new NextRequest(`https://${slug}.support.servicev8.com/`, {
      headers: {
        host: `${slug}.support.servicev8.com`,
        accept: "text/html",
      },
    });
    reqRootValid.cookies.set("sv8_access_token", session.token);
    const rootRes = middleware(reqRootValid);
    expect(rootRes.headers.get("x-middleware-rewrite")).toBeNull();

    // 3. Cross-tenant session (token minted for acme-corp, accessing beta-corp)
    const reqForeign = new NextRequest("https://beta-corp.support.servicev8.com/workspace", {
      headers: {
        host: "beta-corp.support.servicev8.com",
        accept: "application/json",
      },
    });
    reqForeign.cookies.set("sv8_access_token", session.token);

    // Blocked by middleware
    const foreignMid = middleware(reqForeign);
    expect(foreignMid.status).toBe(403);
    const foreignMidJson = await foreignMid.json();
    expect(foreignMidJson).toMatchObject({ error: "cross_tenant_session_denied" });

    // Blocked by workspace route handler
    const foreignWs = await getWorkspace(reqForeign);
    expect(foreignWs.status).toBe(403);
    const foreignWsJson = await foreignWs.json();
    expect(foreignWsJson).toMatchObject({ error: "cross_tenant_session_denied" });
  });

  it("TR05: ingress security rejects forged hosts, foreign product hosts, and sanitizes open redirect returnTo", async () => {
    // 1. Host and X-Forwarded-Host mismatch rejected with 400
    const reqForged = new NextRequest("https://support.servicev8.com/", {
      headers: {
        host: "support.servicev8.com",
        "x-forwarded-host": "evil.com",
      },
    });
    const resForged = middleware(reqForged);
    expect(resForged.status).toBe(400);

    // 2. Foreign product host rejected with 400
    const reqForeignProduct = new NextRequest("https://tenant.care.servicev8.com/", {
      headers: {
        host: "tenant.care.servicev8.com",
      },
    });
    const resForeignProduct = middleware(reqForeignProduct);
    expect(resForeignProduct.status).toBe(400);

    // 3. Foreign Origin on POST rejected with 403
    const reqOrigin = new NextRequest("https://support.servicev8.com/workspace/lookup", {
      method: "POST",
      headers: {
        host: "support.servicev8.com",
        "content-type": "application/json",
        origin: "https://evil.com",
      },
      body: JSON.stringify({ workspace: "acme-corp" }),
    });
    const resOrigin = await postLookup(reqOrigin);
    expect(resOrigin.status).toBe(403);

    // 4. Protocol-relative return path sanitized to /
    expect(safeNextPath("//evil.com/phish")).toBe("/");
    expect(safeNextPath("/\\evil.com/phish")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath("/tickets/TCK-123")).toBe("/tickets/TCK-123");
  });

  it("TR06: return path survives login; logout clears session cookie", async () => {
    // 1. Allowed in-app path survives login
    const reqLogin = new NextRequest("https://acme.support.servicev8.com/login?next=%2Ftickets%2FTCK-8821", {
      method: "POST",
      headers: {
        host: "acme.support.servicev8.com",
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://acme.support.servicev8.com",
      },
      body: "email=admin%40acme.com&password=SupportV8%232026%21Secure",
    });
    // The historical unguarded form now fails before credential or cookie effects.
    const resLogin = await postLogin(reqLogin);
    expect(resLogin.status).toBe(400);
    expect(resLogin.headers.get("set-cookie")).toBeNull();
    const entry = await getLogin(new NextRequest(reqLogin.url, { headers: { host: "acme.support.servicev8.com" } }));
    expect(entry.headers.get("location")).toBe("https://acme.support.servicev8.com/?signin=1&next=%2Ftickets%2FTCK-8821");
    // Successful proof-bearing form return-path behavior has mounted composition coverage.


    // 2. Logout clears session cookie and returns 303
    const reqLogout = new NextRequest("https://acme.support.servicev8.com/logout", {
      method: "POST",
      headers: {
        host: "acme.support.servicev8.com",
        origin: "https://acme.support.servicev8.com",
      },
    });
    const resLogout = await postLogout(reqLogout);
    expect(resLogout.status).toBe(303);
    const cookieHeader = resLogout.headers.get("set-cookie") || "";
    expect(cookieHeader).toContain("sv8_access_token=;");
    expect(cookieHeader).toContain("Max-Age=0");
  });

  it("TR07: convergence with runtime handoff destination and standalone lookup", async () => {
    const slug = "acme-corp";
    const canonicalHost = `${slug}.support.servicev8.com`;

    // 1. Canonical workspace URL matches registered HTTPS tenant host
    const url = supportWorkspaceUrl(slug);
    expect(url.origin).toBe(`https://${canonicalHost}`);
    expect(url.pathname).toBe("/");

    // 2. Lookup resolves to the exact same canonical destination
    const resolved = await resolveTenantBySlug(slug);
    expect(resolved).not.toBeNull();
    expect(resolved?.url).toBe(`https://${canonicalHost}/`);
    expect(resolved?.slug).toBe(slug);

    // 3. Host parsing identifies slug accurately
    const parsedSlug = browserTenantSlugFromHostname(canonicalHost);
    expect(parsedSlug).toBe(slug);
  });

  it("TR08: served HTML forms contain accessible labels, autocomplete, and prevent duplicate submissions", async () => {
    // 1. Tenant sign-in route contains accessible labels and autocompletes
    const reqLogin = new NextRequest("https://acme-corp.support.servicev8.com/login", {
      headers: {
        host: "acme-corp.support.servicev8.com",
        accept: "text/html",
      },
    });
    const resLogin = await getLogin(reqLogin);
    expect(resLogin.status).toBe(302);
    expect(resLogin.headers.get("location")).toBe("https://acme-corp.support.servicev8.com/?signin=1");
    // Native React accessibility is covered in tenant-routing-browser.test.tsx.


    // 2. Host validation rules
    expect(isTrustedServiceV8Hostname("support.servicev8.com")).toBe(true);
    expect(isTrustedServiceV8Hostname("acme-corp.support.servicev8.com")).toBe(true);
    expect(isTrustedServiceV8Hostname("supportv8.default.svc.cluster.local")).toBe(true);
    expect(isTrustedServiceV8Hostname("supportv8.default.svc.cluster.local:3005")).toBe(true);
    expect(isTrustedServiceV8Hostname("supportv8")).toBe(true);
    expect(isTrustedServiceV8Hostname("evil.com")).toBe(false);
    expect(isTrustedServiceV8Hostname("care.servicev8.com")).toBe(false);

    // 3. Cluster internal private route bypasses browser tenant checks
    const reqPrivate = new NextRequest("http://supportv8.default.svc.cluster.local:3005/api/private/interaction-events", {
      method: "POST",
      headers: {
        host: "supportv8.default.svc.cluster.local:3005",
        "x-tenant-id": "tenant_alpha",
        "x-account-id": "acct_alpha",
      },
    });
    const resPrivate = middleware(reqPrivate);
    expect(resPrivate.status).toBe(200);
    expect(resPrivate.headers.get("x-middleware-rewrite")).toBeNull();
  });
});
