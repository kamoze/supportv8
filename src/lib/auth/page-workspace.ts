import { workspaceDiscoveryLimiter } from "./workspace-discovery-limit";
import { browserTenantSlugFromHostname, validateIngressHost } from "../tenant-host";
import { discoverWorkspace } from "./workspace-discovery";

/** DNS shape is not registration. Resolve before rendering any tenant page. */
export async function resolvePageWorkspace(input: Pick<Headers, "get">, lookup = discoverWorkspace): Promise<"global" | "tenant" | "missing" | "unavailable"> {
  const checked = validateIngressHost(input.get("host"), input.get("x-forwarded-host"));
  if (!checked.valid || !checked.hostname || input.get("forwarded")) return "missing";
  const slug = browserTenantSlugFromHostname(checked.hostname);
  if (!slug) return "global";
  try {
    await workspaceDiscoveryLimiter.enforce(slug);
    const workspace = await lookup(slug);
    if (!workspace) return "missing";
    const origin = new URL(workspace.url);
    if (workspace.status !== "active" || workspace.slug !== slug || origin.protocol !== "https:" || origin.host !== checked.hostname || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) return "missing";
    return "tenant";
  } catch { return "unavailable"; }
}
