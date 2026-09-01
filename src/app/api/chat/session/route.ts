import { NextRequest, NextResponse } from "next/server";
import { chatRepository } from "@/lib/db/chat-repository";
import { RequestAuthError, resolveRequestTenant } from "@/lib/auth/request-tenant";
import {
  ChatIngressError,
  requireChatOperatorRole,
} from "@/lib/chatbot/security/ingress-security";
import type { ChatStreamType } from "@/lib/types";

const CHAT_STREAMS = new Set<ChatStreamType>(["contractors", "enquiries", "customers"]);

function sanitizeIntakeData(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value).slice(0, 50);
  const result: Record<string, string> = {};
  for (const [key, fieldValue] of entries) {
    if (/^[a-zA-Z0-9_-]{1,64}$/.test(key) && typeof fieldValue === "string") {
      result[key] = fieldValue.trim().slice(0, 5_000);
    }
  }
  return result;
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof ChatIngressError || error instanceof RequestAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const tenant = await resolveRequestTenant(request, {
      requireAuthentication: !sessionId,
    });

    if (sessionId) {
      const session = await chatRepository.getSession(tenant.tenantId, sessionId);
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      return NextResponse.json({ session });
    }

    requireChatOperatorRole(tenant);
    const sessions = await chatRepository.listSessions(tenant.tenantId);
    return NextResponse.json({ sessions });
  } catch (error) {
    return errorResponse(error, "Failed to load chat sessions");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stream, customerName, customerEmail, intakeData } = body;

    if (
      !CHAT_STREAMS.has(stream) ||
      typeof customerName !== "string" ||
      typeof customerEmail !== "string" ||
      !customerName.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())
    ) {
      return NextResponse.json(
        { error: "A valid stream, customer name, and customer email are required" },
        { status: 400 }
      );
    }
    if (customerName.length > 255 || customerEmail.length > 320) {
      return NextResponse.json({ error: "Customer name or email is too long" }, { status: 400 });
    }

    const tenant = await resolveRequestTenant(request);
    const session = await chatRepository.startSession({
      tenantId: tenant.tenantId,
      tenantSlug: tenant.tenantSlug,
      stream: stream as ChatStreamType,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim().toLowerCase(),
      intakeData: sanitizeIntakeData(intakeData),
    });

    return NextResponse.json({ success: true, session });
  } catch (error) {
    return errorResponse(error, "Failed to create chat session");
  }
}
