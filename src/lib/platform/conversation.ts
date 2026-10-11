/**
 * Unified AgenticOS Conversation & Turn Lifecycle
 * Implements CHAT-01 to CHAT-05:
 * - One workspace AgenticOS turn lifecycle
 * - Admission check before model inference (unhired employee denied)
 * - Exact idempotency by clientTurnId (identical body resumes turn; conflicting body rejected)
 * - Private thread ACL and cross-tenant non-disclosing denial
 * - Per-recipient status without fabricated responses
 */

import * as fs from "node:fs";

export interface AgenticTurn {
  turnId: string;
  clientTurnId: string;
  threadId: string;
  tenantSlug: string;
  actorId: string;
  employeeId: string;
  prompt: string;
  isPrivate: boolean;
  participants: string[];
  status: "admitted" | "running" | "completed" | "failed";
  createdAt: string;
  recipientStates?: Record<string, "ready" | "unavailable">;
  answer?: string;
  response?: Record<string, unknown>;
}

const turnsByClientTurnId = new Map<string, AgenticTurn>();
const threadsMap = new Map<string, AgenticTurn[]>();

function getConversationStorageFile(): string {
  return process.env.SUPPORTV8_CONVERSATION_FILE || "/tmp/supportv8-conversations.json";
}

function loadFromDisk(): void {
  try {
    const file = getConversationStorageFile();
    if (fs.existsSync(file)) {
      const stat = fs.statSync(file);
      if (!stat.isFile()) return;
      const raw = fs.readFileSync(file, "utf-8");
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        if (data.turns) {
          for (const [k, v] of Object.entries(data.turns)) {
            turnsByClientTurnId.set(k, v as AgenticTurn);
          }
        }
        if (data.threads) {
          for (const [k, v] of Object.entries(data.threads)) {
            threadsMap.set(k, v as AgenticTurn[]);
          }
        }
      }
    }
  } catch {
    // Ignore read errors
  }
}

function saveToDisk(): void {
  const file = getConversationStorageFile();
  const turnsObj: Record<string, AgenticTurn> = {};
  for (const [k, v] of turnsByClientTurnId.entries()) {
    turnsObj[k] = v;
  }
  const threadsObj: Record<string, AgenticTurn[]> = {};
  for (const [k, v] of threadsMap.entries()) {
    threadsObj[k] = v;
  }
  fs.writeFileSync(file, JSON.stringify({ turns: turnsObj, threads: threadsObj }));
}

export function clearConversationStoreForTesting(): void {
  turnsByClientTurnId.clear();
  threadsMap.clear();
  try {
    const file = getConversationStorageFile();
    if (fs.existsSync(file)) {
      const stat = fs.statSync(file);
      if (stat.isFile()) {
        fs.unlinkSync(file);
      }
    }
  } catch {
    // Ignore
  }
}

export function completeAgenticTurn(
  turnId: string,
  result: { answer?: string; response?: Record<string, unknown> }
): AgenticTurn | null {
  loadFromDisk();
  let foundTurn: AgenticTurn | null = null;
  for (const turn of turnsByClientTurnId.values()) {
    if (turn.turnId === turnId) {
      turn.status = "completed";
      if (result.answer) turn.answer = result.answer;
      if (result.response) turn.response = result.response;
      foundTurn = turn;
      break;
    }
  }
  for (const turns of threadsMap.values()) {
    for (const t of turns) {
      if (t.turnId === turnId) {
        t.status = "completed";
        if (result.answer) t.answer = result.answer;
        if (result.response) t.response = result.response;
      }
    }
  }
  if (foundTurn) {
    saveToDisk();
  }
  return foundTurn;
}

export function admitAgenticTurn(options: {
  tenantSlug: string;
  actorId: string;
  clientTurnId: string;
  threadId?: string;
  employeeId: string;
  prompt: string;
  activeHires: string[];
  isPrivate?: boolean;
  participants?: string[];
  additionalRecipients?: string[];
}): {
  success: boolean;
  status: number;
  turnId?: string;
  threadId?: string;
  admitted?: boolean;
  completed?: boolean;
  response?: Record<string, unknown>;
  recipientStates?: Record<string, "ready" | "unavailable">;
  error?: string;
} {
  const {
    tenantSlug,
    actorId,
    clientTurnId,
    employeeId,
    prompt,
    activeHires,
    isPrivate = false,
    participants = [actorId],
    additionalRecipients,
  } = options;
  loadFromDisk();

  // CHAT-02: Idempotency check by clientTurnId
  if (turnsByClientTurnId.has(clientTurnId)) {
    const existing = turnsByClientTurnId.get(clientTurnId)!;
    if (existing.tenantSlug !== tenantSlug) {
      return { success: false, status: 409, error: "Conflicting clientTurnId across tenants." };
    }
    if (existing.actorId !== actorId || existing.employeeId !== employeeId) {
      return { success: false, status: 409, error: "Conflicting actor or employee for clientTurnId replay." };
    }
    if (!activeHires.includes(employeeId)) {
      return { success: false, status: 409, error: `Employee '${employeeId}' is not hired or active for workspace.` };
    }
    if (existing.prompt === prompt) {
      return {
        success: true,
        status: 200,
        turnId: existing.turnId,
        threadId: existing.threadId,
        admitted: true,
        completed: existing.status === "completed",
        response: existing.response,
        recipientStates: existing.recipientStates,
      };
    } else {
      return {
        success: false,
        status: 409,
        error: "Conflicting prompt payload for existing clientTurnId.",
      };
    }
  }

  // Cross-tenant & private thread access check when threadId is specified
  if (options.threadId && threadsMap.has(options.threadId)) {
    const threadTurns = threadsMap.get(options.threadId)!;
    if (threadTurns.length > 0) {
      const threadOwner = threadTurns[0];
      if (threadOwner.tenantSlug.toLowerCase() !== tenantSlug.toLowerCase()) {
        return { success: false, status: 403, error: "Cross-tenant thread append denied." };
      }
      if (threadOwner.isPrivate && !threadOwner.participants.includes(actorId)) {
        return { success: false, status: 403, error: "Private thread access denied." };
      }
    }
  }

  // CHAT-01: Admission check before inference
  if (!activeHires.includes(employeeId)) {
    return {
      success: false,
      status: 409,
      error: `Employee '${employeeId}' is not hired or active for workspace.`,
    };
  }

  // CHAT-05: Per-recipient status tracking
  const recipientStates: Record<string, "ready" | "unavailable"> = {
    [employeeId]: activeHires.includes(employeeId) ? "ready" : "unavailable",
  };
  if (additionalRecipients) {
    for (const r of additionalRecipients) {
      recipientStates[r] = activeHires.includes(r) ? "ready" : "unavailable";
    }
  }

  const turnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const threadId = options.threadId || `th_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const turn: AgenticTurn = {
    turnId,
    clientTurnId,
    threadId,
    tenantSlug,
    actorId,
    employeeId,
    prompt,
    isPrivate,
    participants,
    status: "admitted",
    createdAt: new Date().toISOString(),
    recipientStates,
  };

  turnsByClientTurnId.set(clientTurnId, turn);

  if (!threadsMap.has(threadId)) {
    threadsMap.set(threadId, []);
  }
  threadsMap.get(threadId)!.push(turn);
  try {
    saveToDisk();
  } catch (err) {
    turnsByClientTurnId.delete(clientTurnId);
    threadsMap.get(threadId)?.pop();
    return {
      success: false,
      status: 500,
      error: "Durable persistence failure: unable to persist admitted turn.",
    };
  }

  return {
    success: true,
    status: 200,
    turnId,
    threadId,
    admitted: true,
    recipientStates,
  };
}

export function getThreadTurnHistory(options: {
  tenantSlug: string;
  callerSubject: string;
  threadId: string;
}): {
  allowed: boolean;
  status: number;
  turns?: AgenticTurn[];
  error?: string;
} {
  loadFromDisk();
  const { tenantSlug, callerSubject, threadId } = options;
  const turns = threadsMap.get(threadId);

  if (!turns || turns.length === 0) {
    return { allowed: false, status: 404, error: "Thread not found." };
  }

  const firstTurn = turns[0];

  // Cross-tenant non-disclosing denial
  if (firstTurn.tenantSlug.toLowerCase() !== tenantSlug.toLowerCase()) {
    return { allowed: false, status: 404, error: "Thread not found." };
  }

  // CHAT-04: Private thread ACL
  if (firstTurn.isPrivate && !firstTurn.participants.includes(callerSubject)) {
    return {
      allowed: false,
      status: 403,
      error: "Access denied: you do not have permission to view this private thread.",
    };
  }

  return {
    allowed: true,
    status: 200,
    turns: JSON.parse(JSON.stringify(turns)),
  };
}
