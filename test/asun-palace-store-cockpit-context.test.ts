import { describe, it, expect, vi } from "vitest";

vi.mock("pg", () => ({
  Pool: class {
    query = vi.fn();
    connect = vi.fn();
  },
  default: {
    Pool: class {
      query = vi.fn();
      connect = vi.fn();
    },
  },
}));

import { isAsunPalaceTenant } from "../src/lib/services/chat-workflow-service";
import { AsunPalaceContextPanel } from "../src/components/workspace/AsunPalaceContextPanel";

describe("Asun Palace Store In-Cockpit Context Panel", () => {
  it("exports AsunPalaceContextPanel component", () => {
    expect(AsunPalaceContextPanel).toBeDefined();
    expect(typeof AsunPalaceContextPanel).toBe("function");
  });

  it("accurately identifies Asun Palace Store tenants across subdomains and identifiers", () => {
    expect(isAsunPalaceTenant("asun-palace-store")).toBe(true);
    expect(isAsunPalaceTenant("apalace")).toBe(true);
    expect(isAsunPalaceTenant("asun-palace-store.support.servicev8.com")).toBe(true);
    expect(isAsunPalaceTenant("asun_palace")).toBe(true);
    expect(isAsunPalaceTenant("acme")).toBe(false);
    expect(isAsunPalaceTenant("meridian")).toBe(false);
  });
});
