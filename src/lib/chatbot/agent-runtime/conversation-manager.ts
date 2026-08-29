import type { InboundMessagePayload } from "../types";
import type { CustomerChatSession, CustomerChatMessage, PriorityLevel } from "@/lib/types";

// In-memory conversation state (backed by Redis in cluster)
const sessionsMap = new Map<string, CustomerChatSession>();

export class ConversationManager {
  /**
   * Retrieves or creates a chat session for any inbound channel
   */
  static getOrCreateSession(payload: InboundMessagePayload): CustomerChatSession {
    let session = sessionsMap.get(payload.sessionId);
    if (!session) {
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
    return session;
  }

  /**
   * Appends a message to the active session
   */
  static appendMessage(
    sessionId: string,
    message: Omit<CustomerChatMessage, "id" | "timestamp">
  ): CustomerChatMessage {
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
  static updateSessionStatus(
    sessionId: string,
    status: CustomerChatSession["status"],
    assignedType?: "human" | "ai",
    assignedName?: string,
    priority?: PriorityLevel
  ): CustomerChatSession {
    const session = sessionsMap.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    session.status = status;
    if (assignedType) session.assignedType = assignedType;
    if (assignedName) session.assignedName = assignedName;
    if (priority) session.priority = priority;
    session.updatedAt = new Date().toISOString();
    return session;
  }

  static getSession(sessionId: string): CustomerChatSession | null {
    return sessionsMap.get(sessionId) || null;
  }
}
