import { NextRequest } from "next/server";
import { EdgeGateway } from "@/lib/chatbot/api-edge/edge-gateway";
import { ChannelAdapters } from "@/lib/chatbot/experience/channel-adapters";
import { AgentRuntimeCore } from "@/lib/chatbot/agent-runtime/agent-runtime-core";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const authContext = EdgeGateway.authenticateRequest(req.headers, url);

  if (authContext.rateLimitRemaining <= 0) {
    return new Response(
      EdgeGateway.formatSse("error", { error: "Too Many Requests (Rate limit exceeded)" }),
      {
        status: 429,
        headers: { "Content-Type": "text/event-stream" },
      }
    );
  }

  const body = await req.json();
  const payload = ChannelAdapters.normalizeWebChat({
    tenantId: authContext.tenantId,
    sessionId: body.sessionId || `sess_${Date.now()}`,
    stream: body.stream || "customers",
    customerName: body.customerName || "Customer",
    customerEmail: body.customerEmail,
    content: body.content || "",
    isMobile: body.isMobile,
  });

  const encoder = new TextEncoder();
  const customReadable = new ReadableStream({
    async start(controller) {
      try {
        await AgentRuntimeCore.processMessage(payload, (event, data) => {
          const sseString = EdgeGateway.formatSse(event, data);
          controller.enqueue(encoder.encode(sseString));
        });
      } catch (err: any) {
        controller.enqueue(
          encoder.encode(
            EdgeGateway.formatSse("error", { error: err.message || "Agent Runtime Execution Error" })
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(customReadable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-tenant-id": authContext.tenantId,
    },
  });
}
