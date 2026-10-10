import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { signRuntimeEmployeeToken, clearRuntimeRecordsStateForTesting } from '@/lib/platform/runtime-records';
import { GET as readTickets, POST as writeTicket } from '@/app/api/runtime/tickets/route';
import { POST as marketplace } from '@/app/api/marketplace/route';
import { POST as signup } from '@/app/api/tenant/signup/route';
import { signRuntimeSupportSession, setCustomRuntimeAccessResolverForTesting, RUNTIME_SUPPORT_COOKIE } from '@/lib/service-app/runtime-session';
import { marketplaceService } from '@/lib/services/marketplace-service';
import { admitAgenticTurn, getThreadTurnHistory, clearConversationStoreForTesting } from '@/lib/platform/conversation';
import { saveScenarioConfig, getScenarioConfig, startScenarioRun, clearScenarioStoreForTesting } from '@/lib/platform/scenarios';
import { createInMemoryDomainOutboxStore, validateOlgReceipt, sanitizeDomainEventPayload } from '@/lib/platform/event-outbox';
import { normalizeRuntimeWorkspaceView } from '@/lib/service-app/runtime-workspace-view';
import { dispatchAgenticTurn } from '@/lib/chat/agenticos-chat-client';
import { safeEmitSignal } from '@/lib/signals/signal-agent';
import { otpStore } from '@/lib/auth/otp-store';
import { tenantSignupRegistry, TenantRegistryUnavailableError } from '@/lib/auth/tenant-signup-registry';
import { clearAcquisitionState } from '@/lib/platform/acquisition';

const fixtureSecret = 'independent-review-synthetic-session-' + randomUUID();
const fetchSpy = vi.fn(async () => { throw new Error('review blocks external network'); });

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('SUPPORTV8_RUNTIME_SESSION_SECRET', fixtureSecret);
  vi.stubGlobal('fetch', fetchSpy); fetchSpy.mockClear();
  clearRuntimeRecordsStateForTesting();
  clearConversationStoreForTesting();
  clearScenarioStoreForTesting();
  clearAcquisitionState();
  setCustomRuntimeAccessResolverForTesting(async scope => ({
    ...scope,
    capability: 'support:manage',
    email: 'review@example.test',
    domain: scope.accountId === 'acct-b' ? 'tenant-b' : 'tenant-a',
  }));
});

afterEach(() => {
  setCustomRuntimeAccessResolverForTesting(null);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function tenantRequest(slug: string, body: object) {
  const suffix = slug === 'tenant-b' ? 'b' : 'a';
  const workspaceId = 'tenant_rt_' + suffix.repeat(48);
  const token = signRuntimeSupportSession(
    {
      accountId: 'acct-' + suffix,
      tenantId: workspaceId,
      workspaceId,
      verticalId: 'runtime',
      installationId: 'fixture-install-' + suffix,
      sub: 'review-owner-' + suffix,
      roleCap: 'support:manage',
      tenantDomain: slug,
    },
    fixtureSecret
  );
  return new NextRequest(`https://${slug}.support.servicev8.com/api/marketplace`, {
    method: 'POST',
    headers: {
      host: `${slug}.support.servicev8.com`,
      cookie: `${RUNTIME_SUPPORT_COOKIE}=${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function recordRequest(overrides: Record<string, unknown> = {}, host = 'tenant-a.support.servicev8.com', method = 'GET') {
  const token = signRuntimeEmployeeToken({
    actorId: 'runtime-arthur',
    employeeName: 'Arthur',
    tenantDomain: 'tenant-a',
    ...overrides,
  } as any);
  return new Request(`https://${host}/api/runtime/tickets`, {
    method,
    headers: { host, authorization: `Bearer ${token}` },
  });
}

// U1: Runtime Records
it('U1: absent signing secret fails closed on actual Runtime records route', async () => {
  delete process.env.SUPPORTV8_RUNTIME_SESSION_SECRET;
  const res = await readTickets(recordRequest());
  expect(res.status).toBe(503);
});

it('U1: wrong issuer, one-year expiry, unknown actor, status-only capability and default tenant are denied', async () => {
  const res = await readTickets(
    recordRequest(
      {
        iss: 'https://wrong.example.test',
        exp: Math.floor(Date.now() / 1000) + 31536000,
        employeeName: 'Unknown',
        actorId: 'not-a-runtime-employee',
        tenantDomain: 'default',
        capabilities: ['support:status.read'],
      },
      'tenant-b.support.servicev8.com'
    )
  );
  expect([401, 403]).toContain(res.status);
});

it('U1: tenant A and B receive tenant-isolated ticket IDs', async () => {
  const a = await (await readTickets(recordRequest())).json();
  const b = await (await readTickets(recordRequest({ tenantDomain: 'tenant-b', actorId: 'runtime-arthur' }, 'tenant-b.support.servicev8.com'))).json();
  expect(a.tickets.length).toBeGreaterThan(0);
  expect(b.tickets.length).toBeGreaterThan(0);
  const aIds = a.tickets.map((t: any) => t.id);
  const bIds = b.tickets.map((t: any) => t.id);
  expect(aIds).not.toEqual(bIds);
});

// U2: App Acquisition and Launch
it('U2: client-key acquisition is scoped per tenant, preventing cross-tenant collision', async () => {
  const key = randomUUID();
  const a = await marketplace(tenantRequest('tenant-a', { action: 'app_acquire', clientAcquisitionId: key }));
  const b = await marketplace(tenantRequest('tenant-b', { action: 'app_acquire', clientAcquisitionId: key }));
  expect(a.status).toBe(200);
  expect(b.status).toBe(200);
  expect((await a.json()).data.tenantSlug).toBe('tenant-a');
  expect((await b.json()).data.tenantSlug).toBe('tenant-b');
});

it('U2: app launch rejects nonexistent installation with 404', async () => {
  const res = await marketplace(tenantRequest('tenant-a', { action: 'app_launch', installationId: randomUUID() }));
  expect(res.status).toBe(404);
});

// U3: Credits and Workforce Containment
it('U3: select_plan does not refill zero account balance for customer tenant without Forge', async () => {
  const context = { accountId: 'acct-a', runtimeLinked: true };
  marketplaceService.setCredits(0, 'tenant-a', context);
  const plan = marketplaceService.getPlans('tenant-a', context)[1];
  const res = await marketplace(tenantRequest('tenant-a', { action: 'select_plan', planId: plan.id }));
  expect(res.status).toBe(200);
  expect(marketplaceService.getCredits('tenant-a', context)).toBe(0);
});

it('U3: duplicate debit retries settle once using idempotencyKey', async () => {
  const context = { accountId: 'acct-a', runtimeLinked: true };
  marketplaceService.setCredits(100, 'tenant-a', context);
  const body = { action: 'deduct_credits', amount: 10, idempotencyKey: randomUUID() };
  const first = await marketplace(tenantRequest('tenant-a', body));
  const second = await marketplace(tenantRequest('tenant-a', body));
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(marketplaceService.getCredits('tenant-a', context)).toBe(90);
});

// U4: Conversation / AgenticOS Chat
it('U4: conversation replay enforces matching actor and hired employee', () => {
  const input = { tenantSlug: 'tenant-a', actorId: 'owner-a', clientTurnId: 'one', employeeId: 'specialist-a', prompt: 'same', activeHires: ['specialist-a'], isPrivate: true };
  const first = admitAgenticTurn(input);
  expect(first.status).toBe(200);
  const replayDifferentActor = admitAgenticTurn({ ...input, actorId: 'outsider', employeeId: 'other', activeHires: [] });
  expect(replayDifferentActor.status).toBe(409);
});

it('U4: foreign tenant cannot append to existing private thread', () => {
  const first = admitAgenticTurn({ tenantSlug: 'tenant-a', actorId: 'owner-a', clientTurnId: 'a', employeeId: 'specialist', prompt: 'A', activeHires: ['specialist'], isPrivate: true });
  expect(first.status).toBe(200);
  const cross = admitAgenticTurn({ tenantSlug: 'tenant-b', actorId: 'owner-b', clientTurnId: 'b', threadId: first.threadId, employeeId: 'specialist', prompt: 'B', activeHires: ['specialist'] });
  expect(cross.status).toBe(403);
  const history = getThreadTurnHistory({ tenantSlug: 'tenant-a', callerSubject: 'owner-a', threadId: first.threadId! });
  expect(history.turns?.map(t => t.tenantSlug)).toEqual(['tenant-a']);
});

it('U4: dispatchAgenticTurn passes clientTurnId and instanceId in request body', async () => {
  let body: any;
  await dispatchAgenticTurn(
    { tenantSlug: 'tenant-a', tenantId: 'canonical-a', prompt: 'synthetic', clientTurnId: 'turn-123', instanceId: 'inst-123' },
    {
      env: { SERVICEV8_RUNTIME_URL: 'https://runtime.example.test' },
      fetchImpl: async (_u, init) => {
        body = JSON.parse(String(init?.body));
        return Response.json({ turnId: 't', threadId: 'h' });
      },
    }
  );
  expect(body.clientTurnId).toBe('turn-123');
  expect(body.instanceId).toBe('inst-123');
  expect(body.recipientId).toBe('support_lead');
});

// U5: Scenarios
it('U5: foreign tenant cannot overwrite scenario configuration by ID', () => {
  const config = saveScenarioConfig({ tenantSlug: 'tenant-a', scenarioId: 'definition-a', name: 'A', participants: [], parameters: {} });
  expect(() => {
    saveScenarioConfig({ id: config.id, tenantSlug: 'tenant-b', scenarioId: 'definition-b', name: 'B', participants: [], parameters: {} });
  }).toThrow(/Cross-tenant/i);
  expect(getScenarioConfig('tenant-a', config.id)?.name).toBe('A');
});

it('U5: scenario run idempotency key is tenant-scoped', () => {
  const config = saveScenarioConfig({ tenantSlug: 'tenant-a', scenarioId: 'definition-a', name: 'A', participants: [], parameters: {} });
  const first = startScenarioRun({ tenantSlug: 'tenant-a', configId: config.id, activeHires: [], idempotencyKey: 'same' });
  expect(first.status).toBe(200);
  const foreign = startScenarioRun({ tenantSlug: 'tenant-b', configId: 'nonexistent', activeHires: [], idempotencyKey: 'same' });
  expect(foreign.status).toBe(403);
});

// U6: Event Outbox
it('U6: stale worker with invalid receipt cannot quarantine an active lease', async () => {
  const store = createInMemoryDomainOutboxStore();
  await store.stage({ id: 'e', tenantId: 'tenant-a', eventType: 'support.ticket.updated', aggregateType: 'ticket', aggregateId: 't', payload: {} });
  await store.claim('old', 1, -1);
  await store.claim('new', 1, 10000);
  const staleAck = await store.ack('e', 'old', { receiptId: 'bad', deliveredAt: new Date().toISOString() });
  expect(staleAck.success).toBe(false);
  expect((await store.getEventById('e'))?.status).not.toBe('quarantined');
});

it('U6: same event ID across tenants can be acknowledged independently', async () => {
  const store = createInMemoryDomainOutboxStore();
  for (const tenantId of ['tenant-a', 'tenant-b']) {
    await store.stage({ id: 'e', tenantId, eventType: 'support.ticket.updated', aggregateType: 'ticket', aggregateId: 't', payload: {} });
  }
  await store.claim('worker', 2, 10000);
  const receipt = { receiptId: 'rcpt_' + 'a'.repeat(20), deliveredAt: new Date().toISOString() };
  expect((await store.ack('e', 'worker', receipt, 'tenant-a')).success).toBe(true);
  expect((await store.ack('e', 'worker', receipt, 'tenant-b')).success).toBe(true);
});

it('U6: nested transcript is recursively sanitized and UUID receipt is accepted', () => {
  expect(sanitizeDomainEventPayload({ nested: { rawTranscript: 'SYNTHETIC' } })).toEqual({ nested: {} });
  expect(validateOlgReceipt({ receiptId: randomUUID(), deliveredAt: new Date().toISOString() })).toBe(true);
});

it('U6: actual signal sender does not report success for HTTP 202 without a durable receipt', async () => {
  const result = await safeEmitSignal(
    { tenantId: 'review-tenant', accountId: 'review-account', eventType: 'com.servicev8.business.support.ticket-created.v1', subject: 'synthetic-ticket', data: { synthetic: true } },
    { env: { SERVICEV8_RUNTIME_URL: 'https://runtime.example.test', RUNTIME_SIGNALS_SECRET: 'synthetic-review-only' }, fetchImpl: async () => Response.json({}, { status: 202 }) }
  );
  expect(result.ok).toBe(false);
});

// U7: Common Navigation Views
it('U7: gov_audits, gov_logs, gov_api_keys normalize to their actual views', () => {
  for (const route of ['gov_audits', 'gov_logs', 'gov_api_keys']) {
    expect(normalizeRuntimeWorkspaceView(route)).toBe(route);
  }
});

// U8: Standalone Signup Recovery
it('U8: temporary reservation outage does not consume signup receipt so retry is accepted', async () => {
  vi.stubEnv('KEYCLOAK_ADMIN_BASE_URL', 'https://identity.example.test');
  vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_ID', 'review');
  vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_SECRET', 'synthetic-review-only');
  const email = 'recovery@example.test', domain = 'recovery-review';
  const code = await otpStore.issue('signup', email, domain);
  const verificationReceipt = await otpStore.verifySignupAndIssueReceipt(email, code, domain);
  const reserve = vi.spyOn(tenantSignupRegistry, 'reserve').mockRejectedValue(new TenantRegistryUnavailableError());
  const req = () => new NextRequest('https://support.servicev8.com/api/tenant/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Recovery', domain, adminEmail: email, password: 'SyntheticReview123!', verificationReceipt }),
  });
  try {
    expect((await signup(req())).status).toBe(503);
    // On retry, receipt is not consumed by the failed attempt, so it reaches reserve again (503), NOT 403!
    expect((await signup(req())).status).toBe(503);
    expect(reserve).toHaveBeenCalledTimes(2);
  } finally {
    reserve.mockRestore();
  }
});
