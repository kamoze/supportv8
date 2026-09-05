import { describe, expect, it } from "vitest";
import { createPortalLoadGuard } from "@/lib/portal/load-guard";

describe("portal tenant load guard", () => {
  it("prevents an older tenant response from becoming current", () => {
    const guard = createPortalLoadGuard();
    const alphaIsCurrent = guard.begin();
    const meridianIsCurrent = guard.begin();

    expect(alphaIsCurrent()).toBe(false);
    expect(meridianIsCurrent()).toBe(true);

    guard.invalidate();
    expect(meridianIsCurrent()).toBe(false);
  });
});
