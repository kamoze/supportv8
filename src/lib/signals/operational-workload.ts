import { createRemoteJWKSet, jwtVerify, customFetch } from 'jose';
import { readFile } from 'node:fs/promises';
import { PublisherError } from './operational-contract';
export type Credential = (signal: AbortSignal) => Promise<string>;
export function endpoint(raw: string): URL {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash)
        throw new PublisherError(503, 'signals_configuration_required');
    return u;
}
export async function readJson(response: Response, signal: AbortSignal, max = 65536): Promise<any> {
    const reader = response.body?.getReader();
    if (!reader)
        throw Error('signals_authority_unavailable');
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
        while (true) {
            signal.throwIfAborted();
            const next = await reader.read();
            if (next.done)
                break;
            size += next.value.length;
            if (size > max)
                throw Error('signals_response_oversize');
            chunks.push(next.value);
        }
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
    finally {
        void reader.cancel().catch(() => { });
        reader.releaseLock();
    }
}
/** Separate purpose credentials; tokens are short-lived app workloads, never tenant tokens. */
export function credentialFromEnv(prefix: string, audience: string, scope: string, env: Record<string, string | undefined>, request: typeof fetch = fetch): Credential | undefined {
    const issuer = env[prefix + '_WORKLOAD_ISSUER'], jwks = env[prefix + '_WORKLOAD_JWKS_URL'], client = env[prefix + '_CLIENT_ID'], subject = env[prefix + '_SUBJECT'], file = env[prefix + '_SECRET_FILE'];
    if (!issuer || !jwks || !client || !subject || !file)
        return;
    const ref = (v: string) => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/.test(v);
    if (!file.startsWith('/') || !ref(client) || !ref(subject))
        throw Error('signals_configuration_required');
    const tokenUrl = endpoint(issuer);
    tokenUrl.pathname = tokenUrl.pathname.replace(/\/$/, '') + '/protocol/openid-connect/token';
    const key = createRemoteJWKSet(endpoint(jwks), { timeoutDuration: 2000, [customFetch]: request });
    return async (signal) => {
        signal.throwIfAborted();
        const secret = (await readFile(file, 'utf8')).trim();
        if (!secret || secret.length > 4096)
            throw Error('signals_configuration_required');
        const response = await request(tokenUrl, { method: 'POST', redirect: 'error', cache: 'no-store', signal, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: client, client_secret: secret, audience, scope }) });
        const body = await readJson(response, signal, 16384);
        if (response.status !== 200 || body.token_type !== 'Bearer' || typeof body.access_token !== 'string' || body.access_token.length > 16384)
            throw Error('signals_workload_unavailable');
        const { payload: p } = await jwtVerify(body.access_token, key, { issuer, audience, algorithms: ['RS256'], requiredClaims: ['sub', 'azp', 'iat', 'exp', 'scope', 'preferred_username'], clockTolerance: 0 });
        const now = Math.floor(Date.now() / 1000), allowed = ['iss', 'aud', 'sub', 'azp', 'iat', 'exp', 'nbf', 'jti', 'scope', 'preferred_username', 'typ', 'acr', 'realm_access', 'resource_access', 'client_id', 'clientHost', 'clientAddress'];
        if (p.aud !== audience || p.sub !== subject || p.azp !== client || p.scope !== scope || p.preferred_username !== `service-account-${client}` || !Number.isSafeInteger(p.iat) || !Number.isSafeInteger(p.exp) || p.iat! > now || p.exp! <= now || p.exp! <= p.iat! || p.exp! - p.iat! > 120 || !Object.keys(p).every(k => allowed.includes(k)) || (p.client_id !== undefined && p.client_id !== client))
            throw Error('signals_workload_unavailable');
        signal.throwIfAborted();
        return body.access_token;
    };
}
