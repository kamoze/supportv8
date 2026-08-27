import { NextResponse } from "next/server";
import { ChatWorkflowService } from "@/lib/services/chat-workflow-service";
import type { ChatStreamType } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenant = searchParams.get("tenant") || "tenant_default";
  const sessionId = searchParams.get("sessionId");

  if (sessionId) {
    const session = ChatWorkflowService.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ session });
  }

  const sessions = ChatWorkflowService.listSessions(tenant);
  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenantDomain, stream, customerName, customerEmail, intakeData } = body;

    if (!stream || !customerName || !customerEmail) {
      return NextResponse.json(
        { error: "Missing required fields: stream, customerName, customerEmail" },
        { status: 400 }
      );
    }

    const session = ChatWorkflowService.startSession({
      tenantDomain: tenantDomain || "tenant_default",
      stream: stream as ChatStreamType,
      customerName,
      customerEmail,
      intakeData: intakeData || {},
    });

    return NextResponse.json({ success: true, session });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create chat session" }, { status: 500 });
  }
}
