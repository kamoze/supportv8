import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { RequestTenantContext } from "@/lib/auth/request-tenant";

export const CHAT_INGRESS_MAX_BODY_BYTES = 256 * 1024;

const CHAT_OPERATOR_ROLES = new Set([
  "support_superadmin",
  "support_cx_lead",
  "support_operator",
]);

export class ChatIngressError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 403 | 404 | 413 | 503
  ) {
    super(message);
    this.name = "ChatIngressError";
  }
}

export function isChatChannelEnabled(channel: "email" | "whatsapp"): boolean {
  const key =
    channel === "whatsapp"
      ? "SUPPORTV8_WHATSAPP_INGRESS_ENABLED"
      : "SUPPORTV8_EMAIL_INGRESS_ENABLED";
  return process.env[key] === "true";
}

export function requireChatChannelEnabled(channel: "email" | "whatsapp"): void {
  if (!isChatChannelEnabled(channel)) {
    throw new ChatIngressError("Channel ingress is not enabled", 404);
  }
}

function equalSecret(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export function verifyWebhookToken(received: string | null, expected: string | undefined): boolean {
  if (!received || !expected) return false;
  return equalSecret(received, expected);
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | undefined
): boolean {
  if (!appSecret || !signatureHeader || !/^sha256=[a-f0-9]{64}$/i.test(signatureHeader)) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
  return equalSecret(signatureHeader.toLowerCase(), expected);
}

export function requireBoundedRawBody(rawBody: string): void {
  if (Buffer.byteLength(rawBody, "utf8") > CHAT_INGRESS_MAX_BODY_BYTES) {
    throw new ChatIngressError("Webhook payload is too large", 413);
  }
}

export function requireBoundedContentLength(contentLength: string | null): void {
  if (contentLength === null) return;
  if (!/^\d+$/.test(contentLength)) {
    throw new ChatIngressError("Invalid Content-Length", 400);
  }

  const length = Number(contentLength);
  if (!Number.isSafeInteger(length) || length > CHAT_INGRESS_MAX_BODY_BYTES) {
    throw new ChatIngressError("Webhook payload is too large", 413);
  }
}

export function requireChatOperatorRole(tenant: RequestTenantContext): void {
  // Local development uses the demo credential store rather than signed
  // Keycloak tokens. Production always requires an authenticated token and an
  // explicit SupportV8 operator role.
  if (process.env.NODE_ENV !== "production" && !tenant.authenticated) return;

  if (!tenant.authenticated || !tenant.roles.some((role) => CHAT_OPERATOR_ROLES.has(role))) {
    throw new ChatIngressError("Operator role is required", 403);
  }
}

export async function selectServerOwnedSessionId(
  requestedSessionId: unknown,
  sessionExists: (sessionId: string) => Promise<boolean>
): Promise<string> {
  if (
    typeof requestedSessionId === "string" &&
    /^[a-zA-Z0-9_-]{1,64}$/.test(requestedSessionId) &&
    (await sessionExists(requestedSessionId))
  ) {
    return requestedSessionId;
  }

  return `sess_${randomUUID().replace(/-/g, "")}`;
}
