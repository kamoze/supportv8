import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("PWA Manifest & Service Worker", () => {
  it("provides a valid Web App Manifest with required PWA fields", () => {
    const manifestPath = resolve(process.cwd(), "public/manifest.webmanifest");
    expect(existsSync(manifestPath)).toBe(true);

    const raw = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);

    expect(manifest.name).toBe("SupportV8 Client Portal");
    expect(manifest.short_name).toBe("Support");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/?source=pwa");
    expect(manifest.theme_color).toBe("#0B1017");
    expect(manifest.background_color).toBe("#090E15");
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  it("provides a service worker script for offline shell caching", () => {
    const swPath = resolve(process.cwd(), "public/sw.js");
    expect(existsSync(swPath)).toBe(true);

    const content = readFileSync(swPath, "utf-8");
    expect(content).toContain("addEventListener('install'");
    expect(content).toContain("addEventListener('fetch'");
  });

  it("includes PWA meta tags and manifest link in root layout", () => {
    const layoutPath = resolve(process.cwd(), "src/app/layout.tsx");
    const content = readFileSync(layoutPath, "utf-8");

    expect(content).toContain('rel="manifest"');
    expect(content).toContain('href="/manifest.webmanifest"');
    expect(content).toContain('name="mobile-web-app-capable"');
    expect(content).toContain('name="apple-mobile-web-app-capable"');
  });

  it("provides offline fallback handling in service worker fetch handler", () => {
    const swPath = resolve(process.cwd(), "public/sw.js");
    const content = readFileSync(swPath, "utf-8");
    expect(content).toContain("event.request.mode === 'navigate'");
    expect(content).toContain("Service Unavailable");
  });
});
