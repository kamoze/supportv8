import { describe, it, expect } from "vitest";
import { POST, GET, demoLeadsStore } from "../src/app/api/leads/demo-access/route";
import { NextRequest } from "next/server";

describe("SupportV8 Demo Access & Sales Lead Capture", () => {
  it("should reject demo access if work email is missing or invalid", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads/demo-access", {
      method: "POST",
      body: JSON.stringify({ workEmail: "invalid-email", companyName: "Acme Corp" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/valid business work email/i);
  });

  it("should reject demo access if company name is missing or empty", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads/demo-access", {
      method: "POST",
      body: JSON.stringify({ workEmail: "alex@company.com", companyName: "" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/company name is required/i);
  });

  it("should successfully capture sales lead and grant demo access token when email and company are provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads/demo-access", {
      method: "POST",
      body: JSON.stringify({
        workEmail: "alex@enterprise-logistics.com",
        fullName: "Alex Rivera",
        companyName: "Enterprise Logistics LLC",
        targetTenant: "meridian",
        source: "landing_demo_gate",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.lead.workEmail).toBe("alex@enterprise-logistics.com");
    expect(data.lead.companyName).toBe("Enterprise Logistics LLC");
    expect(data.lead.targetTenant).toBe("meridian");
    expect(data.growthv8SyncPayload.verticalInterest).toBe("field_operations_dispatch");
    expect(data.demoAccessToken).toMatch(/^demo_tk_/);
  });

  it("should return list of captured leads on GET", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalLeadsCaptured).toBeGreaterThan(0);
    expect(data.leads.length).toBeGreaterThan(0);
  });
});
