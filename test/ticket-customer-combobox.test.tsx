// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FocusedWorkspaceView } from "@/components/views/FocusedWorkspaceView";
import { AuthService } from "@/lib/auth-service";
import type { CustomerProfile, Issue } from "@/lib/types";

const roots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MOCK_CUSTOMERS: CustomerProfile[] = [
  {
    id: "cust_apex_01",
    tenantId: "tenant_acme",
    name: "Elena Rostova",
    companyName: "Apex Global Logistics",
    email: "elena@apexlogistics.com",
    phone: "+1 (555) 234-8901",
    customerTier: "enterprise",
    sourceSystem: "stripe",
    createdAt: "2026-08-15T10:00:00.000Z",
    updatedAt: "2026-09-28T14:30:00.000Z",
    lastSyncedAt: "2026-09-28T14:30:00.000Z",
  },
  {
    id: "cust_vance_02",
    tenantId: "tenant_acme",
    name: "Marcus Vance",
    companyName: "Vance Biotech Systems",
    email: "marcus@vancebio.io",
    phone: "+1 (555) 871-3420",
    customerTier: "vip",
    sourceSystem: "zendesk",
    createdAt: "2026-08-20T11:20:00.000Z",
    updatedAt: "2026-09-29T09:15:00.000Z",
    lastSyncedAt: "2026-09-29T09:15:00.000Z",
  },
];

const MOCK_ISSUES: Issue[] = [
  {
    id: "iss_1",
    tenantId: "tenant_acme",
    externalId: "SV8-MANUAL-001",
    source: "manual",
    customerName: "Elena Rostova",
    summary: "System performance drop",
    category: "customers",
    customerTier: "enterprise",
    status: "open",
    priority: "high",
    sentiment: "neutral",
    sentimentScore: 0,
    confidence: 0.9,
    businessImpact: "low",
    resolutionRiskScore: 0.1,
    tags: [],
    timeline: [],
    messages: [],
    sourceUrl: "https://support.servicev8.com/issues/1",
    customerRef: "cust_apex_01",
    product: "SupportV8 Core",
    version: "3.2.0",
    sentimentTrajectory: "stable",
    sourceStatus: "open",
    createdAt: "2026-09-28T10:00:00Z",
    updatedAt: "2026-09-28T10:00:00Z",
  },
];

describe("Ticket Customer Combobox in FocusedWorkspaceView", () => {
  beforeEach(() => {
    vi.spyOn(AuthService, "authenticatedFetch").mockImplementation((url, init) => {
      const urlStr = String(url);
      if (urlStr.endsWith("/api/customers") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: "cust_created_inline",
              ...body,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        } as Response);
      }
      if (urlStr.endsWith("/api/customers")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            count: MOCK_CUSTOMERS.length,
            data: MOCK_CUSTOMERS,
          }),
        } as Response);
      }
      if (urlStr.endsWith("/api/issues") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: "iss_new",
              externalId: "SV8-MANUAL-9999",
              ...body,
              createdAt: new Date().toISOString(),
            },
          }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      } as Response);
    });
  });

  afterEach(() => {
    for (const root of roots) act(() => root.unmount());
    roots.length = 0;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("pre-selects customer when initialCustomerForTicket is provided", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    const clearCustomerSpy = vi.fn();

    await act(async () => {
      root.render(
        <FocusedWorkspaceView
          issues={MOCK_ISSUES}
          onResolve={vi.fn()}
          onEscalate={vi.fn()}
          onNavigateToProblems={vi.fn()}
          onExecuteInsight={vi.fn()}
          onNotify={vi.fn()}
          initialCustomerForTicket={MOCK_CUSTOMERS[0]}
          onClearInitialCustomer={clearCustomerSpy}
        />
      );
    });

    expect(clearCustomerSpy).toHaveBeenCalled();

    // The modal should be open with the customer card displayed
    expect(container.textContent).toContain("Create customer ticket");
    expect(container.textContent).toContain("Elena Rostova");
    expect(container.textContent).toContain("Apex Global Logistics");
    expect(container.textContent).toContain("elena@apexlogistics.com");

    const emailInput = container.querySelector("input[type='email']") as HTMLInputElement;
    expect(emailInput?.value).toBe("elena@apexlogistics.com");
  });

  it("selects customer from searchable combobox dropdown", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <FocusedWorkspaceView
          issues={MOCK_ISSUES}
          onResolve={vi.fn()}
          onEscalate={vi.fn()}
          onNavigateToProblems={vi.fn()}
          onExecuteInsight={vi.fn()}
          onNotify={vi.fn()}
        />
      );
    });

    // Click "New Ticket" button
    const newTicketBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("New Ticket")
    );
    expect(newTicketBtn).toBeDefined();

    await act(async () => {
      newTicketBtn?.click();
    });

    // Find the customer input
    const custInput = container.querySelector(
      "input[placeholder*='Search existing customer']"
    ) as HTMLInputElement;
    expect(custInput).not.toBeNull();

    // Focus input to open combobox
    await act(async () => {
      custInput.focus();
    });

    // Customer options should be listed in the dropdown
    const vanceOption = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Marcus Vance")
    );
    expect(vanceOption).toBeDefined();

    // Select Marcus Vance
    await act(async () => {
      vanceOption?.click();
    });

    // Now Marcus Vance is selected in the card
    expect(container.textContent).toContain("Marcus Vance");
    expect(container.textContent).toContain("Vance Biotech Systems");

    const emailInput = container.querySelector("input[type='email']") as HTMLInputElement;
    expect(emailInput?.value).toBe("marcus@vancebio.io");
  });

  it("supports inline customer creation and immediately selects the newly created customer", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <FocusedWorkspaceView
          issues={MOCK_ISSUES}
          onResolve={vi.fn()}
          onEscalate={vi.fn()}
          onNavigateToProblems={vi.fn()}
          onExecuteInsight={vi.fn()}
          onNotify={vi.fn()}
        />
      );
    });

    // Open New Ticket modal
    const newTicketBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("New Ticket")
    );
    await act(async () => {
      newTicketBtn?.click();
    });

    const custInput = container.querySelector(
      "input[placeholder*='Search existing customer']"
    ) as HTMLInputElement;

    // Focus input to open combobox
    await act(async () => {
      custInput.focus();
    });

    // Find the inline add button
    const addCustomerBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Add New Customer")
    );
    expect(addCustomerBtn).toBeDefined();

    await act(async () => {
      addCustomerBtn?.click();
    });

    // Inline form should be visible
    expect(container.textContent).toContain("Add New Customer");
    const nameInput = container.querySelector("input[placeholder='Customer Name *']") as HTMLInputElement;
    const emailInput = container.querySelector("input[placeholder='Email Address *']") as HTMLInputElement;
    const saveSelectBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Save & Select")
    );

    expect(nameInput).not.toBeNull();
    expect(emailInput).not.toBeNull();
    expect(saveSelectBtn).toBeDefined();

    // Fill inline form
    await act(async () => {
      const nameSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      nameSetter?.call(nameInput, "Nora Danish");
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      nameInput.dispatchEvent(new Event("change", { bubbles: true }));

      const emailSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      emailSetter?.call(emailInput, "nora@danish.dk");
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
      emailInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Submit inline form
    await act(async () => {
      saveSelectBtn?.click();
    });

    // AuthService.authenticatedFetch should have been called with /api/customers POST
    expect(AuthService.authenticatedFetch).toHaveBeenCalledWith(
      "/api/customers",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Nora Danish"),
      })
    );

    // Newly created customer should now be selected!
    expect(container.textContent).toContain("Nora Danish");
    const ticketEmail = container.querySelector("input[type='email']") as HTMLInputElement;
    expect(ticketEmail?.value).toBe("nora@danish.dk");
  });
});
