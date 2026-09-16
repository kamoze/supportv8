import { handleManagedSupport } from "@/lib/service-app/managed-support";
import { managedSupportAuthenticatorFromEnv } from "@/lib/service-app/managed-support-auth";
import {
  ManagedSupportAuthority,
  ManagedSupportTicketReader,
} from "@/lib/service-app/managed-support-authority";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const authority = new ManagedSupportAuthority(),
  tickets = new ManagedSupportTicketReader();
export function POST(request: Request) {
  return handleManagedSupport(request, {
    authenticate: managedSupportAuthenticatorFromEnv(),
    verifySource: (mode, target, source, reference) =>
      authority.verifySource(mode, target, source, reference),
    lifecycle: (target) => authority.lifecycle(target),
    verify: (target, operation) => authority.verify(target, operation),
    lookup: (target, reference) => tickets.lookup(target, reference),
  });
}
