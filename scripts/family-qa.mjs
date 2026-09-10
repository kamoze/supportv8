// Local release QA only. All API requests are intercepted; no calls, accounts or records are created.
// Install @playwright/test@1.61.0 in a separate temporary directory, never in this locked production install.
// Set SUPPORT_PLAYWRIGHT_MODULE to its absolute node_modules/@playwright/test/index.mjs path.
const { chromium, expect } = await import(process.env.SUPPORT_PLAYWRIGHT_MODULE || "@playwright/test");
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const base = process.env.SUPPORT_QA_URL || "http://127.0.0.1:18865";
const out = path.resolve(process.env.SUPPORT_QA_OUT || ".impeccable/review");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [], results = [];
const session = role => ({ token: "qa-fixture-not-a-credential", tenantSlug: "qa-support", email: "review@example.com", name: "Release QA", role, issuedAt: Date.now(), expiresAt: Date.now() + 3600000 });
async function surface(role, issues = []) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
  const page = await context.newPage();
  const errors = [], posts = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  if (role) await page.addInitScript(value => sessionStorage.setItem("sv8_operator_session", JSON.stringify(value)), session(role));
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    // Current production main uses these read-only public icon font assets.
    if (url.origin === "https://cdn-uicons.flaticon.com" && ["stylesheet", "font"].includes(request.resourceType())) return route.continue();
    if (url.origin !== base) return route.fulfill({ status: 200, contentType: "text/css", body: "" });
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (request.method() !== "GET") posts.push({ path: url.pathname, body: request.postDataJSON() });
    if (url.pathname === "/api/auth/login") return route.fulfill({ json: { success: false, error: "QA sign-in rejected by the existing handler." } });
    if (url.pathname === "/api/auth/otp/send") return route.fulfill({ status: 503, json: { success: false, error: "QA email service unavailable." } });
    if (url.pathname === "/api/auth/refresh") return route.fulfill({ json: { success: true, session: session(role || "cx_lead") } });
    if (url.pathname === "/api/portal") return route.fulfill({ json: { success: true, config: {
      schemaVersion: 1, branding: { logoUrl: null, heroImageUrl: null, primaryColor: "#2ED8B6", accentColor: "#00F2FE" },
      supportName: "QA Support", headline: "How can we help?", introduction: "A local tenant fixture with no customer records.", searchPlaceholder: "Search published help…", actionsHeading: "Support options", sections: { actions: true, search: true, tracker: true, channels: true }, actions: [],
    } } });
    if (url.pathname === "/api/issues") return route.fulfill({ json: { success: true, data: issues } });
    if (["/api/problems", "/api/insights", "/api/workforce", "/api/sources", "/api/verticals"].includes(url.pathname)) return route.fulfill({ json: { success: true, data: [] } });
    if (url.pathname === "/api/voice/session") return route.fulfill({ json: { success: true, data: { phoneConfigs: [], sessions: [] } } });
    // Unknown optional projections remain unavailable; do not invent operational data.
    return route.fulfill({ json: { success: false, error: "Unavailable in local QA fixture", data: [] } });
  });
  return { context, page, errors, posts };
}
async function check(name, fn, page) {
  try { await fn(); results.push(name); console.log("PASS", name); }
  catch (error) { failures.push({ name, error: error.message }); console.log("FAIL", name, error.message); if (page) await page.screenshot({ path: path.join(out, `failure-${failures.length}.png`) }); }
}
const noOverflow = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
const capture = async (page, name) => {
  // Existing utility transitions take 150–200ms; capture the settled theme.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  return page.screenshot({ path: path.join(out, name + ".png") });
};

const publicSite = await surface();
for (const width of [390, 768, 1440, 2560]) await check(`landing-${width}`, async () => {
  const { page } = publicSite;
  await page.setViewportSize({ width, height: 1000 }); await page.goto(base);
  await expect(page.getByRole("heading", { name: /One desk\.\s*Every path to resolution\./ })).toBeVisible();
  await expect(page.locator(".support-flow-map")).toBeVisible();
  await noOverflow(page);
  const circle = await page.locator(".support-hub").first().boundingBox(); assert(Math.abs(circle.width / circle.height - 1) < .01);
  const flow = await page.locator(".support-flow").boundingBox(); assert(flow.width > width * .85);
  await page.locator(".support-flow-paths button").nth(2).click();
  await expect(page.locator(".support-flow-route")).toContainText("Field work");
  await page.getByRole("button", { name: "Pause flow", exact: true }).click();
  const packet = await page.locator(".support-packet").first().getAttribute("transform");
  await page.waitForTimeout(120); assert.equal(await page.locator(".support-packet").first().getAttribute("transform"), packet);
  await page.evaluate(() => scrollTo(0, 0)); await capture(page, `landing-${width}`);
}, publicSite.page);
await check("reduced-motion-and-keyboard", async () => {
  const { page } = publicSite; await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto(base);
  await expect(page.getByRole("button", { name: "Play flow", exact: true })).toBeVisible();
  const packet = await page.locator(".support-packet").first().getAttribute("transform"); await page.waitForTimeout(120); assert.equal(await page.locator(".support-packet").first().getAttribute("transform"), packet);
  await page.keyboard.press("Tab"); await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  const endpoint = page.locator(".support-endpoint").first(); await endpoint.focus(); const before = await endpoint.getAttribute("transform"); await page.keyboard.press("ArrowRight"); assert.notEqual(await endpoint.getAttribute("transform"), before);
  await page.getByRole("button", { name: "Reset flow layout" }).click();
}, publicSite.page);
await check("signin-existing-payload-focus-and-error", async () => {
  const { page, posts } = publicSite; await page.setViewportSize({ width: 390, height: 1000 }); await page.goto(base);
  await page.getByRole("button", { name: "Sign In", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Workspace sign in" }); await expect(dialog).toBeVisible();
  await dialog.getByLabel("Workspace", { exact: true }).fill("qa-support"); await dialog.getByLabel("Work email", { exact: true }).fill("review@example.com"); await dialog.getByLabel("Password", { exact: true }).fill("not-a-real-password");
  const sum = (await dialog.innerText()).match(/(\d+)\s*\+\s*(\d+)\s*=\s*\?/); assert(sum); await dialog.getByLabel("Security verification answer").fill(String(Number(sum[1]) + Number(sum[2])));
  await page.locator('button[form="signin-form"]').click(); await expect(dialog.getByRole("alert")).toContainText("QA sign-in rejected");
  assert.deepEqual(posts.find(post => post.path === "/api/auth/login").body, { email: "review@example.com", password: "not-a-real-password", tenantSlug: "qa-support" });
  await noOverflow(page); await capture(page, "signin-390"); await page.keyboard.press("Escape"); await expect(dialog).toBeHidden(); await expect(page.getByRole("button", { name: "Sign In", exact: true }).first()).toBeFocused();
}, publicSite.page);
await check("signup-existing-validation-and-email-failure", async () => {
  const { page } = publicSite; await page.goto(base + "/signup"); const dialog = page.getByRole("dialog", { name: "Create support workspace" });
  await dialog.getByLabel("Organization name").fill("QA Support"); await expect(dialog.getByLabel("Subdomain slug")).toHaveValue("qa-support"); await page.locator('button[form="step1-form"]').click();
  await dialog.getByLabel("Administrator name").fill("Release QA"); await dialog.getByLabel("Corporate work email").fill("review@example.com"); await dialog.getByLabel("Password", { exact: true }).fill("not-a-real-password"); await dialog.getByLabel("Confirm password", { exact: true }).fill("different-password");
  const sum = (await dialog.innerText()).match(/(\d+)\s*\+\s*(\d+)\s*=\s*\?/); assert(sum); await dialog.getByLabel("Security verification answer").fill(String(Number(sum[1]) + Number(sum[2])));
  await page.locator('button[form="step2-form"]').click(); await expect(dialog.getByRole("alert")).toContainText("Passwords do not match");
  await dialog.getByLabel("Confirm password", { exact: true }).fill("not-a-real-password");
  await page.locator('button[form="step2-form"]').click(); await expect(dialog.getByRole("alert")).toContainText("QA email service unavailable"); await noOverflow(page); await capture(page, "signup-390");
}, publicSite.page);
await check("tenant-entry-preserves-locked-workspace", async () => {
  const { page } = publicSite; await page.goto(base + "/?tenant=qa-support&view=tenant_landing"); await expect(page.locator(".family-tenant")).toBeVisible(); await capture(page, "tenant-390");
  await page.getByRole("button", { name: /sign in/i }).first().click(); const dialog = page.getByRole("dialog"); await expect(dialog).toContainText("qa-support.support.servicev8.com"); await expect(dialog.getByLabel("Workspace", { exact: true })).toHaveCount(0);
}, publicSite.page);

const admin = await surface("cx_lead");
const labels = ["Work Desk", "Problem Matrix", "Issues Explorer", "CX Cockpit", "Overview", "Ask supportV8", "Autonomous Studio", "Trend Radar", "Knowledge Suite", "Support Portal", "Work Sweep", "AI Workforce", "Voice Telephony", "Audit Logs", "Reports", "Policies & Rules", "Studio Marketplace", "Active Capabilities", "Settings", "Members", "Plans & Credits"];
await admin.page.goto(base + "/?tenant=qa-support&admin=true");
for (const label of labels) await check(`destination-${label}`, async () => { await admin.page.locator("#support-navigation nav").getByRole("button", { name: label, exact: true }).click(); await expect(admin.page.locator("#support-navigation nav").getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-current", "page"); }, admin.page);
for (const width of [390, 768, 1440, 2560]) await check(`workspace-${width}`, async () => {
  const { page } = admin; await page.setViewportSize({ width, height: 1000 });
  if (width < 768) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.locator("#support-navigation nav").getByRole("button", { name: "Work Desk", exact: true }).click();
  await expect(page.locator(".family-workdesk")).toBeVisible(); await noOverflow(page);
  if (width >= 768) { const rail = await page.locator("#support-navigation").boundingBox(); assert.equal(rail.x, 0); const main = await page.locator("#support-workspace").boundingBox(); assert(Math.abs(main.x + main.width - width) < 1); await page.getByRole("button", { name: "Collapse navigation", exact: true }).click(); await page.locator("#support-navigation nav").getByRole("button", { name: "Voice Telephony", exact: true }).click(); await page.getByRole("button", { name: "Expand navigation", exact: true }).click(); await page.locator("#support-navigation nav").getByRole("button", { name: "Work Desk", exact: true }).click(); }
  await capture(page, `workspace-dark-${width}`); await page.getByRole("button", { name: "Switch to light theme" }).click(); await expect(page.locator("html")).toHaveAttribute("data-family-theme", "light"); await capture(page, `workspace-light-${width}`); await page.getByRole("button", { name: "Switch to dark theme" }).click();
}, admin.page);
await check("resolution-context-minimize-maximize", async () => {
  await expect(admin.page.locator(".family-context-controls")).toHaveCount(0);
  const populated = await surface("cx_lead", [{
    id: "qa-issue", tenantId: "qa-support", source: "email", externalId: "QA-001", sourceUrl: "", customerRef: "qa-contact", customerName: "Local QA contact", customerTier: "standard",
    summary: "Local layout fixture: verify resolution context", category: "support", product: "QA", version: "1", sentiment: "neutral", sentimentScore: 0, sentimentTrajectory: "stable", priority: "normal", confidence: 0, businessImpact: "low",
    sourceStatus: "open", status: "open", resolutionRiskScore: 0, tags: [], createdAt: "2026-09-10T12:00:00Z", updatedAt: "2026-09-10T12:00:00Z", timeline: [], messages: [], attachments: [],
  }]);
  const { page } = populated; await page.goto(base + "/?tenant=qa-support&admin=true");
  await page.locator("#support-navigation nav").getByRole("button", { name: "Work Desk", exact: true }).click();
  await expect(page.locator("#support-resolution")).toBeVisible(); await capture(page, "context-expanded-1440");
  await page.getByRole("button", { name: "Minimize resolution context", exact: true }).click(); await expect(page.locator("#support-resolution")).toBeHidden();
  await page.getByRole("button", { name: "Expand resolution context", exact: true }).click(); await expect(page.locator("#support-resolution")).toBeVisible();
  await page.getByRole("button", { name: "Maximize resolution context", exact: true }).click(); await expect(page.locator(".family-queue")).toBeHidden(); await expect(page.locator(".family-details")).toBeHidden();
  await capture(page, "context-maximized-1440"); await page.getByRole("button", { name: "Restore work desk layout", exact: true }).click(); await expect(page.locator(".family-queue")).toBeVisible();
  assert.deepEqual(populated.errors, []); await populated.context.close();
}, admin.page);
await check("mobile-drawer-breakpoint-and-signout", async () => {
  const { page } = admin; await page.setViewportSize({ width: 390, height: 1000 }); await page.getByRole("button", { name: "Open navigation" }).click(); await expect(page.getByRole("button", { name: "Sign out of Cockpit", exact: true })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(page.locator("#support-navigation")).toHaveAttribute("data-mobile-open", "false"); await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
  await page.getByRole("button", { name: "Open navigation" }).click(); await page.setViewportSize({ width: 1440, height: 1000 }); await expect(page.locator("#support-navigation")).toHaveAttribute("data-mobile-open", "false");
  await page.getByRole("button", { name: "Switch to light theme" }).focus(); await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => document.querySelector("#support-navigation").contains(document.activeElement)), false);
  await page.getByRole("button", { name: "Sign out of Cockpit", exact: true }).click(); await expect(page.locator(".family-public")).toBeVisible(); assert.equal(await page.evaluate(() => sessionStorage.getItem("sv8_operator_session")), null);
}, admin.page);
for (const role of ["observer", "contractor"]) await check(`permission-menu-${role}`, async () => {
  const app = await surface(role); await app.page.goto(base + "/?tenant=qa-support&admin=true"); const nav = app.page.locator("#support-navigation nav");
  await expect(nav.getByRole("button", { name: "Members", exact: true })).toHaveCount(0); await expect(nav.getByRole("button", { name: "Settings", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("button", { name: role === "observer" ? "Overview" : "Field Work Desk", exact: true })).toBeVisible(); assert.deepEqual(app.errors, []); await app.context.close();
});
await check("browser-console", async () => {
  // The deliberately intercepted email outage emits one expected HTTP 503 console entry.
  expect(publicSite.errors).toEqual([expect.stringMatching(/Failed to load resource:.*503/)]);
  assert.deepEqual(admin.errors, []);
});
await browser.close();
fs.writeFileSync(path.join(out, "qa-results.json"), JSON.stringify({ passed: results.length, results, failures }, null, 2));
console.log(JSON.stringify({ passed: results.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
