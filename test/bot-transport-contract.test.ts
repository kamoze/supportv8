import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGatewayBotVerifier } from '../src/lib/auth/bot-gateway';
const budget = 8000, maxBytes = 4096;
function setup(fetcher: typeof fetch, token: () => Promise<string> = async () => 'workload') {
  const verify = createGatewayBotVerifier({gatewayUrl:'https://gateway.test',tokenUrl:'https://issuer.test/token',clientId:'fixture',readSecret:token,
    request: (url,init)=>String(url).endsWith('/token') ? Promise.resolve(Response.json({access_token:'workload',token_type:'Bearer',expires_in:120})) : fetcher(url,init)});
  return {verify:async()=>{try{return await verify(proof,new AbortController().signal);}catch(error){expect(error).toMatchObject({status:503});return false;}}};
}
const proof = { token: 'proof', hostname: 'acme.example', action: 'signin' as const, cdata: 'a'.repeat(43) };
const success = '{"schemaVersion":1,"success":true}';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('bounded verification response contract', () => {
  it('accepts exactly HTTP 200 with two semantic fields in either order', async () => {
    for (const body of [success, '{ "success" : true, "schemaVersion" : 1 }', '{"schema\\u0056ersion":1,"success":true}']) {
      expect(await setup(async () => new Response(body)).verify()).toBe(true);
    }
  });
  it.each([201, 202, 204, 206, 302, 400, 500])('rejects HTTP %s', async status => {
    expect(await setup(async () => new Response(status === 204 ? null : success, { status })).verify()).toBe(false);
  });
  it.each([
    '{"schemaVersion":1,"success":true,"success":true}',
    '{"schemaVersion":1,"success":false,"success":true}',
    '{"schemaVersion":2,"schemaVersion":1,"success":true}',
    '{"schemaVersion":1,"schemaVersion":1,"success":true}',
    '{"schemaVersion":1,"succe\\u0073s":false,"success":true}',
    '{"schemaVersion":1,"success":true}{}', '{"schemaVersion":1,"success":true,}',
    'null', '[]', '{"success":true}', '{"schemaVersion":"1","success":true}',
    '{"schemaVersion":1,"success":true,"extra":null}',
  ])('rejects ambiguous or malformed JSON %s', async body => {
    expect(await setup(async () => new Response(body)).verify()).toBe(false);
  });
  it('rejects malformed UTF8 and oversized streamed bodies', async () => {
    const bytes = new TextEncoder().encode('{"schemaVersion":1,"success":true,"extra":"');
    const invalid = new Uint8Array([...bytes, 0xc0, 0xaf, ...new TextEncoder().encode('"}')]);
    expect(await setup(async () => new Response(invalid)).verify()).toBe(false);
    expect(await setup(async () => new Response(' '.repeat(maxBytes) + success)).verify()).toBe(false);
    expect(await setup(async () => new Response(success, { headers: { 'content-length': String(maxBytes + 1) } })).verify()).toBe(false);
  });
  it('rejects trailing invalid UTF8', async () => {
    // Invalid UTF8 after the envelope must not be ignored as trailing data.
    const bytes = new Uint8Array([...new TextEncoder().encode('{"schemaVersion":1,"success":true}'), 0xff]);
    expect(await setup(async () => new Response(bytes)).verify()).toBe(false);
  });
  it.each(['secret', 'headers', 'chunk', 'end'] as const)('rejects the inclusive deadline at %s even before timers run', async stage => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let wall = 10000, mono = 100;
    vi.spyOn(Date, 'now').mockImplementation(() => wall);
    vi.spyOn(performance, 'now').mockImplementation(() => mono);
    const expire = () => { wall += budget; mono += budget; };
    const fetcher = vi.fn(async () => {
      if (stage === 'headers') expire();
      let n = 0;
      return new Response(new ReadableStream({ pull(controller) {
        if (n++ === 0) { if (stage === 'chunk') expire(); controller.enqueue(new TextEncoder().encode(success)); }
        else { if (stage === 'end') expire(); controller.close(); }
      } }, { highWaterMark: 0 }));
    });
    const fixture = setup(fetcher, async () => { if (stage === 'secret') expire(); return 'workload'; });
    expect(await fixture.verify()).toBe(false);
    if (stage === 'secret') expect(fetcher).not.toHaveBeenCalled();
  });
  it('accepts success immediately before the inclusive deadline', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let elapsed = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => 10000 + elapsed);
    vi.spyOn(performance, 'now').mockImplementation(() => 100 + elapsed);
    expect(await setup(async () => { elapsed = budget - 1; return new Response(success); }).verify()).toBe(true);
  });
  it('checks wall elapsed time even if the monotonic clock has not advanced', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let wall = 10000;
    vi.spyOn(Date, 'now').mockImplementation(() => wall);
    vi.spyOn(performance, 'now').mockReturnValue(100);
    expect(await setup(async () => { wall += budget; return new Response(success); }).verify()).toBe(false);
  });
  it('checks the budget again after decoding before returning success', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let elapsed = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => 10000 + elapsed);
    vi.spyOn(performance, 'now').mockImplementation(() => 100 + elapsed);
    const parse = JSON.parse;
    vi.spyOn(JSON, 'parse').mockImplementation((text, reviver) => {
      const result = parse(text, reviver);
      if (text === success) elapsed = budget;
      return result;
    });
    expect(await setup(async () => new Response(success)).verify()).toBe(false);
  });
  it('uses monotonic elapsed time when wall time rolls backward and timer callbacks are delayed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let wall = 10000, mono = 100;
    vi.spyOn(Date, 'now').mockImplementation(() => wall);
    vi.spyOn(performance, 'now').mockImplementation(() => mono);
    expect(await setup(async () => { wall -= 60000; mono += budget; return new Response(success); }).verify()).toBe(false);
  });
  it('includes synchronous dependency blocking before timers can run', async () => {
    const fetcher = vi.fn(async () => new Response(success));
    const fixture = setup(fetcher, async () => {
      const end = performance.now() + budget + 5;
      while (performance.now() < end) { /* Deliberately prevent timer delivery. */ }
      return 'late-workload';
    });
    expect(await fixture.verify()).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  }, budget + 3000);
  it.each(['secret', 'headers', 'body'] as const)('bounds ignored-signal pending %s dependencies', async stage => {
    vi.useFakeTimers();
    let release: (value: string) => void = () => {};
    let cancelled = false;
    const fetcher = vi.fn(() => stage === 'headers' ? new Promise<Response>(() => {}) : Promise.resolve(new Response(new ReadableStream({ cancel() { cancelled = true; } }))));
    const fixture = setup(fetcher, () => stage === 'secret' ? new Promise<string>(resolve => { release = resolve; }) : Promise.resolve('workload'));
    const result = fixture.verify();
    await vi.advanceTimersByTimeAsync(budget);
    expect(await result).toBe(false);
    if (stage === 'secret') { release('late-workload'); await Promise.resolve(); expect(fetcher).not.toHaveBeenCalled(); }
    if (stage === 'body') expect(cancelled).toBe(true);
  });
});
