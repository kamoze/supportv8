import { NextResponse } from "next/server";
import { ChatWorkflowService } from "@/lib/services/chat-workflow-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, sender, senderName, content } = body;

    if (!sessionId || !content) {
      return NextResponse.json({ error: "Missing sessionId or content" }, { status: 400 });
    }

    const result = ChatWorkflowService.sendMessage({
      sessionId,
      sender: sender || "customer",
      senderName: senderName || "Customer",
      content,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to post message" }, { status: 500 });
  }
}
