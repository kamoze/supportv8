import { describe, it, expect } from "vitest";
import { verticalClients } from "@/lib/verticals/vertical-clients";

describe("supportV8 Vertical & Service Apps API Integration", () => {
  it("retrieves health status and supported operations for all ServiceV8 verticals", async () => {
    const statuses = await verticalClients.getVerticalsStatus();
    expect(statuses.length).toBe(6);

    const orderv8 = statuses.find((s) => s.vertical === "orderv8");
    expect(orderv8).toBeDefined();
    expect(orderv8?.status).toBe("healthy");
    expect(orderv8?.supportedOperations).toContain("order.lookup");
    expect(orderv8?.supportedOperations).toContain("order.refund");

    const dominion = statuses.find((s) => s.vertical === "dominion");
    expect(dominion).toBeDefined();
    expect(dominion?.supportedOperations).toContain("incident.lookup");
  });

  it("dispatches order lookup and refund operations to OrderV8", async () => {
    const lookupResult = await verticalClients.dispatch({
      vertical: "orderv8",
      operation: "order.lookup",
      payload: { orderId: "ORD-99412", customerId: "CUST-8821" },
    });

    expect(lookupResult.success).toBe(true);
    expect(lookupResult.vertical).toBe("orderv8");
    expect((lookupResult.data as any).orderId).toBe("ORD-99412");
    expect((lookupResult.data as any).status).toBe("delivered");

    const refundResult = await verticalClients.dispatch({
      vertical: "orderv8",
      operation: "order.refund",
      payload: { orderId: "ORD-99412", amount: 49.0 },
    });

    expect(refundResult.success).toBe(true);
    expect((refundResult.data as any).refundId).toBeDefined();
    expect((refundResult.data as any).status).toBe("processed");
  });

  it("dispatches property maintenance request to PropV8", async () => {
    const propResult = await verticalClients.dispatch({
      vertical: "propv8",
      operation: "maintenance.create",
      payload: { propertyId: "PROP-A102", issue: "HVAC cooling failure" },
    });

    expect(propResult.success).toBe(true);
    expect((propResult.data as any).ticketId).toBeDefined();
    expect((propResult.data as any).status).toBe("dispatched");
  });

  it("dispatches retention campaign trigger to GrowthV8", async () => {
    const growthResult = await verticalClients.dispatch({
      vertical: "growthv8",
      operation: "retention.campaign.trigger",
      payload: { customerId: "CUST-8821" },
    });

    expect(growthResult.success).toBe(true);
    expect((growthResult.data as any).campaignId).toBe("CMP-VIP-RETENTION-2026");
    expect((growthResult.data as any).status).toBe("scheduled");
  });

  it("dispatches telemetry incident check to Dominion AIOps", async () => {
    const domResult = await verticalClients.dispatch({
      vertical: "dominion",
      operation: "incident.lookup",
      payload: { service: "checkout-worker" },
    });

    expect(domResult.success).toBe(true);
    expect((domResult.data as any).activeOutages.length).toBeGreaterThanOrEqual(1);
    expect((domResult.data as any).globalTelemetryScore).toBe(99.1);
  });
});
