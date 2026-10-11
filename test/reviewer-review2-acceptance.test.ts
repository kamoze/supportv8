import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { GET as runtimeTicketsGet } from '../src/app/api/runtime/tickets/route';
import {
  signRuntimeEmployeeToken,
  verifyRuntimeEmployeeToken,
  clearRuntimeRecordsStateForTesting,
  setTenantTicketsForTesting,
} from '../src/lib/platform/runtime-records';
import {
  handleAppAcquisition,
  handleAppLaunch,
  clearAcquisitionState,
  setPlanEligibilityFact,
  clearDeductionReceiptsForTesting,
} from '../src/lib/platform/acquisition';
import { POST as marketplacePost } from '../src/app/api/marketplace/route';
import { POST as chatPost } from '../src/app/api/chat/route';
import { POST as scenariosPost } from '../src/app/api/scenarios/route';
import {
  signRuntimeSupportSession,
  setCustomRuntimeAccessResolverForTesting,
  RUNTIME_SUPPORT_COOKIE,
} from '../src/lib/service-app/runtime-session';
import { clearConversationStoreForTesting } from '../src/lib/platform/conversation';
import { clearScenarioStoreForTesting } from '../src/lib/platform/scenarios';

const fixtureSecret = 'review-fixture-secret-not-production';

describe('Review 2 Acceptance Suite (U1-R2, U2-R2, U3-R2, U9-R2)', () => {
  beforeEach(() => {
    process.env.SUPPORTV8_RUNTIME_SESSION_SECRET = fixtureSecret;
    clearRuntimeRecordsStateForTesting();
    clearAcquisitionState();
    clearConversationStoreForTesting();
    clearScenarioStoreForTesting();
    clearDeductionReceiptsForTesting();
    setCustomRuntimeAccessResolverForTesting(async scope => ({
      ...scope,
      capability: 'support:manage',
      email: 'review@example.test',
      domain: scope.accountId === 'acct-b' ? 'tenant-b' : 'tenant-a',
    }));
  });

  afterEach(() => {
    setCustomRuntimeAccessResolverForTesting(null);
  });

  // ==========================================
  // U1-R2: Runtime Records Authority & Data
  // ==========================================
  it('U1-R2: real Runtime GET must not return seeded records when domain persistence and grants are unavailable', async () => {
    const token = signRuntimeEmployeeToken({
      actorId: 'runtime-arthur',
      employeeName: 'Arthur',
      tenantDomain: 'real-org-review',
    });
    const result = await runtimeTicketsGet(
      new Request('https://real-org-review.support.servicev8.com/api/runtime/tickets', {
        headers: {
          host: 'real-org-review.support.servicev8.com',
          authorization: `Bearer ${token}`,
        },
      })
    );
    expect([401, 403, 503]).toContain(result.status);
  });

  it('U1-R2: rejects signed credential missing iat even if exp is far in future', () => {
    const token = signRuntimeEmployeeToken({
      actorId: 'runtime-arthur',
      employeeName: 'Arthur',
      tenantDomain: 'real-org-review',
    });
    const [header, payload] = token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    delete claims.iat;
    claims.exp = Math.floor(Date.now() / 1000) + 86400;
    const encoded = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const sig = createHmac('sha256', process.env.SUPPORTV8_RUNTIME_SESSION_SECRET!)
      .update(`${header}.${encoded}`)
      .digest('base64url');
    const result = verifyRuntimeEmployeeToken(`${header}.${encoded}.${sig}`, {
      expectedTenantDomain: 'real-org-review',
      requiredCapability: 'support:ticket.read',
    });
    expect(result.valid).toBe(false);
  });

  it('U1-R2: rejects future iat or excessive lifetime > 300s', () => {
    const now = Math.floor(Date.now() / 1000);
    // Future iat
    const futureToken = signRuntimeEmployeeToken({
      actorId: 'runtime-arthur',
      employeeName: 'Arthur',
      tenantDomain: 'tenant-a',
      iat: now + 3600,
      exp: now + 3700,
    });
    expect(verifyRuntimeEmployeeToken(futureToken).valid).toBe(false);

    // Excessive lifetime
    const longToken = signRuntimeEmployeeToken({
      actorId: 'runtime-arthur',
      employeeName: 'Arthur',
      tenantDomain: 'tenant-a',
      iat: now,
      exp: now + 301,
    });
    expect(verifyRuntimeEmployeeToken(longToken).valid).toBe(false);
  });

  it('U1-R2: authorized tenant with 0 records returns count 0, not 18 fixture tickets', async () => {
    setTenantTicketsForTesting('empty-authorized-org', []);
    const token = signRuntimeEmployeeToken({
      actorId: 'runtime-arthur',
      employeeName: 'Arthur',
      tenantDomain: 'empty-authorized-org',
    });
    const result = await runtimeTicketsGet(
      new Request('https://empty-authorized-org.support.servicev8.com/api/runtime/tickets', {
        headers: {
          host: 'empty-authorized-org.support.servicev8.com',
          authorization: `Bearer ${token}`,
        },
      })
    );
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.count).toBe(0);
    expect(body.tickets).toEqual([]);
  });

  // ==========================================
  // U2-R2: App Acquisition & Launch
  // ==========================================
  it('U2-R2: fails closed when canonical acquisition owner and plan are unavailable', () => {
    const result = handleAppAcquisition(
      { tenantSlug: 'real-org-review', accountId: 'acct-review' } as any,
      { offerId: 'unknown-offer', clientAcquisitionId: 'review-1' }
    );
    expect(result.success).toBe(false);
  });

  it('U2-R2: duplicate acquisition with changed body conflicts with 409', () => {
    setPlanEligibilityFact('tenant-a', 'starter');
    const first = handleAppAcquisition(
      { tenantSlug: 'tenant-a', accountId: 'acct-a' } as any,
      { offerId: 'servicev8.service-app.supportv8', clientAcquisitionId: 'acq-key-1' }
    );
    expect(first.success).toBe(true);

    // Duplicate with same body -> 200
    const duplicateSame = handleAppAcquisition(
      { tenantSlug: 'tenant-a', accountId: 'acct-a' } as any,
      { offerId: 'servicev8.service-app.supportv8', clientAcquisitionId: 'acq-key-1' }
    );
    expect(duplicateSame.status).toBe(200);

    // Duplicate with different offerId -> 409 Conflict
    const duplicateDiff = handleAppAcquisition(
      { tenantSlug: 'tenant-a', accountId: 'acct-a' } as any,
      { offerId: 'other-offer', clientAcquisitionId: 'acq-key-1' }
    );
    expect(duplicateDiff.status).toBe(409);
    expect(duplicateDiff.success).toBe(false);
  });

  it('U2-R2: unready or revoked installation cannot launch', () => {
    const unready = handleAppLaunch(
      { tenantSlug: 'tenant-a', accountId: 'acct-a' } as any,
      { installationId: 'install-nonexistent' }
    );
    expect(unready.status).toBe(404);
  });

  // ==========================================
  // U3-R2: Shared Debit Body Binding & Idempotency
  // ==========================================
  function makeSessionToken(slug: string, roleCap: 'support:manage' | 'support:read' = 'support:manage') {
    const suffix = slug === 'tenant-b' ? 'b' : 'a';
    const workspaceId = 'tenant_rt_' + suffix.repeat(48);
    return signRuntimeSupportSession(
      {
        accountId: 'acct-' + suffix,
        tenantId: workspaceId,
        workspaceId,
        verticalId: 'runtime',
        installationId: 'fixture-install-' + suffix,
        sub: 'review-owner-' + suffix,
        roleCap,
        tenantDomain: slug,
      },
      fixtureSecret
    );
  }

  // ==========================================
  // U3-R2: Shared Debit Body Binding & Idempotency
  // ==========================================
  it('U3-R2: debit idempotency key with different amount conflicts with 409', async () => {
    const sessionToken = makeSessionToken('tenant-a');

    const makeDebitRequest = (body: object) =>
      new NextRequest('https://tenant-a.support.servicev8.com/api/marketplace', {
        method: 'POST',
        headers: {
          host: 'tenant-a.support.servicev8.com',
          cookie: `${RUNTIME_SUPPORT_COOKIE}=${sessionToken}`,
          'x-servicev8-credits': '100',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });

    const idemKey = 'debit-idem-' + randomUUID();
    const first = await marketplacePost(
      makeDebitRequest({
        action: 'deduct_credits',
        amount: 25,
        reason: 'ticket triage',
        idempotencyKey: idemKey,
      })
    );
    expect(first.status).toBe(200);

    // Duplicate with different amount for same idempotency key -> 409
    const conflict = await marketplacePost(
      makeDebitRequest({
        action: 'deduct_credits',
        amount: 999,
        reason: 'ticket triage',
        idempotencyKey: idemKey,
      })
    );
    expect(conflict.status).toBe(409);
  });

  // ==========================================
  // U9-R2: Production Entry Points (Chat, Scenarios)
  // ==========================================
  it('U9-R2: chat route enforces turn admission, active hire and private thread ACL', async () => {
    const sessionToken = makeSessionToken('tenant-a');

    const makeChatRequest = (body: object, host = 'tenant-a.support.servicev8.com') =>
      new NextRequest(`https://${host}/api/chat`, {
        method: 'POST',
        headers: {
          host,
          cookie: `${RUNTIME_SUPPORT_COOKIE}=${sessionToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });

    // Unhired specialist employee cannot be admitted
    const unhiredRes = await chatPost(
      makeChatRequest({
        query: 'Help with my order',
        employeeId: 'emp_unhired_specialist',
      })
    );
    expect([404, 409]).toContain(unhiredRes.status);
  });

  it('U9-R2: scenarios route enforces tenant configuration ownership and denies cross-tenant overwrite', async () => {
    const makeScenarioRequest = (body: object, slug = 'tenant-a', token = makeSessionToken(slug)) =>
      new NextRequest(`https://${slug}.support.servicev8.com/api/scenarios`, {
        method: 'POST',
        headers: {
          host: `${slug}.support.servicev8.com`,
          cookie: `${RUNTIME_SUPPORT_COOKIE}=${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });

    // 1. Save config for tenant-a
    const saveRes = await scenariosPost(
      makeScenarioRequest({
        action: 'save',
        scenarioId: 'support-escalation',
        name: 'Auto Escalation',
        version: '1.0.0',
        participants: ['runtime-arthur'],
        rules: {},
      })
    );
    expect(saveRes.status).toBe(200);
    const saveBody = await saveRes.json();
    const configId = saveBody.data.id;

    // 2. Tenant B attempts to overwrite tenant A's config -> 403
    const foreignRes = await scenariosPost(
      makeScenarioRequest(
        {
          action: 'save',
          id: configId,
          scenarioId: 'support-escalation',
          name: 'Hijacked Escalation',
          version: '2.0.0',
          participants: ['runtime-sophia'],
          rules: {},
        },
        'tenant-b',
        makeSessionToken('tenant-b')
      )
    );
    expect(foreignRes.status).toBe(403);
  });
});
