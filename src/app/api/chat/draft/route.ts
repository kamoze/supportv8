import { NextRequest, NextResponse } from "next/server";
import { RequestAuthError, resolveRequestTenant } from "@/lib/auth/request-tenant";
import {
  DemoRateLimitError,
  DemoRateLimitUnavailableError,
  demoRateLimiter,
  requestClientIdentity,
} from "@/lib/auth/demo-rate-limit";
import {
  ChatIngressError,
  isRestrictedDemoOperator,
  requireBoundedContentLength,
  requireChatOperatorRole,
} from "@/lib/chatbot/security/ingress-security";
import { chatRepository } from "@/lib/db/chat-repository";
import {
  ForgeGateway,
  forgeGatewayConfigFromEnv,
} from "@/lib/agentic-runtime/gateway/forge-gateway";
import {
  extractCreditsUsed,
  extractNarrative,
  isBudgetExhausted,
} from "@/lib/agentic-runtime/gateway/completion";
import {
  DRAFT_CHANNELS,
  DRAFT_TONES,
  buildDraftSystemPrompt,
  buildSafeFallbackDraft,
  sanitizeModelDraft,
  type DraftChannel,
  type DraftFallbackReason,
  type DraftTone,
} from "@/lib/chat/draft-reply";

const DEMO_HIRE_IDS: Record<string, string> = {
  acme: "hi_supportv8_demo_acme",
  meridian: "hi_supportv8_demo_meridian",
};

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

function isDraftChannel(value: unknown): value is DraftChannel {
  return typeof value === "string" && (DRAFT_CHANNELS as readonly string[]).includes(value);
}

function isDraftTone(value: unknown): value is DraftTone {
  return typeof value === "string" && (DRAFT_TONES as readonly string[]).includes(value);
}

function fallback(
  customerName: string,
  channel: DraftChannel,
  reason: DraftFallbackReason,
) {
  return NextResponse.json({
    success: true,
    data: {
      draft: buildSafeFallbackDraft(customerName, channel),
      source: "fallback",
      reason,
      creditsUsed: 0,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    requireBoundedContentLength(request.headers.get("content-length"));
    const tenant = await resolveRequestTenant(request, { requireAuthentication: true });
    requireChatOperatorRole(tenant);

    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const channel = isDraftChannel(body.channel) ? body.channel : null;
    const tone = isDraftTone(body.tone) ? body.tone : null;
    if (!SESSION_ID_PATTERN.test(sessionId) || !channel || !tone) {
      return NextResponse.json(
        { success: false, error: "A valid chat session, reply channel, and tone are required." },
        { status: 400 },
      );
    }

    // The browser supplies only an opaque id. The transcript is loaded inside
    // the authenticated tenant session so a forged body cannot poison a draft
    // with another workspace's messages.
    const page = await chatRepository.getSessionPage(tenant.tenantId, sessionId, { limit: 30 });
    if (!page) {
      return NextResponse.json({ success: false, error: "Chat session not found." }, { status: 404 });
    }
    const session = page.session;

    if (isRestrictedDemoOperator(tenant)) {
      try {
        await demoRateLimiter.enforce({
          action: "draft",
          tenantId: tenant.tenantId,
          clientIdentity: requestClientIdentity(request),
          perMinute: 6,
          perHour: 20,
        });
      } catch (error) {
        if (error instanceof DemoRateLimitError || error instanceof DemoRateLimitUnavailableError) {
          return fallback(session.customerName, channel, "usage_limited");
        }
        throw error;
      }
    }

    const instanceId = DEMO_HIRE_IDS[tenant.tenantSlug];
    const forgeConfig = forgeGatewayConfigFromEnv();
    if (!instanceId || !forgeConfig) {
      return fallback(session.customerName, channel, "runtime_unavailable");
    }

    const forge = new ForgeGateway(forgeConfig);
    const hire = await forge.getHire(tenant.tenantId, instanceId);
    if (!hire || hire.vertical !== "supportv8" || hire.status !== "active") {
      return fallback(session.customerName, channel, "runtime_unavailable");
    }
    if (hire.budget.exhausted || hire.budget.remaining <= 0) {
      return fallback(session.customerName, channel, "allowance_exhausted");
    }

    const completion = await forge.complete(tenant.tenantId, {
      instanceId,
      feature: "chat_reply_draft",
      maxTokens: channel === "email" ? 700 : 300,
      messages: [
        { role: "system", content: buildDraftSystemPrompt(session, channel, tone) },
        { role: "user", content: "Draft the next operator reply." },
      ],
    });
    if (!completion) {
      return fallback(session.customerName, channel, "runtime_unavailable");
    }
    if (isBudgetExhausted(completion)) {
      return fallback(session.customerName, channel, "allowance_exhausted");
    }

    const draft = sanitizeModelDraft(extractNarrative(completion), channel);
    if (!draft || draft === "Task complete.") {
      return fallback(session.customerName, channel, "runtime_unavailable");
    }

    return NextResponse.json({
      success: true,
      data: {
        draft,
        source: "llm",
        creditsUsed: extractCreditsUsed(completion),
      },
    });
  } catch (error) {
    if (error instanceof RequestAuthError || error instanceof ChatIngressError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, error: "Unable to prepare a reply draft." },
      { status: 500 },
    );
  }
}
