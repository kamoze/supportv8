import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { invitationEmail, sendInvitationEmail } from "@/lib/auth/invitation-email";
import { supportWorkspaceUrl } from "@/lib/tenant-host";
import { AuthService } from "@/lib/auth-service";
import { middleware } from "@/middleware";
const source = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("customers stay inside SupportV8 for authentication", () => {
  it("emails only the canonical tenant invitation URL with the credential in a fragment", () => {
    const email = invitationEmail("person@example.test", "alpha", "opaque-secret");
    const urls = email.text.match(/https:\/\/\S+/g)!;
    expect(urls).toHaveLength(1);
    const url = new URL(urls[0]);
    expect(url.origin).toBe("https://alpha.support.servicev8.com");
    expect(url.pathname).toBe("/accept-invite"); expect(url.search).toBe("");
    expect(url.hash).toBe("#token=opaque-secret"); expect(email.text.toLowerCase()).not.toContain("keycloak");
  });
  it.each(["alpha.evil.test", "alpha/support", "https://keycloak.servicev8.com", "alpha@evil", "alpha\n"])("rejects injected workspace destinations: %s", slug => {
    expect(() => supportWorkspaceUrl(slug)).toThrow();
  });
  it("does not fall back to identity-provider email when delivery is unavailable", async () => {
    vi.stubEnv("RESEND_API_KEY", ""); vi.stubEnv("resend_api_key", "");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await sendInvitationEmail("person@example.test", "alpha", "token")).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    expect(source("lib/auth/account-members.ts")).not.toContain("execute-actions-email");
  });
  it("rejects auth redirects instead of following them with credentials", async () => {
    const fetcher = vi.fn(async () => { throw new TypeError("redirect rejected"); }); vi.stubGlobal("fetch", fetcher);
    expect((await AuthService.loginWithPassword("person@example.test", "password", "alpha")).success).toBe(false);
    expect(fetcher).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ redirect: "error", credentials: "same-origin" }));
  });
  it("constrains signup navigation rather than trusting a server-supplied redirect", () => {
    const ui = source("components/SignupModal.tsx");
    expect(ui).toContain("supportWorkspaceUrl(slug.trim())");
    expect(ui).not.toContain("data.redirectUrl");
    expect(source("app/signup/page.tsx")).toContain("<SignupModal");
    expect(source("app/signup/page.tsx")).not.toContain("setTimeout");
  });
  it.each(["/accept-invite", "/signup"])("restricts external form submissions and connections on %s", path => {
    const response = middleware(new NextRequest(`https://alpha.support.servicev8.com${path}`, { headers: { host: "alpha.support.servicev8.com" } }));
    const policy = response.headers.get("content-security-policy")!;
    expect(policy).toContain("form-action 'self'"); expect(policy).toContain("connect-src 'self'");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("never redirects expired sessions to an identity-provider site", () => {
    for (const file of ["components/SignInModal.tsx", "components/OperatorProfileEditor.tsx", "components/AcceptInvitation.tsx", "app/signup/page.tsx", "lib/auth-service.ts", "app/page.tsx"]) {
      expect(source(file)).not.toMatch(/(?:href|action|location|window\.open)[^\n]*keycloak/i);
    }
    expect(source("components/AcceptInvitation.tsx")).toContain('href="/?signin=1"');
  });
});
