import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGatewayBotVerifier } from '../src/lib/auth/bot-gateway';
function setup(request: typeof fetch) {
 const verify=createGatewayBotVerifier({gatewayUrl:'https://gateway.test',tokenUrl:'https://issuer.test/token',clientId:'fixture',readSecret:async()=>'synthetic-secret',request});
 return async (signal=new AbortController().signal)=>{try{return await verify(proof,signal);}catch(error){expect(error).toMatchObject({status:503});return false;}};
}
const proof={token:'fixture',hostname:'fixture.example',action:'signin' as const,cdata:'a'.repeat(43)};
const tokenBody=JSON.stringify({access_token:'fixture',token_type:'Bearer',expires_in:120});
const success='{"schemaVersion":1,"success":true}';
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
describe('entire issuer and Gateway budget',()=>{
 it.each(['headers','chunk','end'])('rejects exact deadline in token %s before Gateway dispatch',async stage=>{
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});let elapsed=0;
  vi.spyOn(Date,'now').mockImplementation(()=>10000+elapsed);vi.spyOn(performance,'now').mockImplementation(()=>100+elapsed);
  const request=vi.fn(async()=>{if(stage==='headers')elapsed=8000;let count=0;return new Response(new ReadableStream({pull(controller){if(count++===0){if(stage==='chunk')elapsed=8000;controller.enqueue(new TextEncoder().encode(tokenBody));}else{if(stage==='end')elapsed=8000;controller.close();}}},{highWaterMark:0}));});
  expect(await setup(request)()).toBe(false);expect(request).toHaveBeenCalledOnce();
 });
 it('rejects a blocking token response before any Gateway dispatch',async()=>{
  const request=vi.fn(async()=>{const end=performance.now()+8005;while(performance.now()<end){}return new Response(tokenBody);});
  expect(await setup(request)()).toBe(false);expect(request).toHaveBeenCalledOnce();
 },11000);
 it('shares the original budget across token and Gateway rather than resetting it',async()=>{
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});let elapsed=0;
  vi.spyOn(Date,'now').mockImplementation(()=>10000+elapsed);vi.spyOn(performance,'now').mockImplementation(()=>100+elapsed);
  const request=vi.fn(async url=>{elapsed+=4000;return new Response(String(url).endsWith('/token')?tokenBody:success);});
  expect(await setup(request)()).toBe(false);expect(request).toHaveBeenCalledTimes(2);
 });
 it.each(['headers','body'])('bounds ignored-signal token %s',async stage=>{
  vi.useFakeTimers();let cancelled=false;
  const request=vi.fn(()=>stage==='headers'?new Promise<Response>(()=>{}):Promise.resolve(new Response(new ReadableStream({cancel(){cancelled=true;}}))));
  const waiting=setup(request)();await vi.advanceTimersByTimeAsync(8000);
  expect(await waiting).toBe(false);expect(request).toHaveBeenCalledOnce();if(stage==='body')expect(cancelled).toBe(true);
 });
 it('does not dispatch for an already cancelled caller',async()=>{
  const controller=new AbortController();controller.abort();const request=vi.fn(async()=>new Response(tokenBody));
  expect(await setup(request)(controller.signal)).toBe(false);expect(request).not.toHaveBeenCalled();
 });
 it.each([201,202,204,206,302,400,500])('requires exact token HTTP200, rejects %s',async status=>{
  const request=vi.fn(async()=>new Response(status===204?null:tokenBody,{status}));
  expect(await setup(request)()).toBe(false);expect(request).toHaveBeenCalledOnce();
 });
 it.each([tokenBody+'{}',' '.repeat(32768)+tokenBody,'{"access_token":"fixture","token_type":"Bearer","expires_in":120,"expires_in":120}'])('rejects malformed, oversized or duplicate token JSON',async body=>{
  const request=vi.fn(async()=>new Response(body));expect(await setup(request)()).toBe(false);expect(request).toHaveBeenCalledOnce();
 });
 it('rejects invalid UTF8 within an otherwise ignored token field',async()=>{
  const bytes=new Uint8Array([...new TextEncoder().encode(tokenBody.slice(0,-1)+',"ignored":"'),0xff,...new TextEncoder().encode('"}')]);
  const request=vi.fn(async()=>new Response(bytes));expect(await setup(request)()).toBe(false);expect(request).toHaveBeenCalledOnce();
 });
 it.each([true,false])('preserves legitimate HTTP200 success %s',async success=>{
  const request=vi.fn(async url=>String(url).endsWith('/token')?new Response(tokenBody):Response.json({schemaVersion:1,success}));
  expect(await setup(request)()).toBe(success);expect(request).toHaveBeenCalledTimes(2);
 });
});
