import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/mock-data";

export async function POST(req: NextRequest) {
  try {
    const { name, domain, adminEmail, initialMode = "autonomous" } = await req.json();

    if (!name || !domain) {
      return NextResponse.json({ success: false, error: "Name and domain are required" }, { status: 400 });
    }

    const tenantId = `tenant_${domain.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    db.tenant = {
      tenantId,
      name,
      mode: initialMode,
      featureFlags: {
        observeMode: true,
        copilotMode: true,
        autonomousMode: true,
        problemCorrelation: true,
        businessImpact: true,
        knowledgeIntelligence: true,
        proactiveComms: true,
        staleWorkSweep: true,
      },
    };

    const ssoToken = `sso_tk_${tenantId}_${Date.now().toString(36)}`;
    const studioMarketplaceUrl = `http://studiov8.servicev8.internal:3000/marketplace?tenantId=${encodeURIComponent(tenantId)}&ssoToken=${encodeURIComponent(ssoToken)}`;

    return NextResponse.json({
      success: true,
      message: `Tenant '${name}' successfully onboarded with ID ${tenantId}`,
      tenant: db.tenant,
      adminEmail,
      ssoToken,
      studioMarketplaceUrl,
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
