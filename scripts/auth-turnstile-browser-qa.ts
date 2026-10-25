// Local source qualification only. Chromium renders the actual native app.
// Mounted handlers use explicit synthetic Registry/Turnstile/identity fixtures;
// no production account, provider or email request is made.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { authBotChallenge, AuthBotChallengeService } from "../src/lib/auth/bot-challenge";
import { BotTransactionStore } from "../src/lib/auth/bot-transaction";
import { InMemoryOtpBackend } from "../src/lib/auth/otp-store";
import { createGatewayBotVerifier } from "../src/lib/auth/bot-gateway";
import { workspaceDiscoveryLimiter, createWorkspaceDiscoveryLimiter } from "../src/lib/auth/workspace-discovery-limit";
import { createWorkspaceDiscovery } from "../src/lib/auth/workspace-discovery";
import { POST as challenge } from "../src/app/api/auth/challenge/route";
import { POST as sendOtp } from "../src/app/api/auth/otp/send/route";
import { ResendService } from "../src/lib/services/resend-service";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as formLogin, GET as loginPage } from "../src/app/login/route";
import { GET as lookupGet, POST as lookupPost } from "../src/app/api/workspace/lookup/route";
const { chromium, expect } = await import(process.env.SUPPORT_PLAYWRIGHT_MODULE || "@playwright/test");
if (process.env.NODE_ENV !== "test") throw Error("This fixture requires NODE_ENV=test");
const base = process.env.SUPPORT_QA_URL || "http://127.0.0.1:18932";
if (new URL(base).hostname !== "127.0.0.1") throw Error("Browser fixture server must be loopback");
const out = process.env.SUPPORT_QA_OUT || "/tmp/support-turnstile-browser-evidence"; fs.mkdirSync(out, { recursive: true });
const env = { REGISTRY_URL: "https://registry.example.test", SERVICEV8_OIDC_ISSUER: "https://identity.example.test/realms/servicev8", SUPPORTV8_RUNTIME_REGISTRY_CLIENT_ID: "fixture-registered-reader", SUPPORTV8_RUNTIME_REGISTRY_CLIENT_SECRET: "synthetic-not-a-credential" };
Object.assign(process.env, env);
let emailCount = 0;
ResendService.dispatchOtpEmail = async () => { emailCount++; return { success: true, subject: "Controlled OTP", to: "owner@example.test" }; };
const ownerCalls: Array<{ url: string; body?: string }> = [];
const ownerTransport: typeof fetch = async (input, init) => {
 const url = new URL(String(input)); ownerCalls.push({ url: url.href, body: init?.body ? String(init.body) : undefined });
 if (url.hostname === "identity.example.test" && new URLSearchParams(String(init?.body)).get("grant_type") === "client_credentials") return Response.json({ access_token: "synthetic-token", token_type: "Bearer", expires_in: 120 });
 if (url.hostname === "identity.example.test") return new Response(null, { status: 401 });
 if (url.hostname === "registry.example.test" && url.pathname === "/v1/workspace-hosts/resolve") return url.searchParams.get("slug") === "acme" ? Response.json({ schemaVersion: 1, productAppKey: "support", tenantId: "canonical-acme", accountId: "canonical-account", slug: "acme", companyName: "Acme Research Group", origin: "https://acme.support.servicev8.com" }) : new Response(null, { status: 404 });
 if (url.hostname === "gateway.example.test") {
  const proof = JSON.parse(String(init?.body));
  return Response.json({ schemaVersion: 1, success: proof.schemaVersion === 1 && proof.token === "controlled-browser-token" && ((proof.hostname === "acme.support.servicev8.com" && proof.action === "signin") || (proof.hostname === "support.servicev8.com" && proof.action === "signup")) && /^[a-f0-9]{64}$/.test(proof.cdata) });
 }
 throw Error(`Unconfigured external fixture: ${url.origin}`);
};
globalThis.fetch = ownerTransport;
workspaceDiscoveryLimiter.enforce = createWorkspaceDiscoveryLimiter(new InMemoryOtpBackend());
const service = new AuthBotChallengeService({ siteKey: "synthetic-public-widget-key", store: new BotTransactionStore(new InMemoryOtpBackend()), workspace: createWorkspaceDiscovery(env, ownerTransport), verify: createGatewayBotVerifier({ gatewayUrl: "https://gateway.example.test", tokenUrl: "https://identity.example.test/token", clientId: "fixture-bot-client", readSecret: async () => "synthetic-secret", request: ownerTransport }) });
authBotChallenge.start = service.start.bind(service); authBotChallenge.consume = service.consume.bind(service);
const browser = await chromium.launch({ headless: true, channel: process.env.SUPPORT_BROWSER_CHANNEL || "chrome" });
const results: unknown[] = [];
try {
 for (const width of [1280, 375]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 375, serviceWorkers: "block" });
  const page = await context.newPage(), requests: string[] = [], errors: string[] = [], effects: Array<{ path: string; body: unknown; status: number }> = [];
  page.on("request", (req: any) => requests.push(req.url()));
  page.on("pageerror", (error: Error) => errors.push(error.message));
  page.on("console", (msg: any) => { if (msg.type() === "error" && !msg.text().includes("status of 401") && !msg.text().includes("status of 404")) errors.push(msg.text()); });
  await context.route("**/*", async (route: any) => {
   const req = route.request(), url = new URL(req.url());
   if (url.hostname === "challenges.cloudflare.com") return route.fulfill({ contentType: "text/javascript", body: `window.turnstile={render:(el,options)=>{const b=document.createElement('button');b.type='button';b.textContent='Complete controlled Cloudflare check';b.dataset.qaCloudflare='true';b.style.width=options.size==='compact'?'150px':'300px';b.onclick=()=>options.callback('controlled-browser-token');el.append(b);window.__proofOptions=options;return 'controlled-widget';},remove:()=>document.querySelectorAll('[data-qa-cloudflare]').forEach(n=>n.remove())};` });
   if (!url.hostname.endsWith("support.servicev8.com")) return route.fulfill({ contentType: "text/css", body: "" });
   const handlers: Record<string, (r: NextRequest) => Promise<Response>> = { "/api/auth/challenge": challenge, "/api/auth/otp/send": sendOtp, "/api/auth/login": login, "/api/workspace/lookup": req.method() === "GET" ? lookupGet : lookupPost, "/api/auth/lookup-workspace": req.method() === "GET" ? lookupGet : lookupPost, "/login": req.method() === "GET" ? loginPage : formLogin };
   if (handlers[url.pathname]) {
    const headers = { ...await req.allHeaders(), host: url.host }; if (req.method() !== "GET") headers.origin = url.origin;
    const response = await handlers[url.pathname](new NextRequest(url, { method: req.method(), headers, ...(req.method() !== "GET" ? { body: req.postData() ?? "" } : {}) }));
    if (req.method() !== "GET") effects.push({ path: url.pathname, body: req.postDataJSON(), status: response.status });
    return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
   }
   if (url.pathname.startsWith("/api/")) return route.fulfill({ json: { success: false, data: [] } });
   const response = await route.fetch({ url: `${base}${url.pathname}${url.search}`, headers: { ...await req.allHeaders(), host: url.host }, timeout: 120_000 });
   return route.fulfill({ response });
  });
  try {
   await page.goto("https://support.servicev8.com/?signin=1", { waitUntil: "domcontentloaded", timeout: 120_000 });
   const dialog = page.getByRole("dialog", { name: "Workspace sign in" }); await expect(dialog).toBeVisible();
   await expect(dialog.getByLabel("Workspace", { exact: true })).toHaveValue("");
   await expect(dialog.getByLabel("Work email", { exact: true })).toHaveCount(0); await expect(dialog.getByLabel("Password", { exact: true })).toHaveCount(0);
   await page.screenshot({ path: path.join(out, `global-workspace-${width}.png`) });
   await dialog.getByLabel("Workspace", { exact: true }).fill("missing-company"); await dialog.getByRole("button", { name: "Go to workspace", exact: true }).click();
   await expect(dialog.getByRole("alert")).toContainText("not found");
   await dialog.getByLabel("Workspace", { exact: true }).fill("acme"); await dialog.getByRole("button", { name: "Go to workspace", exact: true }).click();
   await page.waitForURL("https://acme.support.servicev8.com/?signin=1", { timeout: 120_000 });
   await expect(dialog.getByText("Welcome to Acme Research Group")).toBeVisible();
   await expect(dialog.getByLabel("Workspace", { exact: true })).toHaveCount(0);
   await dialog.getByLabel("Work email", { exact: true }).fill("admin@acme.com"); await dialog.getByLabel("Password", { exact: true }).fill("incorrect-fixture-password");
   await expect(page.locator('[data-qa-cloudflare]')).toBeVisible();
   await page.locator('button[form="signin-form"]').click(); await expect(dialog.getByRole("alert")).toContainText("Complete the security check");
   assert.equal(effects.filter(x => x.path === "/api/auth/login").length, 0);
   await page.locator('[data-qa-cloudflare]').click(); await page.locator('button[form="signin-form"]').click();
   await expect(dialog.getByRole("alert")).toContainText("Incorrect password");
   assert.equal(effects.find(x => x.path === "/api/auth/login")?.status, 401);
   const discovery = effects.filter(x => x.path.includes("lookup")); assert(discovery.every(x => Object.keys(x.body as object).join(",") === "workspace"));
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
   const widget = await page.locator('[data-qa-cloudflare]').boundingBox(); if (widget) assert(widget.x + widget.width <= width);
   await page.screenshot({ path: path.join(out, `signin-${width}.png`) });
   await page.goto("https://support.servicev8.com/signup", { waitUntil: "domcontentloaded", timeout: 120_000 });
   await page.waitForFunction("Object.keys(document.querySelector('[aria-label=\"Organization name\"]') || {}).some(key => key.startsWith('__reactProps$'))");
   await page.getByLabel("Organization name", { exact: true }).fill(`Controlled Signup ${width}`);
   await page.locator('button[form="step1-form"]').click();
   await page.getByLabel("Administrator name", { exact: true }).fill("Fixture Owner");
   await page.getByLabel("Corporate work email", { exact: true }).fill(`owner-${width}@example.test`);
   await page.getByLabel("Password", { exact: true }).fill(" Exact Password#2026 ");
   await page.getByLabel("Confirm password", { exact: true }).fill(" Exact Password#2026 ");
   await expect(page.locator('[data-qa-cloudflare]')).toBeVisible();
   const beforeEmail = emailCount;
   await page.locator('button[form="step2-form"]').click(); await expect(page.getByRole("dialog", { name: "Create support workspace" }).getByRole("alert")).toContainText("Complete the security check"); assert.equal(emailCount, beforeEmail);
   await page.locator('[data-qa-cloudflare]').click(); await page.locator('button[form="step2-form"]').click();
   await expect(page.locator("#step3-otp-form input")).toBeVisible(); assert.equal(emailCount, beforeEmail + 1);
   assert.equal(effects.filter(x => x.path === "/api/tenant/signup").length, 0);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
   await page.screenshot({ path: path.join(out, `signup-${width}.png`) });
   assert.deepEqual(errors, []); results.push({ width, passed: true, credentialPosts: 1, scope: "real native UI + mounted source handlers; controlled external owners" });
  } catch (error) { fs.writeFileSync(path.join(out, `failure-${width}.json`), JSON.stringify({ failure: String(error), errors, effects, ownerCalls, requests, widget: await page.evaluate(() => ({api: typeof window.turnstile, scripts: [...document.scripts].map(s => s.src), slots: [...document.querySelectorAll('[aria-label="Security verification"]')].map(e=>e.outerHTML)})) }, null, 2)); await page.screenshot({ path: path.join(out, `failure-${width}.png`) }); throw error; }
  finally { await context.unrouteAll({ behavior: "ignoreErrors" }); await context.close(); }
 }
} finally { await browser.close(); fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ results, providerCalls: ownerCalls.filter(x => x.url.includes("gateway.example.test")).length }, null, 2)); }
console.log(JSON.stringify(results));
