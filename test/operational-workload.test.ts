import { it, expect, beforeAll, afterAll } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { credentialFromEnv } from '@/lib/signals/operational-workload';
let privateKey: CryptoKey, publicJwk: Record<string, unknown>, dir: string, file: string;
const issuer = 'https://issuer.fixture.invalid/realms/test', audience = 'servicev8-runtime-operational-signals', scope = 'runtime:operational-signals:write';
beforeAll(async () => { const pair = await generateKeyPair('RS256'); privateKey = pair.privateKey; publicJwk = { ...await exportJWK(pair.publicKey), kid: 'fixture-key', alg: 'RS256' }; dir = await mkdtemp(join(tmpdir(), 'support-operational-workload-')); file = join(dir, 'synthetic-secret'); await writeFile(file, 'synthetic-only', { mode: 0o600 }); });
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });
async function exercise(changes: Record<string, unknown> = {}) {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ iss: issuer, aud: audience, sub: 'workload-subject', azp: 'support-publisher', iat: now, exp: now + 100, scope, preferred_username: 'service-account-support-publisher', ...changes }).setProtectedHeader({ alg: 'RS256', kid: 'fixture-key' }).sign(privateKey);
    let exchanges = 0;
    const credential = credentialFromEnv('FIXTURE', audience, scope, { FIXTURE_WORKLOAD_ISSUER: issuer, FIXTURE_WORKLOAD_JWKS_URL: issuer + '/jwks', FIXTURE_CLIENT_ID: 'support-publisher', FIXTURE_SUBJECT: 'workload-subject', FIXTURE_SECRET_FILE: file }, async (url, init) => { if (String(url).endsWith('/jwks'))
        return Response.json({ keys: [publicJwk] }); exchanges++; expect(String(url)).toBe(issuer + '/protocol/openid-connect/token'); expect(init?.redirect).toBe('error'); const body = new URLSearchParams(init?.body as URLSearchParams); expect(body.get('audience')).toBe(audience); expect(body.get('scope')).toBe(scope); expect(body.get('grant_type')).toBe('client_credentials'); return Response.json({ token_type: 'Bearer', access_token: token }); })!;
    await credential(AbortSignal.timeout(1000));
    expect(exchanges).toBe(1);
    return true;
}
it('uses a separate short-lived RS256 workload with exact audience/scope/client/subject', async () => expect(await exercise()).toBe(true));
it.each([{ scope: 'registry:installations:read' }, { aud: 'supportv8' }, { sub: 'foreign' }, { azp: 'other' }, { preferred_username: 'human' }, { tenant_id: 'foreign' }, { exp: Math.floor(Date.now() / 1000) + 1000 }, { iat: Math.floor(Date.now() / 1000) + 20 }])('rejects unqualified workload claims %j', async (changes) => expect(exercise(changes)).rejects.toThrow());
it('has no legacy credential fallback', () => expect(credentialFromEnv('FIXTURE', audience, scope, { RUNTIME_SIGNALS_SECRET: 'synthetic' })).toBeUndefined());
