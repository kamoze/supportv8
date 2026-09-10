// Focused production-browser regression; install runner separately as documented in family-qa.mjs.
import assert from "node:assert/strict";
const { chromium, expect } = await import(process.env.SUPPORT_PLAYWRIGHT_MODULE || "@playwright/test");
const browser = await chromium.launch({ headless: true });
const failures = [];
const base = process.env.SUPPORT_QA_URL || "http://127.0.0.1:18865";
async function check(name, run) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference" });
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.origin !== base || url.pathname.startsWith("/api/")
      ? route.fulfill({ status: 200, contentType: "text/css", body: "" }) : route.continue();
  });
  try {
    await page.goto(base);
    await expect(page.getByRole("button", { name: "Pause flow", exact: true })).toBeVisible();
    await page.waitForTimeout(1500);
    await run(page);
    console.log("PASS", name);
  } catch (error) { failures.push({ name, error: error.message }); console.log("FAIL", name, error.message); }
  finally { await page.close(); }
}
await check("Pause, resume and route selection preserve moved geometry; only Reset restores it", async page => {
  const endpoint = page.locator(".support-endpoint").first();
  const original = await endpoint.getAttribute("transform");
  await endpoint.focus(); await page.keyboard.press("ArrowRight");
  const moved = await endpoint.getAttribute("transform"); assert.notEqual(moved, original);
  await page.getByRole("button", { name: "Pause flow", exact: true }).click();
  await page.waitForTimeout(150); assert.equal(await endpoint.getAttribute("transform"), moved);
  await page.locator(".support-flow-paths button").nth(1).click();
  await page.waitForTimeout(150); assert.equal(await endpoint.getAttribute("transform"), moved);
  await page.getByRole("button", { name: "Play flow", exact: true }).click();
  await page.waitForTimeout(150); assert.equal(await endpoint.getAttribute("transform"), moved);
  await page.getByRole("button", { name: "Reset flow layout" }).click();
  await page.waitForTimeout(150); assert.equal(await endpoint.getAttribute("transform"), original);
});
await check("Pause freezes packets without jumping; resume continues from the paused position", async page => {
  const positions = () => page.locator(".support-packet").evaluateAll(nodes => nodes.map(node => node.getAttribute("transform")));
  const before = await page.evaluate(() => {
    const positions = [...document.querySelectorAll(".support-packet")].map(node => node.getAttribute("transform"));
    [...document.querySelectorAll("button")].find(button => button.textContent === "Pause flow").click();
    return positions;
  });
  await page.waitForTimeout(150); const paused = await positions();
  const near = (first, second) => first.forEach((value, index) => {
    const a = value.match(/[-\d.]+/g).map(Number), b = second[index].match(/[-\d.]+/g).map(Number);
    assert(Math.hypot(a[0] - b[0], a[1] - b[1]) < 8, "Packet jumped at pause/resume rather than retaining elapsed time");
  });
  near(before, paused);
  await page.waitForTimeout(150); assert.deepEqual(await positions(), paused);
  await page.getByRole("button", { name: "Play flow", exact: true }).click();
  near(paused, await positions());
  await page.waitForTimeout(150); assert.notDeepEqual(await positions(), paused);
});
await browser.close();
console.log(JSON.stringify({ passed: 2 - failures.length, failures }));
if (failures.length) process.exitCode = 1;
