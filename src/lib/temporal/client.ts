/**
 * supportV8 Temporal Client
 */

export class TemporalWorkflowClient {
  private address: string;

  constructor(address = process.env.TEMPORAL_ADDRESS || "localhost:7233") {
    this.address = address;
  }

  public async triggerStaleSweep(): Promise<{ workflowId: string; status: string }> {
    const workflowId = `wf_stale_sweep_${Date.now()}`;
    return {
      workflowId,
      status: "started",
    };
  }

  public async triggerKnowledgeRefresh(): Promise<{ workflowId: string; status: string }> {
    const workflowId = `wf_kb_refresh_${Date.now()}`;
    return {
      workflowId,
      status: "started",
    };
  }
}

export const temporalClient = new TemporalWorkflowClient();
