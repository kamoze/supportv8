// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SoundAlertToggle } from "@/components/SoundAlertToggle";
import { soundAlertService } from "@/lib/services/sound-alert-service";

const roots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SoundAlertToggle Component", () => {
  const storageMap = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => { storageMap.set(key, String(value)); },
    removeItem: (key: string) => { storageMap.delete(key); },
    clear: () => { storageMap.clear(); },
  };

  beforeEach(() => {
    vi.stubGlobal("localStorage", mockLocalStorage);
    storageMap.clear();
    soundAlertService.updateConfig({
      enabled: true,
      ticketAlerts: true,
      chatAlerts: true,
      volume: 0.7,
    });
  });

  afterEach(() => {
    for (const root of roots) act(() => root.unmount());
    roots.length = 0;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders with active sound state by default", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<SoundAlertToggle />);
    });

    const button = container.querySelector("button[aria-pressed='true']");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("title")).toContain("Sound alerts active");
  });

  it("toggles sound alerts off when clicked", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<SoundAlertToggle />);
    });

    const button = container.querySelector("button[aria-pressed='true']") as HTMLButtonElement;
    expect(button).not.toBeNull();

    act(() => {
      button.click();
    });

    expect(soundAlertService.getConfig().enabled).toBe(false);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("title")).toContain("Sound alerts muted");
  });

  it("opens quick settings dropdown when chevron is clicked", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<SoundAlertToggle showDropdown={true} />);
    });

    const chevron = container.querySelector("button[aria-label='Sound alert preferences']") as HTMLButtonElement;
    expect(chevron).not.toBeNull();

    act(() => {
      chevron.click();
    });

    expect(container.textContent).toContain("Sound Alert Controls");
    expect(container.textContent).toContain("Incoming Tickets");
    expect(container.textContent).toContain("Incoming Chat");
    expect(container.textContent).toContain("VOLUME");
  });
});
