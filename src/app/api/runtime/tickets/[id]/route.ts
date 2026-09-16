import {
  handleRuntimeTicketDetail,
  handleRuntimeTicketUpdate,
} from "@/lib/service-app/runtime-http";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRuntimeTicketDetail(request, (await params).id);
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRuntimeTicketUpdate(request, (await params).id);
}
