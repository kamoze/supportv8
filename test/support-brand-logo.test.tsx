import React from "react";
import { existsSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SupportV8Logo, SUPPORT_BRAND } from "@/components/SupportV8Logo";
import { WorkforceAvatar } from "@/components/WorkforceAvatar";

const file = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const squares = (svg: string) =>
  [...svg.matchAll(/<rect x="(\d+)" y="(\d+)"[^>]*fill="(#[0-9a-f]{6})"/gi)].map(([, x, y, fill]) => `${x},${y}:${fill.toUpperCase()}`);
const FAMILY_MARK = ["0,0:#C8FF00", "17,0:#EC4899", "0,17:#C8FF00", "17,17:#00F2FE"];

describe("SupportV8 family logo (F4)", () => {
  it("lays the mark out lime-left with pink top-right and cyan bottom-right everywhere", () => {
    expect(SUPPORT_BRAND).toEqual({ lime: "#C8FF00", secondary: "#EC4899", tertiary: "#00F2FE" });
    expect(squares(renderToStaticMarkup(<SupportV8Logo />))).toEqual(FAMILY_MARK);
    expect(squares(file("src/app/icon.svg"))).toEqual(FAMILY_MARK);
    expect(squares(file("public/favicon.svg"))).toEqual(FAMILY_MARK);
  });

  it("keeps the previous marks in the brand backups", () => {
    for (const name of ["SupportV8Logo.tsx.txt", "icon.svg", "favicon.svg", "README.md"]) {
      expect(existsSync(new URL(`../docs/brand-backups/2026-11-18/${name}`, import.meta.url))).toBe(true);
    }
    expect(file("docs/brand-backups/2026-11-18/favicon.svg")).toContain("#2ED8B6");
  });

  it("defines the brand tokens with readable secondary text for both themes", () => {
    const globals = file("src/app/globals.css");
    for (const token of ["--support-lime: #C8FF00", "--support-sec: #EC4899", "--support-ter: #00F2FE", "--support-sec-text: #F06DAD"]) expect(globals).toContain(token);
    expect(file("src/app/family.css")).toMatch(/data-family-theme="light"\][^}]*--support-sec-text:#712349/);
  });

  it("paints AI employees in the SupportV8 secondary, with token text rather than raw pink", () => {
    const html = renderToStaticMarkup(<WorkforceAvatar name="Sophia" level="ai_employee" />);
    expect(html).toContain("text-[var(--support-sec-text)]");
    expect(html).not.toContain("#2ED8B6");
  });

  it("defaults the chat widget to SupportV8 pink with dark, readable ink", () => {
    const widget = file("src/components/chat/SupportChatWidget.tsx");
    expect(widget).toContain('brandColor = "#EC4899"');
    expect(widget).not.toContain('"#2ED8B6"');
  });
});
