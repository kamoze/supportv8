import { executeSupportDomainAction } from "@/lib/service-app/domain-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return executeSupportDomainAction(request);
}
