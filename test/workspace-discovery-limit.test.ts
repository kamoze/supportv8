import { describe, expect, it } from "vitest";
import { createWorkspaceDiscoveryLimiter } from "../src/lib/auth/workspace-discovery-limit";
import { InMemoryOtpBackend } from "../src/lib/auth/otp-store";
describe("durable public discovery budgets", () => {
  it("shares a bounded per-workspace budget across facade instances", async () => {
    const backend = new InMemoryOtpBackend(), limits = [createWorkspaceDiscoveryLimiter(backend), createWorkspaceDiscoveryLimiter(backend)];
    for (let i = 0; i < 60; i++) await limits[i % 2]("alpha");
    await expect(limits[1]("alpha")).rejects.toMatchObject({ status: 429 });
    await expect(limits[0]("other")).resolves.toBeUndefined();
  });
  it("denies store outages instead of reverting to process-local limits", async () => {
    const backend = new InMemoryOtpBackend(); backend.increment = async () => { throw Error("private datastore detail"); };
    await expect(createWorkspaceDiscoveryLimiter(backend)("alpha")).rejects.toMatchObject({ status: 503, code: "workspace_lookup_unavailable" });
  });
});
