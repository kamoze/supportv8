import type {
  ChatStreamType,
  ChatWorkflowConfig,
  CustomerChatMessage,
  CustomerChatSession,
  MemberGroup,
  AiChatGuardrailConfig,
  PriorityLevel,
} from "@/lib/types";

// =============================================================================
// Default Workflows Configuration (Configurable by Admin)
// =============================================================================

export const DEFAULT_CHAT_WORKFLOWS: Record<ChatStreamType, ChatWorkflowConfig> = {
  contractors: {
    stream: "contractors",
    title: "Contractors & Vendors",
    subtitle: "Invoicing, work orders, compliance, and subcontractor dispatch",
    icon: "HardHat",
    badgeColor: "#F5A623",
    description: "Dedicated stream for field contractors, vendor invoice tracking, work order dispatch, and insurance/compliance verifications.",
    intakeFields: [
      {
        id: "name",
        name: "name",
        label: "Contractor / Company Name",
        type: "text",
        placeholder: "e.g. Apex Mechanical LLC / John Smith",
        required: true,
      },
      {
        id: "email",
        name: "email",
        label: "Contact Email",
        type: "email",
        placeholder: "john@apexmechanical.com",
        required: true,
      },
      {
        id: "contractorId",
        name: "contractorId",
        label: "Vendor / Contractor ID",
        type: "text",
        placeholder: "e.g. VND-88219",
        required: true,
      },
      {
        id: "workOrderNumber",
        name: "workOrderNumber",
        label: "Work Order / PO Number (Optional)",
        type: "text",
        placeholder: "e.g. WO-90412",
        required: false,
      },
      {
        id: "inquiryCategory",
        name: "inquiryCategory",
        label: "Inquiry Category",
        type: "select",
        required: true,
        options: [
          "Invoice & Payment Status",
          "Work Order Dispatch & Site Access",
          "Compliance, W9 & Insurance Upload",
          "Scope of Work & Change Order",
          "Safety & Site Incident",
        ],
      },
      {
        id: "urgency",
        name: "urgency",
        label: "On-Site Urgency",
        type: "select",
        required: true,
        options: ["Normal", "High (Active On-Site)", "Urgent (Job Blocker / Hazard)"],
      },
      {
        id: "details",
        name: "details",
        label: "Issue / Request Details",
        type: "textarea",
        placeholder: "Describe the issue, work order number, or payment question...",
        required: true,
      },
    ],
    defaultAssignedGroupId: "group_contractors",
    defaultAiEmployeeId: "beaver-alex",
    autoEscalateKeywords: ["hazard", "injury", "lawsuit", "stop work", "lien", "emergency"],
  },

  enquiries: {
    stream: "enquiries",
    title: "General Enquiries",
    subtitle: "Product questions, enterprise licensing, and API partnerships",
    icon: "HelpCircle",
    badgeColor: "#4D9FFF",
    description: "General pre-sales inquiries, product questions, technical architecture reviews, and integration partnerships.",
    intakeFields: [
      {
        id: "name",
        name: "name",
        label: "Your Full Name",
        type: "text",
        placeholder: "e.g. Sarah Jenkins",
        required: true,
      },
      {
        id: "email",
        name: "email",
        label: "Business Email",
        type: "email",
        placeholder: "sarah@innovate.co",
        required: true,
      },
      {
        id: "companyName",
        name: "companyName",
        label: "Company / Organization",
        type: "text",
        placeholder: "e.g. Innovate Labs",
        required: true,
      },
      {
        id: "enquiryType",
        name: "enquiryType",
        label: "Enquiry Topic",
        type: "select",
        required: true,
        options: [
          "Product Capabilities & Demo",
          "Enterprise Pricing & SLAs",
          "API & ForgeGW Integration",
          "Security, SOC2 & Compliance",
          "Partnership & Reseller Program",
        ],
      },
      {
        id: "details",
        name: "details",
        label: "How can we help you today?",
        type: "textarea",
        placeholder: "Tell us about your team size, current challenges, or specific questions...",
        required: true,
      },
    ],
    defaultAssignedGroupId: "group_enquiries",
    defaultAiEmployeeId: "beaver-curator",
    autoEscalateKeywords: ["rfp", "custom pricing", "enterprise security", "procurement", "dpa"],
  },

  customers: {
    stream: "customers",
    title: "Customers & Clients",
    subtitle: "Account support, billing & refund, and high-priority technical triage",
    icon: "Users",
    badgeColor: "#2ED8B6",
    description: "Full-service customer care desk for active platform subscribers, billing inquiries, OrderV8 dispatch tokens, and SLA priority incidents.",
    intakeFields: [
      {
        id: "name",
        name: "name",
        label: "Full Name",
        type: "text",
        placeholder: "e.g. Marcus Vance",
        required: true,
      },
      {
        id: "email",
        name: "email",
        label: "Account Email",
        type: "email",
        placeholder: "marcus@meridiancorp.com",
        required: true,
      },
      {
        id: "accountOrOrderId",
        name: "accountOrOrderId",
        label: "Account / Order ID (Optional)",
        type: "text",
        placeholder: "e.g. ORD-94021 / ACC-4412",
        required: false,
      },
      {
        id: "issueType",
        name: "issueType",
        label: "Support Category",
        type: "select",
        required: true,
        options: [
          "Billing, Invoices & Refund Request",
          "Technical Outage / Bug Report",
          "Account Access & RBAC Permissions",
          "Agent Autonomy & Policy Tuning",
          "Data Ingestion & S3 Vault Help",
        ],
      },
      {
        id: "urgency",
        name: "urgency",
        label: "Priority Level",
        type: "select",
        required: true,
        options: ["Normal (P3)", "High Impact (P2)", "Critical Service Down (P1)"],
      },
      {
        id: "details",
        name: "details",
        label: "Description of Issue",
        type: "textarea",
        placeholder: "Please describe what happened, expected behavior, or steps to reproduce...",
        required: true,
      },
    ],
    defaultAssignedGroupId: "group_support",
    defaultAiEmployeeId: "beaver-sophia",
    autoEscalateKeywords: ["outage", "chargeback", "cancel subscription", "talk to human", "fraud"],
  },
};

// =============================================================================
// Default RBAC Groups
// =============================================================================

export const DEFAULT_MEMBER_GROUPS: MemberGroup[] = [
  {
    id: "group_contractors",
    name: "Contractors & Vendor Support",
    streamType: "contractors",
    description: "Manages contractor work orders, vendor invoice disputes, W9 compliance, and field dispatch.",
    color: "#F5A623",
    permissions: ["tickets.view", "tickets.reply", "contractors.manage", "invoices.approve", "forgev8.dispatch"],
    memberEmails: ["elena.contractors@servicev8.com", "david.field@servicev8.com", "inigodwin@redoo.solutions"],
    isSystem: true,
    createdAt: "2026-08-01T10:00:00Z",
  },
  {
    id: "group_enquiries",
    name: "Enquiries & Pre-Sales Desk",
    streamType: "enquiries",
    description: "Handles prospective client inquiries, enterprise architecture evaluations, and partnership requests.",
    color: "#4D9FFF",
    permissions: ["tickets.view", "tickets.reply", "enquiries.qualify", "knowledge.read"],
    memberEmails: ["sarah.sales@servicev8.com", "marcus.partner@servicev8.com"],
    isSystem: true,
    createdAt: "2026-08-01T10:00:00Z",
  },
  {
    id: "group_support",
    name: "Customer & Client Support",
    streamType: "customers",
    description: "Frontline customer support handling billing inquiries, technical incidents, and SLA resolutions.",
    color: "#2ED8B6",
    permissions: ["tickets.view", "tickets.reply", "orderv8.refund", "knowledge.read", "tickets.escalate"],
    memberEmails: ["support.lead@servicev8.com", "alex.cx@servicev8.com", "inigodwin@redoo.solutions"],
    isSystem: true,
    createdAt: "2026-08-01T10:00:00Z",
  },
  {
    id: "group_staff",
    name: "General Staff",
    streamType: "all",
    description: "Internal operations staff with read-only knowledge and internal ticket handoff access.",
    color: "#8E9AA8",
    permissions: ["tickets.view", "knowledge.read"],
    memberEmails: ["ops.team@servicev8.com"],
    isSystem: true,
    createdAt: "2026-08-01T10:00:00Z",
  },
  {
    id: "group_admin",
    name: "Platform Administrators & CX Leads",
    streamType: "all",
    description: "Full super-admin permissions to configure AI guardrails, BYOM, ForgeGW, and team RBAC.",
    color: "#E5484D",
    permissions: [
      "tickets.view",
      "tickets.reply",
      "tickets.delete",
      "orderv8.refund",
      "governance.admin",
      "byom.manage",
      "forgev8.dispatch",
      "groups.manage",
    ],
    memberEmails: ["admin@servicev8.com", "inigodwin@redoo.solutions"],
    isSystem: true,
    createdAt: "2026-08-01T10:00:00Z",
  },
];

// =============================================================================
// Default AI Chat Guardrails
// =============================================================================

export const DEFAULT_AI_GUARDRAILS: AiChatGuardrailConfig = {
  enabledStreams: ["contractors", "enquiries", "customers"],
  maxAutonomousRefundAmount: 500, // Maximum $ refund AI can issue autonomously without supervisor
  escalateOnSentimentBelow: 0.45, // Trigger human escalation if sentiment drops below 0.45
  bannedTopics: [
    "Internal employee salaries and compensation",
    "Security vulnerability zero-day disclosures",
    "Legal settlement guarantees",
    "Raw database credentials or API keys",
  ],
  escalationKeywords: [
    "lawyer",
    "attorney",
    "sue",
    "fraud",
    "supervisor",
    "manager",
    "human agent",
    "speak to representative",
    "dispute charge",
  ],
  requireHumanForBilling: false,
  requireHumanForContractorPayout: true,
  enableRAGGrounding: true,
};

// =============================================================================
// In-Memory Chat Session & Presence State (Persistent across requests)
// =============================================================================

export interface OnlineStaffMember {
  email: string;
  name: string;
  avatar: string;
  groupIds: string[];
  isOnline: boolean;
  activeChatCount: number;
}

let activeStaffPresence: OnlineStaffMember[] = [
  {
    email: "inigodwin@redoo.solutions",
    name: "Ini Godwin",
    avatar: "/avatars/beaver-manager.jpg",
    groupIds: ["group_admin", "group_support", "group_contractors"],
    isOnline: true,
    activeChatCount: 1,
  },
  {
    email: "alex.cx@servicev8.com",
    name: "Alex Rivera",
    avatar: "/avatars/beaver-analyst.jpg",
    groupIds: ["group_support"],
    isOnline: true,
    activeChatCount: 2,
  },
  {
    email: "elena.contractors@servicev8.com",
    name: "Elena Rostova",
    avatar: "/avatars/beaver-curator.jpg",
    groupIds: ["group_contractors"],
    isOnline: false,
    activeChatCount: 0,
  },
  {
    email: "sarah.sales@servicev8.com",
    name: "Sarah Jenkins",
    avatar: "/avatars/beaver-receptionist.jpg",
    groupIds: ["group_enquiries"],
    isOnline: true,
    activeChatCount: 0,
  },
];

let activeGroups: MemberGroup[] = [...DEFAULT_MEMBER_GROUPS];
let activeGuardrails: AiChatGuardrailConfig = { ...DEFAULT_AI_GUARDRAILS };
let activeWorkflows: Record<ChatStreamType, ChatWorkflowConfig> = { ...DEFAULT_CHAT_WORKFLOWS };

let chatSessions: CustomerChatSession[] = [
  {
    id: "chat_sess_demo_1",
    tenantDomain: "tenant_default",
    stream: "customers",
    customerName: "Marcus Vance",
    customerEmail: "marcus@meridiancorp.com",
    intakeData: {
      accountOrOrderId: "ORD-94021",
      issueType: "Billing, Invoices & Refund Request",
      urgency: "High Impact (P2)",
      details: "Need verification on the $420 refund token dispatch for broken sensor shipment.",
    },
    assignedType: "ai",
    assignedId: "beaver-sophia",
    assignedName: "Sophia — Customer Success Lead",
    assignedAvatar: "/avatars/beaver-sophia.jpg",
    status: "active",
    priority: "high",
    unreadCount: 0,
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    messages: [
      {
        id: "msg_1",
        sender: "customer",
        senderName: "Marcus Vance",
        content: "Hi! I submitted a refund request for Order ORD-94021 because 3 sensors arrived broken.",
        timestamp: "10:15 AM",
      },
      {
        id: "msg_2",
        sender: "ai_employee",
        senderName: "Sophia — Customer Success Lead",
        senderAvatar: "/avatars/beaver-sophia.jpg",
        content: "Hello Marcus! I have reviewed Order #ORD-94021. Since your account is in Enterprise Tier ($420k ARR), I have pre-authorized a replacement shipment and can immediately issue an instant $420 OrderV8 credit token to your account balance.",
        timestamp: "10:16 AM",
        citations: [
          {
            id: "cit_1",
            title: "SLA Policy §4.2 — Enterprise Hardware Replacements",
            snippet: "Tier-1 enterprise accounts qualify for instant autonomous replacement upon photographic receipt.",
          },
        ],
        suggestedActions: [
          {
            label: "Dispatch $420 Refund Token",
            actionId: "action_refund_420",
          },
          {
            label: "Expedite Overnight Sensor Replacement",
            actionId: "action_replace_shipment",
          },
        ],
      },
    ],
  },
  {
    id: "chat_sess_demo_2",
    tenantDomain: "tenant_default",
    stream: "contractors",
    customerName: "Apex Mechanical LLC",
    customerEmail: "dispatch@apexmechanical.com",
    intakeData: {
      contractorId: "VND-88219",
      workOrderNumber: "WO-90412",
      inquiryCategory: "Work Order Dispatch & Site Access",
      urgency: "High (Active On-Site)",
      details: "Our technician is on-site at Building B, but the electronic lockbox code was rejected.",
    },
    assignedType: "human",
    assignedId: "inigodwin@redoo.solutions",
    assignedName: "Ini Godwin (Support Lead)",
    assignedAvatar: "/avatars/beaver-manager.jpg",
    status: "active",
    priority: "urgent",
    unreadCount: 1,
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    messages: [
      {
        id: "msg_c1",
        sender: "customer",
        senderName: "Apex Mechanical LLC",
        content: "We are at Building B front entrance, code 4819 is not unlocking the telecom closet.",
        timestamp: "10:00 AM",
      },
      {
        id: "msg_c2",
        sender: "agent",
        senderName: "Ini Godwin",
        senderAvatar: "/avatars/beaver-manager.jpg",
        content: "Checking site access logs now. Dispatching updated one-time PIN 9284 via ForgeGW.",
        timestamp: "10:02 AM",
      },
    ],
  },
];

// =============================================================================
// Service Functions
// =============================================================================

export class ChatWorkflowService {
  /**
   * Get workflow configuration for all streams or a specific stream
   */
  static getWorkflows(): Record<ChatStreamType, ChatWorkflowConfig> {
    return activeWorkflows;
  }

  static getWorkflow(stream: ChatStreamType): ChatWorkflowConfig {
    return activeWorkflows[stream] || DEFAULT_CHAT_WORKFLOWS[stream];
  }

  static updateWorkflow(stream: ChatStreamType, config: Partial<ChatWorkflowConfig>): ChatWorkflowConfig {
    activeWorkflows[stream] = {
      ...activeWorkflows[stream],
      ...config,
    };
    return activeWorkflows[stream];
  }

  /**
   * Start a new chat session from the customer widget
   */
  static startSession(params: {
    tenantDomain: string;
    stream: ChatStreamType;
    customerName: string;
    customerEmail: string;
    intakeData: Record<string, string>;
  }): CustomerChatSession {
    const workflow = this.getWorkflow(params.stream);
    const assignedGroup = activeGroups.find((g) => g.id === workflow.defaultAssignedGroupId);

    // 1. Check for online human staff in the assigned group
    const onlineHumanStaff = activeStaffPresence.find(
      (staff) => staff.isOnline && staff.groupIds.includes(workflow.defaultAssignedGroupId)
    );

    const isAiEnabledForStream = activeGuardrails.enabledStreams.includes(params.stream);

    let assignedType: "human" | "ai" = "ai";
    let assignedId = workflow.defaultAiEmployeeId;
    let assignedName = "Alex — Support Lead";
    let assignedAvatar = "/avatars/beaver-manager.jpg";

    if (onlineHumanStaff && !isAiEnabledForStream) {
      // Direct human routing
      assignedType = "human";
      assignedId = onlineHumanStaff.email;
      assignedName = onlineHumanStaff.name;
      assignedAvatar = onlineHumanStaff.avatar;
      onlineHumanStaff.activeChatCount += 1;
    } else {
      // AI employee assignment
      if (params.stream === "contractors") {
        assignedId = "beaver-alex";
        assignedName = "Alex — Contractor Dispatch Lead";
        assignedAvatar = "/avatars/beaver-manager.jpg";
      } else if (params.stream === "enquiries") {
        assignedId = "beaver-curator";
        assignedName = "Barnaby — Knowledge & Solutions Lead";
        assignedAvatar = "/avatars/beaver-curator.jpg";
      } else {
        assignedId = "beaver-sophia";
        assignedName = "Sophia — Customer Success Lead";
        assignedAvatar = "/avatars/beaver-sophia.jpg";
      }
    }

    const priority: PriorityLevel =
      params.intakeData.urgency?.toLowerCase().includes("urgent") ||
      params.intakeData.urgency?.toLowerCase().includes("critical")
        ? "urgent"
        : params.intakeData.urgency?.toLowerCase().includes("high")
        ? "high"
        : "normal";

    const initialUserMessage: CustomerChatMessage = {
      id: `msg_${Date.now()}_user`,
      sender: "customer",
      senderName: params.customerName,
      content: params.intakeData.details || `Hello, I need assistance regarding ${workflow.title}.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const initialGreeting: CustomerChatMessage = {
      id: `msg_${Date.now()}_greeting`,
      sender: assignedType === "human" ? "agent" : "ai_employee",
      senderName: assignedName,
      senderAvatar: assignedAvatar,
      content:
        assignedType === "human"
          ? `Hello ${params.customerName}! My name is ${assignedName.split(" ")[0]}. I see your request regarding ${params.intakeData.inquiryCategory || params.intakeData.issueType || params.intakeData.enquiryType || "support"}. I'm reviewing your details right now.`
          : `Hello ${params.customerName}! I'm ${assignedName}. I have received your ${workflow.title} intake. How can I help you resolve this right away?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      citations: [
        {
          id: "cit_welcome",
          title: `${workflow.title} Guidelines & Response Protocol`,
          snippet: "All inquiries are logged with high encryption and synced with tenant SLA monitoring.",
        },
      ],
      suggestedActions:
        params.stream === "customers"
          ? [
              { label: "Check Recent Orders", actionId: "act_orders" },
              { label: "View System Status", actionId: "act_status" },
            ]
          : params.stream === "contractors"
          ? [
              { label: "Verify Access PIN", actionId: "act_pin" },
              { label: "Upload Compliance Doc", actionId: "act_doc" },
            ]
          : [
              { label: "Schedule Architecture Demo", actionId: "act_demo" },
              { label: "Download Security Whitepaper", actionId: "act_whitepaper" },
            ],
    };

    const session: CustomerChatSession = {
      id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tenantDomain: params.tenantDomain,
      stream: params.stream,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      intakeData: params.intakeData,
      assignedType,
      assignedId,
      assignedName,
      assignedAvatar,
      status: "active",
      priority,
      unreadCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [initialUserMessage, initialGreeting],
    };

    chatSessions.unshift(session);
    return session;
  }

  /**
   * Get all active sessions for a tenant
   */
  static listSessions(tenantDomain = "tenant_default"): CustomerChatSession[] {
    return chatSessions;
  }

  static getSession(sessionId: string): CustomerChatSession | null {
    return chatSessions.find((s) => s.id === sessionId) || null;
  }

  /**
   * Post a new message to an existing chat session
   */
  static sendMessage(params: {
    sessionId: string;
    sender: "customer" | "agent";
    senderName: string;
    content: string;
  }): { session: CustomerChatSession; responseMessage?: CustomerChatMessage } {
    const session = this.getSession(params.sessionId);
    if (!session) throw new Error("Chat session not found");

    const userMsg: CustomerChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sender: params.sender,
      senderName: params.senderName,
      senderAvatar: params.sender === "agent" ? "/avatars/beaver-manager.jpg" : undefined,
      content: params.content,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    session.messages.push(userMsg);
    session.updatedAt = new Date().toISOString();

    const lowerContent = params.content.toLowerCase();

    // Check for auto-escalation keywords using word boundary matching
    const needsEscalation = activeGuardrails.escalationKeywords.some((kw) => {
      if (!kw.trim()) return false;
      const escaped = kw.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      return regex.test(params.content);
    });

    if (needsEscalation && session.assignedType === "ai") {
      session.status = "escalated";
      session.priority = "urgent";
      session.assignedType = "human";
      session.assignedName = "Ini Godwin (Escalated Lead)";
      session.assignedAvatar = "/avatars/beaver-manager.jpg";

      const escalationMsg: CustomerChatMessage = {
        id: `msg_${Date.now()}_esc`,
        sender: "system",
        senderName: "System Safety Guardrail",
        content: "🚨 This conversation has been escalated to a live Senior Human Support Lead based on safety guardrail keywords. A team member is joining now.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      session.messages.push(escalationMsg);
      return { session, responseMessage: escalationMsg };
    }

    // If customer sent message and AI is assigned, generate AI assistant response
    if (params.sender === "customer" && session.assignedType === "ai") {
      let aiContent = `Thank you for your update. I have referenced the knowledge base regarding "${params.content.slice(0, 40)}..." and processed the necessary action telemetry.`;
      let citations = [
        {
          id: "cit_auto",
          title: "ServiceV8 Knowledge Topology Graph",
          snippet: "Synthesized matching concept node with 0.94 cosine similarity embedding.",
        },
      ];

      if (lowerContent.includes("refund") || lowerContent.includes("invoice") || lowerContent.includes("payment")) {
        aiContent = `I have verified your account billing records. Under our automated refund policy, transactions under $${activeGuardrails.maxAutonomousRefundAmount} qualify for instant credit. I have staged this action for immediate dispatch.`;
      } else if (lowerContent.includes("work order") || lowerContent.includes("pin") || lowerContent.includes("access")) {
        aiContent = `I've checked the active site dispatch registry. Security token has been validated and synced with the site gate controller.`;
      }

      const aiResponse: CustomerChatMessage = {
        id: `msg_${Date.now()}_ai`,
        sender: "ai_employee",
        senderName: session.assignedName,
        senderAvatar: session.assignedAvatar,
        content: aiContent,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        citations,
        suggestedActions: [
          { label: "Confirm Resolution", actionId: "act_resolve" },
          { label: "Request Human Supervisor", actionId: "act_human" },
        ],
      };

      session.messages.push(aiResponse);
      return { session, responseMessage: aiResponse };
    }

    return { session };
  }

  // ===========================================================================
  // Group & RBAC Management
  // ===========================================================================

  static listGroups(): MemberGroup[] {
    return activeGroups;
  }

  static createGroup(group: Omit<MemberGroup, "id" | "createdAt">): MemberGroup {
    const newGroup: MemberGroup = {
      ...group,
      id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    activeGroups.push(newGroup);
    return newGroup;
  }

  static updateGroup(groupId: string, updates: Partial<MemberGroup>): MemberGroup {
    const idx = activeGroups.findIndex((g) => g.id === groupId);
    if (idx === -1) throw new Error("Group not found");
    activeGroups[idx] = { ...activeGroups[idx], ...updates };
    return activeGroups[idx];
  }

  static deleteGroup(groupId: string): boolean {
    const idx = activeGroups.findIndex((g) => g.id === groupId);
    if (idx === -1) return false;
    activeGroups.splice(idx, 1);
    return true;
  }

  // ===========================================================================
  // Staff Presence & Online Status
  // ===========================================================================

  static listStaffPresence(): OnlineStaffMember[] {
    return activeStaffPresence;
  }

  static toggleStaffOnline(email: string, isOnline: boolean): OnlineStaffMember {
    const staff = activeStaffPresence.find((s) => s.email.toLowerCase() === email.toLowerCase());
    if (staff) {
      staff.isOnline = isOnline;
      return staff;
    }
    const newStaff: OnlineStaffMember = {
      email,
      name: email.split("@")[0],
      avatar: "/avatars/beaver-manager.jpg",
      groupIds: ["group_support"],
      isOnline,
      activeChatCount: 0,
    };
    activeStaffPresence.push(newStaff);
    return newStaff;
  }

  // ===========================================================================
  // AI Guardrails Configuration
  // ===========================================================================

  static getGuardrails(): AiChatGuardrailConfig {
    return activeGuardrails;
  }

  static updateGuardrails(updates: Partial<AiChatGuardrailConfig>): AiChatGuardrailConfig {
    activeGuardrails = { ...activeGuardrails, ...updates };
    return activeGuardrails;
  }
}
