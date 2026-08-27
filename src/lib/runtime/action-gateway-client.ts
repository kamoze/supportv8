/**
 * supportV8 Action Gateway Client
 * Enforces: No AI Employee or Automation directly mutates source systems without passing through Action Gateway.
 */

import type { OperationRegistry, OperationRisk } from "@servicev8/agentic-runtime";
import { buildSupportRegistry } from "./operations";

export interface ActionRequest {
  tenantId: string;
  actor: {
    id: string;
    type: "ai_employee" | "human" | "automation";
    name: string;
  };
  operationId: string;
  input: Record<string, unknown>;
  idempotencyKey?: string;
  requiresApproval?: boolean;
}

export interface ActionExecutionResult {
  success: boolean;
  status: "executed" | "awaiting_approval" | "rejected" | "failed";
  auditId: string;
  operationId: string;
  risk: OperationRisk;
  idempotencyKey: string;
  data?: Record<string, unknown>;
  error?: string;
  timestamp: string;
}

export class ActionGatewayClient {
  private registry: OperationRegistry;
  private auditLog: ActionExecutionResult[] = [];
  private pendingApprovals: Map<string, ActionRequest> = new Map();

  constructor(registry: OperationRegistry = buildSupportRegistry()) {
    this.registry = registry;
  }

  public getRegistry(): OperationRegistry {
    return this.registry;
  }

  public getAuditHistory(tenantId?: string): readonly ActionExecutionResult[] {
    if (!tenantId) return this.auditLog;
    return this.auditLog.filter((log) => log.auditId.includes(tenantId) || true);
  }

  public getPendingApprovals(): Array<{ auditId: string; request: ActionRequest; risk: OperationRisk }> {
    const list: Array<{ auditId: string; request: ActionRequest; risk: OperationRisk }> = [];
    for (const [auditId, request] of this.pendingApprovals.entries()) {
      const op = this.registry.get(request.operationId);
      list.push({
        auditId,
        request,
        risk: op.risk,
      });
    }
    return list;
  }

  public async requestAction(req: ActionRequest): Promise<ActionExecutionResult> {
    const op = this.registry.get(req.operationId);
    const auditId = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const idempotencyKey = req.idempotencyKey || `idem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    // 1. Validation check
    if (op.validate) {
      const valError = op.validate(req.input);
      if (valError) {
        const failure: ActionExecutionResult = {
          success: false,
          status: "failed",
          auditId,
          operationId: op.id,
          risk: op.risk,
          idempotencyKey,
          error: `Validation failed: ${valError}`,
          timestamp,
        };
        this.auditLog.unshift(failure);
        return failure;
      }
    }

    // 2. Critical operations (e.g. financial refund) or explicit approval flag ALWAYS gate on approval
    if (op.risk === "critical" || req.requiresApproval) {
      this.pendingApprovals.set(auditId, req);
      const pending: ActionExecutionResult = {
        success: true,
        status: "awaiting_approval",
        auditId,
        operationId: op.id,
        risk: op.risk,
        idempotencyKey,
        data: {
          message: "Operation held for required human approval gate",
          operation: op.summary,
          risk: op.risk,
        },
        timestamp,
      };
      this.auditLog.unshift(pending);
      return pending;
    }

    // 3. Simulate governed target execution
    const executionData = this.executeTargetOperation(op.id, req.input);
    const executed: ActionExecutionResult = {
      success: true,
      status: "executed",
      auditId,
      operationId: op.id,
      risk: op.risk,
      idempotencyKey,
      data: executionData,
      timestamp,
    };
    this.auditLog.unshift(executed);
    return executed;
  }

  public async approveAction(auditId: string, approverId: string): Promise<ActionExecutionResult> {
    const req = this.pendingApprovals.get(auditId);
    if (!req) {
      throw new Error(`No pending action found for audit ID ${auditId}`);
    }
    this.pendingApprovals.delete(auditId);
    const op = this.registry.get(req.operationId);
    const timestamp = new Date().toISOString();

    const executionData = this.executeTargetOperation(op.id, req.input);
    const executed: ActionExecutionResult = {
      success: true,
      status: "executed",
      auditId,
      operationId: op.id,
      risk: op.risk,
      idempotencyKey: req.idempotencyKey || auditId,
      data: {
        ...executionData,
        approvedBy: approverId,
        approvedAt: timestamp,
      },
      timestamp,
    };
    this.auditLog.unshift(executed);
    return executed;
  }

  public async rejectAction(auditId: string, rejectorId: string, reason: string): Promise<ActionExecutionResult> {
    const req = this.pendingApprovals.get(auditId);
    if (!req) {
      throw new Error(`No pending action found for audit ID ${auditId}`);
    }
    this.pendingApprovals.delete(auditId);
    const op = this.registry.get(req.operationId);
    const timestamp = new Date().toISOString();

    const rejected: ActionExecutionResult = {
      success: false,
      status: "rejected",
      auditId,
      operationId: op.id,
      risk: op.risk,
      idempotencyKey: req.idempotencyKey || auditId,
      error: `Action rejected by ${rejectorId}: ${reason}`,
      timestamp,
    };
    this.auditLog.unshift(rejected);
    return rejected;
  }

  private executeTargetOperation(operationId: string, input: Record<string, unknown>): Record<string, unknown> {
    switch (operationId) {
      case "zendesk.ticket.add_tag":
        return {
          ticket_id: input.ticket_id,
          tags_applied: input.tags,
          updated_at: new Date().toISOString(),
        };
      case "zendesk.ticket.update_priority":
        return {
          ticket_id: input.ticket_id,
          priority_updated: input.priority,
          updated_at: new Date().toISOString(),
        };
      case "zendesk.ticket.add_internal_note":
        return {
          ticket_id: input.ticket_id,
          note_id: `note_${Date.now()}`,
          is_public: false,
          created_at: new Date().toISOString(),
        };
      case "zendesk.ticket.close":
      case "ticket.close":
        return {
          ticket_id: input.ticket_id,
          status: "closed",
          closed_at: new Date().toISOString(),
        };
      case "ticket.create":
        return {
          ticket_id: `zd_ext_${Date.now().toString().slice(-5)}`,
          title: input.title,
          status: "open",
          created_at: new Date().toISOString(),
        };
      case "ticket.route":
        return {
          ticket_id: input.ticket_id,
          target_queue: input.target_queue,
          routed_at: new Date().toISOString(),
        };
      case "customer.refund":
        return {
          refund_id: `ref_${Date.now()}`,
          customer_id: input.customer_id,
          amount_cents: input.amount_cents,
          currency: "USD",
          status: "succeeded",
        };
      case "account.unlock":
        return {
          account_id: input.account_id,
          status: "unlocked",
          unlocked_at: new Date().toISOString(),
        };
      case "problem.notify_customers":
        return {
          problem_id: input.problem_id,
          recipients_count: 142,
          delivery_channel: "email_sms_broadcast",
          status: "dispatched",
        };
      case "knowledge.publish":
        return {
          article_id: `kb_art_${Date.now()}`,
          title: input.title,
          status: "published",
          version: "2.1",
        };
      default:
        return {
          operation_id: operationId,
          executed: true,
        };
    }
  }
}

export const globalActionGateway = new ActionGatewayClient();
