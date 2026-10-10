import {
  handleRuntimeTicketDetail,
  handleRuntimeTicketUpdate,
} from "@/lib/service-app/runtime-http";
import { handleRuntimeEmployeeRecordDetail } from "@/lib/platform/runtime-records";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return handleRuntimeEmployeeRecordDetail(request, (await params).id);
  }
  return handleRuntimeTicketDetail(request, (await params).id);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return Response.json(
      { success: false, error: "Read credentials cannot authorize mutations" },
      { status: 403, headers: { "cache-control": "no-store" } }
    );
  }
  return handleRuntimeTicketUpdate(request, (await params).id);
}
