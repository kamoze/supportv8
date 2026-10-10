import {
  handleRuntimeTicketCreate,
  handleRuntimeTicketList,
} from "@/lib/service-app/runtime-http";
import { handleRuntimeEmployeeRecordRead } from "@/lib/platform/runtime-records";

export const dynamic = "force-dynamic";

export const GET = (request: Request) => {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return handleRuntimeEmployeeRecordRead(request);
  }
  return handleRuntimeTicketList(request);
};

export const POST = (request: Request) => {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return Response.json(
      { success: false, error: "Read credentials cannot authorize mutations" },
      { status: 403, headers: { "cache-control": "no-store" } }
    );
  }
  return handleRuntimeTicketCreate(request);
};
