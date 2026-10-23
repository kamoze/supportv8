import { describe, it, expect, vi } from "vitest";
import {
  deriveIssueFromInteractionActivity,
  processSupportInteraction,
  InteractionWorker,
  TerminalInteractionError,
} from "@/lib/temporal/interaction-workflow";
import type { NormalizedInteractionInput, SupportIntelligenceRepository } from "@/lib/types";

describe("Temporal Interaction Workflow & Activities", () => {
  const tenantId = "tenant_wf_alpha";
  const eventId = "evt_wf_101";

  const sampleInteraction: NormalizedInteractionInput = {
    eventId,
    tenantId,
    accountId: "acc_wf_1",
    connectionId: "conn_zk_1",
    connectorKey: "zendesk",
    source: "zendesk",
    sourceReference: "ticket-9988",
    customerReference: "cust-5544",
    sourceUrl: "https://acme.zendesk.com/tickets/9988",
    text: "Urgent: Payment webhook timeout on production checkout.\nCustomer cannot complete purchase.",
    sender: "customer",
    occurredAt: "2026-10-21T12:00:00.000Z",
    receivedAt: "2026-10-21T12:00:01.000Z",
    correlationId: "corr-wf-101",
    raw: {
      customerName: "Jane Doe",
      priority: "high",
    },
  };

  it("derives durable issue and completes interaction when valid event exists", async () => {
    let completedIssueId: string | null = null;
    let completedEventId: string | null = null;

    const mockRepo: Partial<SupportIntelligenceRepository> = {
      getInteraction: vi.fn().mockResolvedValue(sampleInteraction),
      completeInteraction: vi.fn().mockImplementation(async (_tenantId, evId, issId) => {
        completedEventId = evId;
        completedIssueId = issId;
      }),
      failInteraction: vi.fn(),
    };

    let sessionTenant: string | null = null;
    let querySql: string | null = null;
    let queryParams: any[] | null = null;

    const mockClient = {
      withTenantSession: vi.fn().mockImplementation(async (tenant: string, callback: any) => {
        sessionTenant = tenant;
        const mockSession = {
          query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
            querySql = sql;
            queryParams = params;
            return [{ id: "iss_mock_derived_123" }];
          }),
        };
        return await callback(mockSession);
      }),
    } as any;

    const result = await deriveIssueFromInteractionActivity(eventId, tenantId, {
      repository: mockRepo as SupportIntelligenceRepository,
      client: mockClient,
    });

    expect(result.issueId).toBe("iss_mock_derived_123");
    expect(mockRepo.getInteraction).toHaveBeenCalledWith(tenantId, eventId);
    expect(mockClient.withTenantSession).toHaveBeenCalledWith(tenantId, expect.any(Function));
    expect(sessionTenant).toBe(tenantId);
    expect(querySql).toContain("INSERT INTO supportv8.issues");
    expect(querySql).toContain("ON CONFLICT (tenant_id, source, external_id)");

    // Verify params passed to SQL insert
    expect(queryParams![1]).toBe(tenantId); // tenant_id
    expect(queryParams![2]).toBe("zendesk"); // source
    expect(queryParams![3]).toBe("ticket-9988"); // external_id
    expect(queryParams![4]).toBe("https://acme.zendesk.com/tickets/9988"); // source_url
    expect(queryParams![5]).toBe("cust-5544"); // customer_ref
    expect(queryParams![6]).toBe("Jane Doe"); // customer_name (from raw.customerName)
    expect(queryParams![7]).toBe("Urgent: Payment webhook timeout on production checkout."); // summary (first line)

    // Verify interaction marked complete
    expect(mockRepo.completeInteraction).toHaveBeenCalledWith(
      tenantId,
      eventId,
      "iss_mock_derived_123"
    );
    expect(completedEventId).toBe(eventId);
    expect(completedIssueId).toBe("iss_mock_derived_123");
  });

  it("fails interaction and throws TerminalInteractionError when event is not found", async () => {
    let failedEventId: string | null = null;
    let failedErrorCode: string | null = null;

    const mockRepo: Partial<SupportIntelligenceRepository> = {
      getInteraction: vi.fn().mockResolvedValue(null),
      completeInteraction: vi.fn(),
      failInteraction: vi.fn().mockImplementation(async (_tenantId, evId, code) => {
        failedEventId = evId;
        failedErrorCode = code;
      }),
    };

    const mockClient = {
      withTenantSession: vi.fn(),
    } as any;

    await expect(
      deriveIssueFromInteractionActivity("non_existent_event", tenantId, {
        repository: mockRepo as SupportIntelligenceRepository,
        client: mockClient,
      })
    ).rejects.toThrow(TerminalInteractionError);

    expect(failedEventId).toBe("non_existent_event");
    expect(failedErrorCode).toBe("EVENT_NOT_FOUND");
    expect(mockClient.withTenantSession).not.toHaveBeenCalled();
    expect(mockRepo.completeInteraction).not.toHaveBeenCalled();
  });

  it("fails interaction and throws TerminalInteractionError on invalid event data", async () => {
    const invalidInteraction = {
      ...sampleInteraction,
      sourceReference: "", // missing required reference
    };

    const mockRepo: Partial<SupportIntelligenceRepository> = {
      getInteraction: vi.fn().mockResolvedValue(invalidInteraction),
      completeInteraction: vi.fn(),
      failInteraction: vi.fn(),
    };

    const mockClient = {
      withTenantSession: vi.fn(),
    } as any;

    await expect(
      deriveIssueFromInteractionActivity(eventId, tenantId, {
        repository: mockRepo as SupportIntelligenceRepository,
        client: mockClient,
      })
    ).rejects.toThrow(TerminalInteractionError);

    expect(mockRepo.failInteraction).toHaveBeenCalledWith(
      tenantId,
      eventId,
      "INVALID_EVENT_DATA",
      expect.any(String)
    );
  });

  it("handles fallback summary when text has empty first line", async () => {
    const blankTextInteraction = {
      ...sampleInteraction,
      text: "",
    };

    let summaryParam: string | null = null;

    const mockRepo: Partial<SupportIntelligenceRepository> = {
      getInteraction: vi.fn().mockResolvedValue(blankTextInteraction),
      completeInteraction: vi.fn(),
    };

    const mockClient = {
      withTenantSession: vi.fn().mockImplementation(async (_tenant: string, callback: any) => {
        const mockSession = {
          query: vi.fn().mockImplementation(async (_sql: string, params: any[]) => {
            summaryParam = params[7];
            return [{ id: "iss_blank_summary" }];
          }),
        };
        return await callback(mockSession);
      }),
    } as any;

    const result = await deriveIssueFromInteractionActivity(eventId, tenantId, {
      repository: mockRepo as SupportIntelligenceRepository,
      client: mockClient,
    });

    expect(result.issueId).toBe("iss_blank_summary");
    expect(summaryParam).toBe("Zendesk ticket ticket-9988");
  });

  it("processSupportInteraction delegates to deriveIssueFromInteractionActivity", async () => {
    const mockRepo: Partial<SupportIntelligenceRepository> = {
      getInteraction: vi.fn().mockResolvedValue(sampleInteraction),
      completeInteraction: vi.fn(),
    };

    const mockClient = {
      withTenantSession: vi.fn().mockImplementation(async (_tenant: string, callback: any) => {
        const mockSession = {
          query: vi.fn().mockResolvedValue([{ id: "iss_proc_1" }]),
        };
        return await callback(mockSession);
      }),
    } as any;

    const res = await processSupportInteraction(eventId, tenantId, {
      repository: mockRepo as SupportIntelligenceRepository,
      client: mockClient,
    });

    expect(res.issueId).toBe("iss_proc_1");
  });

  describe("InteractionWorker lifecycle", () => {
    it("processNext claims and processes an interaction for a specific tenant", async () => {
      const mockRepo: Partial<SupportIntelligenceRepository> = {
        claimInteractionsForTenant: vi.fn().mockResolvedValue([sampleInteraction]),
        getInteraction: vi.fn().mockResolvedValue(sampleInteraction),
        completeInteraction: vi.fn(),
      };

      const mockClient = {
        withTenantSession: vi.fn().mockImplementation(async (_tenant: string, callback: any) => {
          const mockSession = {
            query: vi.fn().mockResolvedValue([{ id: "iss_claimed_1" }]),
          };
          return await callback(mockSession);
        }),
      } as any;

      const worker = new InteractionWorker(
        mockRepo as SupportIntelligenceRepository,
        mockClient,
        "test-worker-1"
      );

      const result = await worker.processNext(tenantId);
      expect(result.processed).toBe(1);
      expect(result.issueId).toBe("iss_claimed_1");
      expect(mockRepo.claimInteractionsForTenant).toHaveBeenCalledWith(tenantId, 1, "test-worker-1");
      expect(mockRepo.completeInteraction).toHaveBeenCalledWith(tenantId, eventId, "iss_claimed_1");
    });

    it("processNext returns { processed: 0 } when no pending events are found", async () => {
      const mockRepo: Partial<SupportIntelligenceRepository> = {
        claimInteractions: vi.fn().mockResolvedValue([]),
      };

      const worker = new InteractionWorker(mockRepo as SupportIntelligenceRepository);
      const result = await worker.processNext();
      expect(result.processed).toBe(0);
    });
  });
});
