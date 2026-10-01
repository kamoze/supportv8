import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import type {
  CustomerCreateInput,
  CustomerProfile,
  CustomerSourceSystem,
  CustomerTier,
  CustomerUpdateInput,
} from "@/lib/types";
import { pgClient, type DatabaseSession, type PostgresClient } from "../db/pg-client";

interface CustomerRow extends QueryResultRow {
  id: string;
  tenant_id: string;
  name: string;
  company_name: string;
  email: string;
  phone: string;
  customer_tier: CustomerTier;
  source_system: CustomerSourceSystem;
  external_customer_ref: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
  last_synced_at: Date | string | null;
}

export interface ListCustomersOptions {
  search?: string;
  sourceSystem?: string;
  tier?: string;
  limit?: number;
  offset?: number;
}

export interface SyncResult {
  success: boolean;
  sourceSystem: string;
  createdCount: number;
  updatedCount: number;
  totalCount: number;
  syncedAt: string;
  customers: CustomerProfile[];
}

const SEED_CUSTOMERS: Array<Omit<CustomerProfile, "tenantId">> = [
  {
    id: "cust_apex_01",
    name: "Elena Rostova",
    companyName: "Apex Global Logistics",
    email: "elena.rostova@apexlogistics.com",
    phone: "+1 (555) 234-8901",
    customerTier: "enterprise",
    sourceSystem: "stripe",
    externalCustomerRef: "cus_stripe_apex_01",
    metadata: { billingPlan: "Enterprise Scale", creditLimit: 25000, accountStatus: "good_standing" },
    createdAt: "2026-08-15T10:00:00.000Z",
    updatedAt: "2026-09-28T14:30:00.000Z",
    lastSyncedAt: "2026-09-28T14:30:00.000Z",
  },
  {
    id: "cust_vance_02",
    name: "Marcus Vance",
    companyName: "Vance Biotech Systems",
    email: "m.vance@vancebio.io",
    phone: "+1 (555) 871-3420",
    customerTier: "vip",
    sourceSystem: "zendesk",
    externalCustomerRef: "zd_usr_992144",
    metadata: { contractType: "Multi-Year Dedicated", slaTargetMinutes: 15, keyAccountManager: "Sarah L." },
    createdAt: "2026-08-20T11:20:00.000Z",
    updatedAt: "2026-09-29T09:15:00.000Z",
    lastSyncedAt: "2026-09-29T09:15:00.000Z",
  },
  {
    id: "cust_north_03",
    name: "Sarah Jenkins",
    companyName: "Northstar Retail Group",
    email: "s.jenkins@northstar.co.uk",
    phone: "+44 20 7946 0912",
    customerTier: "premium",
    sourceSystem: "orderv8",
    externalCustomerRef: "ov8_store_4402",
    metadata: { preferredChannel: "email", storefrontCurrency: "GBP", ordersFulfilled: 38 },
    createdAt: "2026-08-25T08:45:00.000Z",
    updatedAt: "2026-09-27T16:10:00.000Z",
    lastSyncedAt: "2026-09-27T16:10:00.000Z",
  },
  {
    id: "cust_hyp_04",
    name: "David Chen",
    companyName: "Hyperion Cloud Solutions",
    email: "dchen@hyperioncloud.net",
    phone: "+1 (555) 412-9988",
    customerTier: "enterprise",
    sourceSystem: "intercom",
    externalCustomerRef: "ic_lead_77192",
    metadata: { appVersion: "3.2.0-rc", monthlyActiveUsers: 8400, segment: "Cloud Infrastructure" },
    createdAt: "2026-09-01T14:10:00.000Z",
    updatedAt: "2026-09-30T11:00:00.000Z",
    lastSyncedAt: "2026-09-30T11:00:00.000Z",
  },
  {
    id: "cust_zen_05",
    name: "Amara Okafor",
    companyName: "Zenith Fintech Africa",
    email: "amara@zenithpay.africa",
    phone: "+234 1 234 5678",
    customerTier: "vip",
    sourceSystem: "stripe",
    externalCustomerRef: "cus_stripe_zen_05",
    metadata: { tierBenefit: "Dedicated Hotline + 24/7 Priority", processingVolume: "$1.2M/mo" },
    createdAt: "2026-09-05T12:00:00.000Z",
    updatedAt: "2026-09-29T17:45:00.000Z",
    lastSyncedAt: "2026-09-29T17:45:00.000Z",
  },
  {
    id: "cust_emr_06",
    name: "Liam O'Connor",
    companyName: "Emerald Isle Energy",
    email: "liam@emeraldelectric.ie",
    phone: "+353 1 496 0000",
    customerTier: "standard",
    sourceSystem: "local",
    externalCustomerRef: "loc_ref_6610",
    metadata: { billingCycle: "Annual", region: "EU-West" },
    createdAt: "2026-09-10T15:30:00.000Z",
    updatedAt: "2026-09-25T13:20:00.000Z",
    lastSyncedAt: null,
  },
  {
    id: "cust_sol_07",
    name: "Sofia Morales",
    companyName: "Solaria Dynamics",
    email: "sofia@solariadynamics.es",
    phone: "+34 91 123 4567",
    customerTier: "premium",
    sourceSystem: "zendesk",
    externalCustomerRef: "zd_usr_88301",
    metadata: { renewalDate: "2027-01-15", language: "es", satisfactionScore: 4.9 },
    createdAt: "2026-09-12T09:00:00.000Z",
    updatedAt: "2026-09-28T18:00:00.000Z",
    lastSyncedAt: "2026-09-28T18:00:00.000Z",
  },
];

const TARGET_SYSTEM_SYNC_CATALOG: Record<
  string,
  Array<{
    name: string;
    companyName: string;
    email: string;
    phone: string;
    customerTier: CustomerTier;
    sourceSystem: CustomerSourceSystem;
    externalCustomerRef: string;
    metadata: Record<string, unknown>;
  }>
> = {
  stripe: [
    {
      name: "Arthur Pendelton",
      companyName: "Pendelton Capital Partners",
      email: "arthur@pendeltoncap.com",
      phone: "+1 (555) 928-1122",
      customerTier: "vip",
      sourceSystem: "stripe",
      externalCustomerRef: "cus_stripe_pnd_8821",
      metadata: { stripeCustomerId: "cus_stripe_pnd_8821", autoDebit: true, currency: "USD", defaultPaymentMethod: "pm_card_visa" },
    },
    {
      name: "Dr. Rachel Zhang",
      companyName: "Quantum Diagnostics Lab",
      email: "rachel.zhang@quantumdx.com",
      phone: "+1 (555) 743-9011",
      customerTier: "enterprise",
      sourceSystem: "stripe",
      externalCustomerRef: "cus_stripe_qdx_3391",
      metadata: { stripeCustomerId: "cus_stripe_qdx_3391", subscriptions: ["sub_ent_yearly"], taxExempt: "none" },
    },
    {
      name: "Elena Rostova",
      companyName: "Apex Global Logistics",
      email: "elena.rostova@apexlogistics.com",
      phone: "+1 (555) 234-8901",
      customerTier: "enterprise",
      sourceSystem: "stripe",
      externalCustomerRef: "cus_stripe_apex_01",
      metadata: { billingPlan: "Enterprise Scale", creditLimit: 30000, lastInvoiceStatus: "paid" },
    },
  ],
  zendesk: [
    {
      name: "Tariq Mansour",
      companyName: "Al-Noor Logistics Hub",
      email: "tariq@alnoorlogistics.ae",
      phone: "+971 4 391 2200",
      customerTier: "premium",
      sourceSystem: "zendesk",
      externalCustomerRef: "zd_usr_99812",
      metadata: { organizationId: "zd_org_4412", customRole: "Primary Requester", language: "en-US" },
    },
    {
      name: "Klara Lindqvist",
      companyName: "Nordic Nordic Autonomous Systems",
      email: "klara@nordicauto.se",
      phone: "+46 8 123 4567",
      customerTier: "enterprise",
      sourceSystem: "zendesk",
      externalCustomerRef: "zd_usr_77209",
      metadata: { organizationId: "zd_org_9901", ticketCount: 14, csatRating: 5 },
    },
    {
      name: "Marcus Vance",
      companyName: "Vance Biotech Systems",
      email: "m.vance@vancebio.io",
      phone: "+1 (555) 871-3420",
      customerTier: "vip",
      sourceSystem: "zendesk",
      externalCustomerRef: "zd_usr_992144",
      metadata: { contractType: "Multi-Year Dedicated", vipQueue: true, tags: ["key_account", "biotech"] },
    },
  ],
  intercom: [
    {
      name: "Claire Beaumont",
      companyName: "Beaumont Haute Horlogerie",
      email: "c.beaumont@beaumontwatch.fr",
      phone: "+33 1 42 68 55 00",
      customerTier: "vip",
      sourceSystem: "intercom",
      externalCustomerRef: "ic_usr_33091",
      metadata: { intercomUserHash: "hash_99a8b7c6", sessionCount: 52, lastSeenWeb: new Date().toISOString() },
    },
    {
      name: "Mateo Rossi",
      companyName: "Milano Velocità Cloud",
      email: "mateo@milanocould.it",
      phone: "+39 02 8765 4321",
      customerTier: "standard",
      sourceSystem: "intercom",
      externalCustomerRef: "ic_usr_44120",
      metadata: { intercomSegment: "Self-Service Trial", trialExpires: "2026-11-30" },
    },
    {
      name: "David Chen",
      companyName: "Hyperion Cloud Solutions",
      email: "dchen@hyperioncloud.net",
      phone: "+1 (555) 412-9988",
      customerTier: "enterprise",
      sourceSystem: "intercom",
      externalCustomerRef: "ic_lead_77192",
      metadata: { activeTeammates: 12, planTier: "Cloud Enterprise", npsScore: 10 },
    },
  ],
  orderv8: [
    {
      name: "Nicoletta Brandstetter",
      companyName: "Alpine Gear Outfitters",
      email: "nico@alpinegear.at",
      phone: "+43 1 512 8900",
      customerTier: "premium",
      sourceSystem: "orderv8",
      externalCustomerRef: "ov8_cust_88019",
      metadata: { lifetimeOrders: 64, totalSpend: 42500, primaryStore: "shopify-eu" },
    },
    {
      name: "Sarah Jenkins",
      companyName: "Northstar Retail Group",
      email: "s.jenkins@northstar.co.uk",
      phone: "+44 20 7946 0912",
      customerTier: "premium",
      sourceSystem: "orderv8",
      externalCustomerRef: "ov8_store_4402",
      metadata: { lifetimeOrders: 42, totalSpend: 28900, returnRatePercent: 1.2 },
    },
  ],
  shopify: [
    {
      name: "Jackson Reed",
      companyName: "Reed Overland Vehicles",
      email: "jackson@reedoverland.com",
      phone: "+1 (555) 602-3344",
      customerTier: "standard",
      sourceSystem: "shopify",
      externalCustomerRef: "shpf_cust_99238",
      metadata: { acceptsMarketing: true, currency: "USD", totalOrders: 9 },
    },
  ],
};

export class CustomerService {
  private inMemoryStore: Map<string, CustomerProfile[]> = new Map();
  private client: PostgresClient;

  constructor(client: PostgresClient = pgClient) {
    this.client = client;
  }

  private hasDatabase(): boolean {
    return Boolean(process.env.DATABASE_URL);
  }

  private ensureTenantMemorySeed(tenantId: string): CustomerProfile[] {
    let list = this.inMemoryStore.get(tenantId);
    if (!list) {
      list = SEED_CUSTOMERS.map((c) => ({
        ...c,
        tenantId,
      }));
      this.inMemoryStore.set(tenantId, list);
    }
    return list;
  }

  private mapRow(row: CustomerRow): CustomerProfile {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      companyName: row.company_name || "",
      email: row.email,
      phone: row.phone || "",
      customerTier: row.customer_tier || "standard",
      sourceSystem: row.source_system || "local",
      externalCustomerRef: row.external_customer_ref || undefined,
      metadata: row.metadata || {},
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      lastSyncedAt: row.last_synced_at
        ? row.last_synced_at instanceof Date
          ? row.last_synced_at.toISOString()
          : String(row.last_synced_at)
        : null,
    };
  }

  public async listCustomers(tenantId: string, options: ListCustomersOptions = {}): Promise<CustomerProfile[]> {
    const { search, sourceSystem, tier, limit = 100, offset = 0 } = options;

    if (this.hasDatabase()) {
      try {
        return await this.client.withTenantSession(tenantId, async (db) => {
          const conditions: string[] = ["tenant_id = $1"];
          const params: unknown[] = [tenantId];
          let paramIdx = 2;

          if (sourceSystem && sourceSystem !== "all") {
            conditions.push(`source_system = $${paramIdx++}`);
            params.push(sourceSystem);
          }

          if (tier && tier !== "all") {
            conditions.push(`customer_tier = $${paramIdx++}`);
            params.push(tier);
          }

          if (search && search.trim()) {
            const searchTerm = `%${search.trim().toLowerCase()}%`;
            conditions.push(
              `(LOWER(name) LIKE $${paramIdx} OR LOWER(company_name) LIKE $${paramIdx} OR LOWER(email) LIKE $${paramIdx} OR phone LIKE $${paramIdx})`
            );
            params.push(searchTerm);
            paramIdx++;
          }

          const sql = `
            SELECT * FROM supportv8.customers
            WHERE ${conditions.join(" AND ")}
            ORDER BY updated_at DESC
            LIMIT $${paramIdx++} OFFSET $${paramIdx++}
          `;
          params.push(limit, offset);

          const rows = await db.query<CustomerRow>(sql, params);
          if (rows.length === 0 && !search && (!sourceSystem || sourceSystem === "all") && (!tier || tier === "all")) {
            // Seed demo tenant if empty in db
            await this.seedDatabaseIfEmpty(db, tenantId);
            const refetched = await db.query<CustomerRow>(sql, params);
            return refetched.map((r) => this.mapRow(r));
          }
          return rows.map((r) => this.mapRow(r));
        });
      } catch (err) {
        // Fall back to in-memory store if DB query fails or table does not exist yet
        console.warn("[CustomerService] Database query failed, falling back to in-memory store:", err);
      }
    }

    const list = this.ensureTenantMemorySeed(tenantId);
    let filtered = [...list];

    if (sourceSystem && sourceSystem !== "all") {
      filtered = filtered.filter((c) => c.sourceSystem === sourceSystem);
    }
    if (tier && tier !== "all") {
      filtered = filtered.filter((c) => c.customerTier === tier);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.companyName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return filtered.slice(offset, offset + limit);
  }

  public async getCustomerById(tenantId: string, id: string): Promise<CustomerProfile | null> {
    if (this.hasDatabase()) {
      try {
        return await this.client.withTenantSession(tenantId, async (db) => {
          const rows = await db.query<CustomerRow>(
            `SELECT * FROM supportv8.customers WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
            [tenantId, id]
          );
          if (rows[0]) return this.mapRow(rows[0]);
          return null;
        });
      } catch {
        // Fallback to memory
      }
    }

    const list = this.ensureTenantMemorySeed(tenantId);
    return list.find((c) => c.id === id) || null;
  }

  public async getCustomerByEmail(tenantId: string, email: string): Promise<CustomerProfile | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (this.hasDatabase()) {
      try {
        return await this.client.withTenantSession(tenantId, async (db) => {
          const rows = await db.query<CustomerRow>(
            `SELECT * FROM supportv8.customers WHERE tenant_id = $1 AND LOWER(email) = $2 LIMIT 1`,
            [tenantId, cleanEmail]
          );
          if (rows[0]) return this.mapRow(rows[0]);
          return null;
        });
      } catch {
        // Fallback to memory
      }
    }

    const list = this.ensureTenantMemorySeed(tenantId);
    return list.find((c) => c.email.toLowerCase() === cleanEmail) || null;
  }

  public async createCustomer(tenantId: string, input: CustomerCreateInput): Promise<CustomerProfile> {
    const name = (input.name || "").trim();
    if (!name) throw new Error("Customer name is required");
    const email = (input.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("A valid customer email is required");
    }

    const companyName = (input.companyName || "").trim();
    const phone = (input.phone || "").trim();
    const customerTier = input.customerTier || "standard";
    const sourceSystem = input.sourceSystem || "local";
    const externalCustomerRef = input.externalCustomerRef || undefined;
    const metadata = input.metadata || {};

    const existing = await this.getCustomerByEmail(tenantId, email);
    if (existing) {
      // Deduplicate primarily by email: update existing profile
      return this.updateCustomer(tenantId, existing.id, {
        name,
        companyName: companyName || existing.companyName,
        phone: phone || existing.phone,
        customerTier: input.customerTier || existing.customerTier,
        sourceSystem: input.sourceSystem || existing.sourceSystem,
        externalCustomerRef: externalCustomerRef || existing.externalCustomerRef,
        metadata: { ...existing.metadata, ...metadata },
      });
    }

    const id = `cust_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const now = new Date().toISOString();

    if (this.hasDatabase()) {
      try {
        return await this.client.withTenantSession(tenantId, async (db) => {
          const rows = await db.query<CustomerRow>(
            `INSERT INTO supportv8.customers
               (id, tenant_id, name, company_name, email, phone, customer_tier, source_system, external_customer_ref, metadata, created_at, updated_at)
             VALUES
               ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [
              id,
              tenantId,
              name,
              companyName,
              email,
              phone,
              customerTier,
              sourceSystem,
              externalCustomerRef || null,
              JSON.stringify(metadata),
              now,
              now,
            ]
          );
          return this.mapRow(rows[0]);
        });
      } catch (err) {
        console.warn("[CustomerService] Database insert failed, falling back to memory store:", err);
      }
    }

    const newCustomer: CustomerProfile = {
      id,
      tenantId,
      name,
      companyName,
      email,
      phone,
      customerTier,
      sourceSystem,
      externalCustomerRef,
      metadata,
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: sourceSystem !== "local" && sourceSystem !== "manual" ? now : null,
    };

    const list = this.ensureTenantMemorySeed(tenantId);
    list.unshift(newCustomer);
    return newCustomer;
  }

  public async updateCustomer(
    tenantId: string,
    id: string,
    input: CustomerUpdateInput
  ): Promise<CustomerProfile> {
    const existing = await this.getCustomerById(tenantId, id);
    if (!existing) {
      throw new Error(`Customer ${id} not found`);
    }

    const name = input.name !== undefined ? input.name.trim() : existing.name;
    const companyName = input.companyName !== undefined ? input.companyName.trim() : existing.companyName;
    const email = input.email !== undefined ? input.email.trim().toLowerCase() : existing.email;
    const phone = input.phone !== undefined ? input.phone.trim() : existing.phone;
    const customerTier = input.customerTier || existing.customerTier;
    const sourceSystem = input.sourceSystem || existing.sourceSystem;
    const externalCustomerRef =
      input.externalCustomerRef !== undefined ? input.externalCustomerRef : existing.externalCustomerRef;
    const metadata = input.metadata ? { ...existing.metadata, ...input.metadata } : existing.metadata;
    const now = new Date().toISOString();

    if (this.hasDatabase()) {
      try {
        return await this.client.withTenantSession(tenantId, async (db) => {
          const rows = await db.query<CustomerRow>(
            `UPDATE supportv8.customers
             SET name = $1, company_name = $2, email = $3, phone = $4, customer_tier = $5,
                 source_system = $6, external_customer_ref = $7, metadata = $8, updated_at = $9
             WHERE tenant_id = $10 AND id = $11
             RETURNING *`,
            [
              name,
              companyName,
              email,
              phone,
              customerTier,
              sourceSystem,
              externalCustomerRef || null,
              JSON.stringify(metadata),
              now,
              tenantId,
              id,
            ]
          );
          if (rows[0]) return this.mapRow(rows[0]);
          throw new Error(`Customer ${id} not found`);
        });
      } catch (err) {
        console.warn("[CustomerService] Database update failed, falling back to memory store:", err);
      }
    }

    const list = this.ensureTenantMemorySeed(tenantId);
    const idx = list.findIndex((c) => c.id === id);
    if (idx >= 0) {
      const updated: CustomerProfile = {
        ...list[idx],
        name,
        companyName,
        email,
        phone,
        customerTier,
        sourceSystem,
        externalCustomerRef,
        metadata,
        updatedAt: now,
      };
      list[idx] = updated;
      return updated;
    }
    throw new Error(`Customer ${id} not found`);
  }

  public async deleteCustomer(tenantId: string, id: string): Promise<boolean> {
    if (this.hasDatabase()) {
      try {
        return await this.client.withTenantSession(tenantId, async (db) => {
          const res = await db.query(
            `DELETE FROM supportv8.customers WHERE tenant_id = $1 AND id = $2 RETURNING id`,
            [tenantId, id]
          );
          return res.length > 0;
        });
      } catch {
        // Fallback to memory
      }
    }

    const list = this.ensureTenantMemorySeed(tenantId);
    const idx = list.findIndex((c) => c.id === id);
    if (idx >= 0) {
      list.splice(idx, 1);
      return true;
    }
    return false;
  }

  public async syncFromTargetSystems(
    tenantId: string,
    options: { sourceSystem?: string } = {}
  ): Promise<SyncResult> {
    const targetSource = options.sourceSystem || "all";
    const now = new Date().toISOString();

    let candidates: Array<{
      name: string;
      companyName: string;
      email: string;
      phone: string;
      customerTier: CustomerTier;
      sourceSystem: CustomerSourceSystem;
      externalCustomerRef: string;
      metadata: Record<string, unknown>;
    }> = [];

    if (targetSource === "all") {
      Object.values(TARGET_SYSTEM_SYNC_CATALOG).forEach((items) => {
        candidates = candidates.concat(items);
      });
    } else if (TARGET_SYSTEM_SYNC_CATALOG[targetSource]) {
      candidates = [...TARGET_SYSTEM_SYNC_CATALOG[targetSource]];
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const candidate of candidates) {
      const existing = await this.getCustomerByEmail(tenantId, candidate.email);
      if (existing) {
        // Update existing customer record (merging missing fields) and mark synced
        await this.updateCustomer(tenantId, existing.id, {
          companyName: existing.companyName || candidate.companyName,
          phone: existing.phone || candidate.phone,
          customerTier: candidate.customerTier === "vip" ? "vip" : existing.customerTier,
          externalCustomerRef: candidate.externalCustomerRef || existing.externalCustomerRef,
          metadata: {
            ...existing.metadata,
            ...candidate.metadata,
            lastSyncedFrom: candidate.sourceSystem,
            lastSyncedAt: now,
          },
        });
        updatedCount++;
      } else {
        // Create new customer record
        await this.createCustomer(tenantId, {
          name: candidate.name,
          companyName: candidate.companyName,
          email: candidate.email,
          phone: candidate.phone,
          customerTier: candidate.customerTier,
          sourceSystem: candidate.sourceSystem,
          externalCustomerRef: candidate.externalCustomerRef,
          metadata: {
            ...candidate.metadata,
            lastSyncedFrom: candidate.sourceSystem,
            lastSyncedAt: now,
          },
        });
        createdCount++;
      }
    }

    const allCustomers = await this.listCustomers(tenantId);

    return {
      success: true,
      sourceSystem: targetSource,
      createdCount,
      updatedCount,
      totalCount: allCustomers.length,
      syncedAt: now,
      customers: allCustomers,
    };
  }

  private async seedDatabaseIfEmpty(db: DatabaseSession, tenantId: string): Promise<void> {
    for (const seed of SEED_CUSTOMERS) {
      await db.query(
        `INSERT INTO supportv8.customers
           (id, tenant_id, name, company_name, email, phone, customer_tier, source_system, external_customer_ref, metadata, created_at, updated_at, last_synced_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (tenant_id, LOWER(email)) DO NOTHING`,
        [
          seed.id,
          tenantId,
          seed.name,
          seed.companyName,
          seed.email,
          seed.phone,
          seed.customerTier,
          seed.sourceSystem,
          seed.externalCustomerRef || null,
          JSON.stringify(seed.metadata || {}),
          seed.createdAt,
          seed.updatedAt,
          seed.lastSyncedAt || null,
        ]
      );
    }
  }
}

export const customerService = new CustomerService();
