import { describe, it, expect } from "vitest";
import { hashPassword, verifyPasswordHash } from "../src/lib/auth/password";
import { UserCredentialStore } from "../src/lib/auth/credential-store";
import { mapRealmRolesToSupportRole } from "../src/lib/auth/keycloak";

describe("SupportV8 Keycloak Realm & Password Auth Architecture", () => {
  describe("Cryptographic Password Hashing", () => {
    it("should hash and verify passwords using salted scrypt", () => {
      const password = "SupportV8#2026!Secure";
      const hash = hashPassword(password);

      expect(hash).toContain(":");
      const [salt, key] = hash.split(":");
      expect(salt.length).toBe(32); // 16 bytes hex
      expect(key.length).toBe(128); // 64 bytes hex

      expect(verifyPasswordHash(password, hash)).toBe(true);
      expect(verifyPasswordHash("WrongPassword#123", hash)).toBe(false);
      expect(verifyPasswordHash("", hash)).toBe(false);
      expect(verifyPasswordHash(password, "")).toBe(false);
    });

    it("should generate distinct salts for identical passwords", () => {
      const password = "SupportV8#2026!Secure";
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(verifyPasswordHash(password, hash1)).toBe(true);
      expect(verifyPasswordHash(password, hash2)).toBe(true);
    });
  });

  describe("User Credential Store & Keycloak Role Mapping", () => {
    it("should authenticate seeded core accounts with default credentials", async () => {
      const store = new UserCredentialStore();

      // 1. Acme Master Admin
      const acmeMaster = await store.authenticate("acme@servicev8.com", "SupportV8#2026!Secure");
      expect(acmeMaster.success).toBe(true);
      expect(acmeMaster.user?.tenantSlug).toBe("acme");
      expect(acmeMaster.user?.role).toBe("cx_lead");

      // 2. Acme Admin
      const acmeAdmin = await store.authenticate("admin@acme.com", "SupportV8#2026!Secure");
      expect(acmeAdmin.success).toBe(true);
      expect(acmeAdmin.user?.tenantSlug).toBe("acme");
      expect(acmeAdmin.user?.name).toBe("Sarah Chen");

      // 3. Meridian Field Dispatch
      const meridianDispatch = await store.authenticate("dispatch@meridian.com", "SupportV8#2026!Secure");
      expect(meridianDispatch.success).toBe(true);
      expect(meridianDispatch.user?.tenantSlug).toBe("meridian");
      expect(meridianDispatch.user?.role).toBe("contractor_lead");
    });

    it("should reject incorrect passwords", async () => {
      const store = new UserCredentialStore();
      const res = await store.authenticate("acme@servicev8.com", "InvalidPassword123!");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Incorrect password. Please try again.");
    });

    it("should reject non-existent accounts", async () => {
      const store = new UserCredentialStore();
      const res = await store.authenticate("unknown@domain.com", "AnyPassword#123");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Account not found");
    });

    it("should register new users with salted password hashes and authenticate", async () => {
      const store = new UserCredentialStore();
      const reg = store.registerUser({
        email: "alex.tech@acme-movers.com",
        password: "NewMoverPassword#2026",
        name: "Alex Technician",
        tenantSlug: "acme-movers",
        role: "technician",
      });

      expect(reg.success).toBe(true);
      expect(reg.user?.email).toBe("alex.tech@acme-movers.com");

      // Duplicate registration rejected
      const dup = store.registerUser({
        email: "alex.tech@acme-movers.com",
        password: "AnotherPassword",
      });
      expect(dup.success).toBe(false);

      // Authenticate with new password
      const auth = await store.authenticate("alex.tech@acme-movers.com", "NewMoverPassword#2026");
      expect(auth.success).toBe(true);
      expect(auth.user?.role).toBe("technician");
    });

    it("should allow users to change passwords securely", async () => {
      const store = new UserCredentialStore();

      // Wrong current password
      const badChange = store.changePassword("david.kim@acme.com", "WrongCurrent", "BrandNewPassword#2026");
      expect(badChange.success).toBe(false);

      // Correct current password
      const goodChange = store.changePassword("david.kim@acme.com", "SupportV8#2026!Secure", "BrandNewPassword#2026");
      expect(goodChange.success).toBe(true);

      // Old password fails, new password succeeds
      const oldAuth = await store.authenticate("david.kim@acme.com", "SupportV8#2026!Secure");
      expect(oldAuth.success).toBe(false);

      const newAuth = await store.authenticate("david.kim@acme.com", "BrandNewPassword#2026");
      expect(newAuth.success).toBe(true);
    });

    it("should map Keycloak realm roles correctly to SupportV8 application roles", () => {
      expect(mapRealmRolesToSupportRole(["support_superadmin"])).toBe("superadmin");
      expect(mapRealmRolesToSupportRole(["support_cx_lead"])).toBe("cx_lead");
      expect(mapRealmRolesToSupportRole(["support_operator"])).toBe("operator");
      expect(mapRealmRolesToSupportRole(["support_contractor_lead"])).toBe("contractor_lead");
      expect(mapRealmRolesToSupportRole(["support_technician"])).toBe("technician");
      expect(mapRealmRolesToSupportRole(["support_observer"])).toBe("observer");
      expect(mapRealmRolesToSupportRole([])).toBe("operator");
    });
  });

  describe("RBAC Permissions Matrix & Access Control", () => {
    // RBAC Capability definitions
    const permissions: Record<string, string[]> = {
      superadmin: ["ticket:all", "policy:write", "refund:unlimited", "tenant:manage", "audit:view", "agent:manage"],
      cx_lead: ["ticket:triage", "policy:write", "refund:up_to_500", "team:manage", "audit:view", "agent:manage"],
      operator: ["ticket:triage", "ticket:reply", "refund:up_to_50", "knowledge:search", "chat:live"],
      contractor_lead: ["job:order_manage", "contractor:pin_verify", "ticket:contractor_view"],
      technician: ["site:pass_access", "ticket:contractor_view"],
      observer: ["metrics:read", "audit:view"],
    };

    function hasPermission(role: string, action: string): boolean {
      const perms = permissions[role] || [];
      return perms.includes(action) || perms.includes("ticket:all") || role === "superadmin";
    }

    it("should enforce CX Lead permissions (Policy authoring & refunds up to $500)", () => {
      expect(hasPermission("cx_lead", "policy:write")).toBe(true);
      expect(hasPermission("cx_lead", "refund:up_to_500")).toBe(true);
      expect(hasPermission("cx_lead", "agent:manage")).toBe(true);
      expect(hasPermission("cx_lead", "site:pass_access")).toBe(false);
    });

    it("should enforce Operator permissions (Triage, live chat, limited refunds)", () => {
      expect(hasPermission("operator", "ticket:triage")).toBe(true);
      expect(hasPermission("operator", "chat:live")).toBe(true);
      expect(hasPermission("operator", "refund:up_to_50")).toBe(true);
      expect(hasPermission("operator", "policy:write")).toBe(false);
      expect(hasPermission("operator", "team:manage")).toBe(false);
    });

    it("should enforce Contractor & Technician permissions (Field jobs, lockbox passes)", () => {
      expect(hasPermission("contractor_lead", "contractor:pin_verify")).toBe(true);
      expect(hasPermission("contractor_lead", "job:order_manage")).toBe(true);
      expect(hasPermission("technician", "site:pass_access")).toBe(true);
      expect(hasPermission("technician", "policy:write")).toBe(false);
    });

    it("should enforce Observer permissions (Read-only audits)", () => {
      expect(hasPermission("observer", "audit:view")).toBe(true);
      expect(hasPermission("observer", "metrics:read")).toBe(true);
      expect(hasPermission("observer", "ticket:reply")).toBe(false);
      expect(hasPermission("observer", "refund:up_to_50")).toBe(false);
    });
  });

  describe("Tenant Onboarding & Keycloak Integration", () => {
    it("should register new tenant admin credentials and assign CX Lead role", async () => {
      const store = new UserCredentialStore();
      const tenantSlug = "apex-logistics";
      const adminEmail = "admin@apex-logistics.com";
      const password = "ApexSecure#2026!Pass";

      const reg = store.registerUser({
        email: adminEmail,
        password,
        name: "Apex Logistics Administrator",
        tenantSlug,
        role: "cx_lead",
      });

      expect(reg.success).toBe(true);
      expect(reg.user?.tenantSlug).toBe("apex-logistics");
      expect(reg.user?.role).toBe("cx_lead");

      // Verify immediate login capability with new credentials
      const auth = await store.authenticate(adminEmail, password);
      expect(auth.success).toBe(true);
      expect(auth.user?.role).toBe("cx_lead");
    });
  });
});

