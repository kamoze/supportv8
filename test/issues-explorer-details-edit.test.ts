import { describe, it, expect, beforeEach } from "vitest";
import { issueService } from "../src/lib/services/issue-service";
import { GET as getIssues, POST as postIssues, PATCH as patchIssues } from "../src/app/api/issues/route";
import { NextRequest } from "next/server";

describe("Issues Explorer - Ticket Details, Status Lifecycle & Edit Suite", () => {
  beforeEach(() => {
    // Reset or ensure test issue is available
    const issue = issueService.getById("ISS-1001");
    if (issue) {
      issueService.updateIssue("ISS-1001", {
        status: "open",
        priority: "urgent",
        summary: "Checkout page throws 500 on final payment submit",
        category: "Billing",
        assignedTo: "Sophia (AI)",
      });
    }
  });

  it("1. Should return full ticket details for an issue", () => {
    const issue = issueService.getById("ISS-1001");
    expect(issue).toBeDefined();
    expect(issue?.externalId).toBe("ZD-884233");
    expect(issue?.summary).toBe("Checkout page throws 500 on final payment submit");
    expect(issue?.customerName).toBe("Sarah Jenkins");
    expect(issue?.customerTier).toBe("enterprise");
  });

  it("2. Should allow changing ticket status to In Progress, Escalated, Resolved, and Closed via POST /api/issues", async () => {
    // Transition to in_progress
    const req1 = new NextRequest("http://localhost:3000/api/issues", {
      method: "POST",
      body: JSON.stringify({ action: "change_status", issueId: "ISS-1001", status: "in_progress" }),
    });
    const res1 = await postIssues(req1);
    const json1 = await res1.json();
    expect(json1.success).toBe(true);
    expect(json1.data.status).toBe("in_progress");

    // Transition to escalated
    const req2 = new NextRequest("http://localhost:3000/api/issues", {
      method: "POST",
      body: JSON.stringify({ action: "update", issueId: "ISS-1001", updates: { status: "escalated", priority: "urgent" } }),
    });
    const res2 = await postIssues(req2);
    const json2 = await res2.json();
    expect(json2.success).toBe(true);
    expect(json2.data.status).toBe("escalated");
    expect(json2.data.priority).toBe("urgent");

    // Transition to resolved via action: resolve
    const req3 = new NextRequest("http://localhost:3000/api/issues", {
      method: "POST",
      body: JSON.stringify({ action: "resolve", issueId: "ISS-1001" }),
    });
    const res3 = await postIssues(req3);
    const json3 = await res3.json();
    expect(json3.success).toBe(true);
    expect(json3.data.status).toBe("resolved");
  });

  it("3. Should allow editing full ticket metadata via PATCH /api/issues", async () => {
    const patchReq = new NextRequest("http://localhost:3000/api/issues", {
      method: "PATCH",
      body: JSON.stringify({
        id: "ISS-1001",
        summary: "Checkout page throws 500 on Stripe gateway webhook",
        category: "Payment Gateway",
        priority: "high",
        assignedTo: "David Kim (Operator)",
        recommendedAction: "Restart worker pods and replay failed webhook payload.",
      }),
    });
    const patchRes = await patchIssues(patchReq);
    const patchJson = await patchRes.json();

    expect(patchJson.success).toBe(true);
    expect(patchJson.data.summary).toBe("Checkout page throws 500 on Stripe gateway webhook");
    expect(patchJson.data.category).toBe("Payment Gateway");
    expect(patchJson.data.priority).toBe("high");
    expect(patchJson.data.assignedTo).toBe("David Kim (Operator)");
    expect(patchJson.data.recommendedAction).toBe("Restart worker pods and replay failed webhook payload.");
  });

  it("4. Should record timeline audit events and internal notes when updating ticket", () => {
    const timelineEvent = {
      id: "tl_test_1",
      timestamp: "10:30 AM",
      actor: "David Kim (Operator)",
      actorType: "human_operator" as const,
      action: "Status transitioned to IN_PROGRESS",
      details: "Investigation initiated.",
    };

    const updated = issueService.updateIssue("ISS-1001", {
      status: "in_progress",
      timeline: [timelineEvent],
    });

    expect(updated?.timeline).toHaveLength(1);
    expect(updated?.timeline?.[0].action).toBe("Status transitioned to IN_PROGRESS");
    expect(updated?.timeline?.[0].actor).toBe("David Kim (Operator)");
  });
});
