/**
 * supportV8 Cross-Vertical SSO & Context Handoff Adapter
 * Seamlessly transitions customer issues and actions to other ServiceV8 verticals (carev8, orderv8, propv8, growthv8, dominion).
 */

export interface HandoffPayload {
  sourceVertical: "supportv8";
  targetVertical: "orderv8" | "carev8" | "propv8" | "growthv8" | "dominion" | "meridianV8";
  tenantId: string;
  customerRef: string;
  issueId?: string;
  problemId?: string;
  summary: string;
  requestedAction?: string;
  authUserId: string;
  timestamp: string;
}

export class VerticalHandoffService {
  public createHandoffToken(payload: HandoffPayload): { token: string; targetUrl: string } {
    const base64Data = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const token = `sv8_ho_${Date.now()}_${base64Data.slice(0, 32)}`;

    let targetBase = "https://orderv8.servicev8.internal";
    if (payload.targetVertical === "carev8") targetBase = "https://carev8.servicev8.internal";
    else if (payload.targetVertical === "propv8") targetBase = "https://propv8.servicev8.internal";
    else if (payload.targetVertical === "growthv8") targetBase = "https://growthv8.servicev8.internal";
    else if (payload.targetVertical === "dominion") targetBase = "https://dominion.servicev8.internal";

    const targetUrl = `${targetBase}/handoff?token=${token}&payload=${base64Data}`;

    return { token, targetUrl };
  }
}

export const verticalHandoff = new VerticalHandoffService();
