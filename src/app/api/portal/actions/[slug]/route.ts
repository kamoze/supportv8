import { NextResponse } from "next/server";
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import { portalRepository } from "@/lib/db/portal-repository";
import {
  portalClientIdentity,
  portalRateLimiter,
  PortalRateLimitError,
  PortalRateLimitUnavailableError,
} from "@/lib/portal/rate-limit";
import { PortalQueryError, runPublicKnowledgeQuery } from "@/lib/portal/public-query";

const ACTION_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const startedAt = Date.now();
  let tenantId: string | undefined;
  let actionSlug = "unknown";
  try {
    const tenant = await resolveRequestTenant(request);
    tenantId = tenant.tenantId;
    const params = await context.params;
    actionSlug = decodeURIComponent(params.slug || "").toLowerCase();
    if (!ACTION_SLUG.test(actionSlug)) {
      return NextResponse.json({ success: false, error: "This help link is invalid." }, { status: 404 });
    }
    await portalRateLimiter.enforce({
      tenantId: tenant.tenantId,
      clientIdentity: portalClientIdentity(request),
    });
    const action = await portalRepository.getPublishedAction(tenant.tenantId, tenant.tenantSlug, actionSlug);
    if (!action) {
      return NextResponse.json({ success: false, error: "This help link is no longer published." }, { status: 404 });
    }

    if (action.mode === "chat") {
      await portalRepository.recordActionEvent({
        tenantId: tenant.tenantId,
        actionSlug,
        outcome: "success",
        durationMs: Date.now() - startedAt,
      }).catch(() => undefined);
      return NextResponse.json(
        { success: true, mode: "chat", label: action.label },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = await runPublicKnowledgeQuery({
      tenantId: tenant.tenantId,
      tenantSlug: tenant.tenantSlug,
      question: action.prompt,
      categories: action.categories,
    });
    await portalRepository.recordActionEvent({
      tenantId: tenant.tenantId,
      actionSlug,
      outcome: result.citations.length ? "success" : "no_results",
      durationMs: Date.now() - startedAt,
    }).catch(() => undefined);
    return NextResponse.json(
      {
        success: true,
        mode: "answer",
        label: action.label,
        citations: result.citations,
        message: result.citations.length
          ? "Verified resources matched this help topic."
          : "No published guidance matched this topic. Start a chat and the support team can help.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (tenantId) {
      await portalRepository.recordActionEvent({
        tenantId,
        actionSlug,
        outcome: error instanceof PortalRateLimitError ? "rate_limited" : "unavailable",
        durationMs: Date.now() - startedAt,
      }).catch(() => undefined);
    }
    if (error instanceof PortalRateLimitError || error instanceof PortalRateLimitUnavailableError || error instanceof PortalQueryError) {
      const headers = error instanceof PortalRateLimitError ? { "Retry-After": String(error.retryAfterSeconds) } : undefined;
      return NextResponse.json({ success: false, error: error.message }, { status: error.status, headers });
    }
    return NextResponse.json({ success: false, error: "This help topic is temporarily unavailable. Start a chat for help." }, { status: 503 });
  }
}
