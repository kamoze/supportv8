import { describe, expect, it } from "vitest";
import { portalMediaKind, readPortalMediaFile } from "@/lib/portal/media";

describe("portal media validation", () => {
  it("accepts image bytes only when the declared type matches", async () => {
    const file = new File([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ], "logo.png", { type: "image/png" });
    await expect(readPortalMediaFile(file, "logo")).resolves.toMatchObject({
      contentType: "image/png",
      extension: "png",
    });
  });

  it("rejects active content and spoofed image types", async () => {
    const svg = new File(["<svg><script>alert(1)</script></svg>"], "logo.svg", { type: "image/svg+xml" });
    const spoofed = new File(["not a png"], "logo.png", { type: "image/png" });
    await expect(readPortalMediaFile(svg, "logo")).rejects.toThrow("PNG, JPEG, or WebP");
    await expect(readPortalMediaFile(spoofed, "logo")).rejects.toThrow("PNG, JPEG, or WebP");
  });

  it("bounds upload type and size", async () => {
    expect(() => portalMediaKind("avatar")).toThrow("logo or hero");
    const oversized = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "logo.png", { type: "image/png" });
    await expect(readPortalMediaFile(oversized, "logo")).rejects.toThrow("2 MB or smaller");
  });
});
