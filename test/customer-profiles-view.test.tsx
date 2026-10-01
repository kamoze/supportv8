// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerProfilesView } from "@/components/views/CustomerProfilesView";
import { AuthService } from "@/lib/auth-service";
import type { CustomerProfile } from "@/lib/types";

const roots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MOCK_CUSTOMERS: CustomerProfile[] = [
  {
    id: "cust_1",
    tenantId: "tenant_acme",
    name: "Elena Rostova",
    companyName: "Apex Global Logistics",
    email: "elena@apexlogistics.com",
    phone: "+1 (555) 234-8901",
    customerTier: "enterprise",
    sourceSystem: "stripe",
    externalCustomerRef: "cus_stripe_01",
    createdAt: "2026-08-15T10:00:00.000Z",
    updatedAt: "2026-09-28T14:30:00.000Z",
    lastSyncedAt: "2026-09-28T14:30:00.000Z",
  },
  {
    id: "cust_2",
    tenantId: "tenant_acme",
    name: "Marcus Vance",
    companyName: "Vance Biotech Systems",
    email: "marcus@vancebio.io",
    phone: "+1 (555) 871-3420",
    customerTier: "vip",
    sourceSystem: "zendesk",
    externalCustomerRef: "zd_usr_02",
    createdAt: "2026-08-20T11:20:00.000Z",
    updatedAt: "2026-09-29T09:15:00.000Z",
    lastSyncedAt: "2026-09-29T09:15:00.000Z",
  },
];

describe("CustomerProfilesView Component", () => {
  beforeEach(() => {
    vi.spyOn(AuthService, "authenticatedFetch").mockImplementation((url, init) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/customers/sync")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { createdCount: 2, updatedCount: 1, totalCount: 4 },
          }),
        } as Response);
      }
      if (urlStr.endsWith("/api/customers") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { id: "cust_new", ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          }),
        } as Response);
      }
      if (urlStr.includes("/api/customers/") && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { ...MOCK_CUSTOMERS[0], ...body, updatedAt: new Date().toISOString() },
          }),
        } as Response);
      }
      if (urlStr.includes("/api/customers/") && init?.method === "DELETE") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          count: MOCK_CUSTOMERS.length,
          data: MOCK_CUSTOMERS,
        }),
      } as Response);
    });
  });

  afterEach(() => {
    for (const root of roots) act(() => root.unmount());
    roots.length = 0;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders customer directory header, metrics, and customer table rows", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(<CustomerProfilesView />);
    });

    expect(container.textContent).toContain("Customer Directory & Biodata");
    expect(container.textContent).toContain("Total Customer Profiles");
    expect(container.textContent).toContain("Elena Rostova");
    expect(container.textContent).toContain("Apex Global Logistics");
    expect(container.textContent).toContain("Marcus Vance");
    expect(container.textContent).toContain("Vance Biotech Systems");
  });

  it("filters customer directory by search query", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(<CustomerProfilesView />);
    });

    const searchInput = container.querySelector("input[placeholder*='Search by customer name']") as HTMLInputElement;
    expect(searchInput).not.toBeNull();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      nativeSetter?.call(searchInput, "Marcus");
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("Marcus Vance");
    expect(container.textContent).not.toContain("Elena Rostova");
  });

  it("triggers sync from target systems when dropdown item is selected", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    const notifySpy = vi.fn();

    await act(async () => {
      root.render(<CustomerProfilesView onNotify={notifySpy} />);
    });

    const syncBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Sync from Target Systems")
    );
    expect(syncBtn).toBeDefined();

    // Open sync dropdown
    await act(async () => {
      syncBtn?.click();
    });

    const syncStripeBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Stripe Billing")
    );
    expect(syncStripeBtn).toBeDefined();

    // Click Stripe sync
    await act(async () => {
      syncStripeBtn?.click();
    });

    expect(AuthService.authenticatedFetch).toHaveBeenCalledWith(
      "/api/customers/sync",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sourceSystem: "stripe" }),
      })
    );
    expect(notifySpy).toHaveBeenCalledWith(expect.stringContaining("Synced 2 new"), "success");
  });

  it("invokes onCreateTicketForCustomer when Ticket action button is clicked", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    const createTicketSpy = vi.fn();

    await act(async () => {
      root.render(<CustomerProfilesView onCreateTicketForCustomer={createTicketSpy} />);
    });

    const ticketButtons = Array.from(container.querySelectorAll("button")).filter((b) =>
      b.textContent?.includes("Ticket")
    );
    expect(ticketButtons.length).toBeGreaterThan(0);

    await act(async () => {
      ticketButtons[0].click();
    });

    expect(createTicketSpy).toHaveBeenCalledWith(MOCK_CUSTOMERS[0]);
  });
});
