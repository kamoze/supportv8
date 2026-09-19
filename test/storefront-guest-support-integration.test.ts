import { describe, it, expect, vi } from "vitest";

vi.mock("pg", () => ({
  Pool: class {
    query = vi.fn();
    connect = vi.fn();
  },
  default: {
    Pool: class {
      query = vi.fn();
      connect = vi.fn();
    },
  },
}));

import { ChatWorkflowService } from "../src/lib/services/chat-workflow-service";
import { ToolPlanner } from "../src/lib/chatbot/agent-runtime/tool-planner";
import type { AgentContext } from "../src/lib/chatbot/types";

describe("Storefront Guest Support & Order Discovery Integration", () => {
  it("enquiries workflow does not block guest shoppers with mandatory company requirement", () => {
    const workflows = ChatWorkflowService.getWorkflows();
    const enquiries = workflows.enquiries;
    expect(enquiries).toBeDefined();

    const companyField = enquiries.intakeFields.find((f) => f.name === "company");
    expect(companyField).toBeDefined();
    expect(companyField?.required).toBe(false);

    const nameField = enquiries.intakeFields.find((f) => f.name === "name");
    expect(nameField?.required).toBe(true);

    const emailField = enquiries.intakeFields.find((f) => f.name === "email");
    expect(emailField?.required).toBe(true);

    const enquiryTypeField = enquiries.intakeFields.find((f) => f.name === "enquiryType");
    expect(enquiryTypeField?.options).toContain("Store Menu, Hours & General Inquiries");
    expect(enquiryTypeField?.options).toContain("Order Status, Delivery & Tracking");
    expect(enquiryTypeField?.options).toContain("Returns, Refunds & Policies");
  });

  it("customers workflow does not enforce mandatory accountOrOrderId for guest returns", () => {
    const workflows = ChatWorkflowService.getWorkflows();
    const customers = workflows.customers;
    expect(customers).toBeDefined();

    const accountField = customers.intakeFields.find((f) => f.name === "accountOrOrderId");
    expect(accountField).toBeDefined();
    expect(accountField?.required).toBe(false);

    const issueTypeField = customers.intakeFields.find((f) => f.name === "issueType");
    expect(issueTypeField?.options).toContain("Order Status, Delivery & Tracking");
    expect(issueTypeField?.options).toContain("Billing, Invoices & Refund Request");
  });

  it("ToolPlanner automatically plans order_lookup tool when customer asks about order or delivery status", () => {
    const mockContext: AgentContext = {
      tenantId: "apalace",
      sessionId: "session_test_123",
      stream: "customers",
      customer: {
        id: "cust_guest",
        name: "Valued Shopper",
        email: "shopper@example.com",
        sentimentScore: 0.8,
        vipStatus: false,
      },
      intakeData: {
        accountOrOrderId: "ORD-99182",
      },
      conversationHistory: [
        {
          id: "msg_1",
          sender: "customer",
          content: "Can you check the delivery status of my order please?",
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const tools = ToolPlanner.planTools(mockContext);
    const lookupTool = tools.find((t) => t.name === "order_lookup");
    expect(lookupTool).toBeDefined();
    expect(lookupTool?.arguments.orderId).toBe("ORD-99182");
    expect(lookupTool?.arguments.email).toBe("shopper@example.com");
    expect(lookupTool?.arguments.tenantId).toBe("apalace");
  });
});
