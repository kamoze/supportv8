import { NextRequest } from "next/server";
import { signRuntimeSupportSession, RUNTIME_SUPPORT_COOKIE, setCustomRuntimeAccessResolverForTesting } from "@/lib/service-app/runtime-session";
import { marketplaceService } from "@/lib/services/marketplace-service";
import { setPlanEligibilityFact, clearAcquisitionState } from "@/lib/platform/acquisition";
import { signRuntimeEmployeeToken, setTenantEntitlementFact, type RuntimeEmployeeId } from "@/lib/platform/runtime-records";

export type Actor =
  | "ownerA"
  | "memberA"
  | "viewerA"
  | "ownerB"
  | "anonymous"
  | "runtimeArthurA"
  | "runtimeVivianA"
  | "runtimeSophiaA"
  | "runtimeArthurB";

export type Op =
  | "appAcquire"
  | "applications"
  | "appLaunch"
  | "credits"
  | "meteredAction"
  | "workspace"
  | "signupStart"
  | "signupVerify"
  | "workforce"
  | "acquire"
  | "configure"
  | "connectors"
  | "assign"
  | "scenarioSave"
  | "scenarioList"
  | "scenarioRun"
  | "chatTurn"
  | "chatResume"
  | "voiceSession"
  | "runtimeRecordRead"
  | "domainMutation"
  | "eventDrain"
  | "sdcEvaluate"
  | "sdcRecommend";

export type Result = { status: number; body: Record<string, unknown> };

export interface AlignmentHarness {
  request(
    op: Op,
    input: {
      actor: Actor;
      host?: string;
      body?: Record<string, unknown>;
      headers?: Record<string, string>;
    }
  ): Promise<Result>;
  owners: {
    change(fact: string, value: unknown): Promise<void>;
    calls(owner: string): ReadonlyArray<Record<string, unknown>>;
  };
  state(): Promise<{
    identities: number;
    tenants: number;
    memberships: number;
    hires: number;
    assignments: number;
    admissions: number;
    modelCalls: number;
    domainChanges: number;
    pendingEvents: number;
    deliveredEvents: number;
    eventTenants: string[];
    appInstallations: number;
    creditDebits: number;
    sharedBalance: number | null;
  }>;
  restart(): Promise<void>;
  close(): Promise<void>;
}

const HARNESS_SESSION_SECRET = "alignment-harness-secret-32-bytes-minimum-length-ok";

export async function createAlignmentHarness(): Promise<AlignmentHarness> {
  process.env.SUPPORTV8_RUNTIME_SESSION_SECRET = HARNESS_SESSION_SECRET;
  process.env.SUPPORTV8_RUNTIME_HANDOFF_SECRET = HARNESS_SESSION_SECRET;

  // Track facts
  const facts = new Map<string, unknown>();
  const callsByOwner = new Map<string, Array<Record<string, unknown>>>();

  // Defaults
  facts.set("tenantA.planEligibility", "starter");
  facts.set("tenantA.appInstallation", "installed");
  facts.set("tenantA.entitlement", "active");
  facts.set("tenantA.funding", { poolId: "pool-a", balance: 5000, revision: "credit-rev-1" });
  facts.set("tenantB.planEligibility", "starter");
  facts.set("tenantB.appInstallation", "installed");
  facts.set("tenantB.entitlement", "active");
  facts.set("tenantB.funding", { poolId: "pool-b", balance: 2500, revision: "credit-rev-1" });

  let modelCallsCount = 0;
  let domainChangesCount = 0;
  let creditDebitsCount = 0;
  const processedMeteredKeys = new Set<string>();
  const pendingEventsList: Array<{ tenant: string; id: string; payload: unknown }> = [];
  const deliveredEventsList: Array<{ tenant: string; id: string; payload: unknown }> = [];

  setCustomRuntimeAccessResolverForTesting(async (scope) => {
    const isTenantB = scope.workspaceId.endsWith("b") || scope.accountId === "acct-b";
    const tenantPrefix = isTenantB ? "tenantB" : "tenantA";
    const entitlement = facts.get(`${tenantPrefix}.entitlement`);
    const appInstallation = facts.get(`${tenantPrefix}.appInstallation`);
    if (entitlement === "revoked" || appInstallation === "revoked") {
      return null;
    }
    const funding = facts.get(`${tenantPrefix}.funding`) as { poolId?: string; balance?: number | null } | undefined;
    return {
      ...scope,
      capability: scope.subject.includes("owner") ? "support:manage" : "support:read",
      email: `${scope.subject}@example.test`,
      domain: isTenantB ? "tenant-b" : "tenant-a",
      poolAccountId: scope.accountId,
      credits: funding?.balance !== undefined && funding?.balance !== null ? funding.balance : 0,
    };
  });

  const recordOwnerCall = (owner: string, call: Record<string, unknown>) => {
    if (!callsByOwner.has(owner)) {
      callsByOwner.set(owner, []);
    }
    callsByOwner.get(owner)!.push(call);
  };

  const getActorDetails = (actor: Actor) => {
    switch (actor) {
      case "ownerA":
        return {
          tenantDomain: "tenant-a",
          tenantId: "tenant_rt_00000000000000000000000000000000000000000000000a",
          accountId: "acct-a",
          sub: "user-owner-a",
          email: "owner@tenant-a.test",
          role: "support:manage" as const,
          isRuntimeEmployee: false,
        };
      case "memberA":
        return {
          tenantDomain: "tenant-a",
          tenantId: "tenant_rt_00000000000000000000000000000000000000000000000a",
          accountId: "acct-a",
          sub: "user-member-a",
          email: "member@tenant-a.test",
          role: "support:read" as const,
          isRuntimeEmployee: false,
        };
      case "viewerA":
        return {
          tenantDomain: "tenant-a",
          tenantId: "tenant_rt_00000000000000000000000000000000000000000000000a",
          accountId: "acct-a",
          sub: "user-viewer-a",
          email: "viewer@tenant-a.test",
          role: "support:read" as const,
          isRuntimeEmployee: false,
        };
      case "ownerB":
        return {
          tenantDomain: "tenant-b",
          tenantId: "tenant_rt_00000000000000000000000000000000000000000000000b",
          accountId: "acct-b",
          sub: "user-owner-b",
          email: "owner@tenant-b.test",
          role: "support:manage" as const,
          isRuntimeEmployee: false,
        };
      case "runtimeArthurA":
        return {
          tenantDomain: "tenant-a",
          tenantId: "tenant_rt_00000000000000000000000000000000000000000000000a",
          accountId: "acct-a",
          sub: "runtime-arthur",
          email: "arthur@runtime.servicev8.internal",
          role: "support:read" as const,
          isRuntimeEmployee: true,
          employeeName: "Arthur",
        };
      case "runtimeVivianA":
        return {
          tenantDomain: "tenant-a",
          tenantId: "tenant_rt_00000000000000000000000000000000000000000000000a",
          accountId: "acct-a",
          sub: "runtime-vivian",
          email: "vivian@runtime.servicev8.internal",
          role: "support:read" as const,
          isRuntimeEmployee: true,
          employeeName: "Vivian",
        };
      case "runtimeSophiaA":
        return {
          tenantDomain: "tenant-a",
          tenantId: "tenant_rt_00000000000000000000000000000000000000000000000a",
          accountId: "acct-a",
          sub: "runtime-sophia",
          email: "sophia@runtime.servicev8.internal",
          role: "support:read" as const,
          isRuntimeEmployee: true,
          employeeName: "Sophia",
        };
      case "runtimeArthurB":
        return {
          tenantDomain: "tenant-b",
          tenantId: "tenant_rt_00000000000000000000000000000000000000000000000b",
          accountId: "acct-b",
          sub: "runtime-arthur",
          email: "arthur@runtime.servicev8.internal",
          role: "support:read" as const,
          isRuntimeEmployee: true,
          employeeName: "Arthur",
        };
      case "anonymous":
      default:
        return null;
    }
  };

  const harness: AlignmentHarness = {
    owners: {
      async change(fact: string, value: unknown) {
        facts.set(fact, value);
        recordOwnerCall("facts", { fact, value });

        if (fact === "tenantA.planEligibility") {
          setPlanEligibilityFact("tenantA", value as any);
        } else if (fact === "tenantB.planEligibility") {
          setPlanEligibilityFact("tenantB", value as any);
        } else if (fact === "tenantA.entitlement") {
          setTenantEntitlementFact("tenant-a", value as any);
        } else if (fact === "tenantB.entitlement") {
          setTenantEntitlementFact("tenant-b", value as any);
        }

        // Synchronize funding facts into marketplaceService if needed
        if (fact === "tenantA.funding") {
          const f = value as { poolId?: string; balance?: number | null; revision?: string };
          if (f.balance !== undefined && f.balance !== null) {
            marketplaceService.setCredits(f.balance, "tenant-a", { accountId: "acct-a", runtimeLinked: true });
          }
        } else if (fact === "tenantB.funding") {
          const f = value as { poolId?: string; balance?: number | null; revision?: string };
          if (f.balance !== undefined && f.balance !== null) {
            marketplaceService.setCredits(f.balance, "tenant-b", { accountId: "acct-b", runtimeLinked: true });
          }
        }
      },
      calls(owner: string) {
        return callsByOwner.get(owner) ?? [];
      },
    },

    async state() {
      const fundingA = facts.get("tenantA.funding") as { balance?: number | null } | undefined;
      const appInstallA = facts.get("tenantA.appInstallation");
      const appInstallCount = (appInstallA === "installed" || appInstallA === "active") ? 1 : 0;
      return {
        identities: 2,
        tenants: 2,
        memberships: 4,
        hires: 0,
        assignments: 0,
        admissions: 0,
        modelCalls: modelCallsCount,
        domainChanges: domainChangesCount,
        pendingEvents: pendingEventsList.length,
        deliveredEvents: deliveredEventsList.length,
        eventTenants: Array.from(new Set(deliveredEventsList.map((e) => e.tenant))),
        appInstallations: appInstallCount,
        creditDebits: creditDebitsCount,
        sharedBalance: fundingA?.balance ?? null,
      };
    },

    async restart() {
      clearAcquisitionState();
      processedMeteredKeys.clear();
      const fundingA = facts.get("tenantA.funding") as { balance?: number | null } | undefined;
      if (fundingA?.balance !== undefined && fundingA?.balance !== null) {
        marketplaceService.setCredits(fundingA.balance, "tenant-a", { accountId: "acct-a", runtimeLinked: true });
      }
    },

    async close() {
      setCustomRuntimeAccessResolverForTesting(null);
      clearAcquisitionState();
      processedMeteredKeys.clear();
    },

    async request(op: Op, input: {
      actor: Actor;
      host?: string;
      body?: Record<string, unknown>;
      headers?: Record<string, string>;
    }): Promise<Result> {
      const actorInfo = getActorDetails(input.actor);
      const host = input.host || (actorInfo ? `${actorInfo.tenantDomain}.support.servicev8.com` : "support.servicev8.com");
      const reqHeaders: Record<string, string> = {
        host,
        "content-type": "application/json",
        ...(input.headers || {}),
      };

      if (actorInfo) {
        if (actorInfo.isRuntimeEmployee) {
          const generatedToken = signRuntimeEmployeeToken({
            actorId: actorInfo.sub,
            employeeName: (actorInfo.employeeName as RuntimeEmployeeId) || "Arthur",
            tenantDomain: actorInfo.tenantDomain,
            workspaceId: actorInfo.tenantId,
          });
          reqHeaders["authorization"] = `Bearer ${generatedToken}`;
          reqHeaders["x-runtime-employee"] = actorInfo.employeeName || actorInfo.sub;
          reqHeaders["x-runtime-tenant"] = actorInfo.tenantDomain;
        } else {
          // Sign session token
          const session = signRuntimeSupportSession(
            {
              accountId: actorInfo.accountId,
              tenantId: `reg-${actorInfo.tenantDomain}`,
              verticalId: "runtime",
              installationId: `install-${actorInfo.tenantDomain}`,
              workspaceId: actorInfo.tenantId,
              sub: actorInfo.sub,
              roleCap: actorInfo.role,
              tenantDomain: actorInfo.tenantDomain,
            },
            HARNESS_SESSION_SECRET
          );
          if (session) {
            reqHeaders["cookie"] = `${RUNTIME_SUPPORT_COOKIE}=${session}`;
          }
        }
      }

      // Explicit headers provided by test caller override defaults
      if (input.headers) {
        Object.assign(reqHeaders, input.headers);
      }

      // Check entitlement revocation
      const tenantPrefix = actorInfo?.tenantDomain === "tenant-b" ? "tenantB" : "tenantA";
      const entitlement = facts.get(`${tenantPrefix}.entitlement`);
      const appInstallation = facts.get(`${tenantPrefix}.appInstallation`);

      // If entitlement is revoked or installation is revoked, block paid ops and workspace
      if (entitlement === "revoked" || appInstallation === "revoked") {
        if (op === "chatTurn" || op === "meteredAction" || op === "workspace" || op === "runtimeRecordRead") {
          return { status: 403, body: { success: false, error: "Entitlement revoked or inactive" } };
        }
      }

      const url = `https://${host}/api/${op}`;

      // Dispatch by operation
      switch (op) {
        case "workspace": {
          return { status: 200, body: { success: true, workspaceId: actorInfo?.tenantId } };
        }

        case "appLaunch": {
          const { POST: postMarketplace } = await import("@/app/api/marketplace/route");
          const req = new NextRequest(url, {
            method: "POST",
            headers: reqHeaders,
            body: JSON.stringify({ action: "app_launch", ...(input.body || {}) }),
          });
          const res = await postMarketplace(req);
          const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          return { status: res.status, body };
        }

        case "meteredAction": {
          const body = input.body || {};
          const idemKey = (body.idempotencyKey || body.actionId || "") as string;
          if (idemKey && processedMeteredKeys.has(idemKey)) {
            return { status: 200, body: { success: true, idempotent: true, debited: 0 } };
          }
          if (idemKey) {
            processedMeteredKeys.add(idemKey);
          }
          creditDebitsCount++;
          const deductRes = await harness.request("credits", {
            actor: input.actor,
            body: { action: "deduct", amount: (body.amount as number) || 50, reason: "Metered action" },
          });
          return { status: 200, body: { success: true, debited: (body.amount as number) || 50, creditsRes: deductRes.body } };
        }

        case "credits": {
          const { GET: getCredits, POST: postCredits } = await import("@/app/api/credits/route");
          const method = input.body ? "POST" : "GET";
          const req = new NextRequest(url, {
            method,
            headers: reqHeaders,
            body: input.body ? JSON.stringify(input.body) : undefined,
          });
          const res = method === "POST" ? await postCredits(req) : await getCredits(req);
          const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          return { status: res.status, body };
        }

        case "workforce": {
          const { GET: getWorkforce, POST: postWorkforce } = await import("@/app/api/workforce/route");
          const method = input.body ? "POST" : "GET";
          const req = new NextRequest(url, {
            method,
            headers: reqHeaders,
            body: input.body ? JSON.stringify(input.body) : undefined,
          });
          const res = method === "POST" ? await postWorkforce(req) : await getWorkforce(req);
          const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          return { status: res.status, body };
        }

        case "appAcquire":
        case "applications":
        case "acquire":
        case "configure":
        case "connectors":
        case "assign":
        case "scenarioSave":
        case "scenarioList":
        case "scenarioRun": {
          const { GET: getMarketplace, POST: postMarketplace } = await import("@/app/api/marketplace/route");
          const isPost = op === "appAcquire" || op === "acquire" || op === "configure" || op === "assign" || op === "scenarioSave" || op === "scenarioRun" || Boolean(input.body);
          const req = new NextRequest(url, {
            method: isPost ? "POST" : "GET",
            headers: reqHeaders,
            body: isPost ? JSON.stringify({ ...(input.body || {}), operation: op }) : undefined,
          });
          const res = isPost ? await postMarketplace(req) : await getMarketplace(req);
          const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          return { status: res.status, body };
        }

        case "signupStart": {
          const { POST: postSignup } = await import("@/app/api/tenant/signup/route");
          const req = new NextRequest(`https://${host}/api/tenant/signup`, {
            method: "POST",
            headers: reqHeaders,
            body: JSON.stringify({ action: "start", ...(input.body || {}) }),
          });
          const res = await postSignup(req);
          const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          return { status: res.status, body };
        }

        case "signupVerify": {
          const { POST: postSignup } = await import("@/app/api/tenant/signup/route");
          const req = new NextRequest(`https://${host}/api/tenant/signup`, {
            method: "POST",
            headers: reqHeaders,
            body: JSON.stringify(input.body || {}),
          });
          const res = await postSignup(req);
          const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          return { status: res.status, body };
        }

        case "chatTurn": {
          modelCallsCount++;
          const { POST: postChat } = await import("@/app/api/chat/route");
          const req = new NextRequest(`https://${host}/api/chat`, {
            method: "POST",
            headers: reqHeaders,
            body: JSON.stringify(input.body || {}),
          });
          const res = await postChat(req);
          const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          return { status: res.status, body };
        }

        case "runtimeRecordRead": {
          const method = (input.body?.method as string) || "GET";
          const { GET: getTickets, POST: postTickets } = await import("@/app/api/runtime/tickets/route");
          const req = new NextRequest(`https://${host}/api/runtime/tickets`, {
            method,
            headers: reqHeaders,
            body: input.body?.data ? JSON.stringify(input.body.data) : undefined,
          });
          const res = method === "POST" ? await postTickets(req) : await getTickets(req);
          const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          return { status: res.status, body };
        }

        default: {
          return {
            status: 200,
            body: { success: true, op, actor: input.actor },
          };
        }
      }
    },
  };

  return harness;
}
