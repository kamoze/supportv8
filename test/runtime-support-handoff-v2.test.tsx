// @vitest-environment jsdom
import React, { act } from "react";
import { createHmac, randomUUID } from "node:crypto";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  verifyRuntimeSupportHandoffToken,
  type RuntimeSupportHandoffClaims,
} from "@/lib/service-app/runtime-handoff-claims";
import { handleRuntimeSupportHandoff } from "@/lib/service-app/runtime-handoff";
import {
  authorizeRuntimeSupportRequest,
  signRuntimeSupportSession,
  verifyRuntimeSupportSession,
} from "@/lib/service-app/runtime-session";
import { isTrustedRuntimeWorkspaceUrl, trustedRuntimeHost } from "@/lib/service-app/runtime-url";
import { runtimeShellUrl } from "@/lib/auth-service";
import { setCustomRuntimeAccessResolverForTesting } from "@/lib/service-app/runtime-session";
import { GET as workspaceSession } from "@/app/api/auth/workspace-session/route";
import { SupportFamilyShell } from "@/components/shell/SupportFamilyShell";
import { SUPPORT_SHELL_TOOLS, supportShellNav } from "@/components/shell/support-nav";

// Hand-off v2 (servicev8.support-handoff.v2) = v1 + runtimeUrl (kamoze/servicev8-agentic-runtime#187).
const secret = "handoff-secret-that-is-at-least-thirty-two-bytes";
const sessionSecret = "session-secret-that-is-at-least-thirty-two-bytes";
const now = 1_800_000_000;
const workspaceId = `tenant_rt_${"a".repeat(48)}`;
const domain = "synthetic-support";
const host = `${domain}.support.servicev8.com`;
const BASE_URL = `https://runtime.servicev8.com/workspace/${domain}`;
const TENANT_URL = `https://${domain}.runtime.servicev8.com/workspace/${domain}`;
const v1: RuntimeSupportHandoffClaims = {
  version: "servicev8.support-handoff.v1",
  iss: "runtime",
  aud: "supportv8-service-app",
  sub: "member-1",
  accountId: "acct-1",
  tenantId: "registry-1",
  verticalId: "runtime",
  installationId: "install-1",
  externalWorkspaceId: workspaceId,
  tenantDomain: domain,
  role: "support:manage",
  destination: `https://${host}/auth/runtime/handoff`,
  iat: now - 1,
  exp: now + 59,
  jti: randomUUID(),
};
const v2 = (runtimeUrl: unknown = BASE_URL) => ({ ...v1, jti: randomUUID(), version: "servicev8.support-handoff.v2", runtimeUrl });
function jwt(body: unknown) {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`;
}
const access = {
  accountId: v1.accountId, tenantId: v1.tenantId, verticalId: "runtime" as const, installationId: v1.installationId,
  workspaceId, subject: v1.sub, capability: "support:manage" as const, email: "synthetic@example.test", domain,
};
const env = (origin?: string): Record<string, string> => (origin === undefined ? {} : { SUPPORTV8_RUNTIME_ORIGIN: origin });
const deps = (e: Record<string, string> = {}) => ({
  handoffSecret: secret, sessionSecret, now: () => now, env: e,
  replay: { consume: vi.fn(async () => true) },
  resolve: vi.fn(async () => access),
});
const admit = (token: string, d = deps()) =>
  handleRuntimeSupportHandoff(new Request(`http://127.0.0.1:3000/auth/runtime/handoff?token=${encodeURIComponent(token)}`, { headers: { host } }), d);
const cookieValue = (response: Response) => /__Host-sv8_runtime_support=([^;]+)/.exec(response.headers.get("set-cookie") ?? "")?.[1];

afterEach(() => { vi.unstubAllEnvs(); document.body.innerHTML = ""; });

describe("hand-off v1 keeps working", () => {
  it("verifies and admits v1 without a Runtime URL in the session", async () => {
    expect(verifyRuntimeSupportHandoffToken(jwt(v1), secret, now, env())).toEqual(v1);
    const response = await admit(jwt(v1));
    expect(response.status).toBe(303);
    const session = verifyRuntimeSupportSession(cookieValue(response), sessionSecret, host, now, env());
    expect(session).not.toBeNull();
    expect(session && Object.hasOwn(session, "runtimeUrl")).toBe(false);
  });

  it("keeps v1 working when SUPPORTV8_RUNTIME_ORIGIN is invalid", async () => {
    expect(verifyRuntimeSupportHandoffToken(jwt(v1), secret, now, env("http://runtime.servicev8.com"))).toEqual(v1);
    expect((await admit(jwt(v1), deps(env("not a url")))).status).toBe(303);
  });
});

describe("hand-off v2 carries the tenant's Runtime URL", () => {
  it.each([["the Runtime host", BASE_URL], ["a Runtime tenant host", TENANT_URL]])("admits v2 on %s and stores the URL in the session", async (_name, url) => {
    const claims = v2(url);
    expect(verifyRuntimeSupportHandoffToken(jwt(claims), secret, now, env())).toEqual(claims);
    const d = deps();
    const response = await admit(jwt(claims), d);
    expect(response.status).toBe(303);
    expect(d.resolve).toHaveBeenCalledOnce();
    const session = verifyRuntimeSupportSession(cookieValue(response), sessionSecret, host, now, env());
    expect(session?.runtimeUrl).toBe(url);
    const authorized = await authorizeRuntimeSupportRequest(
      new Request(`https://${host}/`, { headers: { host, cookie: `__Host-sv8_runtime_support=${cookieValue(response)}` } }),
      { secret: sessionSecret, resolve: async () => access, now: () => now },
    );
    expect(authorized?.session.runtimeUrl).toBe(url);
  });

  it("follows SUPPORTV8_RUNTIME_ORIGIN for the trusted Runtime host", () => {
    const e = env("https://runtime.example.test");
    expect(trustedRuntimeHost(e)).toBe("runtime.example.test");
    expect(verifyRuntimeSupportHandoffToken(jwt(v2(`https://runtime.example.test/workspace/${domain}`)), secret, now, e)).not.toBeNull();
    expect(verifyRuntimeSupportHandoffToken(jwt(v2(BASE_URL)), secret, now, e)).toBeNull();
    expect(trustedRuntimeHost(env(""))).toBe("runtime.servicev8.com");
    expect(trustedRuntimeHost(env("https://runtime.servicev8.com/"))).toBe("runtime.servicev8.com");
  });

  it.each([
    ["http scheme", "http://runtime.servicev8.com/workspace/synthetic-support"],
    ["credentials", "https://user:pass@runtime.servicev8.com/workspace/synthetic-support"],
    ["user only", "https://user@runtime.servicev8.com/workspace/synthetic-support"],
    ["explicit port", "https://runtime.servicev8.com:8443/workspace/synthetic-support"],
    ["default port", "https://runtime.servicev8.com:443/workspace/synthetic-support"],
    ["query", "https://runtime.servicev8.com/workspace/synthetic-support?next=/"],
    ["empty query", "https://runtime.servicev8.com/workspace/synthetic-support?"],
    ["fragment", "https://runtime.servicev8.com/workspace/synthetic-support#x"],
    ["empty fragment", "https://runtime.servicev8.com/workspace/synthetic-support#"],
    ["trailing slash", "https://runtime.servicev8.com/workspace/synthetic-support/"],
    ["deeper path", "https://runtime.servicev8.com/workspace/synthetic-support/settings"],
    ["other path", "https://runtime.servicev8.com/workspaces/synthetic-support"],
    ["dot segments", "https://runtime.servicev8.com/x/../workspace/synthetic-support"],
    ["encoded slug", "https://runtime.servicev8.com/workspace/synthetic%2Dsupport"],
    ["upper-case host", "https://RUNTIME.servicev8.com/workspace/synthetic-support"],
    ["other host", "https://evil.example/workspace/synthetic-support"],
    ["suffix host", "https://runtime.servicev8.com.evil.example/workspace/synthetic-support"],
    ["parent host", "https://servicev8.com/workspace/synthetic-support"],
    ["tenant label mismatch", "https://other-tenant.runtime.servicev8.com/workspace/synthetic-support"],
    ["nested tenant label", "https://a.synthetic-support.runtime.servicev8.com/workspace/synthetic-support"],
    ["other tenant's workspace", "https://runtime.servicev8.com/workspace/other-tenant"],
    ["slug breaking Runtime's rule", "https://runtime.servicev8.com/workspace/-bad"],
    ["not a URL", "runtime.servicev8.com/workspace/synthetic-support"],
    ["empty string", ""],
    ["number", 42],
    ["null", null],
    ["too long", `https://runtime.servicev8.com/workspace/${"a".repeat(600)}`],
  ])("rejects %s before any access lookup", async (_name, url) => {
    expect(isTrustedRuntimeWorkspaceUrl(url, domain, env())).toBe(false);
    expect(verifyRuntimeSupportHandoffToken(jwt(v2(url)), secret, now, env())).toBeNull();
    const d = deps();
    const response = await admit(jwt(v2(url)), d);
    expect(response.status).toBe(401);
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(d.resolve).not.toHaveBeenCalled();
    expect(d.replay.consume).not.toHaveBeenCalled();
  });

  it("enforces the version shapes: v2 needs runtimeUrl, v1 must not carry it, no other new fields", () => {
    const { runtimeUrl: _drop, ...withoutUrl } = v2();
    expect(verifyRuntimeSupportHandoffToken(jwt(withoutUrl), secret, now, env())).toBeNull();
    expect(verifyRuntimeSupportHandoffToken(jwt({ ...v1, runtimeUrl: BASE_URL }), secret, now, env())).toBeNull();
    expect(verifyRuntimeSupportHandoffToken(jwt({ ...v2(), backUrl: BASE_URL }), secret, now, env())).toBeNull();
    expect(verifyRuntimeSupportHandoffToken(jwt({ ...v2(), version: "servicev8.support-handoff.v3" }), secret, now, env())).toBeNull();
    // v2 keeps v1's optional claims.
    expect(verifyRuntimeSupportHandoffToken(jwt({ ...v2(), planId: "growth", credits: 10 }), secret, now, env())).not.toBeNull();
  });

  it.each(["http://runtime.servicev8.com", "https://runtime.servicev8.com/x", "https://runtime.servicev8.com:8443", "https://u:p@runtime.servicev8.com", "https://runtime.servicev8.com?x", "garbage"])(
    "refuses every v2 hand-off when SUPPORTV8_RUNTIME_ORIGIN is %s",
    async (origin) => {
      expect(trustedRuntimeHost(env(origin))).toBeNull();
      expect(verifyRuntimeSupportHandoffToken(jwt(v2()), secret, now, env(origin))).toBeNull();
      expect((await admit(jwt(v2()), deps(env(origin)))).status).toBe(401);
    },
  );
});

describe("the browser session descriptor", () => {
  it("carries the Runtime URL from a v2 session and omits it for v1", async () => {
    vi.stubEnv("SUPPORTV8_RUNTIME_SESSION_SECRET", sessionSecret);
    setCustomRuntimeAccessResolverForTesting(async () => access);
    try {
      for (const [claims, expected] of [[v2(TENANT_URL), TENANT_URL], [v1, undefined]] as const) {
        const cookie = cookieValue(await admit(jwt(claims)));
        const session = signRuntimeSupportSession({
          ...verifyRuntimeSupportSession(cookie, sessionSecret, host, now, env())!,
        }, sessionSecret);
        const payload = await (await workspaceSession(new Request(`https://${host}/api/auth/workspace-session`, {
          headers: { host, cookie: `__Host-sv8_runtime_support=${session}` },
        }))).json();
        expect(payload.session.source).toBe("runtime_handoff");
        expect(payload.session.runtimeUrl).toBe(expected);
      }
    } finally {
      setCustomRuntimeAccessResolverForTesting(null);
    }
  });
});

describe("the session re-checks the Runtime URL on every read", () => {
  const signed = (runtimeUrl: string) => signRuntimeSupportSession({
    accountId: v1.accountId, tenantId: v1.tenantId, verticalId: "runtime", installationId: v1.installationId,
    workspaceId, sub: v1.sub, roleCap: "support:manage", tenantDomain: domain, runtimeUrl,
  }, sessionSecret, now)!;

  it("drops a session whose URL is no longer trusted or belongs to another tenant", () => {
    expect(verifyRuntimeSupportSession(signed(BASE_URL), sessionSecret, host, now, env())?.runtimeUrl).toBe(BASE_URL);
    expect(verifyRuntimeSupportSession(signed(BASE_URL), sessionSecret, host, now, env("https://runtime.example.test"))).toBeNull();
    expect(verifyRuntimeSupportSession(signed("https://runtime.servicev8.com/workspace/other-tenant"), sessionSecret, host, now, env())).toBeNull();
    expect(verifyRuntimeSupportSession(signed("https://evil.example/workspace/synthetic-support"), sessionSecret, host, now, env())).toBeNull();
  });
});

describe("the embedded shell links to Runtime only with a hand-off URL", () => {
  const nav = supportShellNav([
    { title: "ECOSYSTEM", items: [{ id: "studio_marketplace", label: "Marketplace" }, { id: "customers", label: "Customers" }] },
    { title: "SETTINGS", items: [{ id: "market_plans", label: "Plan" }, { id: "gov_settings", label: "Credits" }, { id: "gov_members", label: "Members" }] },
  ], { contractor: false });
  const shell = (mode: "standalone" | "embedded", runtimeUrl?: string) => (
    <SupportFamilyShell mode={mode} runtimeUrl={runtimeUrl} active="customers" nav={nav} tools={SUPPORT_SHELL_TOOLS} tenant={domain} onNavigate={vi.fn()} onSignOut={vi.fn()} onTool={vi.fn()}>
      <main />
    </SupportFamilyShell>
  );

  it("never renders runtime-url on a standalone page", () => {
    expect(renderToStaticMarkup(shell("standalone", BASE_URL))).not.toContain("runtime-url");
    expect(renderToStaticMarkup(shell("embedded"))).not.toContain("runtime-url");
    expect(renderToStaticMarkup(shell("embedded", BASE_URL))).toContain(`runtime-url="${BASE_URL}"`);
  });

  it("passes the URL only for a Runtime hand-off session of the same tenant", () => {
    const handoff = { token: "workspace:1", source: "runtime_handoff", tenantSlug: domain };
    expect(runtimeShellUrl({ ...handoff, runtimeUrl: TENANT_URL })).toBe(TENANT_URL);
    expect(runtimeShellUrl(handoff)).toBeUndefined();
    expect(runtimeShellUrl({ token: "sv8_tk_x", tenantSlug: domain, runtimeUrl: BASE_URL })).toBeUndefined();
    expect(runtimeShellUrl({ ...handoff, runtimeUrl: "https://runtime.servicev8.com/workspace/other" })).toBeUndefined();
    expect(runtimeShellUrl({ ...handoff, runtimeUrl: "javascript:alert(1)" })).toBeUndefined();
  });

  it("points Marketplace and Plan at Runtime and keeps Members and settings in the app", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    await import("../public/vendor/family-ui/family.js");
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(shell("embedded", TENANT_URL)));
    await act(async () => { await customElements.whenDefined("sv8-sidebar"); });
    const link = (id: string) => container.querySelector<HTMLAnchorElement>(`.sv8-sidebar-desktop a.sv8-nav-item[data-id="${id}"]`);
    expect(container.querySelector("sv8-shell")?.getAttribute("runtime-url")).toBe(TENANT_URL);
    expect(link("studio_marketplace")?.href).toBe(`https://${domain}.runtime.servicev8.com/auth/marketplace`);
    expect(link("market_plans")?.href).toBe(`${TENANT_URL}/settings/plan`);
    for (const id of ["gov_members", "gov_settings", "customers"]) expect(link(id)?.getAttribute("href")).toBe(`/?tab=${id}`);
    expect(container.querySelector<HTMLAnchorElement>(".sv8-sidebar-desktop a.sv8-back")?.href).toBe(TENANT_URL);
    // Runtime links are real navigations, not routed through the app.
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link("studio_marketplace")!.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });
});
