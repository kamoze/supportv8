import type { ChatStreamType } from "@/lib/types";

// =============================================================================
// Agent Platform Taxonomy
// =============================================================================
export type AgentClass = "interactive" | "autonomous";

export type InteractiveAgentRole = "chatbot" | "copilot" | "assistant";
export type AutonomousAgentRole = "ai_employee" | "ai_intern" | "background_agent";

export type AgentRole = InteractiveAgentRole | AutonomousAgentRole;

export interface AgentDescriptor {
  id: string;
  name: string;
  role: AgentRole;
  agentClass: AgentClass;
  description: string;
  avatar: string;
  supportedStreams: ChatStreamType[];
  executionEngine: "realtime_sse" | "temporal_workflow" | "scheduled_cron";
  autonomyLevel: "human_supervised" | "semi_autonomous" | "fully_autonomous";
  tools: string[];
}

// =============================================================================
// Dual-Modal Agent Registry
// =============================================================================
export const AGENT_REGISTRY: AgentDescriptor[] = [
  // ── Interactive Agents ───────────────────────────────────────────────────
  {
    id: "agent_chatbot_omni",
    name: "Omnichannel Frontline Chatbot",
    role: "chatbot",
    agentClass: "interactive",
    description: "Real-time conversational agent handling Web, Mobile, Voice, WhatsApp, and Email inquiries.",
    avatar: "/avatars/beaver-sophia.jpg",
    supportedStreams: ["customers", "contractors", "enquiries"],
    executionEngine: "realtime_sse",
    autonomyLevel: "semi_autonomous",
    tools: ["knowledge_search", "order_refund", "site_access_pin", "human_escalate"],
  },
  {
    id: "agent_copilot_workdesk",
    name: "Support Staff Copilot",
    role: "copilot",
    agentClass: "interactive",
    description: "In-desk intelligent assistant providing live draft suggestions, sentiment cues, and action proposals for human agents.",
    avatar: "/avatars/beaver-alex.jpg",
    supportedStreams: ["customers", "contractors", "enquiries"],
    executionEngine: "realtime_sse",
    autonomyLevel: "human_supervised",
    tools: ["knowledge_search", "ticket_summarize", "propose_macro", "sentiment_predict"],
  },
  {
    id: "agent_portal_assistant",
    name: "Tenant Portal Assistant",
    role: "assistant",
    agentClass: "interactive",
    description: "Embedded self-service widget assisting customers with form fill, document upload, and status lookup.",
    avatar: "/avatars/beaver-barnaby.jpg",
    supportedStreams: ["customers", "enquiries"],
    executionEngine: "realtime_sse",
    autonomyLevel: "semi_autonomous",
    tools: ["knowledge_search", "order_lookup", "invoice_download"],
  },

  // ── Autonomous Agents ────────────────────────────────────────────────────
  {
    id: "agent_employee_alex",
    name: "Alex — Autonomous Contractor Dispatcher",
    role: "ai_employee",
    agentClass: "autonomous",
    description: "Autonomous AI Employee managing contractor W9 compliance, work orders, and emergency lockbox dispatch.",
    avatar: "/avatars/beaver-manager.jpg",
    supportedStreams: ["contractors"],
    executionEngine: "temporal_workflow",
    autonomyLevel: "fully_autonomous",
    tools: ["site_access_pin", "work_order_dispatch", "vendor_verify", "dominion_alert"],
  },
  {
    id: "agent_employee_sophia",
    name: "Sophia — Customer Success Lead",
    role: "ai_employee",
    agentClass: "autonomous",
    description: "Autonomous AI Employee managing customer onboarding, VIP SLA retention, and automated refund vouchers.",
    avatar: "/avatars/beaver-sophia.jpg",
    supportedStreams: ["customers"],
    executionEngine: "temporal_workflow",
    autonomyLevel: "fully_autonomous",
    tools: ["order_refund", "growth_sync", "sla_enforce", "proactive_outreach"],
  },
  {
    id: "agent_intern_triage",
    name: "Triage AI Intern",
    role: "ai_intern",
    agentClass: "autonomous",
    description: "Junior autonomous assistant performing inbound ticket tagging, duplicate deduplication, and draft preparation for human review.",
    avatar: "/avatars/beaver-intern.jpg",
    supportedStreams: ["customers", "contractors", "enquiries"],
    executionEngine: "temporal_workflow",
    autonomyLevel: "human_supervised",
    tools: ["knowledge_search", "ticket_tag", "dedup_cluster", "draft_reply"],
  },
  {
    id: "agent_bg_sweeper",
    name: "Durable Background Sweeper & Correlator",
    role: "background_agent",
    agentClass: "autonomous",
    description: "Scheduled Temporal worker daemons executing stale ticket sweeps, incident correlation, and 1536-dim RAG vector re-indexing.",
    avatar: "/avatars/beaver-curator.jpg",
    supportedStreams: ["customers", "contractors", "enquiries"],
    executionEngine: "scheduled_cron",
    autonomyLevel: "fully_autonomous",
    tools: ["stale_work_sweep", "problem_correlation", "rag_vector_sync", "deficit_curate"],
  },
];

export class AgentPlatform {
  /**
   * Retrieves all registered agents in the platform
   */
  static listAgents(): AgentDescriptor[] {
    return AGENT_REGISTRY;
  }

  /**
   * Filters agents by class: Interactive vs Autonomous
   */
  static listByClass(agentClass: AgentClass): AgentDescriptor[] {
    return AGENT_REGISTRY.filter((a) => a.agentClass === agentClass);
  }

  /**
   * Retrieves an agent by its unique identifier
   */
  static getAgent(id: string): AgentDescriptor | undefined {
    return AGENT_REGISTRY.find((a) => a.id === id);
  }

  /**
   * Finds the primary interactive or autonomous agent for a stream
   */
  static findAgentForStream(stream: ChatStreamType, agentClass: AgentClass): AgentDescriptor {
    const match = AGENT_REGISTRY.find(
      (a) => a.agentClass === agentClass && a.supportedStreams.includes(stream)
    );
    return match || AGENT_REGISTRY[0];
  }
}
