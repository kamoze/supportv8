import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import type {
  ChatStreamType,
  CustomerChatMessage,
  CustomerChatSession,
  Issue,
  PriorityLevel,
} from "@/lib/types";
import {
  decodeChatMessageCursor,
  encodeChatMessageCursor,
} from "@/lib/chat/message-cursor";
import { pgClient, type DatabaseSession, type PostgresClient } from "./pg-client";

type Sender = "customer" | "agent";

interface Assignment {
  type: "human" | "ai";
  id: string;
  name: string;
  avatar: string;
  groupId: string;
}

interface SessionMetadata {
  assignedType: "human" | "ai";
  assignedId: string;
  assignedName: string;
  assignedAvatar?: string;
  uiStatus: CustomerChatSession["status"];
}

interface SessionRow extends QueryResultRow {
  id: string;
  tenant_id: string;
  stream: ChatStreamType;
  customer_name: string;
  customer_email: string | null;
  intake_data: Record<string, unknown> | null;
  status: "waiting" | "assigned" | "open" | "resolved" | "closed";
  priority: PriorityLevel;
  assigned_group_id: string | null;
  assigned_operator_id: string | null;
  issue_id: string | null;
  last_message_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface MessageRow extends QueryResultRow {
  id: string;
  session_id: string;
  sender_type: "customer" | "operator" | "ai" | "system";
  sender_id: string | null;
  sender_name: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: Date | string;
}

interface IssueRow extends QueryResultRow {
  id: string;
  tenant_id: string;
  external_id: string;
  source_url: string;
  customer_ref: string;
  customer_name: string;
  customer_tier: string;
  summary: string;
  category: string;
  product: string;
  version: string;
  source_status: string;
  priority: PriorityLevel;
  sentiment: string;
  sentiment_score: number | string;
  sentiment_trajectory: string;
  confidence: number | string;
  business_impact: string;
  resolution_risk_score: number | string;
  tags: string[];
  recommended_action: string | null;
  timeline: Issue["timeline"] | null;
  messages: Issue["messages"] | null;
  assigned_to: string | null;
  assigned_agent: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  intake_data: Record<string, unknown> | null;
}

export interface StartChatInput {
  tenantId: string;
  tenantSlug: string;
  stream: ChatStreamType;
  customerName: string;
  customerEmail: string;
  intakeData: Record<string, string>;
  sessionId?: string;
  channel?: "web" | "email" | "whatsapp" | "voice";
}

export interface SendChatMessageInput {
  tenantId: string;
  tenantSlug: string;
  sessionId: string;
  sender: Sender;
  senderName?: string;
  senderId?: string;
  content: string;
  clientMessageId?: string;
}

export interface ChatSessionPage {
  session: CustomerChatSession;
  nextCursor?: string;
  hasEarlierMessages: boolean;
  hasMoreMessages: boolean;
}

export interface ChatSessionListPage {
  sessions: CustomerChatSession[];
  nextCursor?: string;
  hasMore: boolean;
}

const ASSIGNMENTS: Record<ChatStreamType, Assignment> = {
  contractors: {
    type: "ai",
    id: "emp_support_lead",
    name: "Alex — Contractor Dispatch",
    avatar: "/avatars/beaver-manager.jpg",
    groupId: "group_contractors",
  },
  enquiries: {
    type: "ai",
    id: "emp_kb_refresh",
    name: "Barnaby — Solutions Lead",
    avatar: "/avatars/beaver-curator.jpg",
    groupId: "group_enquiries",
  },
  customers: {
    type: "ai",
    id: "emp_kb_refresh",
    name: "Sophia — Customer Success",
    avatar: "/avatars/beaver-sophia.jpg",
    groupId: "group_support",
  },
};

export function assignmentForTenant(tenantSlug: string, stream: ChatStreamType): Assignment {
  const clean = tenantSlug.trim().toLowerCase();
  if (clean === "acme" || clean === "meridian") {
    return ASSIGNMENTS[stream];
  }
  return {
    type: "human",
    id: "human_support_queue",
    name: "Available online operator",
    avatar: "",
    groupId: `group_${stream}`,
  };
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function displayTenant(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function priorityFromIntake(intake: Record<string, string>): PriorityLevel {
  const urgency = (intake.urgency || "").toLowerCase();
  if (urgency.includes("urgent") || urgency.includes("critical")) return "urgent";
  if (urgency.includes("high")) return "high";
  return "normal";
}

function safeCustomerRef(email: string): string {
  const local = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return `cust_${local || "live"}`.slice(0, 128);
}

function sessionMetadata(row: SessionRow): SessionMetadata {
  const intake = row.intake_data || {};
  const stored = (intake.__supportv8 || {}) as Partial<SessionMetadata>;
  const fallbackStatus: CustomerChatSession["status"] =
    row.status === "resolved" || row.status === "closed"
      ? "resolved"
      : row.status === "waiting"
        ? "queued"
        : "active";

  return {
    assignedType: stored.assignedType || (row.assigned_operator_id ? "human" : "ai"),
    assignedId: stored.assignedId || row.assigned_operator_id || "support_queue",
    assignedName: stored.assignedName || (row.assigned_operator_id ? "Support Operator" : "SupportV8 AI"),
    assignedAvatar: stored.assignedAvatar,
    uiStatus: stored.uiStatus || fallbackStatus,
  };
}

function publicIntake(data: Record<string, unknown> | null): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (key !== "__supportv8" && typeof value === "string") result[key] = value;
  }
  return result;
}

function mapMessage(row: MessageRow): CustomerChatMessage {
  const metadata = row.metadata || {};
  return {
    id: row.id,
    cursor: encodeChatMessageCursor(row.created_at, row.id),
    sender:
      row.sender_type === "operator"
        ? "agent"
        : row.sender_type === "ai"
          ? "ai_employee"
          : row.sender_type,
    senderName: row.sender_name,
    senderAvatar: typeof metadata.senderAvatar === "string" ? metadata.senderAvatar : undefined,
    content: row.content,
    timestamp: iso(row.created_at),
    citations: Array.isArray(metadata.citations)
      ? (metadata.citations as CustomerChatMessage["citations"])
      : undefined,
    suggestedActions: Array.isArray(metadata.suggestedActions)
      ? (metadata.suggestedActions as CustomerChatMessage["suggestedActions"])
      : undefined,
  };
}

function mapSession(row: SessionRow, messages: MessageRow[]): CustomerChatSession {
  const metadata = sessionMetadata(row);
  return {
    id: row.id,
    tenantDomain: row.tenant_id.slice("tenant_".length).replace(/_/g, "-"),
    stream: row.stream,
    customerName: row.customer_name,
    customerEmail: row.customer_email || "",
    intakeData: publicIntake(row.intake_data),
    assignedType: metadata.assignedType,
    assignedId: metadata.assignedId,
    assignedName: metadata.assignedName,
    assignedAvatar: metadata.assignedAvatar,
    status: metadata.uiStatus,
    priority: row.priority,
    unreadCount: 0,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.last_message_at || row.updated_at),
    messages: messages.filter((message) => message.session_id === row.id).map(mapMessage),
  };
}

function issueCategory(stream: ChatStreamType): string {
  if (stream === "contractors") return "contractor_dispatch";
  if (stream === "enquiries") return "general_inquiry";
  return "customer_care";
}

function needsHuman(content: string): boolean {
  const lower = content.toLowerCase();
  return [
    "human",
    "operator",
    "live agent",
    "supervisor",
    "real person",
    "talk to someone",
    "speak with someone",
    "escalat",
    "lawyer",
    "attorney",
    "fraud",
  ].some((phrase) => lower.includes(phrase));
}

function aiReply(content: string, session: CustomerChatSession): string {
  const lower = content.toLowerCase();
  if (lower.includes("refund") || lower.includes("invoice") || lower.includes("payment")) {
    return "I have located your billing request and added it to the operator work desk. I can gather the relevant transaction context while an authorized operator reviews any financial action.";
  }
  if (lower.includes("status") || lower.includes("health") || lower.includes("uptime")) {
    return "I’m checking the current service status and have attached this conversation to your support case so the response remains available to the operator team.";
  }
  if (lower.includes("login") || lower.includes("sign in") || lower.includes("password")) {
    return "I’ve recorded the access issue. Please avoid sharing passwords or one-time codes here; an operator can review the account state from the work desk.";
  }
  return `Thank you for the update. I’ve added it to your ${session.stream} case and the durable work-desk transcript.`;
}

async function insertMessage(
  db: DatabaseSession,
  input: {
    id: string;
    tenantId: string;
    sessionId: string;
    senderType: MessageRow["sender_type"];
    senderId?: string;
    senderName: string;
    content: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO supportv8.chat_messages
       (id, tenant_id, session_id, sender_type, sender_id, sender_name, content, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      input.id,
      input.tenantId,
      input.sessionId,
      input.senderType,
      input.senderId || null,
      input.senderName,
      input.content,
      JSON.stringify(input.metadata || {}),
    ]
  );
}

async function loadSession(
  db: DatabaseSession,
  sessionId: string,
  options: { lock?: boolean; messageLimit?: number; afterCursor?: string | null } = {},
): Promise<ChatSessionPage | null> {
  const lock = options.lock ?? false;
  const messageLimit = Math.min(Math.max(options.messageLimit ?? 100, 1), 200);
  const after = decodeChatMessageCursor(options.afterCursor);
  const rows = await db.query<SessionRow>(
    `SELECT id, tenant_id, stream, customer_name, customer_email, intake_data,
            status, priority, assigned_group_id, assigned_operator_id, issue_id,
            last_message_at, created_at, updated_at
       FROM supportv8.chat_sessions
      WHERE id = $1${lock ? " FOR UPDATE" : ""}`,
    [sessionId]
  );
  if (!rows[0]) return null;
  const messages = after
    ? await db.query<MessageRow>(
        `SELECT id, session_id, sender_type, sender_id, sender_name, content, metadata, created_at
           FROM supportv8.chat_messages
          WHERE session_id = $1
            AND (created_at, id) > ($2::timestamptz, $3)
          ORDER BY created_at ASC, id ASC
          LIMIT $4`,
        [sessionId, after.createdAt, after.messageId, messageLimit + 1],
      )
    : await db.query<MessageRow>(
        `SELECT id, session_id, sender_type, sender_id, sender_name, content, metadata, created_at
           FROM (
             SELECT id, session_id, sender_type, sender_id, sender_name, content, metadata, created_at
               FROM supportv8.chat_messages
              WHERE session_id = $1
              ORDER BY created_at DESC, id DESC
              LIMIT $2
           ) recent
          ORDER BY created_at ASC, id ASC`,
        [sessionId, messageLimit + 1],
      );
  const hasOverflow = messages.length > messageLimit;
  const pageMessages = after
    ? messages.slice(0, messageLimit)
    : hasOverflow
      ? messages.slice(messages.length - messageLimit)
      : messages;
  const session = mapSession(rows[0], pageMessages);
  const lastMessage = pageMessages[pageMessages.length - 1];
  session.nextCursor = lastMessage
    ? encodeChatMessageCursor(lastMessage.created_at, lastMessage.id)
    : options.afterCursor || undefined;
  session.hasEarlierMessages = !after && hasOverflow;
  return {
    session,
    nextCursor: session.nextCursor,
    hasEarlierMessages: session.hasEarlierMessages,
    hasMoreMessages: Boolean(after && hasOverflow),
  };
}

export class ChatRepository {
  constructor(private readonly client: PostgresClient = pgClient) {}

  async startSession(input: StartChatInput): Promise<CustomerChatSession> {
    const assignment = assignmentForTenant(input.tenantSlug, input.stream);
    const priority = priorityFromIntake(input.intakeData);
    const suffix = randomUUID().replace(/-/g, "");
    const requestedSessionId = input.sessionId?.trim();
    const sessionId =
      requestedSessionId && /^[a-zA-Z0-9_-]{1,64}$/.test(requestedSessionId)
        ? requestedSessionId
        : `chat_${suffix}`;
    const issueId = `iss_${suffix}`;
    const externalId = `SV8-CHAT-${suffix.slice(0, 12).toUpperCase()}`;
    const userMessageId = `msg_${randomUUID().replace(/-/g, "")}`;
    const greetingMessageId = `msg_${randomUUID().replace(/-/g, "")}`;
    const tenantName = displayTenant(input.tenantSlug) || "SupportV8";
    const workflowTitle = input.stream === "contractors" ? "contractor support" : input.stream === "enquiries" ? "general enquiry" : "customer support";
    const metadata: SessionMetadata = {
      assignedType: assignment.type,
      assignedId: assignment.id,
      assignedName: assignment.name,
      assignedAvatar: assignment.avatar,
      uiStatus: "active",
    };
    const storedIntake = { ...input.intakeData, __supportv8: metadata };
    const initialContent = input.intakeData.details || `Hello, I need assistance with ${workflowTitle}.`;
    const greeting = assignment.type === "ai"
      ? `Hello ${input.customerName}! I’m ${assignment.name} from ${tenantName} Support. Your ${workflowTitle} request (${externalId}) is now recorded in the operator work desk.`
      : `Hello ${input.customerName}! Your ${workflowTitle} request (${externalId}) is recorded in the operator work desk. An available online operator will reply here.`;

    return this.client.withTenantSession(input.tenantId, async (db) => {
      await db.query(
        `INSERT INTO supportv8.tenants (id, domain, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [input.tenantId, input.tenantSlug, tenantName]
      );

      await db.query(
        `INSERT INTO supportv8.issues
           (id, tenant_id, source, external_id, source_url, customer_ref,
            customer_name, customer_tier, summary, category, product, version,
            sentiment, sentiment_score, sentiment_trajectory, priority,
            confidence, business_impact, resolution_risk_score, source_status,
            tags, recommended_action)
         VALUES
           ($1, $2, 'chat', $3, $4, $5, $6, 'standard', $7, $8, $9,
            '3.2.0', $10, 0.2, 'stable', $11, 0.94, $12, $13, 'open',
            $14, $15)`,
        [
          issueId,
          input.tenantId,
          externalId,
          `https://${input.tenantSlug}.support.servicev8.com/chat/${sessionId}`,
          safeCustomerRef(input.customerEmail),
          input.customerName,
          initialContent,
          issueCategory(input.stream),
          input.stream === "contractors" ? "Field Ops Portal" : "SupportV8 Live Chat",
          priority === "urgent" ? "urgent" : "neutral",
          priority,
          priority === "urgent" ? "high" : "low",
          priority === "urgent" ? 0.4 : 0.1,
          ["chat_intake", input.stream, input.tenantSlug],
          assignment.type === "ai"
            ? `AI employee ${assignment.name} active on ${externalId}.`
            : `Waiting for an authenticated operator on ${externalId}.`,
        ]
      );

      await db.query(
        `INSERT INTO supportv8.chat_sessions
           (id, tenant_id, stream, channel, customer_name, customer_email,
            customer_ref, intake_data, status, priority, assigned_group_id, issue_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'open', $9, $10, $11)`,
        [
          sessionId,
          input.tenantId,
          input.stream,
          input.channel || "web",
          input.customerName,
          input.customerEmail,
          safeCustomerRef(input.customerEmail),
          JSON.stringify(storedIntake),
          priority,
          assignment.groupId,
          issueId,
        ]
      );

      await insertMessage(db, {
        id: userMessageId,
        tenantId: input.tenantId,
        sessionId,
        senderType: "customer",
        senderName: input.customerName,
        content: initialContent,
      });
      await insertMessage(db, {
        id: greetingMessageId,
        tenantId: input.tenantId,
        sessionId,
        senderType: assignment.type === "ai" ? "ai" : "system",
        senderId: assignment.id,
        senderName: assignment.name,
        content: greeting,
        metadata: {
          senderAvatar: assignment.avatar || undefined,
          citations: assignment.type === "ai" ? [
            {
              id: "cit_welcome",
              title: `${tenantName} Support response protocol`,
              snippet: "This conversation is stored in the tenant-isolated SupportV8 work desk.",
            },
          ] : undefined,
          suggestedActions: assignment.type === "ai" ? [
            { label: "Confirm Resolution", actionId: "act_resolve" },
            { label: "Request Human Supervisor", actionId: "act_human" },
          ] : undefined,
        },
      });

      await db.query(
        `INSERT INTO supportv8.workdesk_items
           (tenant_id, session_id, issue_id, status, priority, assigned_group_id)
         VALUES ($1, $2, $3, 'queued', $4, $5)`,
        [input.tenantId, sessionId, issueId, priority, assignment.groupId]
      );
      await db.query(
        `INSERT INTO supportv8.chat_outbox
           (tenant_id, aggregate_type, aggregate_id, event_type, payload)
         VALUES ($1, 'chat_session', $2, 'chat.session.created', $3::jsonb)`,
        [input.tenantId, sessionId, JSON.stringify({ sessionId, issueId, messageIds: [userMessageId, greetingMessageId] })]
      );

      const sessionPage = await loadSession(db, sessionId);
      if (!sessionPage) throw new Error("Created chat session could not be loaded");
      return sessionPage.session;
    });
  }

  async getSession(tenantId: string, sessionId: string): Promise<CustomerChatSession | null> {
    return this.client.withTenantSession(tenantId, async (db) => {
      const page = await loadSession(db, sessionId);
      return page?.session || null;
    });
  }

  async getSessionPage(
    tenantId: string,
    sessionId: string,
    options: { afterCursor?: string | null; limit?: number } = {},
  ): Promise<ChatSessionPage | null> {
    return this.client.withTenantSession(tenantId, (db) =>
      loadSession(db, sessionId, {
        afterCursor: options.afterCursor,
        messageLimit: options.limit,
      }),
    );
  }

  async listSessions(tenantId: string): Promise<CustomerChatSession[]> {
    const page = await this.listSessionsPage(tenantId);
    return page.sessions;
  }

  async listSessionsPage(
    tenantId: string,
    options: { afterCursor?: string | null; limit?: number } = {},
  ): Promise<ChatSessionListPage> {
    return this.client.withTenantSession(tenantId, async (db) => {
      const limit = Math.min(Math.max(options.limit ?? 100, 1), 250);
      const after = decodeChatMessageCursor(options.afterCursor);
      const sessions = await db.query<SessionRow>(
        `SELECT id, tenant_id, stream, customer_name, customer_email, intake_data,
                status, priority, assigned_group_id, assigned_operator_id, issue_id,
                last_message_at, created_at, updated_at
           FROM supportv8.chat_sessions
          WHERE ($1::timestamptz IS NULL OR (last_message_at, id) < ($1::timestamptz, $2))
          ORDER BY last_message_at DESC, id DESC
          LIMIT $3`,
        [after?.createdAt || null, after?.messageId || null, limit + 1],
      );
      if (sessions.length === 0) return { sessions: [], hasMore: false };
      const hasMore = sessions.length > limit;
      const pageSessions = sessions.slice(0, limit);
      const messages = await db.query<MessageRow>(
        `SELECT DISTINCT ON (session_id)
                id, session_id, sender_type, sender_id, sender_name, content, metadata, created_at
           FROM supportv8.chat_messages
          WHERE session_id = ANY($1::varchar[])
          ORDER BY session_id, created_at DESC, id DESC`,
        [pageSessions.map((session) => session.id)]
      );
      const mapped = pageSessions.map((session) => mapSession(session, messages));
      const lastSession = pageSessions[pageSessions.length - 1];
      return {
        sessions: mapped,
        hasMore,
        nextCursor: lastSession
          ? encodeChatMessageCursor(lastSession.last_message_at, lastSession.id)
          : undefined,
      };
    });
  }

  async sendMessage(input: SendChatMessageInput): Promise<{
    session: CustomerChatSession;
    responseMessage?: CustomerChatMessage;
  }> {
    const content = input.content.trim();
    if (!content || content.length > 20_000) throw new Error("Message content must be between 1 and 20,000 characters");

    return this.client.withTenantSession(input.tenantId, async (db) => {
      const currentPage = await loadSession(db, input.sessionId, { lock: true, messageLimit: 1 });
      const current = currentPage?.session;
      if (!current) throw new Error("Chat session not found");
      if (current.status === "resolved") throw new Error("Chat session is already resolved");

      const requestedMessageId = input.clientMessageId?.trim();
      const incomingId = requestedMessageId && /^msg_[a-zA-Z0-9_-]{8,120}$/.test(requestedMessageId)
        ? requestedMessageId
        : `msg_${randomUUID().replace(/-/g, "")}`;
      const existing = await db.query<MessageRow>(
        `SELECT id, session_id, sender_type, sender_id, sender_name, content, metadata, created_at
           FROM supportv8.chat_messages
          WHERE id = $1 AND session_id = $2`,
        [incomingId, input.sessionId],
      );
      if (existing[0]) {
        const duplicatePage = await loadSession(db, input.sessionId, { messageLimit: 100 });
        if (!duplicatePage) throw new Error("Chat session not found");
        return { session: duplicatePage.session };
      }
      const senderName = input.sender === "customer" ? current.customerName : input.senderName || "Support Operator";
      await insertMessage(db, {
        id: incomingId,
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        senderType: input.sender === "agent" ? "operator" : "customer",
        senderId: input.senderId,
        senderName,
        content,
        metadata: input.sender === "agent" ? { senderAvatar: "/avatars/beaver-manager.jpg" } : undefined,
      });

      let responseId: string | undefined;
      if (input.sender === "agent") {
        const metadata: SessionMetadata = {
          assignedType: "human",
          assignedId: input.senderId || "support_operator",
          assignedName: senderName,
          assignedAvatar: "/avatars/beaver-manager.jpg",
          uiStatus: "active",
        };
        await db.query(
          `UPDATE supportv8.chat_sessions
              SET assigned_operator_id = $2,
                  status = 'open',
                  intake_data = jsonb_set(intake_data, '{__supportv8}', $3::jsonb, true),
                  last_message_at = now()
            WHERE id = $1`,
          [input.sessionId, input.senderId || "support_operator", JSON.stringify(metadata)]
        );
        await db.query(
          `UPDATE supportv8.workdesk_items
              SET status = 'active', assigned_operator_id = $2, version = version + 1, updated_at = now()
            WHERE session_id = $1`,
          [input.sessionId, input.senderId || "support_operator"]
        );
      } else if (needsHuman(content)) {
        responseId = `msg_${randomUUID().replace(/-/g, "")}`;
        const leadName = "Senior Support Lead";
        const metadata: SessionMetadata = {
          assignedType: "human",
          assignedId: "human_support_queue",
          assignedName: leadName,
          assignedAvatar: "/avatars/beaver-manager.jpg",
          uiStatus: "escalated",
        };
        await db.query(
          `UPDATE supportv8.chat_sessions
              SET status = 'assigned', priority = 'urgent',
                  intake_data = jsonb_set(intake_data, '{__supportv8}', $2::jsonb, true),
                  last_message_at = now()
            WHERE id = $1`,
          [input.sessionId, JSON.stringify(metadata)]
        );
        await db.query(
          `UPDATE supportv8.workdesk_items
              SET status = 'queued', priority = 'urgent', version = version + 1, updated_at = now()
            WHERE session_id = $1`,
          [input.sessionId]
        );
        await db.query(
          `UPDATE supportv8.issues
              SET priority = 'urgent', sentiment = 'urgent', source_status = 'open',
                  recommended_action = $2
            WHERE id = (SELECT issue_id FROM supportv8.chat_sessions WHERE id = $1)`,
          [input.sessionId, "Live human escalation requested. Ready for operator takeover in the Work Desk."]
        );
        await insertMessage(db, {
          id: responseId,
          tenantId: input.tenantId,
          sessionId: input.sessionId,
          senderType: "system",
          senderName: "Supervisor Escalation",
          content: "Your conversation has been transferred to the live support queue. A senior operator can now review the durable transcript from the Work Desk.",
        });
      } else if (current.assignedType === "ai") {
        responseId = `msg_${randomUUID().replace(/-/g, "")}`;
        await insertMessage(db, {
          id: responseId,
          tenantId: input.tenantId,
          sessionId: input.sessionId,
          senderType: "ai",
          senderId: current.assignedId,
          senderName: current.assignedName,
          content: aiReply(content, current),
          metadata: {
            senderAvatar: current.assignedAvatar,
            suggestedActions: [
              { label: "Confirm Resolution", actionId: "act_resolve" },
              { label: "Request Human Supervisor", actionId: "act_human" },
            ],
          },
        });
        await db.query(
          `UPDATE supportv8.chat_sessions SET last_message_at = now() WHERE id = $1`,
          [input.sessionId]
        );
      }

      await db.query(
        `INSERT INTO supportv8.chat_outbox
           (tenant_id, aggregate_type, aggregate_id, event_type, payload)
         VALUES ($1, 'chat_session', $2, 'chat.message.appended', $3::jsonb)`,
        [
          input.tenantId,
          input.sessionId,
          JSON.stringify({ sessionId: input.sessionId, messageIds: [incomingId, responseId].filter(Boolean) }),
        ]
      );

      const sessionPage = await loadSession(db, input.sessionId, { messageLimit: 100 });
      const session = sessionPage?.session;
      if (!session) throw new Error("Updated chat session could not be loaded");
      return {
        session,
        responseMessage: responseId ? session.messages.find((message) => message.id === responseId) : undefined,
      };
    });
  }

  async appendRuntimeMessage(input: {
    tenantId: string;
    sessionId: string;
    sender: CustomerChatMessage["sender"];
    senderId?: string;
    senderName: string;
    senderAvatar?: string;
    content: string;
    citations?: CustomerChatMessage["citations"];
    suggestedActions?: CustomerChatMessage["suggestedActions"];
  }): Promise<CustomerChatMessage> {
    return this.client.withTenantSession(input.tenantId, async (db) => {
      const currentPage = await loadSession(db, input.sessionId, { lock: true, messageLimit: 1 });
      const current = currentPage?.session;
      if (!current) throw new Error("Chat session not found");
      const messageId = `msg_${randomUUID().replace(/-/g, "")}`;
      const senderType: MessageRow["sender_type"] =
        input.sender === "agent"
          ? "operator"
          : input.sender === "ai_employee"
            ? "ai"
            : input.sender;
      await insertMessage(db, {
        id: messageId,
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        senderType,
        senderId: input.senderId,
        senderName: input.senderName,
        content: input.content,
        metadata: {
          senderAvatar: input.senderAvatar,
          citations: input.citations,
          suggestedActions: input.suggestedActions,
        },
      });
      await db.query(
        `UPDATE supportv8.chat_sessions SET last_message_at = now() WHERE id = $1`,
        [input.sessionId]
      );
      await db.query(
        `INSERT INTO supportv8.chat_outbox
           (tenant_id, aggregate_type, aggregate_id, event_type, payload)
         VALUES ($1, 'chat_session', $2, 'chat.message.appended', $3::jsonb)`,
        [input.tenantId, input.sessionId, JSON.stringify({ sessionId: input.sessionId, messageIds: [messageId] })]
      );
      const sessionPage = await loadSession(db, input.sessionId, { messageLimit: 100 });
      const message = sessionPage?.session.messages.find((item) => item.id === messageId);
      if (!message) throw new Error("Created runtime message could not be loaded");
      return message;
    });
  }

  async updateSessionRouting(input: {
    tenantId: string;
    sessionId: string;
    status: CustomerChatSession["status"];
    assignedType?: "human" | "ai";
    assignedId?: string;
    assignedName?: string;
    assignedAvatar?: string;
    priority?: PriorityLevel;
  }): Promise<CustomerChatSession> {
    return this.client.withTenantSession(input.tenantId, async (db) => {
      const currentPage = await loadSession(db, input.sessionId, { lock: true, messageLimit: 1 });
      const current = currentPage?.session;
      if (!current) throw new Error("Chat session not found");
      const metadata: SessionMetadata = {
        assignedType: input.assignedType || current.assignedType,
        assignedId: input.assignedId || current.assignedId,
        assignedName: input.assignedName || current.assignedName,
        assignedAvatar: input.assignedAvatar || current.assignedAvatar,
        uiStatus: input.status,
      };
      const dbStatus =
        input.status === "resolved"
          ? "resolved"
          : input.status === "queued"
            ? "waiting"
            : input.status === "escalated"
              ? "assigned"
              : "open";
      await db.query(
        `UPDATE supportv8.chat_sessions
            SET status = $2,
                priority = COALESCE($3, priority),
                assigned_operator_id = CASE WHEN $4 = 'human' THEN COALESCE($5, assigned_operator_id) ELSE NULL END,
                intake_data = jsonb_set(intake_data, '{__supportv8}', $6::jsonb, true),
                last_message_at = now()
          WHERE id = $1`,
        [
          input.sessionId,
          dbStatus,
          input.priority || null,
          metadata.assignedType,
          metadata.assignedId,
          JSON.stringify(metadata),
        ]
      );
      await db.query(
        `UPDATE supportv8.workdesk_items
            SET status = $2,
                priority = COALESCE($3, priority),
                assigned_operator_id = CASE WHEN $4 = 'human' THEN $5 ELSE assigned_operator_id END,
                version = version + 1,
                updated_at = now()
          WHERE session_id = $1`,
        [
          input.sessionId,
          input.status === "resolved" ? "resolved" : input.status === "queued" ? "queued" : input.status === "escalated" ? "queued" : "active",
          input.priority || null,
          metadata.assignedType,
          metadata.assignedId,
        ]
      );
      const sessionPage = await loadSession(db, input.sessionId, { messageLimit: 100 });
      if (!sessionPage) throw new Error("Updated runtime session could not be loaded");
      return sessionPage.session;
    });
  }

  async listChatIssues(tenantId: string): Promise<Issue[]> {
    return this.client.withTenantSession(tenantId, async (db) => {
      const rows = await db.query<IssueRow>(
        `SELECT i.id, i.tenant_id, i.external_id, i.source_url, i.customer_ref,
                i.customer_name, i.customer_tier, i.summary, i.category, i.product,
                i.version, i.source_status, i.priority, i.sentiment, i.sentiment_score,
                i.sentiment_trajectory, i.confidence, i.business_impact,
                i.resolution_risk_score, i.tags, i.recommended_action,
                i.timeline, i.messages, i.assigned_to, i.assigned_agent,
                i.created_at, i.updated_at, s.intake_data
           FROM supportv8.issues i
           JOIN supportv8.chat_sessions s ON s.issue_id = i.id AND s.tenant_id = i.tenant_id
          WHERE i.source = 'chat'
          ORDER BY i.updated_at DESC
          LIMIT 500`
      );
      return rows.map((row) => {
        const metadata = ((row.intake_data || {}).__supportv8 || {}) as Partial<SessionMetadata>;
        return {
          id: row.id,
          tenantId: row.tenant_id,
          externalId: row.external_id,
          source: "chat",
          sourceUrl: row.source_url,
          customerRef: row.customer_ref,
          entityType: row.category === "contractor_dispatch" ? "contractor" : "customer",
          customerName: row.customer_name,
          customerTier: row.customer_tier,
          summary: row.summary,
          category: row.category,
          product: row.product,
          version: row.version,
          status: row.source_status as Issue["status"],
          sourceStatus: row.source_status,
          priority: row.priority,
          sentiment: row.sentiment as Issue["sentiment"],
          sentimentScore: Number(row.sentiment_score),
          sentimentTrajectory: row.sentiment_trajectory as Issue["sentimentTrajectory"],
          confidence: Number(row.confidence),
          businessImpact: row.business_impact as Issue["businessImpact"],
          resolutionRiskScore: Number(row.resolution_risk_score),
          tags: row.tags || [],
          assignedTo: row.assigned_to || metadata.assignedName,
          assignedAgent: row.assigned_agent || undefined,
          timeline: row.timeline || [],
          messages: row.messages || [],
          recommendedAction: row.recommended_action || undefined,
          createdAt: iso(row.created_at),
          updatedAt: iso(row.updated_at),
        } as Issue;
      });
    });
  }

  async updateChatIssue(
    tenantId: string,
    issueId: string,
    updates: Partial<Issue>
  ): Promise<Issue | null> {
    return this.client.withTenantSession(tenantId, async (db) => {
      const changed = await db.query<{ id: string } & QueryResultRow>(
        `UPDATE supportv8.issues
            SET summary = COALESCE($2, summary),
                category = COALESCE($3, category),
                priority = COALESCE($4, priority),
                source_status = COALESCE($5, source_status),
                sentiment = COALESCE($6, sentiment),
                recommended_action = COALESCE($7, recommended_action),
                timeline = COALESCE($8::jsonb, timeline),
                messages = COALESCE($9::jsonb, messages),
                assigned_to = COALESCE($10, assigned_to),
                assigned_agent = COALESCE($11, assigned_agent)
          WHERE id = $1 AND source = 'chat'
          RETURNING id`,
        [
          issueId,
          updates.summary || null,
          updates.category || null,
          updates.priority || null,
          updates.status || null,
          updates.sentiment || null,
          updates.recommendedAction || null,
          updates.timeline === undefined ? null : JSON.stringify(updates.timeline),
          updates.messages === undefined ? null : JSON.stringify(updates.messages),
          updates.assignedTo || null,
          updates.assignedAgent || null,
        ]
      );
      if (!changed[0]) return null;

      if (updates.status) {
        const dbStatus = updates.status === "resolved" || updates.status === "closed"
          ? updates.status
          : updates.status === "escalated"
            ? "assigned"
            : "open";
        const uiStatus: CustomerChatSession["status"] =
          updates.status === "resolved" || updates.status === "closed"
            ? "resolved"
            : updates.status === "escalated"
              ? "escalated"
              : "active";
        await db.query(
          `UPDATE supportv8.chat_sessions
              SET status = $2::text,
                  intake_data = jsonb_set(
                    intake_data,
                    '{__supportv8,uiStatus}',
                    to_jsonb($3::text),
                    true
                  ),
                  resolved_at = CASE WHEN $2::text IN ('resolved', 'closed') THEN COALESCE(resolved_at, now()) ELSE NULL END,
                  closed_at = CASE WHEN $2::text = 'closed' THEN COALESCE(closed_at, now()) ELSE NULL END
            WHERE issue_id = $1`,
          [issueId, dbStatus, uiStatus]
        );
        const workdeskStatus = updates.status === "resolved" || updates.status === "closed"
          ? updates.status
          : updates.status === "escalated"
            ? "queued"
            : "active";
        await db.query(
          `UPDATE supportv8.workdesk_items
              SET status = $2::text, version = version + 1,
                  resolved_at = CASE WHEN $2::text IN ('resolved', 'closed') THEN COALESCE(resolved_at, now()) ELSE NULL END,
                  updated_at = now()
            WHERE issue_id = $1`,
          [issueId, workdeskStatus]
        );
      }

      const rows = await db.query<IssueRow>(
        `SELECT i.id, i.tenant_id, i.external_id, i.source_url, i.customer_ref,
                i.customer_name, i.customer_tier, i.summary, i.category, i.product,
                i.version, i.source_status, i.priority, i.sentiment, i.sentiment_score,
                i.sentiment_trajectory, i.confidence, i.business_impact,
                i.resolution_risk_score, i.tags, i.recommended_action,
                i.timeline, i.messages, i.assigned_to, i.assigned_agent,
                i.created_at, i.updated_at, s.intake_data
           FROM supportv8.issues i
           JOIN supportv8.chat_sessions s ON s.issue_id = i.id AND s.tenant_id = i.tenant_id
          WHERE i.id = $1`,
        [issueId]
      );
      if (!rows[0]) return null;
      const metadata = ((rows[0].intake_data || {}).__supportv8 || {}) as Partial<SessionMetadata>;
      return {
        id: rows[0].id,
        tenantId: rows[0].tenant_id,
        externalId: rows[0].external_id,
        source: "chat",
        sourceUrl: rows[0].source_url,
        customerRef: rows[0].customer_ref,
        customerName: rows[0].customer_name,
        customerTier: rows[0].customer_tier,
        summary: rows[0].summary,
        category: rows[0].category,
        product: rows[0].product,
        version: rows[0].version,
        status: rows[0].source_status as Issue["status"],
        sourceStatus: rows[0].source_status,
        priority: rows[0].priority,
        sentiment: rows[0].sentiment as Issue["sentiment"],
        sentimentScore: Number(rows[0].sentiment_score),
        sentimentTrajectory: rows[0].sentiment_trajectory as Issue["sentimentTrajectory"],
        confidence: Number(rows[0].confidence),
        businessImpact: rows[0].business_impact as Issue["businessImpact"],
        resolutionRiskScore: Number(rows[0].resolution_risk_score),
        tags: rows[0].tags || [],
        assignedTo: rows[0].assigned_to || metadata.assignedName,
        assignedAgent: rows[0].assigned_agent || undefined,
        timeline: rows[0].timeline || [],
        messages: rows[0].messages || [],
        recommendedAction: rows[0].recommended_action || undefined,
        createdAt: iso(rows[0].created_at),
        updatedAt: iso(rows[0].updated_at),
      } as Issue;
    });
  }
}

export const chatRepository = new ChatRepository();
