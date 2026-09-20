import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { problemService } from "@/lib/services/problem-service";
import { db, INITIAL_PROBLEMS } from "@/lib/db/mock-data";
import { GET, POST } from "@/app/api/problems/route";
import { NextRequest } from "next/server";

describe("Problem Matrix Zero-State & Correlation Hub", () => {
  it("isolates problems between seeded tenants and clean dynamic tenants", () => {
    const acmeProblems = problemService.getAll("acme");
    const cleanProblems = problemService.getAll("acme-clean-workspace");

    expect(acmeProblems.length).toBeGreaterThan(0);
    expect(cleanProblems.length).toBe(0);
  });

  it("seeds domain-specific demo problems via seedDemoProblems", () => {
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
    expect(data.data.length).toBeGreaterThanOrEqual(1);
    expect(data.data[0]).toHaveProperty("id");
    expect(data.data[0]).toHaveProperty("suspectedCause");
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
