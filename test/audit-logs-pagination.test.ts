import { describe, it, expect } from "vitest";

describe("Governance Audit Logs - Pagination & Container Sizing", () => {
  const mockLogs = Array.from({ length: 45 }, (_, i) => ({
    id: `log_${i + 1}`,
    timestamp: new Date().toISOString(),
    actorName: `Agent ${i + 1}`,
    actorRole: "AI Specialist",
    actorType: "ai_employee",
    operation: "order.refund",
    category: "action_gateway",
    targetEntityId: `ORD-${1000 + i}`,
    riskLevel: "medium",
    status: "executed",
    durationMs: 45,
    sha256Hash: `hash_${i}_abcdef1234567890`,
    reasoning: "Customer requested refund within 30-day window.",
    ipAddress: "10.0.4.12",
    idempotencyKey: `idemp_${i}`,
    metadata: { orderId: `ORD-${1000 + i}` },
  }));

  it("should calculate total pages correctly based on page size", () => {
    const pageSize = 10;
    const totalPages = Math.ceil(mockLogs.length / pageSize);
    expect(totalPages).toBe(5);

    const page2 = mockLogs.slice((2 - 1) * pageSize, 2 * pageSize);
    expect(page2.length).toBe(10);
    expect(page2[0].id).toBe("log_11");
    expect(page2[9].id).toBe("log_20");

    const page5 = mockLogs.slice((5 - 1) * pageSize, 5 * pageSize);
    expect(page5.length).toBe(5);
    expect(page5[0].id).toBe("log_41");
    expect(page5[4].id).toBe("log_45");
  });

  it("should support 25 and 50 page size thresholds", () => {
    const pageSize25 = 25;
    const totalPages25 = Math.ceil(mockLogs.length / pageSize25);
    expect(totalPages25).toBe(2);

    const pageSize50 = 50;
    const totalPages50 = Math.ceil(mockLogs.length / pageSize50);
    expect(totalPages50).toBe(1);
  });
});
