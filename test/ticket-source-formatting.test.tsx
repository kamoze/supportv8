// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import { chatRepository, ChatRepository } from "@/lib/db/chat-repository";
import { POST } from "@/app/api/issues/route";
import { FocusedWorkspaceView } from "@/components/views/FocusedWorkspaceView";
import type { Issue, SourceType } from "@/lib/types";

vi.mock("@/lib/auth/request-tenant", async original => ({
  ...await original<typeof import("@/lib/auth/request-tenant")>(),
  resolveRequestTenant: vi.fn(),
}));

describe("Ticket source and external ID formatting suite", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://test");
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      tenantId: "tenant_alpha",
      tenantSlug: "alpha",
      authenticated: true,
      userId: "operator1",
      displayName: "Jordan Operator",
      roles: ["support_operator"],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe("API POST /api/issues (create_manual)", () => {
    it.each([
      { channel: "manual_entry", expectedPrefix: "SV8-MANUAL-", expectedSource: "manual" as SourceType },
      { channel: "manual", expectedPrefix: "SV8-MANUAL-", expectedSource: "manual" as SourceType },
      { channel: "email", expectedPrefix: "SV8-EMAIL-", expectedSource: "email" as SourceType },
      { channel: "field_dispatch", expectedPrefix: "SV8-VOICE-", expectedSource: "voice" as SourceType },
      { channel: "voice", expectedPrefix: "SV8-VOICE-", expectedSource: "voice" as SourceType },
      { channel: "web_chat", expectedPrefix: "SV8-CHAT-", expectedSource: "chat" as SourceType },
      { channel: "chat", expectedPrefix: "SV8-CHAT-", expectedSource: "chat" as SourceType },
    ])("maps channel $channel to prefix $expectedPrefix and source $expectedSource", async ({ channel, expectedPrefix, expectedSource }) => {
      const startSessionSpy = vi.spyOn(chatRepository, "startSession").mockResolvedValue({ id: "sess_101" } as any);
      const listChatIssuesSpy = vi.spyOn(chatRepository, "listChatIssues").mockResolvedValue([
        {
          id: "iss_101",
          tenantId: "tenant_alpha",
          externalId: `${expectedPrefix}TEST12345678`,
          source: expectedSource,
          summary: "Test issue for channel",
          customerName: "Alex Doe",
          status: "open",
        } as any,
      ]);

      const req = new NextRequest("https://alpha.support.servicev8.com/api/issues", {
        method: "POST",
        body: JSON.stringify({
          action: "create_manual",
          customerName: "Alex Doe",
          customerEmail: "alex@example.com",
          summary: "Cannot access billing portal",
          stream: "customers",
          priority: "normal",
          channel,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.externalId).toMatch(new RegExp(`^${expectedPrefix}`));
      expect(data.data.source).toBe(expectedSource);

      expect(startSessionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant_alpha",
          source: expectedSource,
          manual: expect.objectContaining({
            operatorName: "Jordan Operator",
            priority: "normal",
          }),
        })
      );
      expect(listChatIssuesSpy).toHaveBeenCalledWith("tenant_alpha", "sess_101");
    });
  });

  describe("ChatRepository.startSession internal ID generation and source resolution", () => {
    it.each([
      { channel: "manual" as const, expectedPrefix: "SV8-MANUAL-", expectedSource: "manual" },
      { channel: "email" as const, expectedPrefix: "SV8-EMAIL-", expectedSource: "email" },
      { channel: "voice" as const, expectedPrefix: "SV8-VOICE-", expectedSource: "voice" },
      { channel: "web" as const, expectedPrefix: "SV8-CHAT-", expectedSource: "chat" },
    ])("generates externalId with $expectedPrefix and assigns source $expectedSource for channel $channel", async ({ channel, expectedPrefix, expectedSource }) => {
      const recordedQueries: Array<{ sql: string; values: any[] }> = [];
      const mockDb = {
        query: vi.fn().mockImplementation((sql: string, values?: any[]) => {
          recordedQueries.push({ sql, values: values || [] });
          // console.log("SQL:", sql.replace(/\s+/g, ' '));
          if (sql.includes("SELECT id FROM supportv8.tenants")) {
            return Promise.resolve([{ id: "tenant_alpha" }]);
          }
          if (sql.includes("FROM supportv8.chat_sessions") && sql.includes("WHERE id = $1")) {
            // loadSession query
            return Promise.resolve([
              {
                id: "sess_test",
                tenant_id: "tenant_alpha",
                stream: "customers",
                channel,
                customer_name: "Test Customer",
                customer_email: "test@example.com",
                customer_ref: "cust_test",
                intake_data: {},
                status: "open",
                priority: "normal",
                assigned_group_id: "group_customers",
                assigned_operator_id: null,
                issue_id: "iss_test",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                closed_at: null,
                last_message_at: new Date().toISOString(),
                message_count: 1,
              },
            ]);
          }
          if (sql.includes("supportv8.chat_messages")) {
            // messages query in loadSession
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const mockClient = {
        withTenantSession: vi.fn().mockImplementation((_tenantId: string, fn: (db: any) => Promise<any>) => fn(mockDb)),
      };

      const repo = new ChatRepository(mockClient as any);
      await repo.startSession({
        tenantId: "tenant_alpha",
        tenantSlug: "alpha",
        stream: "customers",
        customerName: "Test Customer",
        customerEmail: "test@example.com",
        intakeData: { details: "Testing source formatting" },
        channel,
        manual: { operatorName: "Operator Jane", priority: "normal" },
      });

      const issueInsert = recordedQueries.find(q => q.sql.includes("INSERT INTO supportv8.issues"));
      expect(issueInsert).toBeDefined();

      // externalId is $3, source is $16
      const externalId = issueInsert!.values[2];
      const source = issueInsert!.values[15];

      expect(externalId).toMatch(new RegExp(`^${expectedPrefix}`));
      expect(source).toBe(expectedSource);
    });

    it("retrieves manual ticket by sessionId in listChatIssues", async () => {
      const mockDb = {
        query: vi.fn().mockImplementation((sql: string, values?: any[]) => {
          if (sql.includes("SELECT i.id, i.tenant_id, i.source")) {
            expect(values?.[0]).toBe("sess_manual_1");
            return Promise.resolve([
              {
                id: "iss_manual_1",
                tenant_id: "tenant_alpha",
                source: "manual",
                external_id: "SV8-MANUAL-ABC123DEF456",
                source_url: "https://alpha.support.servicev8.com/tickets/SV8-MANUAL-ABC123DEF456",
                customer_ref: "cust_manual",
                customer_name: "John Doe",
                customer_tier: "standard",
                summary: "Hardware replacement request",
                category: "support",
                product: "Operator Workdesk",
                version: "3.2.0",
                source_status: "open",
                priority: "normal",
                sentiment: "neutral",
                sentiment_score: "0.2",
                sentiment_trajectory: "stable",
                confidence: "0.95",
                business_impact: "low",
                resolution_risk_score: "0.1",
                tags: ["manual_intake"],
                recommended_action: "Triage ticket",
                timeline: [],
                messages: [],
                assigned_to: "Jordan Operator",
                assigned_agent: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                intake_data: {},
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      };
      const mockClient = {
        withTenantSession: vi.fn().mockImplementation((_tenantId: string, fn: (db: any) => Promise<any>) => fn(mockDb)),
      };
      const repo = new ChatRepository(mockClient as any);
      const issues = await repo.listChatIssues("tenant_alpha", "sess_manual_1");
      expect(issues).toHaveLength(1);
      expect(issues[0].source).toBe("manual");
      expect(issues[0].externalId).toBe("SV8-MANUAL-ABC123DEF456");
    });

    it("updates manual ticket in updateChatIssue", async () => {
      const recordedQueries: Array<{ sql: string; values: any[] }> = [];
      const mockDb = {
        query: vi.fn().mockImplementation((sql: string, values?: any[]) => {
          recordedQueries.push({ sql, values: values || [] });
          if (sql.includes("UPDATE supportv8.issues")) {
            return Promise.resolve([{ id: "iss_manual_1" }]);
          }
          if (sql.includes("SELECT i.id, i.tenant_id, i.source")) {
            return Promise.resolve([
              {
                id: "iss_manual_1",
                tenant_id: "tenant_alpha",
                source: "manual",
                external_id: "SV8-MANUAL-ABC123DEF456",
                source_url: "https://alpha.support.servicev8.com/tickets/SV8-MANUAL-ABC123DEF456",
                customer_ref: "cust_manual",
                customer_name: "John Doe",
                customer_tier: "standard",
                summary: "Updated summary",
                category: "support",
                product: "Operator Workdesk",
                version: "3.2.0",
                source_status: "in_progress",
                priority: "high",
                sentiment: "neutral",
                sentiment_score: "0.2",
                sentiment_trajectory: "stable",
                confidence: "0.95",
                business_impact: "low",
                resolution_risk_score: "0.1",
                tags: ["manual_intake"],
                recommended_action: "Triage ticket",
                timeline: [],
                messages: [],
                assigned_to: "Jordan Operator",
                assigned_agent: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                intake_data: {},
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      };
      const mockClient = {
        withTenantSession: vi.fn().mockImplementation((_tenantId: string, fn: (db: any) => Promise<any>) => fn(mockDb)),
      };
      const repo = new ChatRepository(mockClient as any);
      const updated = await repo.updateChatIssue(
        "tenant_alpha",
        "iss_manual_1",
        {
          summary: "Updated summary",
          priority: "high",
          status: "in_progress",
        },
        true
      );
      expect(updated).not.toBeNull();
      expect(updated?.summary).toBe("Updated summary");
      expect(updated?.source).toBe("manual");

      const updateQuery = recordedQueries.find(q => q.sql.includes("UPDATE supportv8.issues"));
      expect(updateQuery).toBeDefined();
      expect(updateQuery!.values[11]).toBe(true);
    });
  });

  describe("FocusedWorkspaceView UI rendering of ticket sources and prefixes", () => {
    it("renders badges for manual, email, voice, and chat tickets in the queue", () => {
      const testIssues: Issue[] = [
        {
          id: "iss_manual_01",
          tenantId: "tenant_alpha",
          externalId: "SV8-MANUAL-ABC123DEF456",
          source: "manual",
          sourceUrl: "https://alpha.support.servicev8.com/tickets/SV8-MANUAL-ABC123DEF456",
          customerRef: "cust_manual",
          customerName: "Alice Manual",
          customerTier: "standard",
          summary: "Manual phone call ticket logged",
          category: "support",
          product: "Operator Workdesk",
          version: "3.2.0",
          status: "open",
          sourceStatus: "open",
          priority: "normal",
          sentiment: "neutral",
          sentimentScore: 0.5,
          sentimentTrajectory: "stable",
          resolutionRiskScore: 0.2,
          confidence: 0.9,
          businessImpact: "low",
          tags: ["manual_intake"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "iss_email_01",
          tenantId: "tenant_alpha",
          externalId: "SV8-EMAIL-789XYZ123456",
          source: "email",
          sourceUrl: "https://alpha.support.servicev8.com/tickets/SV8-EMAIL-789XYZ123456",
          customerRef: "cust_email",
          customerName: "Bob Email",
          customerTier: "standard",
          summary: "Inbound billing inquiry email",
          category: "billing",
          product: "Inbound Email",
          version: "3.2.0",
          status: "open",
          sourceStatus: "open",
          priority: "high",
          sentiment: "frustrated",
          sentimentScore: 0.3,
          sentimentTrajectory: "stable",
          resolutionRiskScore: 0.6,
          confidence: 0.88,
          businessImpact: "medium",
          tags: ["email_intake"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "iss_voice_01",
          tenantId: "tenant_alpha",
          externalId: "SV8-VOICE-VOX456789123",
          source: "voice",
          sourceUrl: "https://alpha.support.servicev8.com/tickets/SV8-VOICE-VOX456789123",
          customerRef: "cust_voice",
          customerName: "Charlie Voice",
          customerTier: "standard",
          summary: "Voice dispatch urgent outage",
          category: "technical",
          product: "Voice Portal",
          version: "3.2.0",
          status: "open",
          sourceStatus: "open",
          priority: "urgent",
          sentiment: "urgent",
          sentimentScore: 0.1,
          sentimentTrajectory: "deteriorating",
          resolutionRiskScore: 0.9,
          confidence: 0.92,
          businessImpact: "high",
          tags: ["voice_intake"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "iss_chat_01",
          tenantId: "tenant_alpha",
          externalId: "SV8-CHAT-LIVE98765432",
          source: "chat",
          sourceUrl: "https://alpha.support.servicev8.com/chat/chat_live",
          customerRef: "cust_chat",
          customerName: "Dana Chat",
          customerTier: "standard",
          summary: "Live chat inquiry on checkout",
          category: "customer_care",
          product: "SupportV8 Live Chat",
          version: "3.2.0",
          status: "open",
          sourceStatus: "open",
          priority: "normal",
          sentiment: "neutral",
          sentimentScore: 0.7,
          sentimentTrajectory: "improving",
          resolutionRiskScore: 0.1,
          confidence: 0.95,
          businessImpact: "low",
          tags: ["chat_intake"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const html = renderToStaticMarkup(
        <FocusedWorkspaceView
          issues={testIssues}
          onResolve={vi.fn()}
          onEscalate={vi.fn()}
          onNavigateToProblems={vi.fn()}
          onExecuteInsight={vi.fn()}
          onNotify={vi.fn()}
        />
      );

      // Verify external IDs rendered
      expect(html).toContain("SV8-MANUAL-ABC123DEF456");
      expect(html).toContain("SV8-EMAIL-789XYZ123456");
      expect(html).toContain("SV8-VOICE-VOX456789123");
      expect(html).toContain("SV8-CHAT-LIVE98765432");

      // Verify source pills rendered
      expect(html).toContain("manual");
      expect(html).toContain("email");
      expect(html).toContain("voice");
      expect(html).toContain("chat");
    });

    it("opens the new ticket modal with Operator Desk Manual option", async () => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          <FocusedWorkspaceView
            issues={[]}
            onResolve={vi.fn()}
            onEscalate={vi.fn()}
            onNavigateToProblems={vi.fn()}
            onExecuteInsight={vi.fn()}
            onNotify={vi.fn()}
          />
        );
      });

      // Find "New Ticket" button and click it
      const buttons = Array.from(container.querySelectorAll("button"));
      const newTicketButton = buttons.find(b => b.textContent?.includes("New Ticket"));
      expect(newTicketButton).toBeDefined();

      act(() => {
        newTicketButton?.click();
      });

      // Verify modal is open with Ingress Channel options
      const select = container.querySelector("select[aria-label='Ingress channel']") as HTMLSelectElement | null;
      expect(select).not.toBeNull();
      expect(select?.value).toBe("manual_entry");

      const options = Array.from(select?.querySelectorAll("option") || []).map(o => o.text);
      expect(options).toContain("Operator Desk Manual");
      expect(options).toContain("Direct Web Chat");
      expect(options).toContain("Inbound Email");
      expect(options).toContain("Contractor Dispatch Call");

      act(() => {
        root.unmount();
      });
      container.remove();
    });
  });
});
