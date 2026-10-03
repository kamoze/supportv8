import { NextRequest, NextResponse } from "next/server";
import { extractClientToken, verifyClientToken } from "@/lib/auth/client-token";
import { db } from "@/lib/db/mock-data";
import { pgClient } from "@/lib/db/pg-client";

export interface ClientTicketSummary {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  assignedTo: string;
  publicNotes: string;
  priority?: string;
  createdAt?: string;
}

function matchesEmail(issue: any, clientEmail: string): boolean {
  const target = clientEmail.toLowerCase().trim();
  if (!target) return false;

  const emailCandidates = [
    issue.customerEmail,
    issue.customer_email,
    issue.email,
    typeof issue.intakeData === "object" ? issue.intakeData?.customerEmail : null,
    issue.customerRef,
  ];

  for (const candidate of emailCandidates) {
    if (typeof candidate === "string" && candidate.toLowerCase().trim() === target) {
      return true;
    }
  }

  return false;
}

function matchesTenant(issueTenantId?: string, tokenTenantSlug?: string): boolean {
  if (!issueTenantId || !tokenTenantSlug) return true;
  const cleanIssueTenant = issueTenantId.toLowerCase().replace(/^tenant_/, "").trim();
  const cleanTokenTenant = tokenTenantSlug.toLowerCase().replace(/^tenant_/, "").trim();

  if (cleanIssueTenant === cleanTokenTenant) return true;
  if (cleanIssueTenant === "default" && cleanTokenTenant === "acme") return true;
  if (cleanIssueTenant === "acme" && cleanTokenTenant === "default") return true;

  return false;
}

function mapToClientSummary(issue: any): ClientTicketSummary {
  const title =
    issue.title ||
    issue.summary ||
    "Support Request";

  const status =
    issue.status ||
    issue.sourceStatus ||
    issue.source_status ||
    "open";

  const rawUpdatedAt =
    issue.updatedAt ||
    issue.updated_at ||
    issue.createdAt ||
    issue.created_at ||
    new Date().toISOString();

  const updatedAt =
    typeof rawUpdatedAt === "string"
      ? rawUpdatedAt
      : new Date(rawUpdatedAt).toISOString();

  const assignedTo =
    issue.assignedTo ||
    issue.assigned_to ||
    issue.assignee ||
    issue.assignedAgent ||
    issue.assigned_agent ||
    "Support Team";

  const publicNotes =
    issue.publicNotes ||
    issue.public_notes ||
    issue.recommendedAction ||
    issue.recommended_action ||
    "Your issue has been validated and the support team is reviewing the resolution.";

  const ticket: ClientTicketSummary = {
    id: issue.id || issue.externalId || issue.external_id || "TCK-UNKNOWN",
    title,
    status,
    updatedAt,
    assignedTo,
    publicNotes,
  };

  if (issue.priority) {
    ticket.priority = issue.priority;
  }
  if (issue.createdAt || issue.created_at) {
    const rawCreatedAt = issue.createdAt || issue.created_at;
    ticket.createdAt =
      typeof rawCreatedAt === "string"
        ? rawCreatedAt
        : new Date(rawCreatedAt).toISOString();
  }

  return ticket;
}

export async function GET(req: NextRequest) {
  const token = extractClientToken(req);

  if (!token) {
    return NextResponse.json(
      { success: false, authenticated: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const payload = verifyClientToken(token);
  if (!payload) {
    return NextResponse.json(
      { success: false, authenticated: false, error: "Invalid or expired session token" },
      { status: 401 }
    );
  }

  const clientEmail = payload.email.trim().toLowerCase();
  const tokenTenant = payload.tenantSlug.trim().toLowerCase().replace(/^tenant_/, "");

  let rawIssues: any[] = [];

  if (process.env.DATABASE_URL) {
    try {
      const canonicalTenantId = payload.tenantSlug.startsWith("tenant_")
        ? payload.tenantSlug
        : `tenant_${payload.tenantSlug.replace(/[^a-z0-9_]/g, "_")}`;

      const rows = await pgClient.withTenantSession(canonicalTenantId, async (session) => {
        return await session.query(
          `SELECT i.id, i.summary, i.source_status, i.status, i.priority,
                  i.assigned_to, i.assigned_agent, i.recommended_action,
                  i.created_at, i.updated_at, s.customer_email, s.customer_name
             FROM supportv8.issues i
             LEFT JOIN supportv8.chat_sessions s ON s.issue_id = i.id AND s.tenant_id = i.tenant_id
            WHERE LOWER(s.customer_email) = $1 OR LOWER(i.customer_ref) = $1
            ORDER BY i.updated_at DESC
            LIMIT 100`,
          [clientEmail]
        );
      });

      if (rows && rows.length > 0) {
        rawIssues = rows;
      }
    } catch (dbErr) {
      console.warn("[PortalTickets] Postgres query failed, falling back to mock database:", dbErr);
    }
  }

  if (rawIssues.length === 0) {
    const mockPool = [...db.issues];
    if (typeof db.getTenantData === "function") {
      try {
        const tenantData = db.getTenantData(payload.tenantSlug);
        if (tenantData?.issues && Array.isArray(tenantData.issues)) {
          for (const iss of tenantData.issues) {
            if (!mockPool.some((existing) => existing.id === iss.id)) {
              mockPool.push(iss);
            }
          }
        }
      } catch {
        // ignore tenant data resolution errors
      }
    }

    rawIssues = mockPool.filter(
      (issue) => matchesEmail(issue, clientEmail) && matchesTenant(issue.tenantId, tokenTenant)
    );
  }

  const tickets = rawIssues
    .map(mapToClientSummary)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return NextResponse.json({
    success: true,
    tickets,
  });
}
