// @vitest-environment jsdom
// Canonical ServiceV8 portraits: one mapping, the right small files, no broken images.
import React, { act } from "react";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { EmployeeAvatar } from "@/components/chat-ui/EmployeeAvatar";
import { PENDING_ART, PORTRAIT_KEYS, PORTRAIT_SIZES, isCustomAvatarUrl, portraitKey, portraitSources } from "@/lib/portraits";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const root = process.cwd();
const publicFile = (url: string) => join(root, "public", url);
const vectors: [string, string, string][] = JSON.parse(readFileSync(join(root, "test/fixtures/portrait-test-vectors.json"), "utf8"));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sourceFiles(join(dir, e.name)) : /\.(tsx?|mjs)$/.test(e.name) ? [join(dir, e.name)] : []));
}

describe("canonical resolver", () => {
  it.each(vectors)("%j / %j -> %s", (name, role, expected) => {
    expect(portraitKey(name, role)).toBe(expected);
  });

  it("only returns keys with artwork; placeholder names show the default beaver", () => {
    for (const name of PENDING_ART) expect(portraitKey(name)).toBe("default");
    expect(PORTRAIT_KEYS).toHaveLength(12);
    expect(portraitKey("Alex — Support Intelligence Lead", "Senior Support Employee")).toBe("sophia");
    expect(portraitKey("Auto-Tagger Intern", "")).toBe("intern");
  });
});

describe("portrait files", () => {
  it("ships a WebP at 1x and 2x for every key and rendered size, each at most 30 KB", () => {
    for (const key of PORTRAIT_KEYS) {
      for (const size of PORTRAIT_SIZES) {
        const { src, srcSet } = portraitSources(key, size);
        for (const url of [src, ...srcSet.split(", ").map((s) => s.split(" ")[0])]) {
          expect(existsSync(publicFile(url)), url).toBe(true);
          expect(statSync(publicFile(url)).size, url).toBeLessThanOrEqual(30 * 1024);
        }
      }
    }
  });

  it("ships no placeholder-name portraits and records the provenance", () => {
    const files = readdirSync(join(root, "public/avatars"));
    for (const name of PENDING_ART) expect(files.filter((f) => f.startsWith(`beaver-${name}`)), name).toEqual([]);
    expect(readFileSync(join(root, "public/avatars/README.md"), "utf8")).toContain("originals.sha256");
  });

  it("never points an image at a missing file: every stock path in the code exists or resolves canonically", () => {
    const paths = new Set<string>();
    for (const file of sourceFiles(join(root, "src"))) {
      for (const m of readFileSync(file, "utf8").matchAll(/["'`](\/avatars\/[^"'`\s]+)["'`]/g)) paths.add(m[1]);
    }
    expect(paths.size).toBeGreaterThan(0);
    for (const url of paths) {
      // Stock paths are never rendered as-is (they resolve canonically), so a missing one cannot break an image.
      expect(existsSync(publicFile(url)) || !isCustomAvatarUrl(url), url).toBe(true);
    }
    // Data still carries these two, which have no file; they render the canonical portrait.
    expect(isCustomAvatarUrl("/avatars/alex.jpg")).toBe(false);
    expect(isCustomAvatarUrl("/avatars/beaver-alex.jpg")).toBe(false);
  });

  it("keeps the old fallbacks out of the UI", () => {
    for (const file of ["GovernanceAuditLogsView.tsx", "dashboard/WorkforceDirectoryView.tsx", "AskWorkspaceView.tsx", "dashboard/WorkAssignModal.tsx", "KnowledgeGraphCanvas.tsx", "dashboard/VoiceProvisionModal.tsx", "dashboard/VoiceAgentEditModal.tsx", "dashboard/VoiceOperationsView.tsx", "WorkforceApprovalsView.tsx"]) {
      const text = readFileSync(join(root, "src/components/views", file), "utf8");
      expect(text, file).not.toMatch(/\/avatars\/beaver-[a-z]+\.jpg/);
      // WorkforceApprovalsView shows no portrait; its sample rows only lost their stock avatar URLs.
      if (!file.startsWith("WorkforceApprovals")) expect(text, file).toContain("EmployeeAvatar");
    }
  });
});

describe("EmployeeAvatar", () => {
  function render(ui: React.ReactElement) {
    const container = document.createElement("div");
    const r = createRoot(container);
    act(() => r.render(ui));
    return container.querySelector("img")!;
  }

  it("serves the canonical WebP with srcset and explicit width and height", () => {
    const img = render(<EmployeeAvatar name="Maya — Incident & Business Impact Analyst" role="Incident Response Employee" size={48} />);
    expect(img.getAttribute("src")).toBe("/avatars/beaver-penelope-48.webp");
    expect(img.getAttribute("srcset")).toBe("/avatars/beaver-penelope-48.webp 1x, /avatars/beaver-penelope-96.webp 2x");
    expect(img.getAttribute("width")).toBe("48");
    expect(img.getAttribute("height")).toBe("48");
    expect(img.getAttribute("alt")).toBe("");
  });

  it("uses the next size up for slots without an exact file", () => {
    expect(render(<EmployeeAvatar name="Sophia" size={24} />).getAttribute("src")).toBe("/avatars/beaver-sophia-28.webp");
    expect(render(<EmployeeAvatar name="Sophia" size={96} />).getAttribute("src")).toBe("/avatars/beaver-sophia-112.webp");
    expect(render(<EmployeeAvatar name="Sophia" size={24} />).getAttribute("width")).toBe("24");
  });

  it("resolves stock data URLs canonically but keeps a real custom avatar URL", () => {
    expect(render(<EmployeeAvatar src="/avatars/beaver-manager.jpg" name="Alex — Support Intelligence Lead" role="Senior Support Employee" size={40} />).getAttribute("src")).toBe("/avatars/beaver-sophia-40.webp");
    const custom = render(<EmployeeAvatar src="https://cdn.example.com/u/42.png" name="Alex" size={40} />);
    expect(custom.getAttribute("src")).toBe("https://cdn.example.com/u/42.png");
    expect(custom.getAttribute("width")).toBe("40");
    expect(custom.getAttribute("height")).toBe("40");
  });
});
