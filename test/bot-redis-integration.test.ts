import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Redis from "ioredis";
import { RedisOtpBackend } from "../src/lib/auth/otp-store";
import { AuthBotChallengeService } from "../src/lib/auth/bot-challenge";
import { createGatewayBotVerifier } from "../src/lib/auth/bot-gateway";
import { BotTransactionStore } from "../src/lib/auth/bot-transaction";
const enabled = process.env.SUPPORTV8_RUN_REDIS_INTEGRATION === "true";
if (enabled && !process.env.REDIS_URL) throw new Error("Redis bot proof gate requires its disposable fixture");
const clients: Redis[] = [];
const connect = async () => { const client = new Redis(process.env.REDIS_URL!, { lazyConnect: true, maxRetriesPerRequest: 1 }); clients.push(client); await client.connect(); return client; };
describe.runIf(enabled)("mandatory Redis one-use bot transaction", () => {
  let first: Redis, second: Redis;
  beforeAll(async () => { first = await connect(); second = await connect(); });
  afterAll(async () => { await Promise.all(clients.filter(client => client.status !== "end").map(client => client.quit())); });
  it("burns rejected transport proof durably before a replacement process can retry", async () => {
    const hostname='alpha.support.servicev8.com';let gatewayCalls=0;
    const makeService=(client:Redis)=>new AuthBotChallengeService({siteKey:'synthetic-widget-public-key',store:new BotTransactionStore(new RedisOtpBackend(client)),workspace:async()=>({id:'tenant-alpha',accountId:'account-alpha',slug:'alpha',name:'Alpha',status:'active',url:`https://${hostname}/`}),verify:createGatewayBotVerifier({gatewayUrl:'https://gateway.test',tokenUrl:'https://issuer.test/token',clientId:'fixture',readSecret:async()=>'synthetic-secret',request:async url=>{
      if(String(url).endsWith('/token'))return Response.json({access_token:'fixture',token_type:'Bearer',expires_in:120});gatewayCalls++;return new Response('{"schemaVersion":1,"success":false,"success":true}');
    }})});
    const active=await connect(), replacement=await connect(), body={email:`transport-${crypto.randomUUID()}@example.test`,tenantSlug:'alpha',action:'signin'};
    const headers={host:hostname,origin:`https://${hostname}`};
    const issued=await makeService(active).start(new Request(`https://${hostname}/api/auth/challenge`,{headers}),body);
    const challenge=await issued.json(), proof={...body,challengeId:challenge.challengeId,botToken:'fixture'};
    const request=()=>new Request(`https://${hostname}/api/auth/login`,{headers:{...headers,cookie:issued.headers.get('set-cookie')!.split(';')[0]}});
    await expect(makeService(active).consume(request(),'signin',proof)).rejects.toMatchObject({status:503});
    await active.quit();
    await expect(makeService(replacement).consume(request(),'signin',proof)).rejects.toMatchObject({status:400});expect(gatewayCalls).toBe(1);
  });
  it("survives issuer process replacement and admits exactly one concurrent consumption across independent clients", async () => {
    const binding = { hostname: "alpha.support.servicev8.com", action: "signin" as const, tenantSlug: "alpha", email: `bot-${crypto.randomUUID()}@example.test` };
    const transaction = await new BotTransactionStore(new RedisOtpBackend(first)).issue(binding);
    await first.quit();
    const replacement = await connect();
    const consumers = [new BotTransactionStore(new RedisOtpBackend(second)), new BotTransactionStore(new RedisOtpBackend(replacement))];
    expect((await Promise.all(consumers.map(store => store.consume(transaction.id, transaction.cookieSecret, binding)))).sort()).toEqual([false, true]);
    expect(await consumers[0].consume(transaction.id, transaction.cookieSecret, binding)).toBe(false);
  });
});
