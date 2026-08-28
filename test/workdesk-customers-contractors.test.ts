import { describe, it, expect } from "vitest";
import { INITIAL_ISSUES } from "../src/lib/db/mock-data";

describe("Work Desk - Dual Customer & Contractor Operations", () => {
  it("should contain both customer support tickets and field contractor work orders", () => {
    const customerTickets = INITIAL_ISSUES.filter((i) => i.entityType !== "contractor" && !i.category?.includes("contractor"));
    const contractorOrders = INITIAL_ISSUES.filter((i) => i.entityType === "contractor" || i.category?.includes("contractor") || Boolean(i.contractor));

    expect(customerTickets.length).toBeGreaterThan(0);
    expect(contractorOrders.length).toBeGreaterThan(0);

    const firstContractor = contractorOrders[0];
    expect(firstContractor.contractor).toBeDefined();
    expect(firstContractor.contractor!.company).toBeDefined();
    expect(firstContractor.contractor!.trade).toBeDefined();
    expect(firstContractor.contractor!.siteLocation).toBeDefined();
    expect(firstContractor.contractor!.dispatchStatus).toBeDefined();
  });

  it("should filter queue by audience correctly", () => {
    const contractorsOnly = INITIAL_ISSUES.filter(
      (i) => i.entityType === "contractor" || i.category?.includes("contractor") || Boolean(i.contractor)
    );
    expect(contractorsOnly.length).toBeGreaterThanOrEqual(3);

    const customersOnly = INITIAL_ISSUES.filter(
      (i) => !(i.entityType === "contractor" || i.category?.includes("contractor") || Boolean(i.contractor))
    );
    expect(customersOnly.length).toBeGreaterThanOrEqual(5);
  });
});
