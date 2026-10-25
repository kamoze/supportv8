import { createHash } from "node:crypto";
import { type OtpBackend } from "./otp-store";
import { durableBotBackend } from "./bot-transaction";
import { WorkspaceLookupError } from "../tenant-resolver";
import { withinBotDeadline } from "./bot-gateway";
export function createWorkspaceDiscoveryLimiter(backend: OtpBackend) {
  return async (slug: string): Promise<void> => {
    try {
      const key = createHash("sha256").update(slug.trim().toLowerCase()).digest("hex"), signal = AbortSignal.timeout(3000);
      const global = await withinBotDeadline(backend.increment("supportv8:workspace-lookup:v1:global", 60), signal);
      const workspace = await withinBotDeadline(backend.increment(`supportv8:workspace-lookup:v1:${key}`, 60), signal);
      if (global > 600 || workspace > 60) throw new WorkspaceLookupError("Too many workspace lookups. Please try again shortly.", "workspace_lookup_rate_limited", 429);
    } catch (error) { if (error instanceof WorkspaceLookupError) throw error; throw new WorkspaceLookupError("Workspace lookup is temporarily unavailable.", "workspace_lookup_unavailable", 503); }
  };
}
export const workspaceDiscoveryLimiter = { enforce: (slug: string) => createWorkspaceDiscoveryLimiter(durableBotBackend())(slug) };
