import {
  handleRuntimeTicketCreate,
  handleRuntimeTicketList,
} from "@/lib/service-app/runtime-http";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => handleRuntimeTicketList(request);
export const POST = (request: Request) => handleRuntimeTicketCreate(request);
