import type { WorkforceEmployeeIdentity, AutonomyTier } from "./types";

export class WorkforceGovernance {
  private static employees: Map<string, WorkforceEmployeeIdentity> = new Map([
    [
      "employee_sophia",
      {
        id: "employee_sophia",
        name: "Sophia — Customer Success Lead",
        role: "Tier 2 Lead / Autonomous Customer Advocate",
        avatar: "/avatars/beaver-sophia.jpg",
        supervisorName: "Ini Godwin (CX Director)",
        supervisorEmail: "inigodwin@redoo.solutions",
        tokenMonthlyQuota: 5000000,
        tokensConsumed: 412000,
        maxAutonomousRefundUsd: 500.0,
        voiceGender: "female",
        acousticPitchShift: 1.15,
      },
    ],
    [
      "employee_alex",
      {
        id: "employee_alex",
        name: "Alex — Contractor & Vendor Dispatcher",
        role: "Field Operations & Contractor Lead",
        avatar: "/avatars/beaver-manager.jpg",
        supervisorName: "Ini Godwin (CX Director)",
        supervisorEmail: "inigodwin@redoo.solutions",
        tokenMonthlyQuota: 3000000,
        tokensConsumed: 184000,
        maxAutonomousRefundUsd: 250.0,
        voiceGender: "male",
        acousticPitchShift: 0.85,
      },
    ],
    [
      "employee_barnaby",
      {
        id: "employee_barnaby",
        name: "Barnaby — Solutions & Knowledge Lead",
        role: "Pre-Sales & RAG Knowledge Architect",
        avatar: "/avatars/beaver-curator.jpg",
        supervisorName: "Ini Godwin (CX Director)",
        supervisorEmail: "inigodwin@redoo.solutions",
        tokenMonthlyQuota: 4000000,
        tokensConsumed: 320000,
        maxAutonomousRefundUsd: 100.0,
        voiceGender: "male",
        acousticPitchShift: 0.9,
      },
    ],
  ]);

  /**
   * Retrieves an employee identity
   */
  static getEmployee(employeeId: string): WorkforceEmployeeIdentity {
    const emp = this.employees.get(employeeId);
    if (!emp) {
      return this.employees.get("employee_sophia")!;
    }
    return emp;
  }

  /**
   * Evaluates autonomy tier and financial thresholds for a requested LLM action
   */
  static evaluateAutonomy(
    employeeId: string,
    operation: string,
    payload: Record<string, unknown>
  ): { tier: AutonomyTier; reason: string } {
    const employee = this.getEmployee(employeeId);

    // 1. Financial refund limit check
    if (operation === "orderv8.refund" || operation === "billing.credit") {
      const amount = Number(payload.amountUsd || payload.amount || 0);
      if (amount > employee.maxAutonomousRefundUsd) {
        return {
          tier: "requires_supervisor_approval",
          reason: `Requested refund amount ($${amount}) exceeds employee ${employee.name}'s autonomous ceiling ($${employee.maxAutonomousRefundUsd}). Routed to ${employee.supervisorName} for approval.`,
        };
      }
      return { tier: "auto_allowed", reason: "Within autonomous financial ceiling." };
    }

    // 2. Lockbox PIN generation
    if (operation === "contractor.site_pin" || operation === "site_access_pin") {
      return { tier: "auto_allowed", reason: "Autonomous lockbox security token issuance permitted." };
    }

    // 3. Destructive operations require human supervisor sign-off
    if (operation.includes("delete") || operation.includes("terminate") || operation.includes("revoke")) {
      return {
        tier: "requires_supervisor_approval",
        reason: `Destructive operation (${operation}) strictly requires Human Supervisor (${employee.supervisorName}) approval.`,
      };
    }

    return { tier: "auto_allowed", reason: "Standard autonomous operation." };
  }

  /**
   * Verifies and meters token consumption against employee quota
   */
  static meterTokens(employeeId: string, tokens: number): { allowed: boolean; remainingBudget: number } {
    const employee = this.getEmployee(employeeId);
    if (employee.tokensConsumed + tokens > employee.tokenMonthlyQuota) {
      return { allowed: false, remainingBudget: 0 };
    }
    employee.tokensConsumed += tokens;
    const remaining = employee.tokenMonthlyQuota - employee.tokensConsumed;
    return { allowed: true, remainingBudget: remaining };
  }
}
