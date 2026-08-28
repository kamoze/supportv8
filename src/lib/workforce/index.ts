/**
 * supportV8 AI Workforce Spine (Employees & Interns)
 * Implements OrderV8 canonical architecture:
 * 1. AI Employees / Workflows must first be HIRED before they can be assigned work.
 * 2. Specialized Interns are PAIRED to AI Employees and cannot receive direct work assignments.
 */

export type WorkforceLevel = "ai_employee" | "ai_intern";

export interface WorkforceMember {
  id: string;
  name: string;
  level: WorkforceLevel;
  role: string;
  hired: boolean;
  canReceiveDirectWork: boolean;
  supervisorId?: string;
  pairedInternIds?: string[];
  avatar: string;
  avatarUrl: string;
  status: "active" | "idle" | "reviewing" | "available";
  autonomyLevel: "read" | "low" | "medium" | "high";
  grants: string[];
  assignedCount: number;
  csat: number;
  varr: number;
  description: string;
}

export const INITIAL_WORKFORCE: WorkforceMember[] = [
  {
    id: "emp_support_lead",
    name: "Alex — Support Intelligence Lead",
    level: "ai_employee",
    role: "Senior Support Employee",
    hired: true,
    canReceiveDirectWork: true,
    pairedInternIds: ["intern_tagger", "intern_stale_sweeper"],
    avatar: "🤖",
    avatarUrl: "/avatars/beaver-manager.jpg",
    status: "active",
    autonomyLevel: "high",
    grants: ["ticket:write", "comms:broadcast", "knowledge:write"],
    assignedCount: 184,
    csat: 95.8,
    varr: 88.2,
    description: "Orchestrates multi-channel issue triage, correlates systemic problems, and oversees paired AI Interns.",
  },
  {
    id: "emp_incident_analyst",
    name: "Maya — Incident & Business Impact Analyst",
    level: "ai_employee",
    role: "Incident Response Employee",
    hired: true,
    canReceiveDirectWork: true,
    pairedInternIds: ["intern_summarizer"],
    avatar: "🧠",
    avatarUrl: "/avatars/beaver-analyst.jpg",
    status: "active",
    autonomyLevel: "high",
    grants: ["ticket:write", "comms:broadcast"],
    assignedCount: 46,
    csat: 96.4,
    varr: 91.5,
    description: "Computes financial exposure, identifies affected customer populations, and drafts proactive broadcast communications.",
  },
  {
    id: "emp_kb_refresh",
    name: "Jordan — Knowledge Refresh Specialist",
    level: "ai_employee",
    role: "Knowledge Refresh Employee",
    hired: true,
    canReceiveDirectWork: true,
    pairedInternIds: [],
    avatar: "📚",
    avatarUrl: "/avatars/beaver-curator.jpg",
    status: "active",
    autonomyLevel: "medium",
    grants: ["knowledge:write"],
    assignedCount: 32,
    csat: 93.0,
    varr: 81.0,
    description: "Mines successful resolutions for reusable procedures and authors Knowledge Base proposals in KnowledgeV8.",
  },
  {
    id: "emp_voice_specialist",
    name: "Sophia — Frontline Voice & Conversational Lead",
    level: "ai_employee",
    role: "Voice Channel Specialist",
    hired: false,
    canReceiveDirectWork: true,
    pairedInternIds: [],
    avatar: "🎙️",
    avatarUrl: "/avatars/beaver-sophia.jpg",
    status: "available",
    autonomyLevel: "high",
    grants: ["voice:sip", "ticket:write", "orderv8:refund"],
    assignedCount: 0,
    csat: 97.2,
    varr: 93.0,
    description: "Real-time telephony agent handling conversational SIP inbound calls, IVR flows, and warm voice transfers.",
  },
  {
    id: "emp_tier2_finance",
    name: "Arthur — Tier 2 Escalation & Finance Lead",
    level: "ai_employee",
    role: "Tier 2 Financial Lead",
    hired: false,
    canReceiveDirectWork: true,
    pairedInternIds: [],
    avatar: "💼",
    avatarUrl: "/avatars/beaver-arthur.jpg",
    status: "available",
    autonomyLevel: "high",
    grants: ["ticket:write", "orderv8:refund", "invoice:reconcile"],
    assignedCount: 0,
    csat: 98.0,
    varr: 94.5,
    description: "Specialized senior financial arbitrator managing multi-line refund disputes and high-value ARR reconciliation.",
  },
  {
    id: "intern_tagger",
    name: "Chip — Auto-Tagger & Categorizer",
    level: "ai_intern",
    role: "Triage Sub-Agent",
    hired: true,
    canReceiveDirectWork: false,
    supervisorId: "emp_support_lead",
    avatar: "🐣",
    avatarUrl: "/avatars/beaver-intern.jpg",
    status: "active",
    autonomyLevel: "low",
    grants: ["ticket:write"],
    assignedCount: 642,
    csat: 91.2,
    varr: 72.0,
    description: "Specialized intern paired to Alex for applying standard intent and sentiment tags to incoming external tickets.",
  },
  {
    id: "intern_stale_sweeper",
    name: "Rusty — Stale Ticket Sweeper",
    level: "ai_intern",
    role: "Backlog Sub-Agent",
    hired: true,
    canReceiveDirectWork: false,
    supervisorId: "emp_support_lead",
    avatar: "🧹",
    avatarUrl: "/avatars/beaver-arthur.jpg",
    status: "idle",
    autonomyLevel: "medium",
    grants: ["ticket:write"],
    assignedCount: 310,
    csat: 94.0,
    varr: 85.0,
    description: "Specialized intern paired to Alex for running nightly sweeps across external helpdesks to close dormant cases.",
  },
  {
    id: "intern_summarizer",
    name: "Echo — Transcript & Call Summarizer",
    level: "ai_intern",
    role: "Voice Sub-Agent",
    hired: true,
    canReceiveDirectWork: false,
    supervisorId: "emp_incident_analyst",
    avatar: "🎧",
    avatarUrl: "/avatars/beaver-receptionist.jpg",
    status: "active",
    autonomyLevel: "read",
    grants: [],
    assignedCount: 155,
    csat: 92.5,
    varr: 68.0,
    description: "Specialized intern paired to Maya for transcribing real-time voice streams and generating structured summaries.",
  },
];

export class WorkforceManager {
  private members: WorkforceMember[] = [...INITIAL_WORKFORCE];

  public getAll(): WorkforceMember[] {
    return [...this.members];
  }

  public getHiredEmployees(): WorkforceMember[] {
    return this.members.filter((m) => m.level === "ai_employee" && m.hired);
  }

  public getAvailableEmployees(): WorkforceMember[] {
    return this.members.filter((m) => m.level === "ai_employee" && !m.hired);
  }

  public getInterns(): WorkforceMember[] {
    return this.members.filter((m) => m.level === "ai_intern");
  }

  public getPairedInterns(employeeId: string): WorkforceMember[] {
    return this.members.filter((m) => m.level === "ai_intern" && m.supervisorId === employeeId);
  }

  public getById(id: string): WorkforceMember | undefined {
    return this.members.find((m) => m.id === id);
  }

  public hireEmployee(employeeId: string): { success: boolean; message: string; member?: WorkforceMember } {
    const member = this.getById(employeeId);
    if (!member) {
      return { success: false, message: `Employee blueprint '${employeeId}' not found.` };
    }
    if (member.hired) {
      return { success: true, message: `${member.name} is already hired on the active roster.`, member };
    }
    member.hired = true;
    member.status = "active";
    return {
      success: true,
      message: `Successfully hired ${member.name} into the active AI Workforce roster! Work can now be assigned.`,
      member,
    };
  }

  public assignWork(
    targetId: string,
    issueDescription: string
  ): { success: boolean; message: string; supervisor?: string } {
    const member = this.getById(targetId);
    if (!member) {
      return { success: false, message: `Workforce target '${targetId}' not found.` };
    }

    // 1. Hiring check
    if (!member.hired) {
      return {
        success: false,
        message: `${member.name} must be HIRED first before being assigned work. Navigate to AI Workforce to hire.`,
      };
    }

    // 2. Intern direct assignment guard
    if (member.level === "ai_intern") {
      const supervisor = this.getById(member.supervisorId || "emp_support_lead");
      return {
        success: false,
        supervisor: supervisor?.name,
        message: `Architectural Constraint: Interns are paired sub-agents and cannot be assigned work directly. Please assign work to supervising AI Employee (${supervisor?.name || "Alex"}), who will delegate sub-tasks.`,
      };
    }

    // 3. Valid assignment to hired AI Employee
    member.assignedCount += 1;
    return {
      success: true,
      message: `Issue assigned to hired AI Employee ${member.name}. Execution spine active.`,
    };
  }

  public delegateTask(
    internId: string,
    task: string
  ): { delegated: boolean; supervisorApprovalRequired: boolean; message: string } {
    const member = this.getById(internId);
    if (!member) throw new Error(`Workforce member ${internId} not found`);

    if (member.level === "ai_intern" && member.autonomyLevel === "read") {
      return {
        delegated: false,
        supervisorApprovalRequired: true,
        message: `Task requires supervisor escalation to ${member.supervisorId}`,
      };
    }

    member.assignedCount += 1;
    return {
      delegated: true,
      supervisorApprovalRequired: false,
      message: `Task delegated successfully to ${member.name} (${member.role}).`,
    };
  }
}

export const workforceManager = new WorkforceManager();
