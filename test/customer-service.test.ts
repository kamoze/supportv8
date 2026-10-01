import { describe, it, expect, beforeEach } from "vitest";
import { CustomerService } from "@/lib/services/customer-service";
import type { PostgresClient } from "@/lib/db/pg-client";

describe("CustomerService", () => {
  let service: CustomerService;
  const tenantId = "tenant_test_customers";

  beforeEach(() => {
    // Provide dummy client without DATABASE_URL so in-memory store is used
    service = new CustomerService({} as PostgresClient);
  });

  it("lists seeded demo customers for a fresh tenant", async () => {
    const customers = await service.listCustomers(tenantId);
    expect(customers.length).toBeGreaterThan(0);
    const apex = customers.find((c) => c.email.includes("apexlogistics.com"));
    expect(apex).toBeDefined();
    expect(apex?.name).toBe("Elena Rostova");
    expect(apex?.companyName).toBe("Apex Global Logistics");
    expect(apex?.phone).toBe("+1 (555) 234-8901");
    expect(apex?.customerTier).toBe("enterprise");
  });

  it("filters customers by search query across name, company, email, and phone", async () => {
    const byName = await service.listCustomers(tenantId, { search: "Elena" });
    expect(byName.length).toBe(1);
    expect(byName[0].name).toBe("Elena Rostova");

    const byCompany = await service.listCustomers(tenantId, { search: "Vance Biotech" });
    expect(byCompany.length).toBe(1);
    expect(byCompany[0].name).toBe("Marcus Vance");

    const byEmail = await service.listCustomers(tenantId, { search: "hyperioncloud.net" });
    expect(byEmail.length).toBe(1);
    expect(byEmail[0].name).toBe("David Chen");

    const byPhone = await service.listCustomers(tenantId, { search: "7946 0912" });
    expect(byPhone.length).toBe(1);
    expect(byPhone[0].name).toBe("Sarah Jenkins");
  });

  it("creates a new local customer profile", async () => {
    const created = await service.createCustomer(tenantId, {
      name: "Gregory House",
      companyName: "Princeton-Plainsboro",
      email: "house@ppth.org",
      phone: "+1 (555) 392-1000",
      customerTier: "vip",
      sourceSystem: "local",
    });

    expect(created.id).toMatch(/^cust_/);
    expect(created.name).toBe("Gregory House");
    expect(created.companyName).toBe("Princeton-Plainsboro");
    expect(created.email).toBe("house@ppth.org");
    expect(created.customerTier).toBe("vip");

    const retrieved = await service.getCustomerById(tenantId, created.id);
    expect(retrieved?.id).toBe(created.id);
  });

  it("deduplicates primarily by email when creating customer", async () => {
    const first = await service.createCustomer(tenantId, {
      name: "Lisa Cuddy",
      companyName: "PPTH Admin",
      email: "cuddy@ppth.org",
      phone: "+1 (555) 392-2000",
      customerTier: "standard",
    });

    // Create again with same email (different case)
    const second = await service.createCustomer(tenantId, {
      name: "Dean Lisa Cuddy",
      companyName: "Princeton-Plainsboro Teaching Hospital",
      email: "CUDDY@ppth.org",
      phone: "+1 (555) 392-2001",
      customerTier: "enterprise",
    });

    expect(second.id).toBe(first.id);
    expect(second.name).toBe("Dean Lisa Cuddy");
    expect(second.companyName).toBe("Princeton-Plainsboro Teaching Hospital");
    expect(second.phone).toBe("+1 (555) 392-2001");
    expect(second.customerTier).toBe("enterprise");

    const list = await service.listCustomers(tenantId, { search: "cuddy@ppth.org" });
    expect(list.length).toBe(1);
  });

  it("updates existing customer biodata", async () => {
    const customer = await service.createCustomer(tenantId, {
      name: "James Wilson",
      companyName: "Oncology Dept",
      email: "wilson@ppth.org",
      phone: "+1 (555) 392-3000",
    });

    const updated = await service.updateCustomer(tenantId, customer.id, {
      companyName: "Department of Oncology & Palliative Care",
      customerTier: "vip",
    });

    expect(updated.companyName).toBe("Department of Oncology & Palliative Care");
    expect(updated.customerTier).toBe("vip");
    expect(updated.name).toBe("James Wilson");
  });

  it("deletes a customer", async () => {
    const customer = await service.createCustomer(tenantId, {
      name: "Robert Chase",
      companyName: "Intensive Care",
      email: "chase@ppth.org",
      phone: "+1 (555) 392-4000",
    });

    const deleted = await service.deleteCustomer(tenantId, customer.id);
    expect(deleted).toBe(true);

    const lookup = await service.getCustomerById(tenantId, customer.id);
    expect(lookup).toBeNull();
  });

  it("syncs customer records from target systems and updates lastSyncedAt", async () => {
    const initialList = await service.listCustomers(tenantId);
    const initialCount = initialList.length;

    // Sync from Stripe
    const stripeSync = await service.syncFromTargetSystems(tenantId, { sourceSystem: "stripe" });
    expect(stripeSync.success).toBe(true);
    expect(stripeSync.sourceSystem).toBe("stripe");
    expect(stripeSync.totalCount).toBeGreaterThanOrEqual(initialCount);

    // Arthur Pendelton from Stripe should now exist
    const arthur = await service.getCustomerByEmail(tenantId, "arthur@pendeltoncap.com");
    expect(arthur).toBeDefined();
    expect(arthur?.name).toBe("Arthur Pendelton");
    expect(arthur?.companyName).toBe("Pendelton Capital Partners");
    expect(arthur?.sourceSystem).toBe("stripe");
    expect(arthur?.lastSyncedAt).toBeDefined();

    // Elena Rostova should have been updated with lastSyncedAt
    const elena = await service.getCustomerByEmail(tenantId, "elena.rostova@apexlogistics.com");
    expect(elena?.lastSyncedAt).toBeDefined();

    // Sync from All
    const allSync = await service.syncFromTargetSystems(tenantId, { sourceSystem: "all" });
    expect(allSync.success).toBe(true);
    expect(allSync.createdCount + allSync.updatedCount).toBeGreaterThan(0);
  });
});
