import { NextRequest, NextResponse } from "next/server";
import { issueService } from "@/lib/services/issue-service";
import { chatRepository } from "@/lib/db/chat-repository";
import { RequestAuthError, resolveRequestTenant } from "@/lib/auth/request-tenant";
import {
  ChatIngressError,
  requireChatOperatorRole,
  requirePersistentMutationRole,
} from "@/lib/chatbot/security/ingress-security";
import {
  emitSupportTicketEscalatedSignal,
  emitSupportTicketResolvedSignal,
} from "@/lib/signals/signal-agent";
import type { Issue, SentimentClass, SourceType } from "@/lib/types";
import { requireSameOrigin } from "@/lib/auth/account-error";

const hasDurableDatabase = () => Boolean(process.env.DATABASE_URL);

const ISSUE_STATUSES = new Set(["open", "in_progress", "escalated", "resolved", "closed"]);
const ISSUE_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const ISSUE_SENTIMENTS = new Set(["positive", "neutral", "frustrated", "angry", "urgent", "happy"]);

function sanitizeIssueUpdates(input: unknown): Partial<Issue> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const raw = input as Record<string, unknown>;
  const updates: Partial<Issue> = {};
  if (typeof raw.status === "string" && ISSUE_STATUSES.has(raw.status)) updates.status = raw.status;
  if (typeof raw.priority === "string" && ISSUE_PRIORITIES.has(raw.priority)) updates.priority = raw.priority as Issue["priority"];
  if (typeof raw.sentiment === "string" && ISSUE_SENTIMENTS.has(raw.sentiment)) updates.sentiment = raw.sentiment as Issue["sentiment"];
  for (const field of ["summary", "category", "assignedTo", "assignedAgent", "recommendedAction"] as const) {
    if (typeof raw[field] === "string") {
      (updates as Record<string, unknown>)[field] = raw[field].trim().slice(0, field === "summary" || field === "recommendedAction" ? 5_000 : 255);
    }
  }
  if (Array.isArray(raw.timeline) && JSON.stringify(raw.timeline).length <= 200_000) {
    updates.timeline = raw.timeline.slice(0, 500) as Issue["timeline"];
  }
  if (Array.isArray(raw.messages) && JSON.stringify(raw.messages).length <= 500_000) {
    updates.messages = raw.messages.slice(-500) as Issue["messages"];
  }
  return updates;
}

async function updateIssue(
  tenant: Awaited<ReturnType<typeof resolveRequestTenant>>,
  targetId: string,
  rawUpdates: unknown,
): Promise<Issue | undefined | null> {
  const updates = sanitizeIssueUpdates(rawUpdates);
  let updated: Issue | undefined | null;
  if (tenant.runtimeLinked) {
    requirePersistentMutationRole(tenant);
    updated = await chatRepository.updateWorkspaceIssue(tenant.tenantId, targetId, updates);
  } else {
    requirePersistentMutationRole(tenant);
    updated =
      (hasDurableDatabase()
        ? await chatRepository.updateChatIssue(tenant.tenantId, targetId, updates, true)
        : null) ||
      issueService.updateIssue(targetId, updates, tenant.tenantSlug);
  }

  if (updated) {
    const isResolved =
      updates.status === "resolved" ||
      updates.status === "closed" ||
      updated.status === "resolved" ||
      updated.status === "closed";
    const isEscalated =
      updates.status === "escalated" ||
      updates.priority === "urgent" ||
      updated.priority === "urgent";

    const emitTenantId =
      tenant.tenantId.startsWith("tenant_") ? tenant.tenantId : (tenant.tenantSlug || tenant.tenantId);

    if (isResolved) {
      void emitSupportTicketResolvedSignal({
        tenantId: emitTenantId,
        accountId: tenant.accountId,
        ticketId: updated.id,
        ticketRef: updated.externalId,
        resolutionSummary: updated.summary,
      }).catch((err) => console.warn("[Signal Outbox] Ticket resolved signal error:", err));
    } else if (isEscalated) {
      void emitSupportTicketEscalatedSignal({
        tenantId: emitTenantId,
        accountId: tenant.accountId,
        ticketId: updated.id,
        ticketRef: updated.externalId,
        customerName: updated.customerName,
        reason: updated.summary,
      }).catch((err) => console.warn("[Signal Outbox] Ticket escalation signal error:", err));
    }
  }

  return updated;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sentiment = searchParams.get("sentiment") as SentimentClass | undefined;
    const category = searchParams.get("category") || undefined;
    const source = searchParams.get("source") as SourceType | undefined;
    const problemId = searchParams.get("problemId") || undefined;
    const search = searchParams.get("search") || undefined;
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    requireChatOperatorRole(tenant);

    const [mockIssues, durableChatIssues] = await Promise.all([
      Promise.resolve(tenant.runtimeLinked ? [] : issueService.getAll({ sentiment, category, source, problemId, search, tenant: tenant.tenantSlug })),
      !hasDurableDatabase()
        ? Promise.resolve([])
        : tenant.runtimeLinked
        ? chatRepository.listWorkspaceIssues(tenant.tenantId)
        : chatRepository.listChatIssues(tenant.tenantId, undefined, true),
    ]);
    const filteredChatIssues = durableChatIssues.filter((issue) => {
      if (source && issue.source !== source) return false;
      if (sentiment && issue.sentiment !== sentiment) return false;
      if (category && issue.category !== category) return false;
      if (problemId && issue.problemId !== problemId) return false;
      if (search) {
        const haystack = `${issue.externalId} ${issue.customerName} ${issue.summary}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
    const durableIds = new Set(filteredChatIssues.map((issue) => issue.id));
    const issues = [...filteredChatIssues, ...mockIssues.filter((issue) => !durableIds.has(issue.id))];
    return NextResponse.json({
      success: true,
      count: issues.length,
      data: issues,
    });
  } catch (error) {
    if (error instanceof ChatIngressError || error instanceof RequestAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load issues" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, issueId, id, updates, ...rest } = body;
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    requireChatOperatorRole(tenant);

    if (action === "update" || action === "resolve" || action === "change_status") {
      const targetId = issueId || id;
      if (typeof targetId !== "string" || !targetId.trim()) {
        return NextResponse.json({ success: false, error: "Missing issue ID" }, { status: 400 });
      }
      const payload = updates || (action === "resolve" ? { status: "resolved" } : rest);
      const updated = await updateIssue(tenant, targetId, payload);
      if (!updated) {
        return NextResponse.json({ success: false, error: `Issue ${targetId} not found` }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: `Issue ${targetId} updated successfully`,
        data: updated,
      });
    }

    requirePersistentMutationRole(tenant);
    if (action === "create_manual") {
      requireSameOrigin(req);
      const { customerName, customerEmail = "", summary, stream = "customers", priority = "normal", channel = "manual_entry" } = body;
      if (typeof customerName !== "string" || !customerName.trim() || customerName.length > 255 ||
          typeof summary !== "string" || !summary.trim() || summary.length > 5000 ||
          typeof customerEmail !== "string" || customerEmail.length > 254 ||
          (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) ||
          !["customers", "contractors", "enquiries"].includes(stream) || !ISSUE_PRIORITIES.has(priority) ||
          !["web_chat", "email", "manual_entry", "field_dispatch", "chat", "manual", "voice"].includes(channel)) {
        return NextResponse.json({ success: false, error: "Enter a customer name, summary, valid email (if provided), stream, and priority." }, { status: 400 });
      }
      if (!hasDurableDatabase()) throw new ChatIngressError("Ticket storage is unavailable. Your ticket has not been saved; please try again.", 503);

      const normalizedSource: "manual" | "voice" | "email" | "chat" =
        channel === "manual_entry" || channel === "manual"
          ? "manual"
          : channel === "field_dispatch" || channel === "voice"
          ? "voice"
          : channel === "email"
          ? "email"
          : "chat";

      const session = await chatRepository.startSession({
        tenantId: tenant.tenantId,
        tenantSlug: tenant.tenantSlug,
        accountId: tenant.accountId,
        stream,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        intakeData: { details: summary.trim(), origin: "operator_workdesk", ingressChannel: channel },
        channel: channel === "email" ? "email" : normalizedSource === "voice" ? "voice" : normalizedSource === "manual" ? "manual" : "web",
        source: normalizedSource,
        manual: { operatorName: tenant.displayName || "Support operator", priority },
      });
      const [issue] = await chatRepository.listChatIssues(tenant.tenantId, session.id);
      if (!issue) throw new Error("Ticket was saved but could not be loaded. Refresh Workdesk before retrying.");

      return NextResponse.json({ success: true, data: issue }, { status: 201 });
    }
    if (tenant.runtimeLinked) return NextResponse.json({success:false,error:"Use create_manual to save a workspace ticket."},{status:400});
    const issue = issueService.createFromInteraction({ ...body, tenant: tenant.tenantSlug });
    return NextResponse.json({
      success: true,
      data: issue,
    });
  } catch (err: unknown) {
    if (err instanceof ChatIngressError || err instanceof RequestAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to process issue" },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, issueId, ...updates } = body;
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    requireChatOperatorRole(tenant);
    const targetId = id || issueId;
    if (!targetId) {
      return NextResponse.json({ success: false, error: "Missing issue ID" }, { status: 400 });
    }
    const updated = await updateIssue(tenant, targetId, updates);
    if (!updated) {
      return NextResponse.json({ success: false, error: `Issue ${targetId} not found` }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (err: unknown) {
    if (err instanceof ChatIngressError || err instanceof RequestAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to update issue" },
      { status: 400 }
    );
  }
}
