import { describe, expect, it } from "vitest";
import { AuthBotChallengeService } from "../src/lib/auth/bot-challenge";
import { BotTransactionStore } from "../src/lib/auth/bot-transaction";
import { InMemoryOtpBackend } from "../src/lib/auth/otp-store";
const base = { email: "lead@example.com", tenantSlug: "alpha" };
const request = (hostname = "alpha.support.servicev8.com", cookie = "", origin = `https://${hostname}`) => new Request(`https://${hostname}/api/auth/challenge`, { method: "POST", headers: { host: hostname, origin, cookie } });
function fixture() {
  let active = true, result = true, calls = 0;
  const service = new AuthBotChallengeService({ siteKey: "synthetic-public-widget-key", store: new BotTransactionStore(new InMemoryOtpBackend()),
    workspace: async slug => active ? { id: "native-owner-fixture", slug, name: "Alpha", status: "active", url: `https://${slug}.support.servicev8.com/` } : null,
    verify: async proof => { calls++; expect(proof.hostname).toBe("alpha.support.servicev8.com"); expect(proof.action).toBe("signin"); return result; },
  });
  return { service, disable: () => { active = false; }, reject: () => { result = false; }, calls: () => calls };
}
describe("auth proof transaction service", () => {
  it("issues a host-only cookie and consumes exactly once across fresh request objects", async () => {
    const f = fixture(), response = await f.service.start(request(), { action: "signin", ...base }), body = await response.json();
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("__Host-support_auth_signin="); expect(cookie).toContain("HttpOnly"); expect(cookie).toContain("Secure"); expect(cookie).toContain("SameSite=strict"); expect(cookie).not.toContain("Domain=");
    const proof = { ...base, challengeId: body.challengeId, botToken: "synthetic-proof" };
    await expect(f.service.consume(request(undefined, cookie.split(";", 1)[0]), "signin", proof)).resolves.toMatchObject({ id: "native-owner-fixture", slug: "alpha" });
    await expect(f.service.consume(request(undefined, cookie.split(";", 1)[0]), "signin", proof)).rejects.toMatchObject({ status: 400 });
    expect(f.calls()).toBe(1);
  });
  it("denies cross-origin, global credential posts, missing/foreign cookies and provider rejection", async () => {
    const f = fixture(), issued = await f.service.start(request(), { action: "signin", ...base }), body = await issued.json(), cookie = issued.headers.get("set-cookie")!.split(";", 1)[0];
    const proof = { ...base, challengeId: body.challengeId, botToken: "synthetic-proof" };
    await expect(f.service.consume(request(undefined, cookie, "https://beta.support.servicev8.com"), "signin", proof)).rejects.toMatchObject({ status: 403 });
    await expect(f.service.consume(request("support.servicev8.com", cookie), "signin", proof)).rejects.toMatchObject({ status: 403 });
    await expect(f.service.consume(request(), "signin", proof)).rejects.toMatchObject({ status: 400 });
    await expect(f.service.consume(request(undefined, `${cookie}; ${cookie}`), "signin", proof)).rejects.toMatchObject({ status: 400 });
    expect(f.calls()).toBe(0); f.reject();
    await expect(f.service.consume(request(undefined, cookie), "signin", proof)).rejects.toMatchObject({ status: 400 });
    await expect(f.service.consume(request(undefined, cookie), "signin", proof)).rejects.toMatchObject({ status: 400 });
    expect(f.calls()).toBe(1);
  });
  it("rechecks active native workspace before redeeming a previously issued transaction", async () => {
    const f = fixture(), issued = await f.service.start(request(), { action: "signin", ...base }), body = await issued.json(); f.disable();
    await expect(f.service.consume(request(undefined, issued.headers.get("set-cookie")!.split(";", 1)[0]), "signin", { ...base, challengeId: body.challengeId, botToken: "synthetic-proof" })).rejects.toMatchObject({ status: 403 });
    expect(f.calls()).toBe(0);
  });
  it("requires signup on the global host and rejects missing or public test site configuration", async () => {
    const f = fixture();
    await expect(f.service.start(request(), { action: "signup", ...base })).rejects.toMatchObject({ status: 403 });
    expect((await f.service.start(request("support.servicev8.com"), { action: "signup", ...base })).status).toBe(200);
    for (const siteKey of ["", "1x00000000000000000000AA"]) expect(() => new AuthBotChallengeService({ siteKey, store: new BotTransactionStore(new InMemoryOtpBackend()), workspace: async () => null, verify: async () => true })).toThrow();
  });
});
