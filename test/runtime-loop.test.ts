import { describe, it, expect } from "vitest";
import { buildSupportRegistry } from "@/lib/runtime/operations";
import { SupportAgenticEngine } from "@/lib/runtime/support-engine";
import { ActionGatewayClient } from "@/lib/runtime/action-gateway-client";
import {
  defineTenantRef,
  evaluateAutonomy,
  parseAutonomyPolicy,
  type EngineContext,
} from "@servicev8/agentic-runtime";

describe("supportV8 Agentic Runtime Loop", () => {
  it("registers all required support operations with proper risk levels", () => {
    const registry = buildSupportRegistry();
    const ops = registry.list();

    expect(ops.length).toBeGreaterThanOrEqual(10);
    expect(registry.get("zendesk.ticket.add_tag").risk).toBe("low");
    expect(registry.get("zendesk.ticket.close").risk).toBe("medium");
    expect(registry.get("customer.refund").risk).toBe("critical");
    expect(registry.get("account.unlock").risk).toBe("high");
    expect(registry.get("problem.notify_customers").risk).toBe("high");
  });

  it("proposes operations through Engine contract without direct mutation", async () => {
    const engine = new SupportAgenticEngine({
      mode: "autonomous",
      source: "zendesk",
      externalTicketId: "ZD-12345",
      customer: { id: "C-1", name: "Alice", tier: "enterprise" },
      message: "Our checkout keeps spinning indefinitely",
      sentiment: "angry",
      intent: "checkout_failure",
      category: "checkout_failure",
      likelyProblemId: "PRB-218",
      confidence: 0.95,
    });

    const tenantRef = defineTenantRef({
      tenantId: "tenant_test",
      tenantDomain: "tenant-test.servicev8.internal",
    });

    const ctx: EngineContext = {
      tenant: tenantRef,
      instanceId: "hire_support_01",
      tuning: {},
      narrate: async () => "Engine narrative summary for Alice",
    };

    const resolution = await engine.run(ctx);

    expect(resolution.recommendation).toContain("Engine narrative");
    expect(resolution.proposals?.length).toBeGreaterThanOrEqual(2);

    const tagProposal = resolution.proposals?.find((p) => p.operationId === "zendesk.ticket.add_tag");
    expect(tagProposal).toBeDefined();
    expect(tagProposal?.input.ticket_id).toBe("ZD-12345");

    const priorityProposal = resolution.proposals?.find((p) => p.operationId === "zendesk.ticket.update_priority");
    expect(priorityProposal).toBeDefined();
    expect(priorityProposal?.input.priority).toBe("urgent");
  });

  it("strictly gates critical operations on human approval via Action Gateway", async () => {
    const client = new ActionGatewayClient();

    // Critical financial refund operation
    const result = await client.requestAction({
      tenantId: "tenant_default",
      actor: { id: "ai_emp_1", type: "ai_employee", name: "Refund Bot" },
      operationId: "customer.refund",
      input: {
        customer_id: "C-881",
        amount_cents: 4900,
        reason: "Double charge refund",
      },
    });

    expect(result.status).toBe("awaiting_approval");
    expect(result.risk).toBe("critical");

    const pending = client.getPendingApprovals();
    expect(pending.length).toBe(1);
    expect(pending[0].auditId).toBe(result.auditId);

    // Human approves
    const approved = await client.approveAction(result.auditId, "supervisor_jane");
    expect(approved.status).toBe("executed");
    expect(approved.data?.approvedBy).toBe("supervisor_jane");
  });

  it("enforces tenant autonomy threshold evaluation using @servicev8/agentic-runtime", () => {
    const tenantRef = defineTenantRef({
      tenantId: "tenant_test",
      tenantDomain: "tenant-test.servicev8.internal",
    });
    const policy = parseAutonomyPolicy({ autoExecuteMaxRisk: "medium" }, "test:policy")!;
    const registry = buildSupportRegistry();

    // Low risk operation with high confidence -> allowed
    const lowOp = registry.get("zendesk.ticket.add_tag");
    const decisionLow = evaluateAutonomy({
      grants: ["ticket:write"],
      risk: lowOp.risk,
      requiredScope: lowOp.requiredScope,
      policy,
      preApproved: [],
      proposal: {
        operationId: "zendesk.ticket.add_tag",
        input: { ticket_id: "ZD-1", tags: ["test"] },
        reason: "tagging ticket",
      },
    });
    expect(decisionLow.outcome).toBe("execute");

    // High risk operation exceeding medium threshold -> denied
    const highOp = registry.get("account.unlock");
    const decisionHigh = evaluateAutonomy({
      grants: ["account:admin"],
      risk: highOp.risk,
      requiredScope: highOp.requiredScope,
      policy,
      preApproved: [],
      proposal: {
        operationId: "account.unlock",
        input: { account_id: "ACC-1", reason: "test" },
        reason: "unlocking account",
      },
    });
    expect(decisionHigh.outcome).toBe("needs_approval");
  });
});
