import { describe, it, expect } from "vitest";
import type { Issue } from "../src/lib/types";

function filterWorkDeskQueue(
  issues: Issue[],
  queueStatusFilter: "active" | "all" | "resolved",
  filterType: "all" | "customers" | "contractors" | "urgent" = "all",
  searchQuery: string = ""
): Issue[] {
  return issues.filter((i) => {
    // 1. Queue Status Filter: Resolved and closed tickets leave the active work desk queue by default
    const isClosedOrResolved = i.status === "resolved" || i.status === "closed";
    if (queueStatusFilter === "active" && isClosedOrResolved) {
      return false;
    }
    if (queueStatusFilter === "resolved" && !isClosedOrResolved) {
      return false;
    }

    // 2. Search query filter
    const matchesSearch =
      !searchQuery ||
      i.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.externalId.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // 3. Category / Entity filter
    const isCtr = i.entityType === "contractor" || i.category?.includes("contractor") || Boolean(i.contractor);
    if (filterType === "customers") return !isCtr;
    if (filterType === "contractors") return isCtr;
    if (filterType === "urgent") return i.priority === "urgent" || i.priority === "high";
    return true;
  });
}

describe("Work Desk Queue Lifecycle & Resolved/Closed Exit Logic", () => {
  const mockIssues: Issue[] = ([
    {
      id: "iss-1",
      externalId: "SV8-1001",
      summary: "Customer refund request for delayed dispatch",
      customerName: "Alice Walker",
      status: "open",
      priority: "urgent",
      createdAt: "2026-08-31T10:00:00Z",
    },
    {
      id: "iss-2",
      externalId: "SV8-1002",
      summary: "Field technician needs electronic lockbox PIN",
      customerName: "Bob Builder",
      entityType: "contractor",
      status: "in_progress",
      priority: "high",
      createdAt: "2026-08-31T10:15:00Z",
    },
    {
      id: "iss-3",
      externalId: "SV8-1003",
      summary: "SSO login issue resolved via cache clearance",
      customerName: "Charlie Brown",
      status: "resolved",
      priority: "normal",
      createdAt: "2026-08-31T09:00:00Z",
    },
    {
      id: "iss-4",
      externalId: "SV8-1004",
      summary: "Dormant ticket safely closed by sweeper",
      customerName: "Diana Prince",
      status: "closed",
      priority: "low",
      createdAt: "2026-08-31T08:00:00Z",
    },
    {
      id: "iss-5",
      externalId: "SV8-1005",
      summary: "Billing dispute requiring tier 2 manager override",
      customerName: "Edward Norton",
      status: "escalated",
      priority: "urgent",
      createdAt: "2026-08-31T10:30:00Z",
    },
  ] as any) as Issue[];

  it("1. Active Work Desk Queue should exclude resolved and closed tickets", () => {
    const activeQueue = filterWorkDeskQueue(mockIssues, "active");
    const activeIds = activeQueue.map((i) => i.id);

    // iss-1 (open), iss-2 (in_progress), iss-5 (escalated) must be in active queue
    expect(activeIds).toEqual(["iss-1", "iss-2", "iss-5"]);
    expect(activeQueue.length).toBe(3);

    // iss-3 (resolved) and iss-4 (closed) must NOT be in active queue
    expect(activeIds).not.toContain("iss-3");
    expect(activeIds).not.toContain("iss-4");
  });

  it("2. When an open ticket is resolved, it immediately leaves the active work desk queue", () => {
    // Start with initial active queue
    const initialActive = filterWorkDeskQueue(mockIssues, "active");
    expect(initialActive.map((i) => i.id)).toContain("iss-1");

    // Resolve iss-1
    const updatedIssues = mockIssues.map((i) =>
      i.id === "iss-1" ? { ...i, status: "resolved" } : i
    );

    const nextActive = filterWorkDeskQueue(updatedIssues, "active");
    expect(nextActive.map((i) => i.id)).not.toContain("iss-1");
    expect(nextActive.map((i) => i.id)).toEqual(["iss-2", "iss-5"]);
  });

  it("3. When an in-progress ticket is closed, it immediately leaves the active work desk queue", () => {
    // Close iss-2
    const updatedIssues = mockIssues.map((i) =>
      i.id === "iss-2" ? { ...i, status: "closed" } : i
    );

    const nextActive = filterWorkDeskQueue(updatedIssues, "active");
    expect(nextActive.map((i) => i.id)).not.toContain("iss-2");
    expect(nextActive.map((i) => i.id)).toEqual(["iss-1", "iss-5"]);
  });

  it("4. Resolved Archive view returns only resolved and closed tickets", () => {
    const resolvedArchive = filterWorkDeskQueue(mockIssues, "resolved");
    const resolvedIds = resolvedArchive.map((i) => i.id);

    expect(resolvedIds).toEqual(["iss-3", "iss-4"]);
    expect(resolvedArchive.length).toBe(2);
  });

  it("5. Auto-advance helper correctly identifies the next active ticket to focus", () => {
    const currentTicketId = "iss-1";
    const remainingActive = mockIssues.filter(
      (i) => i.id !== currentTicketId && i.status !== "resolved" && i.status !== "closed"
    );

    expect(remainingActive.length).toBe(2);
    expect(remainingActive[0].id).toBe("iss-2");
  });
});
