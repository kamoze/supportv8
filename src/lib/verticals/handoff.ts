import { marketplaceService } from "../services/marketplace-service";

export interface HandoffPayload {
  sourceVertical:
    | "supportv8"
    | "servicev8-runtime"
    | "runtime"
    | "orderv8"
    | "carev8"
    | "propv8"
    | "growthv8"
    | "dominion"
    | "workerv8"
    | "meridianV8"
    | (string & {});
  targetVertical:
    | "supportv8"
    | "orderv8"
    | "carev8"
    | "propv8"
    | "growthv8"
    | "dominion"
    | "workerv8"
    | "meridianV8"
    | (string & {});
  tenantId: string;
  accountId?: string;
  boundApps?: string[];
  boundAppId?: string;
  customerRef?: string;
  issueId?: string;
  problemId?: string;
  summary?: string;
  requestedAction?: string;
  authUserId?: string;
  timestamp?: string;
  planId?: string;
}

export class VerticalHandoffService {
  private readonly handoffs = new Map<string, HandoffPayload>();

  private resolveTargetBase(targetVertical: string): string {
    switch (targetVertical) {
      case "supportv8":
        return process.env.SUPPORTV8_URL || "https://support.servicev8.internal";
      case "carev8":
        return process.env.CAREV8_URL || "https://carev8.servicev8.internal";
      case "propv8":
        return process.env.PROPV8_URL || "https://propv8.servicev8.internal";
      case "growthv8":
        return process.env.GROWTHV8_URL || "https://growthv8.servicev8.internal";
      case "dominion":
        return process.env.DOMINION_URL || "https://dominion.servicev8.internal";
      case "workerv8":
        return process.env.WORKERV8_URL || "https://workerv8.servicev8.internal";
      case "servicev8-runtime":
      case "runtime":
        return process.env.RUNTIME_URL || "https://runtime.servicev8.internal";
      default:
        return process.env.ORDERV8_URL || "https://orderv8.servicev8.internal";
    }
  }

  public createHandoffToken(payload: HandoffPayload): {
    token: string;
    targetUrl: string;
    payload: HandoffPayload;
    sharedCredits?: number;
  } {
    const timestamp = payload.timestamp || new Date().toISOString();
    const fullPayload: HandoffPayload = {
      ...payload,
      timestamp,
      summary: payload.summary || `Handoff from ${payload.sourceVertical} to ${payload.targetVertical}`,
      customerRef: payload.customerRef || "C-1001",
    };

    let sharedCredits: number | undefined;
    if (fullPayload.accountId) {
      const reg = marketplaceService.registerSourceHandoff({
        sourceVertical: fullPayload.sourceVertical,
        targetVertical: fullPayload.targetVertical,
        accountId: fullPayload.accountId,
        tenantSlug: fullPayload.tenantId,
        boundApps: fullPayload.boundApps,
        planId: fullPayload.planId,
      });
      sharedCredits = reg.sharedCredits;
    }

    const base64Data = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
    const token = `sv8_ho_${Date.now()}_${base64Data}`;
    this.handoffs.set(token, fullPayload);
    const targetBase = this.resolveTargetBase(fullPayload.targetVertical);
    const targetUrl = `${targetBase}/handoff?token=${token}&payload=${base64Data}`;

    return { token, targetUrl, payload: fullPayload, sharedCredits };
  }

  public parseHandoffPayload(tokenOrPayload: string): HandoffPayload | null {
    try {
      if (!tokenOrPayload) return null;
      if (this.handoffs.has(tokenOrPayload)) {
        return this.handoffs.get(tokenOrPayload)!;
      }
      if (tokenOrPayload.startsWith("sv8_ho_")) {
        const parts = tokenOrPayload.split("_");
        if (parts.length >= 4) {
          const raw = parts.slice(3).join("_");
          const jsonStr = Buffer.from(raw, "base64url").toString("utf8");
          return JSON.parse(jsonStr) as HandoffPayload;
        }
      }
      let jsonStr: string;
      if (tokenOrPayload.includes("{")) {
        jsonStr = tokenOrPayload;
      } else {
        jsonStr = Buffer.from(tokenOrPayload, "base64url").toString("utf8");
      }
      return JSON.parse(jsonStr) as HandoffPayload;
    } catch {
      return null;
    }
  }

  public acceptHandoff(tokenOrPayload: string | HandoffPayload): {
    success: boolean;
    payload: HandoffPayload;
    sharedCredits: number;
    boundApps: string[];
  } {
    const payload =
      typeof tokenOrPayload === "string"
        ? this.parseHandoffPayload(tokenOrPayload)
        : tokenOrPayload;

    if (!payload) {
      throw new Error("Invalid or unparseable handoff payload");
    }

    const accountId = payload.accountId || `acct_ho_${payload.tenantId}`;
    const reg = marketplaceService.registerSourceHandoff({
      sourceVertical: payload.sourceVertical,
      targetVertical: payload.targetVertical,
      accountId,
      tenantSlug: payload.tenantId,
      boundApps: payload.boundApps,
      planId: payload.planId,
    });

    return {
      success: true,
      payload: { ...payload, accountId },
      sharedCredits: reg.sharedCredits,
      boundApps: reg.boundApps,
    };
  }
}

export const verticalHandoff = new VerticalHandoffService();
