import { describe, it, expect } from "vitest";
import {
  ChatWorkflowService,
  DEFAULT_CHAT_WORKFLOWS,
  DEFAULT_MEMBER_GROUPS,
  DEFAULT_AI_GUARDRAILS,
} from "../src/lib/services/chat-workflow-service";

describe("Omnichannel Chat Workflow & Group RBAC Engine", () => {
  it("should provide default workflow configurations for all 3 streams", () => {
    const workflows = ChatWorkflowService.getWorkflows();
    expect(workflows.contractors).toBeDefined();
    expect(workflows.enquiries).toBeDefined();
    expect(workflows.customers).toBeDefined();

    expect(workflows.contractors.title).toContain("Contractors");
    expect(workflows.enquiries.title).toContain("Enquiries");
    expect(workflows.customers.title).toContain("Customers");

    expect(workflows.contractors.intakeFields.length).toBeGreaterThan(3);
    expect(workflows.customers.intakeFields.length).toBeGreaterThan(3);
  });

  it("should initialize a new chat session for Contractors stream with intake data", () => {
    const session = ChatWorkflowService.startSession({
      tenantDomain: "acme",
      stream: "contractors",
      customerName: "Apex Technicians",
      customerEmail: "tech@apex.com",
      intakeData: {
        contractorId: "VND-99120",
        inquiryCategory: "Work Order Dispatch & Site Access",
        urgency: "High (Active On-Site)",
        details: "Gate code 8812 is malfunctioning.",
      },
    });

    expect(session.id).toBeDefined();
    expect(session.stream).toBe("contractors");
    expect(session.priority).toBe("high");
    expect(session.intakeData.contractorId).toBe("VND-99120");
    expect(session.messages.length).toBe(2);
    expect(session.messages[0].sender).toBe("customer");
    expect(session.messages[1].sender).toBe("ai_employee");
  });

  it("should initialize a new chat session for Customers stream and assign AI Lead", () => {
    const session = ChatWorkflowService.startSession({
      tenantDomain: "acme",
      stream: "customers",
      customerName: "Elena Rostova",
      customerEmail: "elena@acme.com",
      intakeData: {
        issueType: "Billing, Invoices & Refund Request",
        urgency: "Normal",
        details: "Checking on refund status.",
      },
    });

    expect(session.id).toBeDefined();
    expect(session.stream).toBe("customers");
    expect(session.assignedName).toContain("Sophia");
  });

  it("should handle customer messages and generate grounded AI response with citations", () => {
    const session = ChatWorkflowService.startSession({
      tenantDomain: "acme",
      stream: "customers",
      customerName: "Marcus Vance",
      customerEmail: "marcus@meridian.com",
      intakeData: { details: "Need order replacement assistance" },
    });

    const result = ChatWorkflowService.sendMessage({
      sessionId: session.id,
      sender: "customer",
      senderName: "Marcus Vance",
      content: "Can you issue an automated refund for my broken item?",
    });

    expect(result.session.messages.length).toBe(4);
    const lastMsg = result.responseMessage;
    expect(lastMsg).toBeDefined();
    expect(lastMsg?.sender).toBe("ai_employee");
    expect(lastMsg?.content).toContain("refund");
    expect(lastMsg?.citations).toBeDefined();
    expect(lastMsg?.citations?.length).toBeGreaterThan(0);
  });

  it("should automatically escalate session to human lead when escalation keyword is detected", () => {
    const session = ChatWorkflowService.startSession({
      tenantDomain: "acme",
      stream: "customers",
      customerName: "Disgruntled User",
      customerEmail: "user@risk.com",
      intakeData: { details: "Problem with billing" },
    });

    const result = ChatWorkflowService.sendMessage({
      sessionId: session.id,
      sender: "customer",
      senderName: "Disgruntled User",
      content: "This is completely unacceptable, I want to talk to your supervisor or lawyer immediately!",
    });

    expect(result.session.status).toBe("escalated");
    expect(result.session.priority).toBe("urgent");
    expect(result.session.assignedType).toBe("human");
    expect(result.responseMessage?.sender).toBe("system");
    expect(result.responseMessage?.content).toContain("🚨");
  });

  it("should manage RBAC groups and permissions", () => {
    const initialGroups = ChatWorkflowService.listGroups();
    expect(initialGroups.length).toBeGreaterThanOrEqual(4);

    const newGroup = ChatWorkflowService.createGroup({
      name: "VIP Enterprise CX",
      streamType: "customers",
      description: "Handles Fortune 500 VIP support requests",
      color: "#9B51E0",
      permissions: ["tickets.view", "tickets.reply", "orderv8.refund"],
      memberEmails: ["vip.lead@servicev8.com"],
      isSystem: false,
    });

    expect(newGroup.id).toBeDefined();
    expect(newGroup.name).toBe("VIP Enterprise CX");

    const updated = ChatWorkflowService.updateGroup(newGroup.id, {
      description: "Updated VIP description",
    });
    expect(updated.description).toBe("Updated VIP description");

    const deleted = ChatWorkflowService.deleteGroup(newGroup.id);
    expect(deleted).toBe(true);
  });

  it("should toggle human staff online presence", () => {
    const staff = ChatWorkflowService.listStaffPresence();
    expect(staff.length).toBeGreaterThan(0);

    const targetEmail = "alex.cx@servicev8.com";
    const toggled = ChatWorkflowService.toggleStaffOnline(targetEmail, false);
    expect(toggled.isOnline).toBe(false);

    const restored = ChatWorkflowService.toggleStaffOnline(targetEmail, true);
    expect(restored.isOnline).toBe(true);
  });
});
