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
    const items = ["overview", "workspace", "voice", "gov_audit", "market_plans"].map(id => ({ id, handler: vi.fn() }));
    const grouped = groupSupportNavigation([{ title: "Incumbent", items }], false);
    expect(grouped.map(group => group.title)).toEqual(["Work", "Workforce", "Governance", "Settings"]);
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
    const html = renderToStaticMarkup(<SupportV8Logo />);
    expect(html.match(/<rect /g)).toHaveLength(4);
    expect(html.match(/width="12" height="12"/g)).toHaveLength(4);
    expect(html).toContain("#c8ff00");
    expect(html).toContain("#2ED8B6");
    expect(html).toContain("#00F2FE");
    expect(html).toContain(">v8</span>");
  });
  it("preserves the complete incumbent menu role filters and auth action handlers", () => {
    const page = source("app/page.tsx");
    expect(hash(page.slice(page.indexOf("  const allNavSections ="), page.indexOf("  // Automatically enforce tab route guards")))).toBe("8149bfd03bf1dd8c2a4c1451109eb5008eb7a7415e4b72a6933139fbf2cb7449");
    for (const [name, expected] of [["SignInModal", "462f2a7ea44bcc064fca87bc01d7a4337875b702ee55ea238110dee8c87bc81d"], ["SignupModal", "aad4ac72f4f4d23eb517d508f72f031bfe54ba994444390c6b025171d9b27802"]]) {
      const text = source(`components/${name}.tsx`);
      const start = text.indexOf("  if (!isOpen) return null;");
      const end = text.indexOf("  return (\n", start);
      expect(hash(text.slice(start, end))).toBe(expected);
    }
  });
});
