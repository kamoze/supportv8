import { NextRequest } from "next/server";
import { RequestAuthError, resolveRequestTenant } from "@/lib/auth/request-tenant";
import { chatRepository } from "@/lib/db/chat-repository";
import {
  ChatRealtimeUnavailableError,
  chatRealtime,
  type ChatRealtimeEvent,
} from "@/lib/chat/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sseFrame(event: string, data: unknown, id?: string): Uint8Array {
  const encoder = new TextEncoder();
  const lines = [id ? `id: ${id}` : "", `event: ${event}`, `data: ${JSON.stringify(data)}`, ""];
  return encoder.encode(`${lines.filter(Boolean).join("\n")}\n`);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId") || "";
    const tenant = await resolveRequestTenant(request);
    const session = sessionId
      ? await chatRepository.getSessionPage(tenant.tenantId, sessionId, { limit: 1 })
      : null;
    if (!session) {
      return Response.json({ error: "Chat session not found" }, { status: 404 });
    }

    const lastEventId = request.headers.get("last-event-id") || searchParams.get("lastEventId");
    let cleanup: () => Promise<void> = async () => undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let heartbeat: ReturnType<typeof setInterval> | undefined;
        let unsubscribe: (() => Promise<void>) | undefined;

        const close = async () => {
          if (closed) return;
          closed = true;
          if (heartbeat) clearInterval(heartbeat);
          request.signal.removeEventListener("abort", abort);
          await unsubscribe?.().catch(() => undefined);
          try {
            controller.close();
          } catch {
            // Connection already closed by the client.
          }
        };
        const send = (event: ChatRealtimeEvent) => {
          if (!closed) controller.enqueue(sseFrame("chat", event, event.streamId));
        };
        const abort = () => void close();
        cleanup = close;
        request.signal.addEventListener("abort", abort, { once: true });

        void (async () => {
          try {
            unsubscribe = await chatRealtime.subscribe(tenant.tenantId, sessionId, send);
            if (closed) {
              await unsubscribe();
              return;
            }
            const replay = await chatRealtime.replay(tenant.tenantId, sessionId, lastEventId);
            for (const event of replay) send(event);
            if (!closed) controller.enqueue(sseFrame("ready", { sessionId }));
            heartbeat = setInterval(() => {
              if (!closed) controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
            }, 15_000);
          } catch (error) {
            if (!closed) {
              controller.enqueue(
                sseFrame("degraded", {
                  error: error instanceof Error ? error.message : "Live updates unavailable",
                }),
              );
            }
            await close();
          }
        })();
      },
      cancel() {
        return cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const status =
      error instanceof RequestAuthError
        ? error.status
        : error instanceof ChatRealtimeUnavailableError
          ? 503
          : 500;
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to open live chat updates" },
      { status },
    );
  }
}
