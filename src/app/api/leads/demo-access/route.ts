import { NextRequest, NextResponse } from "next/server";

export interface DemoLeadRecord {
  id: string;
  workEmail: string;
  fullName?: string;
  companyName?: string;
  targetTenant: string;
  source: string;
  capturedAt: string;
  ipAddress?: string;
  status: "captured" | "synced_growthv8";
}

// In-memory lead pipeline ledger
export const demoLeadsStore: DemoLeadRecord[] = [];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workEmail, fullName, companyName, targetTenant = "acme", source = "landing_demo_gate" } = body;

    if (!workEmail || !workEmail.includes("@") || !workEmail.includes(".")) {
      return NextResponse.json(
        { success: false, error: "A valid business work email is required to access live sandbox demos." },
        { status: 400 }
      );
    }

    const leadId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const lead: DemoLeadRecord = {
      id: leadId,
      workEmail: workEmail.trim().toLowerCase(),
      fullName: fullName?.trim() || workEmail.split("@")[0],
      companyName: companyName?.trim() || workEmail.split("@")[1]?.split(".")[0]?.toUpperCase() || "Enterprise Prospect",
      targetTenant: targetTenant.toLowerCase(),
      source,
      capturedAt: new Date().toISOString(),
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1",
      status: "captured",
    };

    demoLeadsStore.unshift(lead);

    // Prepare GrowthV8 CRM handoff telemetry packet
    const growthv8SyncPayload = {
      event: "lead.created",
      leadId: lead.id,
      email: lead.workEmail,
      company: lead.companyName,
      verticalInterest: targetTenant === "meridian" ? "field_operations_dispatch" : "customer_care_saas",
      campaign: "supportv8_live_demo_gate",
    };

    return NextResponse.json({
      success: true,
      message: `Demo access granted for ${lead.workEmail}. Telemetry routed to GrowthV8 sales desk.`,
      lead,
      growthv8SyncPayload,
      demoAccessToken: `demo_tk_${lead.id}_${Date.now()}`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to process demo access" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    totalLeadsCaptured: demoLeadsStore.length,
    leads: demoLeadsStore.slice(0, 50),
  });
}
