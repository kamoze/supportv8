/**
 * supportV8 Proactive Communication Service
 * Basis: EP17 (SV8-160 to SV8-164)
 */

import { db } from "../db/mock-data";
import { globalActionGateway } from "../runtime/action-gateway-client";
import { OP_PROBLEM_NOTIFY } from "../runtime/operations";

export interface ProactiveDraft {
  problemId: string;
  problemTitle: string;
  audienceCount: number;
  messageType: "acknowledgement" | "workaround" | "recovery";
  subject: string;
  body: string;
  channels: ("email" | "sms" | "in_app")[];
}

export class ProactiveCommsService {
  public generateDraft(problemId: string, messageType: "acknowledgement" | "workaround" | "recovery" = "acknowledgement"): ProactiveDraft {
    const problem = db.problems.find((p) => p.id === problemId);
    if (!problem) {
      throw new Error(`Problem ${problemId} not found`);
    }

    let subject = `Service Advisory: ${problem.title}`;
    let body = `Dear Customer,\n\nOur automated support intelligence has detected an issue affecting ${problem.title}. Our engineering team is currently deploying a mitigation.`;

    if (messageType === "workaround") {
      subject = `Workaround Available: ${problem.title}`;
      body = `Dear Customer,\n\nRegarding the ongoing issue (${problem.title}), we recommend the following interim workaround:\n- ${problem.recommendedActions[0] || "Please check back shortly."}`;
    } else if (messageType === "recovery") {
      subject = `Resolved: ${problem.title}`;
      body = `Dear Customer,\n\nWe have verified that the issue (${problem.title}) is now fully resolved. All services are operating normally.`;
    }

    return {
      problemId: problem.id,
      problemTitle: problem.title,
      audienceCount: problem.affectedCustomerCount,
      messageType,
      subject,
      body,
      channels: ["email", "in_app"],
    };
  }

  public async broadcastNotification(draft: ProactiveDraft, actorId = "comms_lead"): Promise<{ success: boolean; message: string; auditId?: string }> {
    const problem = db.problems.find((p) => p.id === draft.problemId);
    if (!problem) {
      throw new Error(`Problem ${draft.problemId} not found`);
    }

    const result = await globalActionGateway.requestAction({
      tenantId: db.tenant.tenantId,
      actor: {
        id: actorId,
        type: "human",
        name: "Communications Lead",
      },
      operationId: OP_PROBLEM_NOTIFY,
      input: {
        problem_id: draft.problemId,
        message: draft.body,
        channels: draft.channels,
      },
    });

    if (result.success) {
      problem.communicationsCount += 1;
      return {
        success: true,
        message: `Proactive advisory '${draft.subject}' dispatched to ${draft.audienceCount} affected customers.`,
        auditId: result.auditId,
      };
    } else {
      return {
        success: false,
        message: `Broadcast failed: ${result.error}`,
        auditId: result.auditId,
      };
    }
  }
}

export const proactiveCommsService = new ProactiveCommsService();
