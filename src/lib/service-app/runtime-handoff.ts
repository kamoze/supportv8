import { verifyRuntimeSupportHandoffToken } from "./runtime-handoff-claims";
import {
  runtimeHandoffReplayStore,
  type RuntimeHandoffReplayStore,
} from "./runtime-handoff-replay";
import {
  resolveOperationalSupportAccess,
  type OperationalSupportAccess,
  type SupportRuntimeScope,
} from "./runtime-access";
import {
  intersectSupportRoles,
  runtimeSupportCookie,
  signRuntimeSupportSession,
  trustedRuntimeTenantHost,
} from "./runtime-session";
import { marketplaceService } from "../services/marketplace-service";
type Deps = {
  handoffSecret?: string;
  sessionSecret?: string;
  now?: () => number;
  replay?: RuntimeHandoffReplayStore;
  resolve?: (
    scope: SupportRuntimeScope,
  ) => Promise<OperationalSupportAccess | null>;
};
const secure = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};
const denied = () =>
  Response.json(
    { error: "handoff unavailable — return to Runtime and try again" },
    { status: 401, headers: secure },
  );
export async function handleRuntimeSupportHandoff(
  request: Request,
  deps: Deps = {},
): Promise<Response> {
  if (request.method !== "GET")
    return new Response(null, {
      status: 405,
      headers: { ...secure, allow: "GET" },
    });
  if (
    ["purpose", "sec-purpose", "x-purpose", "x-moz"].some((h) =>
      /prefetch|prerender/i.test(request.headers.get(h) ?? ""),
    )
  )
    return denied();
  try {
    const url = new URL(request.url);
    if (
      url.searchParams.getAll("token").length !== 1 ||
      [...url.searchParams.keys()].some((k) => k !== "token")
    )
      return denied();
    const now = deps.now ?? (() => Math.floor(Date.now() / 1000));
    const claims = verifyRuntimeSupportHandoffToken(
      url.searchParams.get("token"),
      deps.handoffSecret ?? process.env.SUPPORTV8_SERVICE_APP_RUNTIME_SECRET,
      now(),
    );
    if (
      !claims ||
      trustedRuntimeTenantHost(request) !==
        `${claims.tenantDomain}.support.servicev8.com`
    )
      return denied();
    const scope: SupportRuntimeScope = {
      accountId: claims.accountId,
      tenantId: claims.tenantId,
      verticalId: "runtime",
      installationId: claims.installationId,
      workspaceId: claims.externalWorkspaceId,
      subject: claims.sub,
    };
    const access = await (deps.resolve ?? resolveOperationalSupportAccess)(
      scope,
    );
    if (!access || access.domain !== claims.tenantDomain || claims.exp <= now())
      return denied();
    const roleCap = intersectSupportRoles(claims.role, access.capability);
    if (
      !roleCap ||
      !(await (deps.replay ?? runtimeHandoffReplayStore).consume(claims)) ||
      claims.exp <= now()
    )
      return denied();
    const session = signRuntimeSupportSession(
      {
        accountId: scope.accountId,
        tenantId: scope.tenantId,
        verticalId: "runtime",
        installationId: scope.installationId,
        workspaceId: scope.workspaceId,
        sub: scope.subject,
        roleCap,
        tenantDomain: claims.tenantDomain,
      },
      deps.sessionSecret ?? process.env.SUPPORTV8_RUNTIME_SESSION_SECRET,
      now(),
    );
    if (!session) return denied();

    const poolAccountId = access.poolAccountId || (claims as any).poolAccountId || claims.accountId;
    const effectivePlanId = access.planId || (claims as any).planId || (claims as any).plan || (claims as any).tier;
    const effectiveCredits = access.credits ?? (claims as any).credits;
    const boundApps = [
      "servicev8-runtime",
      "runtime",
      "supportv8",
      ...(((claims as any).boundApps as string[]) || []),
    ];

    marketplaceService.registerSourceHandoff({
      sourceVertical: "servicev8-runtime",
      sourceApp: "runtime",
      targetVertical: "supportv8",
      targetApp: "supportv8",
      accountId: poolAccountId,
      workspaceId: claims.externalWorkspaceId,
      tenantSlug: claims.tenantDomain,
      boundApps,
      planId: effectivePlanId,
      credits: effectiveCredits,
    });

    void marketplaceService.syncForgeAccountPool(poolAccountId).catch(() => null);

    return new Response(null, {
      status: 303,
      headers: {
        ...secure,
        location: "/?view=cockpit&handoff=runtime",
        "set-cookie": runtimeSupportCookie(session),
      },
    });
  } catch {
    return denied();
  }
}
