import { handleRuntimeSupportHandoff } from "@/lib/service-app/runtime-handoff";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => handleRuntimeSupportHandoff(request);
export const POST = (request: Request) => handleRuntimeSupportHandoff(request);
