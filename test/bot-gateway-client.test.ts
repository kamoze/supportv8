import { describe, expect, it } from "vitest";
import { createGatewayBotVerifier } from "../src/lib/auth/bot-gateway";

const config = { gatewayUrl: "https://gateway.fixture.test", tokenUrl: "https://identity.fixture.test/token", clientId: "support-auth-fixture", readSecret: async () => "synthetic-private-client-secret" };
const challenge = { token: "synthetic-browser-token", hostname: "alpha.support.servicev8.com", action: "signin" as const, cdata: "a".repeat(64) };
describe("strict Gateway bot client", () => {
  it("requests only bot scope and accepts only the exact v1 response", async () => {
    const requests: Request[] = [];
    const verify = createGatewayBotVerifier({ ...config, request: async (url, init) => {
      const request = new Request(url, init); requests.push(request);
      return requests.length === 1 ? Response.json({ access_token: "fixture-access-token", token_type: "Bearer", expires_in: 120 }) : Response.json({ schemaVersion: 1, success: true });
    } });
    await expect(verify(challenge, new AbortController().signal)).resolves.toBe(true);
    expect(Object.fromEntries(new URLSearchParams(await requests[0].text()))).toEqual({ grant_type: "client_credentials", client_id: config.clientId, client_secret: "synthetic-private-client-secret", audience: "servicev8-action-gateway", scope: "bot:verify" });
    expect(requests[1].url).toBe("https://gateway.fixture.test/v1/security/bot/verify");
    expect(await requests[1].json()).toEqual({ schemaVersion: 1, ...challenge });
    expect(requests[1].headers.get("authorization")).toBe("Bearer fixture-access-token");
  });
  it.each([
    '{"schemaVersion":1,"success":false,"success":false}',
    '{"schemaVersion":1,"success":true,"success":false}',
    '{"schemaVersion":1,"success":false,"success":true}',
    '{"schemaVersion":1,"schemaVersion":1,"success":false}',
    '{"schemaVersion":2,"schemaVersion":1,"success":false}',
    '{"schemaVersion":1,"success":false,"succe\\u0073s":false}',
  ])("rejects duplicate fields even when their effective value would deny proof: %s", async body => {
    const verify=createGatewayBotVerifier({...config,request:async url=>String(url).endsWith('/token')?Response.json({access_token:'fixture',token_type:'Bearer',expires_in:120}):new Response(body)});
    await expect(verify(challenge,new AbortController().signal)).rejects.toMatchObject({status:503});
  });
  it("does not downgrade to a legacy boolean or trust malformed output", async () => {
    for (const value of [{ success: true }, { schemaVersion: 2, success: true }, { schemaVersion: 1, success: true, extra: true }, { schemaVersion: 1, success: "true" }, null]) {
      const verify = createGatewayBotVerifier({ ...config, request: async url => String(url).endsWith("/token") ? Response.json({ access_token: "fixture-token", token_type: "Bearer", expires_in: 120 }) : Response.json(value) });
      await expect(verify(challenge, new AbortController().signal)).rejects.toMatchObject({ status: 503 });
    }
  });
  it("propagates valid negative proof and bounds hanging secret, token and provider reads", async () => {
    for (const kind of ["negative", "secret", "token", "body", "redirect", "oversize"]) {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20);
      const verify = createGatewayBotVerifier({ ...config, readSecret: () => kind === "secret" ? new Promise(() => {}) : Promise.resolve("synthetic-secret"), request: async url => {
        if (String(url).endsWith("/token")) return kind === "token" ? new Promise(() => {}) : Response.json({ access_token: "fixture-token", token_type: "Bearer", expires_in: 120 });
        if (kind === "body") return new Response(new ReadableStream({ pull: () => new Promise(() => {}) }));
        if (kind === "oversize") return new Response("x".repeat(70_000));
        const response = Response.json({ schemaVersion: 1, success: false }); if (kind === "redirect") Object.defineProperty(response, "redirected", { value: true }); return response;
      } });
      if (kind === "negative") await expect(verify(challenge, controller.signal)).resolves.toBe(false);
      else await expect(verify(challenge, controller.signal)).rejects.toMatchObject({ status: 503 });
      clearTimeout(timer);
    }
  });
  it("requires configured private endpoints and a registered client without static credential fallbacks", () => {
    for (const patch of [{ gatewayUrl: "http://public.example.com" }, { tokenUrl: "https://identity.test/token?secret=1" }, { clientId: "" }, { gatewayUrl: "https://user:secret@gateway.test" }]) {
      expect(() => createGatewayBotVerifier({ ...config, ...patch })).toThrow();
    }
  });
});

describe('dedicated supportv8-auth-bot profile', () => {
  const dedicated = {...config, clientId:'supportv8-auth-bot', tokenUrl:'https://keycloak.servicev8.com/realms/servicev8/protocol/openid-connect/token'};
  it.each([{expires_in:300},{expires_in:121},{expires_in:0},{expires_in:1.5},{expires_in:'120'},{scope:'bot:verify action:execute'},{scope:''},{scope:undefined},{scope:'action:execute'},{refresh_token:null},{refresh_token:''},{token_type:'bearer'}])('rejects invalid dedicated token before Gateway/provider %j', async patch => {
    let calls=0;
    const verify=createGatewayBotVerifier({...dedicated,request:async()=>++calls===1?Response.json({access_token:'fixture',token_type:'Bearer',expires_in:120,scope:'bot:verify',...patch}):Response.json({schemaVersion:1,success:true})});
    await expect(verify(challenge,new AbortController().signal)).rejects.toMatchObject({status:503});
    expect(calls).toBe(1);
  });
  it.each([1,120])('admits legitimate dedicated lifetime %s',async expires_in=>{
    let calls=0;
    const verify=createGatewayBotVerifier({...dedicated,request:async()=>++calls===1?Response.json({access_token:'fixture',token_type:'Bearer',expires_in,scope:'bot:verify'}):Response.json({schemaVersion:1,success:true})});
    expect(await verify(challenge,new AbortController().signal)).toBe(true);expect(calls).toBe(2);
  });
  it.each(['https://identity.fixture.test/token','https://keycloak.servicev8.com/realms/other/protocol/openid-connect/token','https://keycloak.servicev8.com/realms/servicev8/protocol/openid-connect/token/'])('pins dedicated token endpoint %s',tokenUrl=>{
    expect(()=>createGatewayBotVerifier({...dedicated,tokenUrl})).toThrow();
  });
  it.each(['supportv8-execution','support-auth-fixture','supportv8-auth-bot-other'])('preserves configurable legacy profile %s including 300s and optional scope/refresh fields',async clientId=>{
    for(const extra of [{},{scope:'bot:verify action:execute',refresh_token:'legacy'}]) {
      let calls=0;
      const verify=createGatewayBotVerifier({...config,clientId,request:async()=>++calls===1?Response.json({access_token:'fixture',token_type:'Bearer',expires_in:300,...extra}):Response.json({schemaVersion:1,success:true})});
      expect(await verify(challenge,new AbortController().signal)).toBe(true);expect(calls).toBe(2);
    }
  });
});
