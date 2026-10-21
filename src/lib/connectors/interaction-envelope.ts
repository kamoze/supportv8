import type { NormalizedInteractionInput } from "@/lib/types";

const ALLOWED_KEYS = new Set([
  "eventId",
  "accountId",
  "tenantId",
  "connectionId",
  "connectorKey",
  "source",
  "sourceReference",
  "customerReference",
  "sourceUrl",
  "text",
  "sender",
  "occurredAt",
  "receivedAt",
  "correlationId",
  "raw",
]);

const REQUIRED_STRING_KEYS = [
  "eventId",
  "accountId",
  "tenantId",
  "connectionId",
  "sourceReference",
  "customerReference",
  "sourceUrl",
  "text",
  "sender",
  "occurredAt",
] as const;

const ZENDESK_URL_PATTERN = /^https:\/\/[a-z0-9-]+\.zendesk\.com\/(?:tickets|agent\/tickets)\/\d+(?:[/?#].*)?$/;

const SKEW_TOLERANCE_MS = 60 * 1000; // 60 seconds
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const MAX_TEXT_LENGTH = 100_000;
const MAX_RAW_BYTES = 1_048_576; // 1 MiB

export type ValidateInteractionEnvelopeResult =
  | { valid: true; event: NormalizedInteractionInput }
  | { valid: false; error: string; status: number };

/**
 * Validates the normalized interaction event envelope received from Action Gateway.
 * Enforces:
 * - Reject unknown keys
 * - Missing required fields: eventId, accountId, tenantId, connectionId, sourceReference,
 *   customerReference, sourceUrl, text, sender, occurredAt
 * - source must be "zendesk"
 * - sourceUrl must be a valid HTTPS Zendesk deep link (https://[a-z0-9-]+\.zendesk\.com/(tickets|agent/tickets)/\d+)
 * - text must not exceed 100,000 characters
 * - raw payload JSON stringified must not exceed 1 MiB (1,048,576 bytes)
 * - occurredAt must not be in the future (skew tolerance 60s) and not older than 7 days
 */
export function validateInteractionEnvelope(body: unknown): ValidateInteractionEnvelopeResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      valid: false,
      error: "Interaction envelope must be a JSON object",
      status: 400,
    };
  }

  const record = body as Record<string, unknown>;

  // 1. Reject unknown keys
  for (const key of Object.keys(record)) {
    if (!ALLOWED_KEYS.has(key)) {
      return {
        valid: false,
        error: `Unknown field '${key}' is not permitted in interaction envelope`,
        status: 400,
      };
    }
  }

  // 2. Validate required string fields
  for (const key of REQUIRED_STRING_KEYS) {
    if (typeof record[key] !== "string" || (key !== "text" && !record[key].trim())) {
      return {
        valid: false,
        error: `Missing or invalid required field '${key}'`,
        status: 400,
      };
    }
  }

  // 3. source must be "zendesk"
  if (record.source !== "zendesk") {
    return {
      valid: false,
      error: `Invalid source: expected 'zendesk', got '${record.source}'`,
      status: 400,
    };
  }

  // 4. sourceUrl must be a valid HTTPS Zendesk deep link
  const sourceUrl = record.sourceUrl as string;
  if (!ZENDESK_URL_PATTERN.test(sourceUrl)) {
    return {
      valid: false,
      error: `Invalid sourceUrl: must be a valid HTTPS Zendesk deep link matching https://[subdomain].zendesk.com/(tickets|agent/tickets)/[id]`,
      status: 400,
    };
  }

  // 5. text must not exceed 100,000 characters
  const text = record.text as string;
  if (text.length > MAX_TEXT_LENGTH) {
    return {
      valid: false,
      error: `text exceeds maximum allowed length of 100,000 characters (received ${text.length})`,
      status: 400,
    };
  }

  // 6. sender validation
  const sender = record.sender as string;
  if (sender !== "customer" && sender !== "agent" && sender !== "system") {
    return {
      valid: false,
      error: `Invalid sender: expected 'customer', 'agent', or 'system', got '${sender}'`,
      status: 400,
    };
  }

  // 7. raw payload validation (must be object, <= 1 MiB)
  const raw = (record.raw ?? {}) as Record<string, unknown>;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      valid: false,
      error: "raw payload must be a JSON object",
      status: 400,
    };
  }
  const rawString = JSON.stringify(raw);
  const rawBytes = Buffer.byteLength(rawString, "utf8");
  if (rawBytes > MAX_RAW_BYTES) {
    return {
      valid: false,
      error: `raw payload JSON exceeds maximum allowed size of 1 MiB (received ${rawBytes} bytes)`,
      status: 400,
    };
  }

  // 8. occurredAt validation: not in the future (>60s skew), not older than 7 days
  const occurredTime = Date.parse(record.occurredAt as string);
  if (Number.isNaN(occurredTime)) {
    return {
      valid: false,
      error: "occurredAt must be a valid ISO date string",
      status: 400,
    };
  }
  const now = Date.now();
  if (occurredTime > now + SKEW_TOLERANCE_MS) {
    return {
      valid: false,
      error: "occurredAt cannot be in the future (skew tolerance 60 seconds exceeded)",
      status: 400,
    };
  }
  if (occurredTime < now - SEVEN_DAYS_MS) {
    return {
      valid: false,
      error: "occurredAt cannot be older than 7 days",
      status: 400,
    };
  }

  // 9. receivedAt validation
  let receivedAt = record.receivedAt as string | undefined;
  if (receivedAt) {
    if (typeof receivedAt !== "string" || Number.isNaN(Date.parse(receivedAt))) {
      return {
        valid: false,
        error: "receivedAt must be a valid ISO date string when supplied",
        status: 400,
      };
    }
  } else {
    receivedAt = new Date().toISOString();
  }

  if (record.connectorKey !== undefined && typeof record.connectorKey !== "string") {
    return {
      valid: false,
      error: "connectorKey must be a string if supplied",
      status: 400,
    };
  }

  if (record.correlationId !== undefined && typeof record.correlationId !== "string") {
    return {
      valid: false,
      error: "correlationId must be a string if supplied",
      status: 400,
    };
  }

  const connectorKey =
    typeof record.connectorKey === "string" && record.connectorKey.trim()
      ? record.connectorKey.trim()
      : "zendesk";

  const correlationId =
    typeof record.correlationId === "string" && record.correlationId.trim()
      ? record.correlationId.trim()
      : (record.eventId as string);

  const event: NormalizedInteractionInput = {
    eventId: record.eventId as string,
    accountId: record.accountId as string,
    tenantId: record.tenantId as string,
    connectionId: record.connectionId as string,
    connectorKey,
    source: "zendesk",
    sourceReference: record.sourceReference as string,
    customerReference: record.customerReference as string,
    sourceUrl,
    text,
    sender: sender as "customer" | "agent" | "system",
    occurredAt: record.occurredAt as string,
    receivedAt,
    correlationId,
    raw,
  };

  return {
    valid: true,
    event,
  };
}
