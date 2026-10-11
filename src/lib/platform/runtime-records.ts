import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Pool } from "pg";
import { INITIAL_ISSUES } from "@/lib/db/mock-data";

export type RuntimeEmployeeId = "Arthur" | "Vivian" | "Sophia";

export interface RuntimeEmployeeCapability {
  actorId: string;
  employeeName: RuntimeEmployeeId;
  capabilities: string[];
  allowedFields: string[];
}

export const RUNTIME_EMPLOYEE_PROFILES: Record<RuntimeEmployeeId, RuntimeEmployeeCapability> = {
  Arthur: {
    actorId: "runtime-arthur",
    employeeName: "Arthur",
    capabilities: ["support:ticket.read", "support:status.read"],
    allowedFields: [
      "id",
      "ticketRef",
      "status",
      "priority",
      "summary",
      "source",
      "createdAt",
      "updatedAt",
    ],
  },
  Sophia: {
    actorId: "runtime-sophia",
    employeeName: "Sophia",
    capabilities: ["support:ticket.read", "support:knowledge.read", "support:status.read"],
    allowedFields: [
      "id",
      "ticketRef",
      "customerName",
      "customerRef",
      "status",
      "priority",
      "summary",
      "source",
      "createdAt",
      "updatedAt",
    ],
  },
  Vivian: {
    actorId: "runtime-vivian",
    employeeName: "Vivian",
    capabilities: ["support:metrics.read", "support:status.read"],
    allowedFields: [
      "id",
      "ticketRef",
      "status",
      "priority",
      "source",
      "createdAt",
      "updatedAt",
    ],
  },
};

export interface RuntimeEmployeeTokenPayload {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  jti: string;
  tenant_id: string;
  calling_service: string;
  actor: {
    type: "ai_employee";
    id: RuntimeEmployeeId;
  };
  capabilities: string[];
  purpose: "direct_read" | "cross_app_command";
  correlation_id?: string;
}

export interface RuntimeRecordAuditEntry {
  id: string;
  timestamp: string;
  tenantId: string;
  actorId: string;
  operation: string;
  decision: "allow" | "deny";
  reason?: string;
  correlationId?: string;
}

// In-memory test state
const actorGrants = new Map<string, "active" | "revoked">();
const tenantEntitlements = new Map<string, "active" | "revoked">();
const tenantTicketsStore = new Map<string, Array<Record<string, unknown>>>();
let outageMode = false;
const auditLogs: RuntimeRecordAuditEntry[] = [];

export function setRuntimeActorGrant(actorId: string, status: "active" | "revoked"): void {
  actorGrants.set(actorId, status);
}

export function setTenantEntitlementFact(tenantDomain: string, status: "active" | "revoked"): void {
  tenantEntitlements.set(tenantDomain, status);
}

export function setTenantTicketsForTesting(tenantDomain: string, tickets: Array<Record<string, unknown>>): void {
  tenantTicketsStore.set(tenantDomain.replace(/^tenant_/, "").toLowerCase(), tickets);
}

export function setRuntimeRecordOutage(outage: boolean): void {
  outageMode = outage;
}

export function isRuntimeRecordOutage(): boolean {
  return outageMode;
}

export function getRuntimeRecordAuditLogs(): ReadonlyArray<RuntimeRecordAuditEntry> {
  return auditLogs;
}

export function clearRuntimeRecordAuditLogsForTesting(): void {
  auditLogs.length = 0;
}

export function clearRuntimeRecordsStateForTesting(): void {
  actorGrants.clear();
  tenantEntitlements.clear();
  tenantTicketsStore.clear();
  outageMode = false;
  auditLogs.length = 0;

  // Initialize known test tenants with isolated domain records
  const seedTenants = ["tenant-a", "tenant-b"];
  for (const t of seedTenants) {
    tenantTicketsStore.set(
      t,
      INITIAL_ISSUES.map((issue) => ({
        id: `${t}-${issue.id}`,
        ticketRef: `SV8-${t}-${issue.id}`,
        customerRef: `${t}-${issue.customerRef}`,
        customerName: issue.customerName,
        status: issue.sourceStatus,
        priority: issue.priority,
        summary: issue.summary,
        source: issue.source,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      }))
    );
  }
}

export function logRuntimeRecordAccess(entry: Omit<RuntimeRecordAuditEntry, "id" | "timestamp">): void {
  auditLogs.push({
    id: `audit_${randomUUID().slice(0, 8)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
}

function getSecret(): string | null {
  return process.env.SUPPORTV8_RUNTIME_SESSION_SECRET || null;
}

const APPROVED_ACTORS: Record<string, RuntimeEmployeeId> = {
  "runtime-arthur": "Arthur",
  "runtime-vivian": "Vivian",
  "runtime-sophia": "Sophia",
};

export function signRuntimeEmployeeToken(input: {
  actorId: string;
  employeeName: RuntimeEmployeeId;
  tenantDomain: string;
  workspaceId?: string;
  capabilities?: string[];
  purpose?: "direct_read" | "cross_app_command";
  aud?: string;
  iss?: string;
  iat?: number;
  exp?: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const iat = input.iat ?? now;
  const exp = input.exp ?? now + 300; // 5 min TTL
  const secret = getSecret() || "dev-testing-secret-key-32-chars-long";

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload: RuntimeEmployeeTokenPayload = {
    iss: input.iss ?? "https://identity.servicev8.internal",
    sub: input.actorId,
    aud: input.aud ?? "supportv8",
    iat,
    exp,
    jti: `tok_rt_${randomUUID().slice(0, 12)}`,
    tenant_id: input.tenantDomain,
    calling_service: "service:runtime",
    actor: {
      type: "ai_employee",
      id: input.employeeName,
    },
    capabilities:
      input.capabilities ??
      RUNTIME_EMPLOYEE_PROFILES[input.employeeName]?.capabilities ??
      ["support:ticket.read"],
    purpose: input.purpose ?? "direct_read",
    correlation_id: `corr_${randomUUID().slice(0, 8)}`,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyRuntimeEmployeeToken(
  token: string,
  options: {
    expectedTenantDomain?: string;
    expectedActor?: string;
    requiredCapability?: string;
    now?: number;
  } = {}
): {
  valid: boolean;
  status?: number;
  error?: string;
  payload?: RuntimeEmployeeTokenPayload;
} {
  if (!token || typeof token !== "string") {
    return { valid: false, status: 401, error: "Missing or malformed token" };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, status: 401, error: "Invalid token format" };
  }

  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
  const secret = getSecret();
  if (!secret) {
    return { valid: false, status: 503, error: "Runtime verifier unconfigured" };
  }

  // Signature check
  const expectedSig = createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  if (
    signatureB64.length !== expectedSig.length ||
    !timingSafeEqual(Buffer.from(signatureB64), Buffer.from(expectedSig))
  ) {
    return { valid: false, status: 401, error: "Invalid token signature" };
  }

  let payload: RuntimeEmployeeTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { valid: false, status: 401, error: "Invalid token JSON" };
  }

  const now = options.now ?? Math.floor(Date.now() / 1000);

  // Issued-at validation
  if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat)) {
    return { valid: false, status: 401, error: "Missing or invalid iat claim" };
  }
  if (payload.iat > now + 60) {
    return { valid: false, status: 401, error: "Token issued in future" };
  }

  // Expiration check
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp <= now) {
    return { valid: false, status: 401, error: "Token expired or missing exp claim" };
  }

  // TTL limit check: max 300s, must be positive
  const lifetime = payload.exp - payload.iat;
  if (lifetime > 300 || lifetime <= 0) {
    return { valid: false, status: 401, error: "Token lifetime exceeds maximum allowed TTL (300s)" };
  }

  // Issuer check
  if (payload.iss !== "https://identity.servicev8.internal") {
    return { valid: false, status: 401, error: "Token issuer mismatch" };
  }

  // Approved actor check
  const approvedEmployee = APPROVED_ACTORS[payload.sub];
  if (!approvedEmployee || payload.actor?.id !== approvedEmployee) {
    return { valid: false, status: 401, error: "Unknown or unapproved runtime actor" };
  }

  // Audience check
  const allowedAudiences = ["supportv8", "supportv8-runtime-records", "supportv8-runtime-session"];
  if (!allowedAudiences.includes(payload.aud)) {
    return { valid: false, status: 403, error: "Token audience mismatch" };
  }

  // Purpose check
  if (payload.purpose !== "direct_read") {
    return { valid: false, status: 403, error: "Token purpose mismatch; expected direct_read" };
  }

  // Tenant matching check: strict match, NO default bypass
  if (options.expectedTenantDomain) {
    const cleanExpected = options.expectedTenantDomain.replace(/^tenant_/, "").toLowerCase();
    const cleanPayloadTenant = (payload.tenant_id || "").replace(/^tenant_/, "").toLowerCase();
    if (cleanExpected !== cleanPayloadTenant) {
      return { valid: false, status: 403, error: "Cross-tenant access denied" };
    }
  }

  // Actor claim match check
  if (options.expectedActor) {
    if (payload.actor?.id !== options.expectedActor && payload.sub !== options.expectedActor) {
      return { valid: false, status: 401, error: "Actor identity mismatch" };
    }
  }

  // Actor grant revocation check
  if (payload.sub && actorGrants.get(payload.sub) === "revoked") {
    return { valid: false, status: 403, error: "Actor grant revoked", payload };
  }

  // Tenant entitlement revocation check
  if (payload.tenant_id && tenantEntitlements.get(payload.tenant_id) === "revoked") {
    return { valid: false, status: 403, error: "Tenant entitlement revoked", payload };
  }

  // Capability check: exact match required per actor role
  if (options.requiredCapability) {
    const userCaps = payload.capabilities || [];
    const actorName = payload.actor?.id;
    const isVivian = actorName === "Vivian";
    const hasRequired = isVivian
      ? userCaps.includes("support:status.read") || userCaps.includes("support:metrics.read")
      : userCaps.includes(options.requiredCapability);

    if (!hasRequired) {
      return { valid: false, status: 403, error: `Missing required capability: ${options.requiredCapability}` };
    }
  }

  return { valid: true, payload };
}

export function projectTicketForActor(
  ticket: Record<string, unknown>,
  actorName: RuntimeEmployeeId
): Record<string, unknown> {
  const profile = RUNTIME_EMPLOYEE_PROFILES[actorName] || RUNTIME_EMPLOYEE_PROFILES.Sophia;
  const allowed = new Set(profile.allowedFields);

  const projected: Record<string, unknown> = {};

  // Standard field normalizations
  const rawId = ticket.id as string;
  const rawRef = (ticket.ticketRef || ticket.externalId || `SV8-${rawId}`) as string;
  const rawStatus = (ticket.status || ticket.sourceStatus || "open") as string;
  const rawPriority = (ticket.priority || "normal") as string;
  const rawSummary = (ticket.summary || "") as string;
  const rawSource = (ticket.source || "runtime") as string;
  const rawCreatedAt = (ticket.createdAt || new Date().toISOString()) as string;
  const rawUpdatedAt = (ticket.updatedAt || new Date().toISOString()) as string;

  const candidateFields: Record<string, unknown> = {
    id: rawId,
    ticketRef: rawRef,
    status: rawStatus,
    priority: rawPriority,
    summary: rawSummary,
    source: rawSource,
    createdAt: rawCreatedAt,
    updatedAt: rawUpdatedAt,
    customerName: ticket.customerName,
    customerRef: ticket.customerRef,
  };

  for (const [key, val] of Object.entries(candidateFields)) {
    if (allowed.has(key) && val !== undefined) {
      projected[key] = val;
    }
  }

  // Strict sanitization: NEVER project prohibited private fields
  delete projected.internalNotes;
  delete projected.customerSsn;
  delete projected.rawTranscript;
  delete projected.billingSecret;
  delete projected.sentimentScore;

  return projected;
}

export function getTenantMockTickets(tenantDomain: string): Array<Record<string, unknown>> {
  const cleanTenant = tenantDomain.replace(/^tenant_/, "").toLowerCase();
  return INITIAL_ISSUES.map((issue) => ({
    id: `${cleanTenant}-${issue.id}`,
    ticketRef: `SV8-${cleanTenant}-${issue.id}`,
    customerRef: `${cleanTenant}-${issue.customerRef}`,
    customerName: issue.customerName,
    status: issue.sourceStatus,
    priority: issue.priority,
    summary: issue.summary,
    source: issue.source,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  }));
}

async function checkDatabaseAvailable(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return true;
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 300,
    });
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      return true;
    } finally {
      client.release();
      await pool.end();
    }
  } catch {
    return false;
  }
}

async function fetchTenantRawTickets(cleanTenant: string): Promise<Array<Record<string, unknown>>> {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false,
      connectionTimeoutMillis: 2000,
    });
    const client = await pool.connect();
    try {
      const res = await client.query(
        "SELECT id, external_id, customer_ref, customer_name, source_status, priority, summary, source, category, created_at::text AS created_at, updated_at::text AS updated_at FROM supportv8.issues WHERE tenant_id = $1 ORDER BY updated_at DESC, id DESC",
        [cleanTenant]
      );
      return res.rows.map((row: any) => ({
        id: row.id,
        ticketRef: row.external_id || `SV8-${cleanTenant}-${row.id}`,
        customerRef: row.customer_ref,
        customerName: row.customer_name,
        customerEmail: row.customer_email || undefined,
        status: row.source_status,
        priority: row.priority,
        category: row.category,
        summary: row.summary,
        description: row.summary,
        source: row.source,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } finally {
      client.release();
      await pool.end();
    }
  }
  return tenantTicketsStore.get(cleanTenant) || [];
}

export async function handleRuntimeEmployeeRecordRead(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return Response.json(
      { success: false, error: "Method not allowed" },
      { status: 405, headers: { allow: "GET", "cache-control": "no-store" } }
    );
  }

  if (outageMode) {
    logRuntimeRecordAccess({
      tenantId: "unknown",
      actorId: "unknown",
      operation: "read_tickets",
      decision: "deny",
      reason: "ticket service unavailable",
    });
    return Response.json(
      { success: false, error: "ticket service unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  // Derive tenant from host or headers
  const host = request.headers.get("host") || "";
  const hostDomain = host.split(".")[0]?.toLowerCase() || "tenant-a";
  const expectedActor = request.headers.get("x-runtime-employee") || undefined;

  const verification = verifyRuntimeEmployeeToken(token, {
    expectedTenantDomain: hostDomain,
    expectedActor,
    requiredCapability: "support:ticket.read",
  });

  if (!verification.valid || !verification.payload) {
    const actorId = verification.payload?.sub || expectedActor || "unknown";
    logRuntimeRecordAccess({
      tenantId: verification.payload?.tenant_id || hostDomain,
      actorId,
      operation: "read_tickets",
      decision: "deny",
      reason: verification.error,
    });
    return Response.json(
      { success: false, error: verification.error || "Authentication required" },
      { status: verification.status || 401, headers: { "cache-control": "no-store" } }
    );
  }

  const payload = verification.payload;
  const actorName = payload.actor.id;

  // Log successful read
  logRuntimeRecordAccess({
    tenantId: payload.tenant_id,
    actorId: payload.sub,
    operation: "read_tickets",
    decision: "allow",
    correlationId: payload.correlation_id,
  });

  const cleanTenant = payload.tenant_id.replace(/^tenant_/, "").toLowerCase();

  // If domain persistence is unavailable or unreachable:
  const dbOk = await checkDatabaseAvailable();
  if (!dbOk || (!tenantTicketsStore.has(cleanTenant) && !process.env.DATABASE_URL)) {
    logRuntimeRecordAccess({
      tenantId: payload.tenant_id,
      actorId: payload.sub,
      operation: "read_tickets",
      decision: "deny",
      reason: "domain persistence and grants unavailable",
      correlationId: payload.correlation_id,
    });
    return Response.json(
      { success: false, error: "domain persistence and grants unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  let rawTickets: Array<Record<string, unknown>>;
  try {
    rawTickets = await fetchTenantRawTickets(cleanTenant);
  } catch (err) {
    logRuntimeRecordAccess({
      tenantId: payload.tenant_id,
      actorId: payload.sub,
      operation: "read_tickets",
      decision: "deny",
      reason: "ticket repository schema or database unavailable",
      correlationId: payload.correlation_id,
    });
    return Response.json(
      { success: false, error: "ticket repository schema or database unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }
  const projectedTickets = rawTickets.map((t) => projectTicketForActor(t, actorName));

  return Response.json(
    {
      success: true,
      count: projectedTickets.length,
      tickets: projectedTickets,
      actor: actorName,
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
      },
    }
  );
}

export async function handleRuntimeEmployeeRecordDetail(
  request: Request,
  id: string
): Promise<Response> {
  if (request.method !== "GET") {
    return Response.json(
      { success: false, error: "Method not allowed" },
      { status: 405, headers: { allow: "GET", "cache-control": "no-store" } }
    );
  }

  if (outageMode) {
    return Response.json(
      { success: false, error: "ticket service unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  const host = request.headers.get("host") || "";
  const hostDomain = host.split(".")[0]?.toLowerCase() || "tenant-a";
  const expectedActor = request.headers.get("x-runtime-employee") || undefined;

  const verification = verifyRuntimeEmployeeToken(token, {
    expectedTenantDomain: hostDomain,
    expectedActor,
    requiredCapability: "support:ticket.read",
  });

  if (!verification.valid || !verification.payload) {
    return Response.json(
      { success: false, error: verification.error || "Authentication required" },
      { status: verification.status || 401, headers: { "cache-control": "no-store" } }
    );
  }

  const payload = verification.payload;
  const cleanTenant = payload.tenant_id.replace(/^tenant_/, "").toLowerCase();

  const dbOk = await checkDatabaseAvailable();
  if (!dbOk || (!tenantTicketsStore.has(cleanTenant) && !process.env.DATABASE_URL)) {
    return Response.json(
      { success: false, error: "domain persistence and grants unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  let rawTickets: Array<Record<string, unknown>>;
  try {
    rawTickets = await fetchTenantRawTickets(cleanTenant);
  } catch (err) {
    return Response.json(
      { success: false, error: "ticket repository schema or database unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }
  const found = rawTickets.find((t) => t.id === id || t.ticketRef === id);

  if (!found) {
    return Response.json(
      { success: false, error: "ticket not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    );
  }

  return Response.json(
    {
      success: true,
      ticket: projectTicketForActor(found, payload.actor.id),
      actor: payload.actor.id,
    },
    {
      status: 200,
      headers: { "cache-control": "no-store" },
    }
  );
}
