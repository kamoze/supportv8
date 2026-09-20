import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { StudioMarketplaceHubView } from "@/components/views/StudioMarketplaceHubView";
import { MarketplaceWorkforceView } from "@/components/views/MarketplaceWorkforceView";
import { MarketplaceConnectorsView } from "@/components/views/MarketplaceConnectorsView";
import { AutonomousStudioView } from "@/components/views/AutonomousStudioView";

describe("ServiceV8 Marketplace, Workforce & Studio Architecture Linkages", () => {
  it("StudioMarketplaceHubView presents onboarding with direct Studio management linkages", () => {
    const onNavigateToStudio = vi.fn();
    const onNavigateToInstalled = vi.fn();
    const html = renderToStaticMarkup(
      <StudioMarketplaceHubView
        tenantId="tenant_acme"
        tenantName="Acme Corp"
        onNotify={vi.fn()}
        onNavigateToStudio={onNavigateToStudio}
        onNavigateToInstalled={onNavigateToInstalled}
      />,
    );

    // Architectural Banner
    expect(html).toContain("Marketplace &amp; Package Onboarding");
    expect(html).toContain("Onboard in Marketplace • Manage in Studio • Operate in Workforce");
    expect(html).toContain("Manage in Studio");
    expect(html).toContain("Installed Products");

    // Autonomous Packages Onboarding
    expect(html).toContain("Autonomous Solution Packages");
    expect(html).toContain("Customer Support Triage &amp; Tagging");
    expect(html).toContain("E-Commerce Auto-Refund &amp; Verification");
    expect(html).toContain("Dormant Ticket Backlog Sweeper");

    // Canonical Sophia Voice Support Onboarding
    expect(html).toContain("Sophia — Customer Support Lead AI");
    expect(html).toContain("Hire or configure Sophia");
    expect(html).toContain('href="/api/voice/sophia/launch"');

    // Cross-Vertical Studio Link (ServiceV8 standard §1.4)
    expect(html).toContain('href="https://studio.servicev8.com/?tenant=tenant_acme&amp;vertical=support"');
  });

  it("MarketplaceWorkforceView acts as Installed Products view with direct Studio orchestration", () => {
    const onNavigateToStudio = vi.fn();
    const onNavigateToMarketplace = vi.fn();
    const html = renderToStaticMarkup(
      <MarketplaceWorkforceView
        onNavigateToStudio={onNavigateToStudio}
        onNavigateToMarketplace={onNavigateToMarketplace}
      />,
    );

    // Header & Standard
    expect(html).toContain("Installed Products &amp; Active Packages");
    expect(html).toContain("MANAGED IN STUDIO");
    expect(html).toContain("Manage in Studio");
    expect(html).toContain("Onboard More");

    // Installed Packages
    expect(html).toContain("Customer Support Triage &amp; Tagging");
    expect(html).toContain("E-Commerce Auto-Refund &amp; Verification");
    expect(html).toContain("Dormant Ticket Backlog Sweeper");

    // AI Employees & Connectors
    expect(html).toContain("Active Hired AI Employees");
    expect(html).toContain("Active Integration Connectors");
  });

  it("MarketplaceConnectorsView links to Studio triggers and simulation", () => {
    const onNavigateToStudio = vi.fn();
    const html = renderToStaticMarkup(
      <MarketplaceConnectorsView
        connectors={[
          {
            id: "conn_zendesk",
            name: "Zendesk Support",
            category: "helpdesk",
            icon: "fi fi-rr-headset",
            description: "Zendesk ticket sync",
            tier: "included",
            isSubscribed: true,
            status: "active",
            syncFrequencyMinutes: 1,
            eventsPerDay: 1420,
            endpointUrl: "https://acme.zendesk.com",
            configFields: [],
          },
        ]}
        onToggleConnector={vi.fn()}
        onOpenConfig={vi.fn()}
        onNavigateToStudio={onNavigateToStudio}
      />,
    );

    expect(html).toContain("Manage Triggers in Studio");
  });

  it("AutonomousStudioView acts as the management cockpit with linkages to Marketplace", () => {
    const onNavigateToMarketplace = vi.fn();
    const onNavigateToInstalled = vi.fn();
    const html = renderToStaticMarkup(
      <AutonomousStudioView
        onNotify={vi.fn()}
        onNavigateToMarketplace={onNavigateToMarketplace}
        onNavigateToInstalled={onNavigateToInstalled}
      />,
    );

    // Hero Banner & Cockpit Branding
    expect(html).toContain("SERVICEV8 MANAGEMENT COCKPIT");
    expect(html).toContain("Manage All Onboarded Packages, Workflows &amp; Sweeps");
    expect(html).toContain("Onboard in Marketplace");
    expect(html).toContain("Installed Products");

    // Onboarded Package Attribution
    expect(html).toContain("Onboarded Package");
  });
});
