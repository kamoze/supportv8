import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { chatRepository } from "@/lib/db/chat-repository";
import { tenantSlugFromId } from "@/lib/auth/request-tenant";
import { verifySupportEmailTenantAccount } from "@/lib/messaging/tenant-account";

type EmailEvent = {
  eventId: string; providerMessageId?: string; accountId: string; tenantId: string; connectionId: string; connectorKey: string; channel: "email";
  conversationId: string; sender: string; recipient: string; subject: string; content: string; receivedAt: string; hasAttachments: boolean;
};

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && !isInternalHost(request.headers.get("host"))) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const expected = process.env.SUPPORTV8_EMAIL_EVENTS_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/, "");
  if (!expected || !supplied || !safeEqual(supplied, expected)) return NextResponse.json({ error: "email_event_not_authorized" }, { status: 401 });
  let event: EmailEvent;
  try { event = validateEvent(await request.json()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "invalid_email_event" }, { status: 400 }); }
  if (request.headers.get("x-servicev8-tenant-id") !== event.tenantId || request.headers.get("x-servicev8-account-id") !== event.accountId || request.headers.get("x-servicev8-event-id") !== event.eventId) {
    return NextResponse.json({ error: "email event envelope mismatch" }, { status: 403 });
  }

  const tenantSlug = tenantSlugFromId(event.tenantId);
  await verifySupportEmailTenantAccount({ tenantId: event.tenantId, accountId: event.accountId });
  await chatRepository.validateAndBindEmailChannel({ tenantId: event.tenantId, accountId: event.accountId, connectionId: event.connectionId, connectorKey: event.connectorKey, recipient: event.recipient, eventId: event.eventId });
  const sessionId = stableId("email", `${event.tenantId}:${event.connectionId}:${event.conversationId}`);
  const messageId = stableId("msg_email", `${event.tenantId}:${event.connectionId}:${event.eventId}`);
  const existing = await chatRepository.getSession(event.tenantId, sessionId);
  if (existing) {
    await chatRepository.sendMessage({ tenantId: event.tenantId, tenantSlug, sessionId, sender: "customer", senderName: senderName(event.sender), content: event.content, clientMessageId: messageId });
  } else {
    await chatRepository.startSession({
      sessionId,
      tenantId: event.tenantId, tenantSlug, stream: "enquiries", channel: "email", forceHumanQueue: true, initialMessageId: messageId,
      customerName: senderName(event.sender), customerEmail: senderAddress(event.sender),
      intakeData: { details: event.content, inquiryCategory: "Email support request", subject: event.subject, messagingConversationId: event.conversationId, hasAttachments: String(event.hasAttachments) },
    });
  }
  await chatRepository.recordEmailJourney({ tenantId: event.tenantId, sessionId, eventId: event.eventId, direction: "inbound", actor: senderName(event.sender), details: `Email received: ${event.subject}` });
  return NextResponse.json({ accepted: true, sessionId, replayed: Boolean(existing) }, { status: existing ? 200 : 202 });
}

function validateEvent(value: unknown): EmailEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("email event must be an object");
  const body = value as Record<string, unknown>;
  for (const key of ["eventId", "accountId", "tenantId", "connectionId", "connectorKey", "conversationId", "sender", "recipient", "subject", "content", "receivedAt"] as const) {
    if (typeof body[key] !== "string" || !body[key].trim()) throw new Error(`${key} is required`);
  }
  if (body.channel !== "email" || typeof body.hasAttachments !== "boolean") throw new Error("invalid email event");
  if (String(body.content).length > 1_000_000 || String(body.subject).length > 998) throw new Error("email event is too large");
  if (Number.isNaN(Date.parse(String(body.receivedAt)))) throw new Error("receivedAt is invalid");
  return body as EmailEvent;
}
function stableId(prefix: string, value: string) { return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 40)}`; }
function senderAddress(value: string) { return (value.match(/<([^<>]+)>\s*$/)?.[1] ?? value).trim().toLowerCase(); }
function senderName(value: string) { const address = senderAddress(value); const display = value.replace(/<[^<>]+>\s*$/, "").trim().replace(/^"|"$/g, ""); return display && display !== address ? display.slice(0, 255) : address.split("@")[0]!.slice(0, 255); }
function safeEqual(left: string, right: string) { const a = Buffer.from(left), b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
function isInternalHost(value: string | null) { const host = (value ?? "").split(":")[0]!.toLowerCase(); return host === "supportv8" || host === "supportv8.default.svc" || host === "supportv8.default.svc.cluster.local"; }
