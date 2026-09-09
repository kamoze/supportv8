import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { StudioMarketplaceHubView } from "@/components/views/StudioMarketplaceHubView";

describe("StudioMarketplaceHubView", () => {
  it("presents the canonical Sophia hire/configure flow without browser-made entitlements", () => {
    const html = renderToStaticMarkup(
      <StudioMarketplaceHubView tenantId="tenant_acme" tenantName="Acme" onNotify={vi.fn()} />,
    );
    expect(html).toContain("Sophia — Customer Support Lead AI");
    expect(html).toContain("Autonomous customer care reasoning, order resolution, and sentiment escalation.");
    expect(html).toContain('href="/api/voice/sophia/launch"');
    expect(html).toContain("Hire or configure Sophia");
    expect(html).toContain("Free to hire");
    expect(html).toContain("subscription allowance first, then purchased top-up credits");
    expect(html).not.toContain("sso_tk_");
    expect(html).not.toContain("Subscribe with Stripe");
    expect(html).not.toContain("Subscribed &amp; Active");
    expect(html).not.toContain("Alex — Contractor");
  });
});
