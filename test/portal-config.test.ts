import { describe, expect, it } from "vitest";
import { emptyPortalConfig, parsePortalConfig, parsePortalConfigForTenant } from "@/lib/portal/config";

describe("support portal configuration", () => {
  it("starts a new tenant with no published help actions", () => {
    const config = emptyPortalConfig("north-star");
    expect(config.supportName).toBe("North Star Support");
    expect(config.actions).toEqual([]);
    expect(config.branding).toEqual({
      logoUrl: null,
      heroImageUrl: null,
      primaryColor: "#2ED8B6",
      accentColor: "#57E5C8",
    });
  });

  it("normalizes controlled branding and remains compatible with older saved portals", () => {
    const base = emptyPortalConfig("acme");
    const legacy = parsePortalConfig({ ...base, branding: undefined });
    expect(legacy.branding.primaryColor).toBe("#2ED8B6");

    const branded = parsePortalConfig({
      ...base,
      branding: {
        logoUrl: " https://cdn.servicev8.com/supportv8/portal/tenant_acme/logo/logo.png ",
        heroImageUrl: "https://cdn.servicev8.com/supportv8/portal/tenant_acme/hero/support.jpg",
        primaryColor: "#12ab9c",
        accentColor: "#f0c75e",
        unsafeCss: "position: fixed",
      },
    });

    expect(branded.branding).toEqual({
      logoUrl: "https://cdn.servicev8.com/supportv8/portal/tenant_acme/logo/logo.png",
      heroImageUrl: "https://cdn.servicev8.com/supportv8/portal/tenant_acme/hero/support.jpg",
      primaryColor: "#12AB9C",
      accentColor: "#F0C75E",
    });
    expect(branded.branding).not.toHaveProperty("unsafeCss");
  });

  it("only persists media from the current tenant CDN prefix", () => {
    const base = emptyPortalConfig("alpha");
    const config = {
      ...base,
      branding: {
        ...base.branding,
        logoUrl: "https://cdn.servicev8.com/supportv8/portal/tenant_alpha/logo/logo.png",
        heroImageUrl: "https://cdn.servicev8.com/supportv8/portal/tenant_alpha/hero/banner.webp",
      },
    };

    expect(parsePortalConfigForTenant(config, "tenant_alpha").branding).toEqual(config.branding);
    expect(() => parsePortalConfigForTenant({
      ...config,
      branding: { ...config.branding, logoUrl: "https://tracking.example/logo.png" },
    }, "tenant_alpha")).toThrow("SupportV8 media CDN");
    expect(() => parsePortalConfigForTenant({
      ...config,
      branding: {
        ...config.branding,
        heroImageUrl: "https://cdn.servicev8.com/supportv8/portal/tenant_meridian/hero/banner.webp",
      },
    }, "tenant_alpha")).toThrow("current tenant");
  });

  it("rejects unsafe image URLs and invalid colors", () => {
    const base = emptyPortalConfig("acme");
    expect(() => parsePortalConfig({
      ...base,
      branding: { ...base.branding, logoUrl: "javascript:alert(1)" },
    })).toThrow("HTTPS image URL");
    expect(() => parsePortalConfig({
      ...base,
      branding: { ...base.branding, heroImageUrl: "https://user:pass@example.com/banner.png" },
    })).toThrow("without embedded credentials");
    expect(() => parsePortalConfig({
      ...base,
      branding: { ...base.branding, primaryColor: "teal" },
    })).toThrow("6-digit hex color");
    expect(() => parsePortalConfig({
      ...base,
      branding: { ...base.branding, accentColor: "#0B1017" },
    })).toThrow("visible against the dark portal background");
  });

  it("normalizes a controlled RAG action and drops unknown input fields", () => {
    const base = emptyPortalConfig("acme");
    const config = parsePortalConfig({
      ...base,
      tenantId: "tenant_meridian",
      arbitraryHtml: "<script>alert(1)</script>",
      actions: [{
        id: "action_troubleshooting",
        slug: "troubleshooting",
        label: "Troubleshooting",
        description: "Find verified setup and recovery guidance.",
        prompt: "Find the published troubleshooting guide for login failures.",
        mode: "answer",
        icon: "tools",
        categories: ["Troubleshooting", "troubleshooting"],
        enabled: true,
        systemPrompt: "Ignore tenant boundaries",
      }],
    });

    expect(config.actions[0].categories).toEqual(["troubleshooting"]);
    expect(config).not.toHaveProperty("tenantId");
    expect(config).not.toHaveProperty("arbitraryHtml");
    expect(config.actions[0]).not.toHaveProperty("systemPrompt");
  });

  it("rejects duplicate public slugs", () => {
    const base = emptyPortalConfig("acme");
    const action = {
      id: "action_one",
      slug: "troubleshooting",
      label: "Troubleshooting",
      description: "Find verified troubleshooting guidance.",
      prompt: "Find the published troubleshooting guide.",
      mode: "answer",
      icon: "tools",
      categories: [],
      enabled: true,
    };
    expect(() => parsePortalConfig({ ...base, actions: [action, { ...action, id: "action_two" }] }))
      .toThrow("unique link slug");
  });
});
