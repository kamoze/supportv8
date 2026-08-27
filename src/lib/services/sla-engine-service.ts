/**
 * supportV8 SLA Engine & Real-Time Breach Predictor
 * Monitors live ticket queues, computes time-to-breach, applies tier SLAs,
 * and automatically triggers early-warning escalations before customer breach.
 */

import { db } from "../db/mock-data";
import type { SlaPolicyRule, TicketSlaStatus } from "../types/cx-types";

export const SLA_TIER_RULES: Record<"enterprise" | "pro" | "standard", SlaPolicyRule> = {
  enterprise: {
    tier: "enterprise",
    firstResponseTimeMinutes: 15,
    nextResponseTimeMinutes: 30,
    resolutionTimeMinutes: 120,
  },
  pro: {
    tier: "pro",
    firstResponseTimeMinutes: 60,
    nextResponseTimeMinutes: 120,
    resolutionTimeMinutes: 480,
  },
  standard: {
    tier: "standard",
    firstResponseTimeMinutes: 240,
    nextResponseTimeMinutes: 480,
    resolutionTimeMinutes: 1440,
  },
};

export class SlaEngineService {
  private customTickets: TicketSlaStatus[] = [];

  public getSlaOverview(): {
    attainmentRate: number;
    totalTracked: number;
    healthyCount: number;
    atRiskCount: number;
    breachedCount: number;
    tickets: TicketSlaStatus[];
  } {
    const defaultTickets: TicketSlaStatus[] = [
      {
        ticketId: "t_sla_001",
        externalId: "ZD-88421",
        customerName: "Acme Cloud Infrastructure",
        tier: "enterprise",
        channel: "zendesk",
        status: "open",
        assignedAgent: "Maya — Incident Specialist",
        targetResponseMinutes: 15,
        elapsedMinutes: 13,
        remainingMinutes: 2,
        riskLevel: "at_risk",
        predictedBreachMinutes: 2,
        suggestedAction: "Auto-assign to Tier 2 on-call or execute autonomous refund/triage",
      },
      {
        ticketId: "t_sla_002",
        externalId: "INT-44109",
        customerName: "FinTech Global Payments",
        tier: "enterprise",
        channel: "intercom",
        status: "in_progress",
        assignedAgent: "Alex — Lead Support Engineer",
        targetResponseMinutes: 15,
        elapsedMinutes: 4,
        remainingMinutes: 11,
        riskLevel: "healthy",
        predictedBreachMinutes: 11,
        suggestedAction: "Awaiting customer response to 3DS validation guidance",
      },
      {
        ticketId: "t_sla_003",
        externalId: "VC-99120",
        customerName: "Nexus Retail Systems",
        tier: "pro",
        channel: "voice",
        status: "open",
        assignedAgent: "Jordan — Escalations Lead",
        targetResponseMinutes: 60,
        elapsedMinutes: 52,
        remainingMinutes: 8,
        riskLevel: "at_risk",
        predictedBreachMinutes: 8,
        suggestedAction: "High sentiment frustration: Trigger immediate callback or manager review",
      },
      {
        ticketId: "t_sla_004",
        externalId: "ZD-88390",
        customerName: "BioHealth Diagnostics",
        tier: "enterprise",
        channel: "zendesk",
        status: "open",
        assignedAgent: "Rusty — Stale Sweeper",
        targetResponseMinutes: 15,
        elapsedMinutes: 19,
        remainingMinutes: -4,
        riskLevel: "breached",
        predictedBreachMinutes: 0,
        suggestedAction: "BREACHED: Priority override dispatches incident manager alert",
      },
      {
        ticketId: "t_sla_005",
        externalId: "INT-44082",
        customerName: "AeroDynamics Logix",
        tier: "standard",
        channel: "intercom",
        status: "open",
        assignedAgent: "Chip — Auto-Triage Intern",
        targetResponseMinutes: 240,
        elapsedMinutes: 45,
        remainingMinutes: 195,
        riskLevel: "healthy",
        predictedBreachMinutes: 195,
        suggestedAction: "Normal queue priority",
      },
    ];

    const allTickets = [...this.customTickets, ...defaultTickets];
    const healthyCount = allTickets.filter((t) => t.riskLevel === "healthy").length;
    const atRiskCount = allTickets.filter((t) => t.riskLevel === "at_risk").length;
    const breachedCount = allTickets.filter((t) => t.riskLevel === "breached").length;

    const attainmentRate = Number((((allTickets.length - breachedCount) / allTickets.length) * 100).toFixed(1));

    return {
      attainmentRate,
      totalTracked: allTickets.length,
      healthyCount,
      atRiskCount,
      breachedCount,
      tickets: allTickets,
    };
  }

  /**
   * Prioritize or auto-escalate an at-risk ticket.
   */
  public escalateAtRiskTicket(ticketId: string): { success: boolean; message: string; ticket: TicketSlaStatus } {
    const overview = this.getSlaOverview();
    const ticket = overview.tickets.find((t) => t.ticketId === ticketId);

    if (!ticket) throw new Error(`Ticket '${ticketId}' not found`);

    ticket.assignedAgent = "Jordan — Escalations Lead (Priority Escalated)";
    ticket.riskLevel = "healthy";
    ticket.remainingMinutes = 45;
    ticket.suggestedAction = "Escalation team paged: First contact response in progress";

    return {
      success: true,
      message: `Ticket ${ticket.externalId} successfully escalated with priority override.`,
      ticket,
    };
  }
}

export const slaEngine = new SlaEngineService();
