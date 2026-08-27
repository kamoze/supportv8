/**
 * supportV8 AI Workforce Spine (Employees & Interns)
 * Implements roles, hierarchy, autonomy boundaries, and supervisor handoffs.
 */

export type WorkforceLevel = "ai_employee" | "ai_intern";

export interface WorkforceMember {
  id: string;
  name: string;
  level: WorkforceLevel;
  role: string;
  supervisorId?: string;
  avatar: string;
  avatarUrl: string;
  status: "active" | "idle" | "reviewing";
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
    avatar: "🤖",
    avatarUrl: "/avatars/beaver-manager.jpg",
    status: "active",
    autonomyLevel: "high",
    grants: ["ticket:write", "comms:broadcast", "knowledge:write"],
    assignedCount: 184,
    csat: 95.8,
    varr: 88.2,
    description: "Orchestrates multi-channel issue triage, correlates systemic problems, and oversees AI Interns.",
  },
  {
    id: "emp_incident_analyst",
    name: "Maya — Incident & Business Impact Analyst",
    level: "ai_employee",
    role: "Incident Response Employee",
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
    avatar: "📚",
    avatarUrl: "/avatars/beaver-curator.jpg",
    status: "reviewing",
    autonomyLevel: "medium",
    grants: ["knowledge:write"],
    assignedCount: 32,
    csat: 93.0,
    varr: 81.0,
    description: "Mines successful resolutions for reusable procedures and authors Knowledge Base proposals.",
  },
  {
    id: "intern_tagger",
    name: "Chip — Auto-Tagger & Categorizer",
    level: "ai_intern",
    role: "Triage Intern",
    supervisorId: "emp_support_lead",
    avatar: "🐣",
    avatarUrl: "/avatars/beaver-intern.jpg",
    status: "active",
    autonomyLevel: "low",
    grants: ["ticket:write"],
    assignedCount: 642,
    csat: 91.2,
    varr: 72.0,
    description: "Lightweight intern for applying standard intent and sentiment tags to incoming external tickets.",
  },
  {
    id: "intern_stale_sweeper",
    name: "Rusty — Stale Ticket Sweeper",
    level: "ai_intern",
    role: "Backlog Intern",
    supervisorId: "emp_support_lead",
    avatar: "🧹",
    avatarUrl: "/avatars/beaver-arthur.jpg",
    status: "idle",
    autonomyLevel: "medium",
    grants: ["ticket:write"],
    assignedCount: 310,
    csat: 94.0,
    varr: 85.0,
    description: "Runs nightly sweeps across external helpdesks to close dormant cases with zero customer activity.",
  },
  {
    id: "intern_summarizer",
    name: "Echo — Transcript & Call Summarizer",
    level: "ai_intern",
    role: "Voice Intern",
    supervisorId: "emp_incident_analyst",
    avatar: "🎧",
    avatarUrl: "/avatars/beaver-receptionist.jpg",
    status: "active",
    autonomyLevel: "read",
    grants: [],
    assignedCount: 155,
    csat: 92.5,
    varr: 68.0,
    description: "Transcribes real-time voice contact center streams and generates structured incident summaries.",
  },
];

export class WorkforceManager {
  private members: WorkforceMember[] = [...INITIAL_WORKFORCE];

  public getAll(): WorkforceMember[] {
    return [...this.members];
  }

  public getById(id: string): WorkforceMember | undefined {
    return this.members.find((m) => m.id === id);
  }

  public delegateTask(internId: string, task: string): { delegated: boolean; supervisorApprovalRequired: boolean; message: string } {
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
