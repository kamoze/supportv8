import type { ToolCallDefinition, ToolExecutionResult, AgentContext } from "../types";
import { ForgeSymphonyClient, KnowledgeV8Client, DominionClient } from "@/lib/services/interservice-client";
import { enqueueSupportTriage } from "@/lib/temporal/client";
import { WorkforceSpine } from "@/lib/workforce-spine/orchestrator";

export class ToolPlanner {
  /**
   * Plans which tools (if any) should be invoked based on customer intent
   */
  static planTools(context: AgentContext): ToolCallDefinition[] {
    const lastMsg = context.conversationHistory[context.conversationHistory.length - 1]?.content || "";
    const lower = lastMsg.toLowerCase();
    const plannedTools: ToolCallDefinition[] = [];

    if (lower.includes("refund") || lower.includes("credit") || lower.includes("reimburse")) {
      plannedTools.push({
        name: "order_refund",
        arguments: {
          tenantId: context.tenantId,
          amountUsd: 150.0,
          customerEmail: context.customer.email || "customer@example.com",
          reason: "Customer requested automated refund credit voucher",
        },
      });
    }

    if (lower.includes("pin") || lower.includes("lockbox") || lower.includes("gate code") || lower.includes("site access")) {
      plannedTools.push({
        name: "site_access_pin",
        arguments: {
          tenantId: context.tenantId,
          contractorId: (context.intakeData?.contractorId as string) || "VND-ACTIVE",
          siteId: "SITE-MAIN-ENTRANCE",
        },
      });
    }

    if (lower.includes("supervisor") || lower.includes("human") || lower.includes("escalate") || context.customer.sentimentScore < 0.45) {
      plannedTools.push({
        name: "human_escalate",
        arguments: {
          tenantId: context.tenantId,
          reason: "Customer sentiment threshold breach or explicit supervisor request",
          priority: "urgent",
        },
      });
    }

    return plannedTools;
  }

  /**
   * Executes a planned tool call through the Workforce Spine
   */
  static async executeTool(tool: ToolCallDefinition, context: AgentContext): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const employeeId =
      context.stream === "contractors"
        ? "employee_alex"
        : context.stream === "enquiries"
        ? "employee_barnaby"
        : "employee_sophia";

    try {
      if (tool.name === "human_escalate") {
        await DominionClient.emitAlert({
          tenantId: context.tenantId,
          severity: "high",
          title: `Live Human Chat Escalation: ${context.customer.name}`,
          description: (tool.arguments.reason as string) || "Human agent requested",
        });

        return {
          toolName: tool.name,
          success: true,
          result: {
            assignedGroup: "group_support",
            status: "transferred_to_human_queue",
            priority: "urgent",
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      const spineRes = await WorkforceSpine.orchestrateAction({
        actionId: `act_${Date.now()}`,
        tenantId: context.tenantId,
        employeeId,
        stream: context.stream,
        operation:
          tool.name === "order_refund"
            ? "orderv8.refund"
            : tool.name === "site_access_pin"
            ? "contractor.site_pin"
            : tool.name,
        payload: tool.arguments,
        sessionId: context.sessionId,
      });

      return {
        toolName: tool.name,
        success: spineRes.success,
        result: spineRes.output,
        executionTimeMs: spineRes.executionTimeMs,
      };
    } catch (err: any) {
      return {
        toolName: tool.name,
        success: false,
        result: { error: err.message || "Tool execution failed" },
        executionTimeMs: Date.now() - startTime,
      };
    }
  }
}
