import { describe, expect, it } from "vitest";
import { boundedManagedSupportJson } from "@/lib/service-app/managed-support-registration-transport";

describe("managed Support registration response boundary", () => {
  it("reads bounded chunked JSON", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"status":'));
        controller.enqueue(new TextEncoder().encode('"ready"}'));
        controller.close();
      },
    });
    await expect(
      boundedManagedSupportJson(new Response(stream)),
    ).resolves.toEqual({ status: "ready" });
  });
  it("rejects an oversized chunked response before parsing", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(32769));
        controller.close();
      },
    });
    await expect(
      boundedManagedSupportJson(new Response(stream)),
    ).rejects.toThrow("managed_support_response_too_large");
  });
});
