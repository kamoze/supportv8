import { createHash } from "node:crypto";
import type { InboundMessagePayload } from "../types";
import type { CustomerChatSession, CustomerChatMessage, PriorityLevel } from "@/lib/types";
import { chatRepository } from "@/lib/db/chat-repository";
import { tenantSlugFromId } from "@/lib/auth/request-tenant";

// Local fallback for tests/development without DATABASE_URL. Production state
// is loaded from the tenant-scoped PostgreSQL chat repository.
const sessionsMap = new Map<string, CustomerChatSession>();

const EXTERNAL_CHANNELS = new Set(["email", "whatsapp", "voice"]);

/**
 * Provider identifiers such as an email address or phone number are not
 * globally unique across tenants. Namespace them before they reach the
 * globally keyed chat_sessions table so one tenant can never collide with
 * another tenant's conversation.
 */
export function durableRuntimeSessionId(payload: Pick<InboundMessagePayload, "channel" | "tenantId" | "sessionId">): string {
  if (!EXTERNAL_CHANNELS.has(payload.channel)) return payload.sessionId;

  const digest = createHash("sha256")
    .update(`${payload.tenantId}:${payload.channel}:${payload.sessionId}`)
    .digest("hex")
    .slice(0, 48);
  return `chat_${digest}`;
}

export class ConversationManager {
  /**
   * Retrieves or creates a chat session for any inbound channel
   */
  static async getOrCreateSession(payload: InboundMessagePayload): Promise<{
    session: CustomerChatSession;
    created: boolean;
  }> {
    payload.sessionId = durableRuntimeSessionId(payload);

    if (process.env.DATABASE_URL) {
      const existing = await chatRepository.getSession(payload.tenantId, payload.sessionId);
      if (existing) return { session: existing, created: false };

      const channel =
        payload.channel === "email" || payload.channel === "whatsapp" || payload.channel === "voice"
          ? payload.channel
          : "web";
      const session = await chatRepository.startSession({
        tenantId: payload.tenantId,
        tenantSlug: tenantSlugFromId(payload.tenantId),
        sessionId: payload.sessionId,
        channel,
        stream: payload.stream,
        customerName: payload.senderName,
        customerEmail: payload.senderEmail || "",
        intakeData: {
          details: payload.content,
          ...(Object.fromEntries(
            Object.entries(payload.metadata || {}).filter((entry): entry is [string, string] => typeof entry[1] === "string")
          )),
        },
      });
      return { session, created: true };
    }

    let session = sessionsMap.get(payload.sessionId);
    let created = false;
    if (!session) {
      created = true;
      session = {
        id: payload.sessionId,
        tenantDomain: payload.tenantId,
        stream: payload.stream,
        customerName: payload.senderName,
        customerEmail: payload.senderEmail || "user@example.com",
        customerPhone: payload.senderPhone,
        intakeData: payload.metadata as Record<string, string> || {},
        assignedType: "ai",
        assignedId: "beaver-sophia",
        assignedName: payload.stream === "contractors" ? "Alex — Contractor Dispatch" : payload.stream === "enquiries" ? "Barnaby — Solutions Lead" : "Sophia — Customer Success",
        assignedAvatar: payload.stream === "contractors" ? "/avatars/beaver-manager.jpg" : payload.stream === "enquiries" ? "/avatars/beaver-curator.jpg" : "/avatars/beaver-sophia.jpg",
        status: "active",
        priority: "normal",
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      sessionsMap.set(payload.sessionId, session);
    }
    return { session, created };
  }

  /**
   * Appends a message to the active session
   */
  static async appendMessage(
    tenantId: string,
    sessionId: string,
    message: Omit<CustomerChatMessage, "id" | "timestamp">
  ): Promise<CustomerChatMessage> {
    if (process.env.DATABASE_URL) {
      return chatRepository.appendRuntimeMessage({
        tenantId,
        sessionId,
        sender: message.sender,
        senderName: message.senderName,
        senderAvatar: message.senderAvatar,
        content: message.content,
        citations: message.citations,
        suggestedActions: message.suggestedActions,
      });
    }

    const session = sessionsMap.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const fullMessage: CustomerChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    session.messages.push(fullMessage);
    session.updatedAt = new Date().toISOString();
    return fullMessage;
  }

  /**
   * Updates the status or routing assignment of a session
   */
  static async updateSessionStatus(
    tenantId: string,
    sessionId: string,
    status: CustomerChatSession["status"],
    assignedType?: "human" | "ai",
    assignedName?: string,
    priority?: PriorityLevel
  ): Promise<CustomerChatSession> {
    if (process.env.DATABASE_URL) {
      return chatRepository.updateSessionRouting({
        tenantId,
        sessionId,
        status,
        assignedType,
        assignedId: assignedType === "human" ? "human_support_queue" : undefined,
        assignedName,
        priority,
      });
    }

    const session = sessionsMap.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    session.status = status;
    if (assignedType) session.assignedType = assignedType;
    if (assignedName) session.assignedName = assignedName;
    if (priority) session.priority = priority;
    session.updatedAt = new Date().toISOString();
    return session;
  }

  static async getSession(tenantId: string, sessionId: string): Promise<CustomerChatSession | null> {
    if (process.env.DATABASE_URL) {
      return chatRepository.getSession(tenantId, sessionId);
    }
    return sessionsMap.get(sessionId) || null;
  }
}
