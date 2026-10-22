import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateKeyPair, SignJWT, exportSPKI, type GenerateKeyPairResult } from "jose";
import {
  authenticateInteractionIngress,
  setInteractionIngressAuthKeyForTesting,
} from "@/lib/service-app/interaction-ingress-auth";
import { validateInteractionEnvelope } from "@/lib/connectors/interaction-envelope";
import { POST } from "@/app/api/private/interaction-events/route";
import { setInteractionRepositoryForTesting } from "@/lib/connectors/interaction-repository-registry";

describe("Interaction Ingress Security & Envelope Validation", () => {
  let keyPair: GenerateKeyPairResult;
  let otherKeyPair: GenerateKeyPairResult;

  const validIssuer = "https://auth.servicev8.com/realms/servicev8";
  const validAudience = "supportv8";
  const validAzp = "action-gateway-support";
  const validScope = "supportv8:interactions:ingest";
  const tenantId = "tenant_test_123";
  const accountId = "acc_test_456";

  beforeAll(async () => {
    keyPair = await generateKeyPair("RS256");
    otherKeyPair = await generateKeyPair("RS256");
    setInteractionIngressAuthKeyForTesting(keyPair.publicKey);
  });

  afterAll(() => {
    setInteractionIngressAuthKeyForTesting(null);
    setInteractionRepositoryForTesting(null);
  });

  async function createToken(
    claims: Record<string, unknown> = {},
    options: {
      signKey?: any;
      lifetimeSeconds?: number;
      issuer?: string;
      audience?: string;
      alg?: string;
    } = {}
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const lifetime = options.lifetimeSeconds ?? 60;
    const signingKey = options.signKey ?? keyPair.privateKey;

    const jwt = new SignJWT({
      sub: "action-gateway-sub",
      azp: validAzp,
      account_id: accountId,
      tenant_id: tenantId,
      scope: validScope,
      jti: `jti_${crypto.randomUUID().replace(/-/g, "")}`,
      ...claims,
    })
      .setProtectedHeader({ alg: options.alg ?? "RS256" })
      .setIssuer(options.issuer ?? validIssuer)
      .setAudience(options.audience ?? validAudience)
      .setIssuedAt(now)
      .setExpirationTime(now + lifetime);

    return await jwt.sign(signingKey);
  }

  function createValidEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      eventId: "evt_zk_1001",
      accountId,
      tenantId,
      connectionId: "conn_zk_primary",
      connectorKey: "zendesk",
      source: "zendesk",
      sourceReference: "12345",
      customerReference: "cust_c890",
      sourceUrl: "https://acme-help.zendesk.com/tickets/12345",
      text: "Customer reports invoice generation failed on renewal.",
      sender: "customer",
      occurredAt: new Date(Date.now() - 5000).toISOString(),
      raw: { ticketId: 12345, priority: "high" },
      ...overrides,
    };
  }

  describe("Workload Token Authentication", () => {
    it("accepts valid RS256 token with matching claims and headers", async () => {
      const token = await createToken();
      const request = new Request("https://supportv8.internal/api/private/interaction-events", {
        headers: {
          authorization: `Bearer ${token}`,
          "x-servicev8-account-id": accountId,
          "x-servicev8-tenant-id": tenantId,
        },
      });

      const result = await authenticateInteractionIngress(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.actor.clientId).toBe(validAzp);
        expect(result.actor.accountId).toBe(accountId);
        expect(result.actor.tenantId).toBe(tenantId);
        expect(result.actor.scope).toBe(validScope);
      }
    });

    it("accepts Keycloak client_credentials token without tenant claims when headers provide valid context", async () => {
      const now = Math.floor(Date.now() / 1000);
      const jwt = new SignJWT({
        sub: "service-account-action-gateway-support",
        azp: validAzp,
        scope: "openid supportv8:interactions:ingest email",
        jti: `jti_${crypto.randomUUID().replace(/-/g, "")}`,
      })
        .setProtectedHeader({ alg: "RS256" })
        .setIssuer(validIssuer)
        .setAudience(validAudience)
        .setIssuedAt(now)
        .setExpirationTime(now + 60);

      const token = await jwt.sign(keyPair.privateKey);
      const request = new Request("https://supportv8.internal/api/private/interaction-events", {
        headers: {
          authorization: `Bearer ${token}`,
          "x-servicev8-account-id": "acc_keycloak_123",
          "x-servicev8-tenant-id": "tenant_keycloak_456",
        },
      });

      const result = await authenticateInteractionIngress(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.actor.clientId).toBe(validAzp);
        expect(result.actor.accountId).toBe("acc_keycloak_123");
        expect(result.actor.tenantId).toBe("tenant_keycloak_456");
      }
    });

    it("rejects request missing Authorization header with 401", async () => {
      const request = new Request("https://supportv8.internal/api/private/interaction-events", {
        headers: {
          "x-servicev8-account-id": accountId,
          "x-servicev8-tenant-id": tenantId,
        },
      });

      const result = await authenticateInteractionIngress(request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
      }
    });

    it("rejects non-Bearer authorization format with 401", async () => {
      const request = new Request("https://supportv8.internal/api/private/interaction-events", {
        headers: {
          authorization: "Basic dXNlcjpwYXNz",
          "x-servicev8-account-id": accountId,
          "x-servicev8-tenant-id": tenantId,
        },
      });

      const result = await authenticateInteractionIngress(request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
      }
    });

    it("rejects token signed with unauthorized key with 401", async () => {
      const token = await createToken({}, { signKey: otherKeyPair.privateKey });
      const request = new Request("https://supportv8.internal/api/private/interaction-events", {
        headers: {
          authorization: `Bearer ${token}`,
          "x-servicev8-account-id": accountId,
          "x-servicev8-tenant-id": tenantId,
        },
      });

      const result = await authenticateInteractionIngress(request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
      }
    });

    it("rejects token with lifetime exceeding 120 seconds with 401", async () => {
      const token = await createToken({}, { lifetimeSeconds: 125 });
      const request = new Request("https://supportv8.internal/api/private/interaction-events", {
        headers: {
          authorization: `Bearer ${token}`,
          "x-servicev8-account-id": accountId,
          "x-servicev8-tenant-id": tenantId,
        },
      });

      const result = await authenticateInteractionIngress(request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
        expect(result.error).toContain("120 seconds");
      }
    });

    it("rejects expired token with 401", async () => {
      const now = Math.floor(Date.now() / 1000);
      const jwt = new SignJWT({
        sub: "action-gateway-sub",
        azp: validAzp,
        account_id: accountId,
        tenant_id: tenantId,
        scope: validScope,
        jti: `jti_${crypto.randomUUID().replace(/-/g, "")}`,
      })
        .setProtectedHeader({ alg: "RS256" })
        .setIssuer(validIssuer)
        .setAudience(validAudience)
        .setIssuedAt(now - 100)
        .setExpirationTime(now - 10);

      const token = await jwt.sign(keyPair.privateKey);
      const request = new Request("https://supportv8.internal/api/private/interaction-events", {
        headers: {
          authorization: `Bearer ${token}`,
          "x-servicev8-account-id": accountId,
          "x-servicev8-tenant-id": tenantId,
        },
      });

      const result = await authenticateInteractionIngress(request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
      }
    });

    it("rejects token with wrong audience with 401", async () => {
      const token = await createToken({}, { audience: "wrong-audience" });
      const request = new Request("https://supportv8.internal/api/private/interaction-events", {
        headers: {
          authorization: `Bearer ${token}`,
          "x-servicev8-account-id": accountId,
          "x-servicev8-tenant-id": tenantId,
        },
      });

      const result = await authenticateInteractionIngress(request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
      }
    });

    it("rejects token with wrong azp with 403", async () => {
      const token = await createToken({ azp: "rogue-agent" });
      const request = new Request("https://supportv8.internal/api/private/interaction-events", {
        headers: {
          authorization: `Bearer ${token}`,
          "x-servicev8-account-id": accountId,
          "x-servicev8-tenant-id": tenantId,
        },
      });

      const result = await authenticateInteractionIngress(request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(403);
        expect(result.error).toContain("azp");
      }
    });

    it("rejects token with wrong scope with 403", async () => {
      const token = await createToken({ scope: "supportv8:tickets:read" });
      const request = new Request("https://supportv8.internal/api/private/interaction-events", {
        headers: {
          authorization: `Bearer ${token}`,
          "x-servicev8-account-id": accountId,
          "x-servicev8-tenant-id": tenantId,
        },
      });

      const result = await authenticateInteractionIngress(request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(403);
        expect(result.error).toContain("scope");
      }
    });

    it("rejects mismatched x-servicev8-tenant-id header with 403", async () => {
      const token = await createToken();
      const request = new Request("https://supportv8.internal/api/private/interaction-events", {
        headers: {
          authorization: `Bearer ${token}`,
          "x-servicev8-account-id": accountId,
          "x-servicev8-tenant-id": "tenant_attacker",
        },
      });

      const result = await authenticateInteractionIngress(request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(403);
        expect(result.error).toContain("mismatch");
      }
    });

    it("rejects mismatched x-servicev8-account-id header with 403", async () => {
      const token = await createToken();
      const request = new Request("https://supportv8.internal/api/private/interaction-events", {
        headers: {
          authorization: `Bearer ${token}`,
          "x-servicev8-account-id": "acc_attacker",
          "x-servicev8-tenant-id": tenantId,
        },
      });

      const result = await authenticateInteractionIngress(request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(403);
        expect(result.error).toContain("mismatch");
      }
    });

    it("rejects missing x-servicev8-* headers with 403", async () => {
      const token = await createToken();
      const request = new Request("https://supportv8.internal/api/private/interaction-events", {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const result = await authenticateInteractionIngress(request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(403);
      }
    });
  });

  describe("Interaction Envelope Validation", () => {
    it("accepts a fully compliant Zendesk interaction envelope", () => {
      const valid = createValidEnvelope();
      const result = validateInteractionEnvelope(valid);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.event.eventId).toBe("evt_zk_1001");
        expect(result.event.source).toBe("zendesk");
        expect(result.event.sourceUrl).toBe("https://acme-help.zendesk.com/tickets/12345");
        expect(result.event.sender).toBe("customer");
      }
    });

    it("rejects unknown keys in envelope with 400", () => {
      const body = {
        ...createValidEnvelope(),
        unexpectedField: "rogue_data",
      };
      const result = validateInteractionEnvelope(body);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.status).toBe(400);
        expect(result.error).toContain("unexpectedField");
      }
    });

    it("rejects non-object envelope with 400", () => {
      expect(validateInteractionEnvelope(null).valid).toBe(false);
      expect(validateInteractionEnvelope([]).valid).toBe(false);
      expect(validateInteractionEnvelope("string").valid).toBe(false);
    });

    it("rejects missing required identifiers with 400", () => {
      const fields = [
        "eventId",
        "accountId",
        "tenantId",
        "connectionId",
        "sourceReference",
        "customerReference",
        "sourceUrl",
        "sender",
        "occurredAt",
      ];
      for (const field of fields) {
        const body = createValidEnvelope();
        delete body[field];
        const result = validateInteractionEnvelope(body);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.status).toBe(400);
          expect(result.error).toContain(field);
        }
      }
    });

    it("rejects non-Zendesk source with 400", () => {
      const body = createValidEnvelope({ source: "salesforce" });
      const result = validateInteractionEnvelope(body);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.status).toBe(400);
        expect(result.error).toContain("zendesk");
      }
    });

    it("rejects invalid sourceUrl (non-HTTPS or non-Zendesk deep link) with 400", () => {
      const invalidUrls = [
        "http://acme.zendesk.com/tickets/12345", // HTTP insecure
        "https://malicious.com/tickets/12345", // Non-zendesk domain
        "https://acme.zendesk.com/other/12345", // Wrong path
        "https://acme.zendesk.com/tickets/not-a-number", // Ticket not digits
        "https://acme.zendesk.com.attacker.com/tickets/12345", // Domain spoofing
      ];

      for (const url of invalidUrls) {
        const body = createValidEnvelope({ sourceUrl: url });
        const result = validateInteractionEnvelope(body);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.status).toBe(400);
          expect(result.error).toContain("sourceUrl");
        }
      }
    });

    it("accepts valid Zendesk deep links (tickets and agent/tickets)", () => {
      const validUrls = [
        "https://acme.zendesk.com/tickets/12345",
        "https://sub-domain-1.zendesk.com/agent/tickets/998877",
      ];

      for (const url of validUrls) {
        const body = createValidEnvelope({ sourceUrl: url });
        const result = validateInteractionEnvelope(body);
        expect(result.valid).toBe(true);
      }
    });

    it("rejects text exceeding 100,000 characters with 400", () => {
      const body = createValidEnvelope({ text: "a".repeat(100_001) });
      const result = validateInteractionEnvelope(body);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.status).toBe(400);
        expect(result.error).toContain("100,000");
      }
    });

    it("accepts text of exactly 100,000 characters", () => {
      const body = createValidEnvelope({ text: "a".repeat(100_000) });
      const result = validateInteractionEnvelope(body);
      expect(result.valid).toBe(true);
    });

    it("rejects raw payload exceeding 1 MiB with 400", () => {
      // 1 MiB = 1,048,576 bytes
      const bigString = "x".repeat(1_050_000);
      const body = createValidEnvelope({ raw: { big: bigString } });
      const result = validateInteractionEnvelope(body);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.status).toBe(400);
        expect(result.error).toContain("1 MiB");
      }
    });

    it("rejects occurredAt in the future (>60s skew) with 400", () => {
      const futureDate = new Date(Date.now() + 120_000).toISOString();
      const body = createValidEnvelope({ occurredAt: futureDate });
      const result = validateInteractionEnvelope(body);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.status).toBe(400);
        expect(result.error).toContain("future");
      }
    });

    it("accepts occurredAt within 60s future skew tolerance", () => {
      const acceptableFuture = new Date(Date.now() + 30_000).toISOString();
      const body = createValidEnvelope({ occurredAt: acceptableFuture });
      const result = validateInteractionEnvelope(body);
      expect(result.valid).toBe(true);
    });

    it("rejects occurredAt older than 7 days with 400", () => {
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const body = createValidEnvelope({ occurredAt: oldDate });
      const result = validateInteractionEnvelope(body);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.status).toBe(400);
        expect(result.error).toContain("7 days");
      }
    });

    it("accepts occurredAt within 7 days", () => {
      const validRecent = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const body = createValidEnvelope({ occurredAt: validRecent });
      const result = validateInteractionEnvelope(body);
      expect(result.valid).toBe(true);
    });

    it("rejects invalid sender value with 400", () => {
      const body = createValidEnvelope({ sender: "robot" });
      const result = validateInteractionEnvelope(body);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.status).toBe(400);
        expect(result.error).toContain("sender");
      }
    });
  });

  describe("Route-level Tenant & Payload Consistency", () => {
    it("rejects request when token tenant_id does not match envelope tenantId with 403", async () => {
      const token = await createToken({ tenant_id: "tenant_legit" });
      const mockRepo = {
        recordInteraction: async () => {
          throw new Error("Should not be called");
        },
      } as any;
      setInteractionRepositoryForTesting(mockRepo);

      const envelope = createValidEnvelope({ tenantId: "tenant_spoofed" });
      const request = new Request("https://supportv8.internal/api/private/interaction-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
          "x-servicev8-account-id": accountId,
          "x-servicev8-tenant-id": "tenant_legit",
        },
        body: JSON.stringify(envelope),
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain("mismatch");
    });

    it("rejects request when token account_id does not match envelope accountId with 403", async () => {
      const token = await createToken({ account_id: "acc_legit" });
      const mockRepo = {
        recordInteraction: async () => {
          throw new Error("Should not be called");
        },
      } as any;
      setInteractionRepositoryForTesting(mockRepo);

      const envelope = createValidEnvelope({ accountId: "acc_spoofed" });
      const request = new Request("https://supportv8.internal/api/private/interaction-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
          "x-servicev8-account-id": "acc_legit",
          "x-servicev8-tenant-id": tenantId,
        },
        body: JSON.stringify(envelope),
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain("mismatch");
    });

    it("persists and returns 202 on valid ingestion", async () => {
      let recordedInput: any = null;
      const mockRepo = {
        recordInteraction: async (input: any) => {
          recordedInput = input;
          return { replayed: false, interactionId: "evt_committed_1" };
        },
      } as any;
      setInteractionRepositoryForTesting(mockRepo);

      const token = await createToken();
      const envelope = createValidEnvelope();
      const request = new Request("https://supportv8.internal/api/private/interaction-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
          "x-servicev8-account-id": accountId,
          "x-servicev8-tenant-id": tenantId,
        },
        body: JSON.stringify(envelope),
      });

      const response = await POST(request);
      expect(response.status).toBe(202);
      const data = await response.json();
      expect(data.accepted).toBe(true);
      expect(data.replayed).toBe(false);
      expect(data.eventId).toBe("evt_zk_1001");
      expect(data.interactionId).toBe("evt_committed_1");
      expect(recordedInput).toBeDefined();
      expect(recordedInput.eventId).toBe("evt_zk_1001");
    });

    it("returns 200 with replayed: true on duplicate event", async () => {
      const mockRepo = {
        recordInteraction: async () => ({ replayed: true, interactionId: "evt_existing_9" }),
      } as any;
      setInteractionRepositoryForTesting(mockRepo);

      const token = await createToken();
      const envelope = createValidEnvelope();
      const request = new Request("https://supportv8.internal/api/private/interaction-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
          "x-servicev8-account-id": accountId,
          "x-servicev8-tenant-id": tenantId,
        },
        body: JSON.stringify(envelope),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.accepted).toBe(true);
      expect(data.replayed).toBe(true);
      expect(data.interactionId).toBe("evt_existing_9");
    });
  });
});
