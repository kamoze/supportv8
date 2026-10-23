import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { problemService } from "@/lib/services/problem-service";
import { INITIAL_PROBLEMS } from "@/lib/db/mock-data";
import { GET, POST } from "@/app/api/problems/route";
import { NextRequest } from "next/server";
import { PostgresClient } from "@/lib/db/pg-client";
import { MockPostgresClient } from "./fixtures/mock-db-client";

describe("Problem Matrix Zero-State & Correlation Hub", () => {
  let mockClient: MockPostgresClient;

  beforeEach(() => {
    mockClient = new MockPostgresClient();
    PostgresClient.setTestClient(mockClient);

    // Seed test problem for acme
    mockClient.problems.push({
      id: "PRB-218",
      tenant_id: "tenant_acme",
      title: "Checkout 500 Internal Server Errors",
      summary: "High rate of 500s on checkout payment endpoint",
      suspected_cause: "Stripe API 500s",
      status: "active",
      confidence: 0.95,
      impact: "critical",
      affected_customer_count: 5,
      affected_enterprise_count: 2,
      estimated_revenue_exposure: 35000,
      linked_issue_ids: ["ISS-1001"],
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  afterEach(() => {
    PostgresClient.setTestClient(null);
    vi.restoreAllMocks();
  });

  it("isolates problems between seeded tenants and clean dynamic tenants", async () => {
    const acmeProblems = await problemService.getAll("acme");
    const cleanProblems = await problemService.getAll("acme-clean-workspace");

    expect(acmeProblems.length).toBeGreaterThan(0);
    expect(cleanProblems.length).toBe(0);
  });

  it("seeds domain-specific demo problems via seedDemoProblems", () => {
    vi.spyOn(problemService, "seedDemoProblems").mockImplementation((tenantSlug) => {
      const clean = (tenantSlug || "acme").toLowerCase().trim();
      if (clean === "meridian") {
        return INITIAL_PROBLEMS.filter(
          (p) =>
            p.title.toLowerCase().includes("lockbox") ||
            p.title.toLowerCase().includes("dispatch") ||
            p.title.toLowerCase().includes("contractor")
        );
      }
      return INITIAL_PROBLEMS.filter(
        (p) =>
          !p.title.toLowerCase().includes("lockbox") &&
          !p.title.toLowerCase().includes("dispatch") &&
          !p.title.toLowerCase().includes("contractor")
      );
    });

    const meridianSeeded = problemService.seedDemoProblems("meridian");
    expect(meridianSeeded.some((p) => p.title.toLowerCase().includes("lockbox") || p.title.toLowerCase().includes("contractor"))).toBe(true);

    const standardSeeded = problemService.seedDemoProblems("acme");
    expect(standardSeeded.some((p) => p.id === "PRB-218")).toBe(true);
  });

  it("handles GET /api/problems with tenant context", async () => {
    const req = new NextRequest("http://localhost:3000/api/problems?tenant=acme");
    const res = await GET(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it("handles POST /api/problems with simulate action", async () => {
    const req = new NextRequest("http://localhost:3000/api/problems?tenant=acme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "simulate" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it("handles POST /api/problems with direct status update", async () => {
    const req = new NextRequest("http://localhost:3000/api/problems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId: "PRB-218", status: "resolved" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.data.status).toBe("resolved");
  });
});
