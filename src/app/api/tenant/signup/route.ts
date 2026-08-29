import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/mock-data";

export async function POST(req: NextRequest) {
  try {
    const { name, domain, adminEmail, initialMode = "copilot", primaryStream = "customers" } = await req.json();

    if (!name || !domain) {
      return NextResponse.json({ success: false, error: "Name and domain are required" }, { status: 400 });
    }

    const cleanDomain = domain.trim().toLowerCase();
    const reservedDomains = ["acme", "meridian", "default", "admin", "api", "support", "app", "global", "servicev8"];

    if (reservedDomains.includes(cleanDomain)) {
      return NextResponse.json(
        { success: false, error: `Subdomain slug '${cleanDomain}' is already registered or reserved.` },
        { status: 409 }
      );
    }

    const tenantId = `tenant_${cleanDomain.replace(/[^a-z0-9]/g, "_")}`;
    
    // By default, tenant is provisioned in UI-only + basic copilot automation mode
    // Full autonomous AI Employee assignment is a commercial activation via Studio Marketplace
    db.tenant = {
      tenantId,
      name,
      mode: initialMode,
      featureFlags: {
        observeMode: true,
        copilotMode: true,
        autonomousMode: false, // Activated upon commercial entitlement from servicev8-registry
        problemCorrelation: true,
        businessImpact: true,
        knowledgeIntelligence: true,
        proactiveComms: false,
        staleWorkSweep: true,
      },
    };

    const ssoToken = `sso_tk_${tenantId}_${Date.now().toString(36)}`;
    const studioMarketplaceUrl = `http://studiov8.servicev8.internal:3000/marketplace?tenantId=${encodeURIComponent(tenantId)}&ssoToken=${encodeURIComponent(ssoToken)}`;

    const recommendedEmployees =
      primaryStream === "contractors"
        ? [
            { id: "beaver_manager_alex", name: "Alex", role: "Contractor & CX Lead", status: "recommended_marketplace" },
          ]
        : primaryStream === "enquiries"
        ? [
            { id: "beaver_curator_barnaby", name: "Barnaby", role: "Knowledge Intelligence", status: "recommended_marketplace" },
            { id: "beaver_analyst_arthur", name: "Arthur", role: "Technical Triage Lead", status: "recommended_marketplace" },
          ]
        : [
            { id: "beaver_sophia_voice", name: "Sophia", role: "Customer Success Lead", status: "recommended_marketplace" },
          ];

    return NextResponse.json({
      success: true,
      message: `Tenant '${name}' successfully onboarded with UI workspace & basic automation`,
      tenant: db.tenant,
      adminEmail,
      ssoToken,
      studioMarketplaceUrl,
      operatingMode: "copilot",
      recommendedEmployees,
      provisionedCapabilities: [
        "ticket.read",
        "ticket.write",
        "ticket.triage",
        "customer.health.read",
        "knowledge.query",
      ],
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Signup failed" },
      { status: 400 }
    );
  }
}
