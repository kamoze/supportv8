import { nativeLoginAuthority } from "./native-login-authority";
import { discoverWorkspace } from "./workspace-discovery";
import { browserTenantSlugFromHostname, validateIngressHost } from "../tenant-host";
import { BotProofError } from "./bot-transaction";

/** Never trust a tenant header, query value or an ID decoded from a slug. */
export async function authorizeCanonicalRequestWorkspace(claims: Record<string, unknown>, request: Request) {
  const host = validateIngressHost(request.headers.get("host"), request.headers.get("x-forwarded-host"));
  const slug = host.valid && host.hostname && !request.headers.get("forwarded") ? browserTenantSlugFromHostname(host.hostname) : null;
  if (!slug) throw new BotProofError(403, "A registered workspace host is required.");
  const registered = await discoverWorkspace(slug);
  return nativeLoginAuthority.current(registered, claims, request);
}
