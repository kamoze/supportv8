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

export async function POST(request: Request) {
  const startedAt = Date.now();
  let tenantId: string | undefined;
  try {
    const tenant = await resolveRequestTenant(request);
    tenantId = tenant.tenantId;
    await portalRateLimiter.enforce({
      tenantId: tenant.tenantId,
      clientIdentity: portalClientIdentity(request),
    });
    const body = await request.json().catch(() => ({}));
    const result = await runPublicKnowledgeQuery({
      tenantId: tenant.tenantId,
      tenantSlug: tenant.tenantSlug,
      question: body.query,
    });
    await portalRepository.recordActionEvent({
      tenantId: tenant.tenantId,
      actionSlug: "__search__",
      outcome: result.citations.length ? "success" : "no_results",
      durationMs: Date.now() - startedAt,
    }).catch(() => undefined);
    return NextResponse.json(
      {
        success: true,
        query: result.query,
        citations: result.citations,
        message: result.citations.length
          ? "Verified resources matched your question."
          : "No published guidance matched. Start a chat and the support team can help.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (tenantId) {
      const outcome = error instanceof PortalRateLimitError ? "rate_limited" : "unavailable";
      await portalRepository.recordActionEvent({
        tenantId,
        actionSlug: "__search__",
        outcome,
        durationMs: Date.now() - startedAt,
      }).catch(() => undefined);
    }
    if (error instanceof PortalRateLimitError || error instanceof PortalRateLimitUnavailableError || error instanceof PortalQueryError) {
      const headers = error instanceof PortalRateLimitError ? { "Retry-After": String(error.retryAfterSeconds) } : undefined;
      return NextResponse.json({ success: false, error: error.message }, { status: error.status, headers });
    }
    return NextResponse.json({ success: false, error: "Support search is temporarily unavailable. Start a chat for help." }, { status: 503 });
  }
}
