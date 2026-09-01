import { describe, expect, it } from "vitest";
import type { RequestTenantContext } from "../src/lib/auth/request-tenant";
import {
  requireChatOperatorRole,
  requirePersistentMutationRole,
} from "../src/lib/chatbot/security/ingress-security";

describe("restricted demo operator", () => {
  const tenant: RequestTenantContext = {
    tenantId: "tenant_acme",
    tenantSlug: "acme",
    authenticated: true,
    userId: "demo-account",
    roles: ["support_demo_operator"],
  };

  it("can enter operator chat but cannot mutate shared workspace records", () => {
    expect(() => requireChatOperatorRole(tenant)).not.toThrow();
    expect(() => requirePersistentMutationRole(tenant)).toThrow(
      "Demo operators cannot change shared workspace data"
    );
  });
});
