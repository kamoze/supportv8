import type {
  ChatStreamType,
  ChatWorkflowConfig,
  CustomerChatMessage,
  CustomerChatSession,
  MemberGroup,
  AiChatGuardrailConfig,
  PriorityLevel,
  Issue,
} from "@/lib/types";
import { db } from "@/lib/db/mock-data";
import { INITIAL_WORKFORCE } from "@/lib/workforce";

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
    defaultAiEmployeeId: "emp_support_lead",
    autoEscalateKeywords: ["hazard", "injury", "lawsuit", "stop work", "lien", "emergency"],
  },

  enquiries: {
    stream: "enquiries",
    title: "General Enquiries",
    subtitle: "Product capabilities, integrations, pricing, and architecture",
    icon: "HelpCircle",
    badgeColor: "#4D9FFF",
    description: "Public-facing helpdesk for prospective buyers, API integration questions, security whitepapers, and SLA tier comparisons.",
    intakeFields: [
      {
        id: "name",
        name: "name",
        label: "Contact Name",
        type: "text",
        placeholder: "e.g. Elena Rostova",
        required: true,
      },
      {
        id: "email",
        name: "email",
        label: "Work Email",
        type: "email",
        placeholder: "elena@enterprise.com",
        required: true,
      },
      {
        id: "company",
        name: "company",
        label: "Company / Organization",
        type: "text",
        placeholder: "Acme Logistics Inc.",
        required: true,
      },
      {
        id: "enquiryType",
        name: "enquiryType",
        label: "Inquiry Type",
        type: "select",
        required: true,
        options: [
          "Platform Demo & Architecture Deep-Dive",
          "Pricing & Enterprise Volume Licensing",
          "Custom API & Telephony Integrations",
          "Security, HIPAA & SOC-2 Compliance",
          "Other Technical Question",
        ],
      },
      {
        id: "details",
        name: "details",
        label: "Inquiry Details",
        type: "textarea",
        placeholder: "Tell us about your team size, current challenges, or specific questions...",
        required: true,
      },
    ],
    defaultAssignedGroupId: "group_enquiries",
    defaultAiEmployeeId: "emp_kb_refresh",
    autoEscalateKeywords: ["rfp", "custom pricing", "enterprise security", "procurement", "dpa"],
  },

  customers: {
    stream: "customers",
    title: "Customers & Clients",
    subtitle: "Account support, billing & refund, and high-priority technical triage",
    icon: "Users",
    badgeColor: "#2ED8B6",
    description: "Full-service customer care desk for active platform subscribers, billing inquiries, OrderV8 dispatch vouchers, and SLA priority incidents.",
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
    defaultAiEmployeeId: "emp_kb_refresh",
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
    name: "Solutions & Architecture Desk",
    streamType: "enquiries",
    description: "Evaluates pre-sales technical requirements, RAG vector topologies, and SLA contracts.",
    color: "#4D9FFF",
    permissions: ["tickets.view", "tickets.reply", "knowledge.curate", "leads.qualify"],
    memberEmails: ["alex.solutions@servicev8.com", "sarah.enterprise@servicev8.com"],
    isSystem: true,
    createdAt: "2026-08-01T10:00:00Z",
  },
  {
    id: "group_support",
    name: "Customer Support & Triage Lead",
    streamType: "customers",
    description: "Tier 1 & Tier 2 customer support, billing reconciliations, OrderV8 credit voucher dispatches.",
    color: "#2ED8B6",
    permissions: ["tickets.view", "tickets.reply", "tickets.escalate", "refunds.issue", "forgev8.dispatch"],
    memberEmails: ["marcus.support@servicev8.com", "ini.escalations@servicev8.com"],
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
  defaultChatRouting: "ai_first",
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
      details: "Need verification on the $420 refund voucher dispatch for broken sensor shipment.",
    },
    status: "active",
    priority: "high",
    assignedType: "ai",
    assignedId: "emp_support_lead",
    assignedName: "Alex — Support Intelligence Lead",
    assignedAvatar: "/avatars/beaver-manager.jpg",
    createdAt: "2026-08-30T17:30:00Z",
    updatedAt: "2026-08-30T17:34:00Z",
    messages: [
      {
        id: "msg_pre_1",
        sender: "customer",
        senderName: "Marcus Vance",
        content: "Hi, our shipment ORD-94021 arrived with 4 crushed pressure sensors. We need immediate replacement or credit adjustment before Monday.",
        timestamp: "17:30",
      },
      {
        id: "msg_pre_2",
        sender: "ai_employee",
        senderName: "Alex — Support Intelligence Lead",
        senderAvatar: "/avatars/beaver-manager.jpg",
        content: "Hello Marcus! I have reviewed Order #ORD-94021. Since your account is in Enterprise Tier ($420k ARR), I have pre-authorized a replacement shipment and can immediately issue an instant $420 OrderV8 credit voucher to your account balance.",
        timestamp: "17:31",
        citations: [
          {
            id: "cit_ord_policy",
            title: "Meridian Enterprise Tier Replacements & Instant Adjustment Policy",
            snippet: "Accounts exceeding $100k ARR are authorized for immediate auto-credit up to $500.00 without Tier 2 manual supervisor signoff.",
          },
        ],
        suggestedActions: [
          {
            actionId: "action_refund_420",
            label: "Dispatch $420 Refund Voucher",
          },
          {
            actionId: "action_replace_shipment",
            label: "Expedite Overnight Sensor Replacement",
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

    const seqChat = Math.floor(1000 + Math.random() * 9000);
    const sessionId = `chat_sess_${seqChat}`;

    // 1. Check for online human staff in the assigned group
    const isDemoTenant = ["acme", "meridian", "default", "tenant_default"].includes(
      (params.tenantDomain || "").toLowerCase()
    );
    const onlineHumanStaff = isDemoTenant ? activeStaffPresence.find(
      (staff) => staff.isOnline && staff.groupIds.includes(workflow.defaultAssignedGroupId)
    ) : undefined;

    // Resolve Tenant Subdomain Brand & Routing
    const rawSubdomain = (params.tenantDomain || "acme").toLowerCase().replace(".support.servicev8.com", "").replace(".support.servicev8.internal", "").replace(".support.", "");
    const tenantData = db.getTenantData(rawSubdomain);
    let tenantBrand = tenantData.tenant?.name ? `${tenantData.tenant.name} Support` : "Acme Cloud Support";
    let tenantGreetingSpecialty = "";

    if (rawSubdomain.includes("timeforbed") || rawSubdomain.includes("tfb")) {
      tenantBrand = "TimeForBed Concierge";
      tenantGreetingSpecialty = "smart bed bases, mattress selection, or order status";
    } else if (rawSubdomain.includes("meridian")) {
      tenantBrand = "Meridian Enterprise Support";
      tenantGreetingSpecialty = "enterprise account services, bulk shipments, or SLAs";
    } else if (rawSubdomain.includes("aplogistics") || rawSubdomain.includes("apex")) {
      tenantBrand = "AP Logistics Dispatch";
      tenantGreetingSpecialty = "freight shipments, dock scheduling, or carrier manifests";
    } else if (tenantData.tenant?.name) {
      tenantBrand = `${tenantData.tenant.name} Support`;
      tenantGreetingSpecialty = "account assistance, order status, or technical support";
    }

    const isAiEnabledForStream = activeGuardrails.enabledStreams.includes(params.stream);
    const isDirectHumanRouting = activeGuardrails.defaultChatRouting === "direct_human";

    let assignedType: "human" | "ai" = "ai";
    let assignedId = "";
    let assignedName = "";
    let assignedAvatar = "";

    if (isDirectHumanRouting || !isAiEnabledForStream) {
      // Direct human operator routing
      assignedType = "human";
      assignedId = onlineHumanStaff ? onlineHumanStaff.email : "human_support_queue";
      assignedName = onlineHumanStaff ? onlineHumanStaff.name : "Human Support Desk (Live Operator)";
      assignedAvatar = onlineHumanStaff ? onlineHumanStaff.avatar : "/avatars/beaver-manager.jpg";
      if (onlineHumanStaff) onlineHumanStaff.activeChatCount += 1;
    } else {
      // Dynamic AI Employee Resolution: Only use configured AI employees that are actively hired in the workforce
      const configuredEmployeeId = workflow.defaultAiEmployeeId;
      const hiredEmployee = isDemoTenant ? INITIAL_WORKFORCE.find((emp) =>
        (emp.id === configuredEmployeeId || (configuredEmployeeId === "beaver-curator" && emp.id === "emp_kb_refresh") || (configuredEmployeeId === "beaver-alex" && emp.id === "emp_support_lead")) && emp.hired
      ) || INITIAL_WORKFORCE.find((emp) => emp.hired && emp.canReceiveDirectWork) : undefined;

      if (hiredEmployee) {
        assignedType = "ai";
        assignedId = hiredEmployee.id;
        assignedName = hiredEmployee.name;
        assignedAvatar = hiredEmployee.avatarUrl;
      } else {
        // Fallback: If no hired employee exists in the active workforce for this channel, route directly to Human Staff Queue
        assignedType = "human";
        assignedId = onlineHumanStaff ? onlineHumanStaff.email : "human_support_queue";
        assignedName = onlineHumanStaff ? onlineHumanStaff.name : "Human Support Desk (Live Operator)";
        assignedAvatar = onlineHumanStaff ? onlineHumanStaff.avatar : "/avatars/beaver-manager.jpg";
        if (onlineHumanStaff) onlineHumanStaff.activeChatCount += 1;
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
      id: `msg_${seqChat}_user`,
      sender: "customer",
      senderName: params.customerName,
      content: params.intakeData.details || `Hello, I need assistance regarding ${workflow.title}.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const initialGreeting: CustomerChatMessage = {
      id: `msg_${seqChat}_greeting`,
      sender: assignedType === "human" ? "agent" : "ai_employee",
      senderName: assignedName,
      senderAvatar: assignedAvatar,
      content:
        assignedType === "human"
          ? `Hello ${params.customerName}! My name is ${assignedName.split(" ")[0]} from ${tenantBrand}. I see your incoming request regarding ${params.intakeData.inquiryCategory || params.intakeData.issueType || params.intakeData.enquiryType || workflow.title}. I have opened ticket SV8-CHAT-${seqChat} in the operator work desk and am reviewing your details now.`
          : `Hello ${params.customerName}! I'm ${assignedName} from ${tenantBrand}. I have received your ${workflow.title} request (Ticket SV8-CHAT-${seqChat}). How can I assist you ${tenantGreetingSpecialty ? `with your ${tenantGreetingSpecialty}` : "right away"}?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      citations: [
        {
          id: "cit_welcome",
          title: `${workflow.title} Guidelines & Response Protocol`,
          snippet: `All inquiries on ${tenantBrand} are logged with high encryption and synced with tenant SLA monitoring.`,
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

    const extId = `SV8-CHAT-${seqChat}`;
    const newIssue: Issue = {
      id: `iss_chat_${seqChat}`,
      tenantId: `tenant_${rawSubdomain.replace(/[^a-z0-9-]/g, "_")}`,
      externalId: extId,
      source: "chat",
      sourceUrl: `https://${rawSubdomain || "support"}.servicev8.com/chat/${sessionId}`,
      customerRef: `cust_${params.customerEmail ? params.customerEmail.split("@")[0] : "live"}`,
      entityType: params.stream === "contractors" ? "contractor" : "customer",
      customerName: params.customerName,
      customerTier: "standard",
      summary: params.intakeData.details || params.intakeData.issueType || params.intakeData.enquiryType || `${workflow.title} Inbound Request`,
      category: params.stream === "contractors" ? "contractor_dispatch" : params.stream === "enquiries" ? "general_inquiry" : "customer_care",
      product: params.stream === "contractors" ? "Field Ops Portal" : "SupportV8 Live Chat",
      version: "3.2.0",
      status: "open",
      sourceStatus: "open",
      priority,
      sentiment: priority === "urgent" ? "urgent" : "neutral",
      sentimentScore: 0.2,
      sentimentTrajectory: "stable",
      confidence: 0.94,
      businessImpact: priority === "urgent" ? "high" : "low",
      resolutionRiskScore: priority === "urgent" ? 0.4 : 0.1,
      recommendedAction: assignedType === "human"
        ? "Human operator requested. Immediate live assistance assigned."
        : `AI Employee ${assignedName} active on session ${extId}.`,
      tags: ["chat_intake", params.stream, rawSubdomain || "default"],
      assignedTo: assignedName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      contractor: params.stream === "contractors" ? {
        workOrderId: `WO-${seqChat}`,
        company: params.intakeData.companyName || "Apex Facilities",
        contactName: params.customerName,
        trade: "Facilities & Lockbox Entry",
        siteLocation: params.intakeData.siteLocation || "Telecom Hub Building B, 442 Innovation Way",
        dispatchStatus: "on_site",
        accessCode: "LOCK-8841",
        eta: "Active On-Site",
      } : undefined,
    };

    // Store in shared tenant database
    db.addIssue(newIssue, rawSubdomain);

    const session: CustomerChatSession = {
      id: sessionId,
      tenantDomain: rawSubdomain,
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
    const rawSubdomain = (tenantDomain || "acme")
      .toLowerCase()
      .replace(/^tenant_/, "")
      .replace(".support.servicev8.com", "")
      .replace(".support.servicev8.internal", "")
      .replace(".support.", "");

    return chatSessions.filter((s) => {
      const sessDomain = (s.tenantDomain || "acme")
        .toLowerCase()
        .replace(/^tenant_/, "")
        .replace(".support.servicev8.com", "")
        .replace(".support.servicev8.internal", "")
        .replace(".support.", "");

      if (rawSubdomain === "acme" || rawSubdomain === "default") {
        return sessDomain === "acme" || sessDomain === "default";
      }
      return sessDomain === rawSubdomain;
    });
  }

  static getSession(sessionId: string): CustomerChatSession | null {
    return chatSessions.find((s) => s.id === sessionId) || null;
  }

  /**
   * Reply directly from human operator in the Work Desk
   */
  static replyFromOperator(sessionId: string, operatorName: string, content: string): CustomerChatSession | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const operatorMsg: CustomerChatMessage = {
      id: `msg_${Date.now()}_op`,
      sender: "agent",
      senderName: operatorName || "Ini Godwin (Escalated Lead)",
      senderAvatar: "/avatars/beaver-manager.jpg",
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    session.messages.push(operatorMsg);
    session.updatedAt = new Date().toISOString();
    session.assignedType = "human";
    session.assignedName = operatorName;

    return session;
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

    // Check for auto-escalation keywords or explicit human supervisor / operator request
    const isHumanActionRequested =
      lowerContent.includes("human") ||
      lowerContent.includes("operator") ||
      lowerContent.includes("live agent") ||
      lowerContent.includes("supervisor") ||
      lowerContent.includes("real person") ||
      lowerContent.includes("talk to someone") ||
      lowerContent.includes("speak with someone") ||
      lowerContent.includes("escalat") ||
      lowerContent.includes("act_human");

    const needsEscalation =
      isHumanActionRequested ||
      activeGuardrails.escalationKeywords.some((kw) => {
        if (!kw.trim()) return false;
        const escaped = kw.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "i");
        return regex.test(params.content);
      });

    if (needsEscalation && (session.assignedType === "ai" || isHumanActionRequested)) {
      const resolvedAdmin = db.getTenantAdminName(session.tenantDomain) || "Support Lead";
      session.status = "escalated";
      session.priority = "urgent";
      session.assignedType = "human";
      session.assignedName = `${resolvedAdmin} (Support Lead)`;
      session.assignedAvatar = "/avatars/beaver-manager.jpg";

      // Elevate ticket in tenant issues and db.issues with urgent priority and front-of-line elevation
      const sessNum = session.id.replace("chat_sess_", "");
      const tenantIssues = db.getTenantData(session.tenantDomain).issues;
      const existingIssue =
        tenantIssues.find(
          (i) =>
            i.externalId.includes(sessNum) ||
            i.summary.includes(session.customerName) ||
            i.customerName === session.customerName
        ) ||
        db.issues.find(
          (i) =>
            i.externalId.includes(sessNum) ||
            i.summary.includes(session.customerName) ||
            i.customerName === session.customerName
        );

      if (existingIssue) {
        existingIssue.priority = "urgent";
        existingIssue.sentiment = "urgent";
        existingIssue.status = "open";
        existingIssue.assignedTo = `${resolvedAdmin} (Support Lead)`;
        existingIssue.recommendedAction = `🚨 Live Human Lead Escalation: Customer requested human operator. Assigned to ${resolvedAdmin}. Ready for operator takeover in Work Desk.`;
      }

      const escalationMsg: CustomerChatMessage = {
        id: `msg_${Date.now()}_esc`,
        sender: "system",
        senderName: "System Safety Guardrail",
        content: `🚨 Conversation Transferred to Live Human Operator: You are now connected with a Senior Support Lead (${resolvedAdmin}). An operator in the Work Desk is reviewing your transcript.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      session.messages.push(escalationMsg);
      return { session, responseMessage: escalationMsg };
    }

    // If customer sent message and AI is assigned, generate high-quality AI assistant response
    if (params.sender === "customer" && session.assignedType === "ai") {
      let aiContent = `Thank you for your update. I have referenced the knowledge base regarding "${params.content.slice(0, 40)}..." and verified the relevant system parameters.`;
      let citations = [
        {
          id: "cit_auto",
          title: "ServiceV8 Grounded Knowledge Graph",
          snippet: "Synthesized matching concept node with 0.94 cosine similarity embedding.",
        },
      ];

      // Domain-specific grounded replies based on Subdomain & Ingress Stream
      const sessionSubdomain = (session.tenantDomain || "").toLowerCase();
      if (sessionSubdomain.includes("timeforbed") || sessionSubdomain.includes("tfb")) {
        if (lowerContent.includes("mattress") || lowerContent.includes("bed") || lowerContent.includes("firm") || lowerContent.includes("base") || lowerContent.includes("motor") || lowerContent.includes("trial") || lowerContent.includes("zero gravity")) {
          aiContent = `Here is the verified TimeForBed product guidance:
• **Zero-Gravity Adjustable Base**: Dual-motor articulation with wireless remote presets, anti-snore elevation, and under-bed LED illumination.
• **100-Night Sleep Trial**: All TimeForBed hybrid mattresses include a risk-free 100-night trial with complimentary white-glove return pickup.
• **Split-King Sync**: Sync cable allows independent head/foot articulation or paired simultaneous adjustment via remote.`;
        }
      }

      if (!aiContent.startsWith("Here is the verified TimeForBed")) {
        if (lowerContent.includes("refund") || lowerContent.includes("invoice") || lowerContent.includes("payment")) {
          aiContent = `I have verified your billing records on the OrderV8 ledger. Under our automated policy, transactions under $${activeGuardrails.maxAutonomousRefundAmount} qualify for instant refund or credit voucher. I have staged this refund action for immediate dispatch.`;
        } else if (lowerContent.includes("system status") || lowerContent.includes("health") || lowerContent.includes("uptime")) {
          aiContent = `✅ **ServiceV8 System Health Status**: All microservices (OrderV8, WorkerV8, KnowledgeV8 RAG, and Twilio Telephony SIP Bridges) are fully operational with 99.99% uptime. Current API latency is 42ms with 0 active degradation incidents.`;
        } else if (lowerContent.includes("log on") || lowerContent.includes("login") || lowerContent.includes("sign in") || lowerContent.includes("password") || lowerContent.includes("not working") || lowerContent.includes("cannot log")) {
          aiContent = `I have checked our identity and tenant gateway services. All authentication endpoints are healthy. If you are experiencing logon issues:
1. Ensure you are accessing via your tenant slug (e.g. \`acme.support.servicev8.com\`).
2. Verify your email address format or request an Email OTP one-time passcode.
3. If your account is locked due to repeated attempts, click "Request Human Supervisor" below to initiate an immediate security unlock.`;
        } else if (lowerContent.includes("work order") || lowerContent.includes("pin") || lowerContent.includes("access") || lowerContent.includes("lockbox")) {
          aiContent = `Your electronic lockbox security PIN for Building B telecom closet is valid for 24 hours: LOCK-8841. On-site access permits are active and logged.`;
        } else if (session.assignedId === "beaver-curator") {
          // Barnaby — Knowledge & Solutions Lead
          if (lowerContent.includes("demo") || lowerContent.includes("feature") || lowerContent.includes("architecture") || lowerContent.includes("pricing")) {
            aiContent = `Here is the architectural overview for ServiceV8:
• **Vector Knowledge Topology**: Grounded pgvector RAG pipeline with sub-100ms semantic similarity search.
• **Zero-Trust Action Gateway**: All autonomous operations (refunds, credential rotations, SOW dispatches) enforce mTLS encryption, SHA-256 hash chaining, and idempotency guarantees.
• **Omnichannel Telephony**: Twilio SIP bridge with sub-300ms turn-taking audio streaming.
• **Enterprise Pricing**: Standard ($199/mo), Pro ($499/mo), and Enterprise ($1,299/mo) with dedicated SLAs.`;
          } else {
            aiContent = `I have analyzed your inquiry against our verified documentation index. ServiceV8 provides end-to-end multi-tenant isolation with zero data leakage across workspaces. Would you like me to open the relevant knowledge whitepaper?`;
          }
        }
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
