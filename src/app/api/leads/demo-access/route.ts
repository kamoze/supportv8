import { NextRequest, NextResponse } from "next/server";
import { ResendService } from "@/lib/services/resend-service";

export interface DemoLeadRecord {
  id: string;
  workEmail: string;
  fullName?: string;
  companyName: string;
  targetTenant: string;
  optInEmail?: boolean;
  needsAssessment?: string[];
  ticketVolume?: string;
  source: string;
  capturedAt: string;
  ipAddress?: string;
  status: "captured" | "synced_growthv8";
  resendEmailId?: string;
}

// In-memory lead pipeline ledger
const demoLeadsStore: DemoLeadRecord[] = [];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workEmail,
      fullName,
      companyName,
      targetTenant = "acme",
      optInEmail = false,
      needsAssessment = [],
      ticketVolume,
      source = "landing_demo_gate",
    } = body;

    const isGuestLaunch = !workEmail && (!companyName || companyName === "Guest Organization");

    let cleanEmail = (workEmail || "").trim().toLowerCase();
    let cleanCompany = (companyName || "").trim();

    if (!isGuestLaunch) {
      if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
        return NextResponse.json(
          { success: false, error: "A valid business work email is required to access live sandbox demos." },
          { status: 400 }
        );
      }
      if (!cleanCompany || cleanCompany.length < 2) {
        return NextResponse.json(
          { success: false, error: "Company name is required for sales qualification." },
          { status: 400 }
        );
      }
    } else {
      cleanEmail = `guest_${Date.now()}@servicev8.com`;
      cleanCompany = "Guest Sandbox Evaluator";
    }

    const leadId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const lead: DemoLeadRecord = {
      id: leadId,
      workEmail: cleanEmail,
      fullName: fullName?.trim() || cleanEmail.split("@")[0],
      companyName: cleanCompany,
      targetTenant: targetTenant.toLowerCase(),
      optInEmail: Boolean(optInEmail),
      needsAssessment: Array.isArray(needsAssessment) ? needsAssessment : [],
      ticketVolume: ticketVolume || undefined,
      source,
      capturedAt: new Date().toISOString(),
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1",
      status: "captured",
    };

    // Dispatch lead email to leads@servicev8.com via Resend
    const emailResult = await ResendService.dispatchLeadEmail({
      leadId: lead.id,
      workEmail: lead.workEmail,
      fullName: lead.fullName,
      companyName: lead.companyName,
      targetTenant: lead.targetTenant,
      optInEmail: lead.optInEmail ?? false,
      needsAssessment: lead.needsAssessment,
      ticketVolume: lead.ticketVolume,
      capturedAt: lead.capturedAt,
      ipAddress: lead.ipAddress,
    });

    if (emailResult.resendEmailId) {
      lead.resendEmailId = emailResult.resendEmailId;
    }

    demoLeadsStore.unshift(lead);

    // Prepare GrowthV8 CRM handoff telemetry packet
    const growthv8SyncPayload = {
      event: "lead.created",
      leadId: lead.id,
      email: lead.workEmail,
      company: lead.companyName,
      optInEmail: lead.optInEmail,
      needsAssessment: lead.needsAssessment,
      ticketVolume: lead.ticketVolume,
      verticalInterest: targetTenant === "meridian" ? "field_operations_dispatch" : "customer_care_saas",
      campaign: "supportv8_live_demo_gate",
    };

    return NextResponse.json({
      success: true,
      message: `Demo access granted for ${lead.workEmail} at ${lead.companyName}. Parsable lead notification dispatched to leads@servicev8.com.`,
      lead,
      emailDispatched: emailResult,
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
