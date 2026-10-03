import { describe, it, expect, vi } from "vitest";
import { GET as ticketsHandler } from "@/app/api/portal/tickets/route";
import { signClientToken } from "@/lib/auth/client-token";
import { NextRequest } from "next/server";
import { db } from "@/lib/db/mock-data";
import { pgClient } from "@/lib/db/pg-client";

describe("Client Tickets API", () => {
  const tenantSlug = "acme";
  const email = "sarah.jenkins@acme-corp.com";

  it("returns 401 Unauthorized when no client token is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/portal/tickets");
    const res = await ticketsHandler(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 Unauthorized when an invalid token is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/portal/tickets", {
      headers: { Authorization: "Bearer invalid.jwt.token" },
    });
    const res = await ticketsHandler(req);
    expect(res.status).toBe(401);
  });

  it("returns tickets filtered by authenticated client email", async () => {
    // Ensure test customer issue exists
    if (!db.issues.some((i) => (i as any).customerEmail === email)) {
      db.issues.push({
        id: "TCK-8821",
        title: "Order refund review and token credit",
        status: "in_progress",
        priority: "p2",
        customerName: "Sarah Jenkins",
        customerEmail: email,
        tenantId: "tenant_acme",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
    }

    const token = signClientToken({ email, tenantSlug, customerId: "c1" });
    const req = new NextRequest("http://localhost:3000/api/portal/tickets", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await ticketsHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.tickets)).toBe(true);
    expect(body.tickets.some((t: any) => t.id === "TCK-8821")).toBe(true);
  });

  it("supports authentication via cookie", async () => {
    const token = signClientToken({ email, tenantSlug, customerId: "c1" });
    const req = new NextRequest("http://localhost:3000/api/portal/tickets", {
      headers: {
        cookie: `supportv8_client_token=${token}`,
      },
    });

    const res = await ticketsHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.tickets.some((t: any) => t.id === "TCK-8821")).toBe(true);
  });

  it("does not return tickets belonging to other clients or unrelated tenants", async () => {
    const otherEmail = "other.user@example.com";
    if (!db.issues.some((i) => (i as any).customerEmail === otherEmail)) {
      db.issues.push({
        id: "TCK-9999",
        title: "Unrelated customer ticket",
        status: "open",
        priority: "p3",
        customerName: "Other User",
        customerEmail: otherEmail,
        tenantId: "tenant_acme",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
    }

    const token = signClientToken({ email, tenantSlug, customerId: "c1" });
    const req = new NextRequest("http://localhost:3000/api/portal/tickets", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await ticketsHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tickets.some((t: any) => t.id === "TCK-9999")).toBe(false);
  });

  it("maps tickets to public summary schema (id, title, status, updatedAt, assignedTo, publicNotes)", async () => {
    const token = signClientToken({ email, tenantSlug, customerId: "c1" });
    const req = new NextRequest("http://localhost:3000/api/portal/tickets", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await ticketsHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    const ticket = body.tickets.find((t: any) => t.id === "TCK-8821");
    expect(ticket).toBeDefined();
    expect(ticket.id).toBe("TCK-8821");
    expect(ticket.title).toBe("Order refund review and token credit");
    expect(ticket.status).toBe("in_progress");
    expect(typeof ticket.updatedAt).toBe("string");
    expect(typeof ticket.assignedTo).toBe("string");
    expect(typeof ticket.publicNotes).toBe("string");
  });

  it("does not fall back to mock data if Postgres executes successfully with 0 results", async () => {
    const originalDbUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://fake:fake@localhost:5432/fake";
    const withTenantSessionSpy = vi.spyOn(pgClient, "withTenantSession").mockImplementation(async (_tenant, callback) => {
      return callback({
        query: async () => [],
      } as any);
    });

    try {
      const token = signClientToken({ email, tenantSlug, customerId: "c1" });
      const req = new NextRequest("http://localhost:3000/api/portal/tickets", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const res = await ticketsHandler(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.tickets).toEqual([]);
    } finally {
      withTenantSessionSpy.mockRestore();
      if (originalDbUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDbUrl;
      }
    }
  });

  it("falls back to mock data if Postgres query throws an error", async () => {
    const originalDbUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://fake:fake@localhost:5432/fake";
    const withTenantSessionSpy = vi.spyOn(pgClient, "withTenantSession").mockRejectedValue(new Error("Connection refused"));

    try {
      const token = signClientToken({ email, tenantSlug, customerId: "c1" });
      const req = new NextRequest("http://localhost:3000/api/portal/tickets", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const res = await ticketsHandler(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.tickets.some((t: any) => t.id === "TCK-8821")).toBe(true);
    } finally {
      withTenantSessionSpy.mockRestore();
      if (originalDbUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDbUrl;
      }
    }
  });
});
