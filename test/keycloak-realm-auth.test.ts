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

      // 2. Acme Movers Admin
      const moversAdmin = await store.authenticate("admin@acme-movers.com", "SupportV8#2026!Secure");
      expect(moversAdmin.success).toBe(true);
      expect(moversAdmin.user?.tenantSlug).toBe("acme-movers");
      expect(moversAdmin.user?.name).toBe("Admin Acme Movers");

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
      const badChange = store.changePassword("admin@acme-movers.com", "WrongCurrent", "BrandNewPassword#2026");
      expect(badChange.success).toBe(false);

      // Correct current password
      const goodChange = store.changePassword("admin@acme-movers.com", "SupportV8#2026!Secure", "BrandNewPassword#2026");
      expect(goodChange.success).toBe(true);

      // Old password fails, new password succeeds
      const oldAuth = await store.authenticate("admin@acme-movers.com", "SupportV8#2026!Secure");
      expect(oldAuth.success).toBe(false);

      const newAuth = await store.authenticate("admin@acme-movers.com", "BrandNewPassword#2026");
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
});
