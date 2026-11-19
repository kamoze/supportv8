import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/auth/keycloak", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth/keycloak")>()),
  issueKeycloakDemoAccessToken: vi.fn(),
}));

import { isSupportDemoTenant, supportDemoEnabled } from "@/lib/demo-mode";
import { UserCredentialStore } from "@/lib/auth/credential-store";
import { issueKeycloakDemoAccessToken } from "@/lib/auth/keycloak";
import { POST as demoLogin } from "@/app/api/auth/demo/route";
import { GET as listDemoLeads, POST as captureDemoLead } from "@/app/api/leads/demo-access/route";
import { GET as demoStatus } from "@/app/api/demo/status/route";
import { isDemoTenant } from "@/lib/platform/workforce";
import { demoPersonasFor } from "@/components/demo/demo-personas";
import { GlobalLandingView } from "@/components/GlobalLandingView";
import { isRuntimeHandoffSession } from "@/lib/auth-service";
import { canChangeOperatingMode, operatingModeLabel, tenantOperatingMode } from "@/lib/operating-mode";
import { PolicyEngine } from "@/lib/services/policy-engine";

const off = () => vi.stubEnv("SUPPORTV8_DEMO_MODE", "");
const on = () => vi.stubEnv("SUPPORTV8_DEMO_MODE", "true");
afterEach(() => vi.unstubAllEnvs());

describe("demo sandbox needs an explicit flag", () => {
  beforeEach(off);

  it("is off unless SUPPORTV8_DEMO_MODE is exactly true", () => {
    for (const value of [undefined, "", "1", "yes", "on", "false"]) {
      expect(supportDemoEnabled({ SUPPORTV8_DEMO_MODE: value })).toBe(false);
    }
    expect(supportDemoEnabled({ SUPPORTV8_DEMO_MODE: "true" })).toBe(true);
    expect(isSupportDemoTenant("acme", {})).toBe(false);
    expect(isSupportDemoTenant("acme", { SUPPORTV8_DEMO_MODE: "true" })).toBe(true);
    expect(isSupportDemoTenant("lexi-s-planthouse", { SUPPORTV8_DEMO_MODE: "true" })).toBe(false);
  });

  it("seeds no named personas or QA presets without the flag", async () => {
    const store = new UserCredentialStore();
    expect(store.listUsers()).toEqual([]);
    expect(store.getUserByEmail("david.kim@acme.com", "acme")).toBeUndefined();
    expect(store.getUserByEmail("admin@acme.com", "acme")).toBeUndefined();
    const attempt = await store.authenticate("admin@acme.com", "SupportV8#2026!Secure", "acme");
    expect(attempt.success).toBe(false);

    on();
    const demo = new UserCredentialStore();
    expect(demo.getUserByEmail("david.kim@acme.com", "acme")?.name).toBe("David Kim");
  });

  it("refuses demo sign-in and demo lead capture without the flag", async () => {
    const response = await demoLogin(new NextRequest("https://support.servicev8.com/api/auth/demo", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantSlug: "acme" }),
    }));
    expect(response.status).toBe(404);
    expect(issueKeycloakDemoAccessToken).not.toHaveBeenCalled();

    const capture = await captureDemoLead(new NextRequest("https://support.servicev8.com/api/leads/demo-access", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workEmail: "x@example.com", companyName: "X" }),
    }));
    expect(capture.status).toBe(404);
    expect((await listDemoLeads()).status).toBe(404);
  });

  it("tells the browser whether the sandbox is enabled", async () => {
    expect(await (await demoStatus()).json()).toEqual({ success: true, enabled: false, tenants: [] });
    on();
    expect(await (await demoStatus()).json()).toEqual({ success: true, enabled: true, tenants: ["acme", "meridian"] });
  });

  it("treats acme and meridian as ordinary tenants without the flag", () => {
    expect(isDemoTenant("acme")).toBe(false);
    expect(isDemoTenant("meridian")).toBe(false);
    on();
    expect(isDemoTenant("acme")).toBe(true);
  });

  it("offers the persona switcher only in the enabled sandbox, never to a Runtime hand-off", () => {
    expect(demoPersonasFor({ demoEnabled: false, tenantSlug: "acme", runtimeHandoff: false })).toEqual([]);
    expect(demoPersonasFor({ demoEnabled: true, tenantSlug: "acme", runtimeHandoff: true })).toEqual([]);
    expect(demoPersonasFor({ demoEnabled: true, tenantSlug: "lexi-s-planthouse", runtimeHandoff: false })).toEqual([]);
    expect(demoPersonasFor({ demoEnabled: true, tenantSlug: "acme", runtimeHandoff: false }).map(p => p.name))
      .toEqual(["David Kim", "Sarah Chen", "Audit Officer"]);
    expect(demoPersonasFor({ demoEnabled: true, tenantSlug: "meridian", runtimeHandoff: false }).map(p => p.role))
      .toEqual(["contractor_lead"]);
  });

  it("recognises a Runtime hand-off session", () => {
    expect(isRuntimeHandoffSession({ token: "workspace:1700000000", source: "runtime_handoff" })).toBe(true);
    expect(isRuntimeHandoffSession({ token: "workspace:1700000000" })).toBe(true);
    expect(isRuntimeHandoffSession({ token: "sv8_tk_acme_1_x" })).toBe(false);
    expect(isRuntimeHandoffSession(null)).toBe(false);
  });

  it("hides every demo entry on the landing page unless enabled", () => {
    const props = { onOpenSignIn: vi.fn(), onOpenTenantPortal: vi.fn(), onOpenSignup: vi.fn(), onOpenDemoGate: vi.fn() };
    const hidden = renderToStaticMarkup(<GlobalLandingView {...props} />);
    for (const text of ["Acme Demo", "Meridian Demo", "Instant Demo Sandbox", "Explore the work desk"]) expect(hidden).not.toContain(text);
    expect(hidden).toContain("Get Started");
    const shown = renderToStaticMarkup(<GlobalLandingView {...props} demoEnabled />);
    for (const text of ["Acme Demo", "Meridian Demo", "Instant Demo Sandbox", "Explore the work desk"]) expect(shown).toContain(text);
  });

  it("keeps persona names out of the dashboard page and the modal behind the flag", () => {
    const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
    expect(page).not.toContain("David Kim");
    expect(page).not.toContain("Sarah Chen");
    expect(page.match(/\{demoEnabled && <DemoAccessModal/g)).toHaveLength(2);
  });
});

describe("AI operating mode shows the tenant's stored value", () => {
  function engineWithRow(row: Record<string, unknown> | undefined) {
    const session = { query: vi.fn(async () => (row ? [row] : [])) };
    const client = {
      withSystemSession: async (fn: (s: typeof session) => unknown) => fn({ query: vi.fn(async () => [{ exists: false }]) } as never),
      withTenantSession: async (_tenant: string, fn: (s: typeof session) => unknown) => fn(session),
    };
    return new PolicyEngine(client as never);
  }

  it("reports an unset mode as not configured instead of a default", async () => {
    const unset = await engineWithRow(undefined).getPolicy("tenant_new");
    expect(unset.operatingModeConfigured).toBe(false);
    expect(tenantOperatingMode(unset)).toBeNull();
    expect(operatingModeLabel(tenantOperatingMode(unset))).toBe("Not set");

    const copilot = await engineWithRow({ tenant_id: "tenant_x", mode: "copilot", raw_context_retention_hours: 48 }).getPolicy("tenant_x");
    expect(copilot.operatingModeConfigured).toBe(true);
    expect(operatingModeLabel(tenantOperatingMode(copilot))).toBe("Copilot");
  });

  it("never falls back to Autonomous", () => {
    expect(tenantOperatingMode(null)).toBeNull();
    expect(tenantOperatingMode({ operatingMode: "autonomous", operatingModeConfigured: false })).toBeNull();
    expect(tenantOperatingMode({ operatingMode: "autonomous", operatingModeConfigured: true })).toBe("autonomous");
    const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
    expect(page).toContain("const [operatingMode, setOperatingMode] = useState<TenantOperatingMode | null>(null);");
    expect(page).toContain("AI mode: Not set");
    // The header switch persists through the tenant policy instead of only changing local state.
    expect(page).toMatch(/handleChangeOperatingMode[\s\S]*action: "update"/);
  });

  it("lets only CX leads and administrators change it", () => {
    expect(canChangeOperatingMode("cx_lead")).toBe(true);
    expect(canChangeOperatingMode("superadmin")).toBe(true);
    for (const role of ["operator", "observer", "contractor", undefined]) expect(canChangeOperatingMode(role)).toBe(false);
  });
});
