import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { GlobalLandingView } from "@/components/GlobalLandingView";
import { SupportV8Logo } from "@/components/SupportV8Logo";
import { groupSupportNavigation } from "@/components/FamilyControls";

const source = (name: string) => readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

describe("production support family refresh", () => {
  it("groups only already-authorized navigation objects without changing destinations", () => {
    const items = ["overview", "workspace", "approvals", "market_workforce", "market_plans"].map(id => ({ id, handler: vi.fn() }));
    const grouped = groupSupportNavigation([{ title: "Incumbent", items }], false);
    expect(grouped.map(group => group.title)).toEqual(["AGENTIC RUNTIME", "ECOSYSTEM", "GOVERNANCE", "SETTINGS"]);
    expect(grouped.flatMap(group => group.items)).toHaveLength(items.length);
    for (const item of items) expect(grouped.flatMap(group => group.items)).toContain(item);
    expect(groupSupportNavigation([{ title: "Filtered", items: [items[1]] }], true)).toEqual([{ title: "Field Operations", items: [items[1]] }]);
  });
  it("renders the approved support hub with real entry controls and illustrative paths", () => {
    const html = renderToStaticMarkup(<GlobalLandingView onOpenSignIn={vi.fn()} onOpenTenantPortal={vi.fn()} onOpenSignup={vi.fn()} />);
    expect(html).toContain("One desk.");
    expect(html).toContain("Every path to resolution.");
    for (const name of ["Customer chat", "Tickets", "Field work", "Support team", "Work orders", "Knowledge", "Pause flow"]) expect(html).toContain(name);
    for (const id of ["capabilities", "workforce", "architecture", "security"]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain("Sign In");
    expect(html).not.toContain("99.4% CSAT");
  });
  it("uses four equal brand squares and the approved lowercase identity", () => {
    // Family mark (F4): lime down the left column, SupportV8 teal top-right, cyan bottom-right.
    const html = renderToStaticMarkup(<SupportV8Logo />);
    expect(html.match(/<rect /g)).toHaveLength(4);
    expect(html.match(/width="14" height="14"/g)).toHaveLength(4);
    const fills = [...html.matchAll(/<rect x="(\d+)" y="(\d+)"[^>]*fill="(#[0-9A-F]{6})"/gi)].map(([, x, y, fill]) => `${x},${y}:${fill.toUpperCase()}`);
    expect(fills).toEqual(["0,0:#C8FF00", "17,0:#2ED8B6", "0,17:#C8FF00", "17,17:#00F2FE"]);
    expect(html).not.toContain("#2ED8B6");
    expect(html).toContain(">v8</span>");
  });
  it("preserves the complete incumbent menu role filters and auth action handlers", () => {
    const page = source("app/page.tsx");
    expect(hash(page.slice(page.indexOf("  const allNavSections ="), page.indexOf("  // Automatically enforce tab route guards")))).toBe("75836e838a0443346c8c5a51d6042b79c5847bda9af7b9d79af0d399f5aeeb01");
    for (const [name, expected] of [["SignInModal", "462f2a7ea44bcc064fca87bc01d7a4337875b702ee55ea238110dee8c87bc81d"], ["SignupModal", "1b9433e286dd8b124e78a457cc1d789694dfcd77d97c0fa9bf640ce33868b550"]]) {
      const text = source(`components/${name}.tsx`);
      const start = text.indexOf("  if (!isOpen) return null;");
      const end = text.indexOf("  return (\n", start);
      expect(hash(text.slice(start, end))).toBe(expected);
    }
  });
});
