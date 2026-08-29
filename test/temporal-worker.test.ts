import { describe, it, expect } from "vitest";
import { SUPPORT_SCHEDULED_EVENTS, ensureTemporalSchedules } from "../src/lib/temporal/schedules";
import { TASK_QUEUE, TEMPORAL_NAMESPACE } from "../src/lib/temporal/config";

describe("SupportV8 Temporal Worker & Scheduled Sweeper Engine", () => {
  it("should define scheduled events matching required periodic cron intervals and args", () => {
    expect(SUPPORT_SCHEDULED_EVENTS.length).toBe(3);

    const staleSweep = SUPPORT_SCHEDULED_EVENTS.find((e) => e.scheduleId === "stale-work-sweep");
    expect(staleSweep).toBeDefined();
    expect(staleSweep?.workflowType).toBe("staleWorkSweepWorkflow");
    expect(staleSweep?.spec.intervals?.[0].every).toBe("10 minutes");
    expect(staleSweep?.args).toBeDefined();

    const problemCorr = SUPPORT_SCHEDULED_EVENTS.find((e) => e.scheduleId === "proactive-problem-correlation");
    expect(problemCorr).toBeDefined();
    expect(problemCorr?.workflowType).toBe("proactiveBroadcastWorkflow");
    expect(problemCorr?.spec.intervals?.[0].every).toBe("15 minutes");
    expect(problemCorr?.args).toBeDefined();

    const dailyRag = SUPPORT_SCHEDULED_EVENTS.find((e) => e.scheduleId === "daily-knowledge-rag-sync");
    expect(dailyRag).toBeDefined();
    expect(dailyRag?.workflowType).toBe("dailyKnowledgeRagSyncWorkflow");
    expect(dailyRag?.spec.cronExpressions?.[0]).toBe("0 0 * * *");
    expect(dailyRag?.args).toBeDefined();
  });

  it("should target supportv8-spine task queue and default namespace", () => {
    expect(TASK_QUEUE).toBe("supportv8-spine");
    expect(TEMPORAL_NAMESPACE).toBe("default");
  });

  it("should handle idempotent schedule registration and updates", async () => {
    // Mock client
    const mockClient = {
      schedule: {
        create: async (params: any) => {
          if (params.scheduleId === "stale-work-sweep") {
            const err: any = new Error("Schedule already running");
            err.name = "ScheduleAlreadyRunning";
            throw err;
          }
          return { scheduleId: params.scheduleId };
        },
        getHandle: (_id: string) => ({
          update: async (_cb: any) => {},
        }),
      },
    };

    const res = await ensureTemporalSchedules(mockClient as any);
    expect(res.existing).toContain("stale-work-sweep");
    expect(res.created).toContain("proactive-problem-correlation");
    expect(res.created).toContain("daily-knowledge-rag-sync");
  });
});
