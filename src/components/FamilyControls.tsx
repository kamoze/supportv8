"use client";

import React, { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "@/components/ui/FlatIcon";

export function FamilyThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => { setLight(document.documentElement.dataset.familyTheme === "light"); }, []);
  const label = light ? "Switch to dark theme" : "Switch to light theme";
  return <button type="button" className="family-icon-button" title={label} aria-label={label} aria-pressed={light} onClick={() => {
    const next = !light;
    setLight(next);
    document.documentElement.dataset.familyTheme = next ? "light" : "dark";
    try { localStorage.setItem("supportFamilyTheme", next ? "light" : "dark"); } catch { /* Optional presentation preference. */ }
  }}>{light ? <Moon size={18} /> : <Sun size={18} />}</button>;
}

// Presentation-only dialog focus/dismissal. Existing form handlers own auth.
export function useFamilyDialog<T extends HTMLElement = HTMLDivElement>(isOpen: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!isOpen || !dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>("button,a[href],input,select,textarea,[tabindex='0']")].filter(el => !el.hasAttribute("disabled") && el.getClientRects().length);
    const timer = requestAnimationFrame(() => focusable()[0]?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const items = focusable(), first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      cancelAnimationFrame(timer);
      document.removeEventListener("keydown", keydown);
      if (previous?.getClientRects().length) previous.focus();
      else document.querySelector<HTMLElement>("#support-workspace")?.focus();
    };
  }, [isOpen]);
  return ref;
}

export function groupSupportNavigation<T extends { id: string }>(sections: { title: string; items: T[] }[], contractor: boolean) {
  const items = sections.flatMap(section => section.items);
  const groups: [string, string[]][] = [
    [contractor ? "Field Operations" : "AGENTIC RUNTIME", contractor ? ["workspace", "problems", "issues", "cx_cockpit"] : ["ask", "workspace", "knowledge", "studio", "overview", "trends"]],
    [contractor ? "Field Assistant & Comms" : "ECOSYSTEM", contractor ? ["ask"] : ["cx_cockpit", "problems", "issues", "customers", "workforce", "studio_marketplace", "market_workforce", "market_connectors", "portal_composer"]],
    ["GOVERNANCE", contractor ? [] : ["gov_audit", "gov_reports", "approvals", "workflows", "policies"]],
    ["SETTINGS", contractor ? [] : ["market_plans", "gov_settings", "gov_members"]],
  ];
  return groups.map(([title, ids]) => ({ title, items: ids.flatMap(id => items.filter(item => item.id === id)) })).filter(group => group.items.length);
}
