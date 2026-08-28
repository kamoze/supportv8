import type { WarmVoiceTransferPacket } from "./types";
import { WorkforceGovernance } from "./governance";

export class WarmVoiceTransferEngine {
  /**
   * Constructs a warm voice transfer packet with acoustic tuning and supervisor whisper metadata
   */
  static buildTransferPacket(params: {
    callSid: string;
    callerNumber: string;
    customerName: string;
    employeeId: string;
    sentimentScore: number;
    issueSummary: string;
    suggestedAction: string;
  }): WarmVoiceTransferPacket {
    const employee = WorkforceGovernance.getEmployee(params.employeeId);

    const whisperSummary = `Caller ${params.customerName} (${params.callerNumber}) on line. Sentiment: ${Math.round(
      params.sentimentScore * 100
    )}%. Issue: ${params.issueSummary}. Suggested: ${params.suggestedAction}.`;

    return {
      callSid: params.callSid,
      callerNumber: params.callerNumber,
      customerName: params.customerName,
      sentimentScore: params.sentimentScore,
      summaryWhisper: whisperSummary,
      suggestedAction: params.suggestedAction,
      supervisorExtension: "x8001",
      sipHeaders: {
        "X-ServiceV8-CallSid": params.callSid,
        "X-ServiceV8-Tenant": "tenant_default",
        "X-ServiceV8-Employee": employee.name,
        "X-ServiceV8-Supervisor": employee.supervisorEmail,
        "X-ServiceV8-Whisper": encodeURIComponent(whisperSummary),
        "X-ServiceV8-PitchShift": employee.acousticPitchShift.toString(),
      },
    };
  }
}
