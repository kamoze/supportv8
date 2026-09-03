import { describe, expect, it, vi } from "vitest";
import type Redis from "ioredis";
import { presenceKeys, StaffPresenceStore } from "@/lib/chat/staff-presence";
const ctx = { tenantId: "tenant_alpha", tenantSlug: "alpha", userId: "subject1", username: "jordan@alpha.com", displayName: "Jordan", authenticated: true, roles: ["support_operator"] };
describe("signed staff presence leases", () => {
  it("starts empty, namespaces tenants, and has no seeded staff", async () => {
    const evalFn = vi.fn(async () => []);
    const store = new StaffPresenceStore(() => ({ eval: evalFn } as unknown as Redis));
    expect(await store.list("tenant_alpha")).toEqual([]);
    expect(presenceKeys("tenant_alpha")).not.toEqual(presenceKeys("tenant_beta"));
    expect(() => presenceKeys("bad:tenant")).toThrow();
  });
  it("stores only the verified staff identity with a 90-second lease", async () => {
    const evalFn = vi.fn(async () => 1);
    const store = new StaffPresenceStore(() => ({ eval: evalFn } as unknown as Redis), () => 1000);
    await store.heartbeat(ctx);
    const args = evalFn.mock.calls[0] as unknown[];
    expect(args[2]).toBe(presenceKeys("tenant_alpha")[0]);
    expect(JSON.parse(String(args[5]))).toMatchObject({ id: "subject1", name: "Jordan", email: "jordan@alpha.com" });
    expect(args[6]).toBe(91_000);
  });
  it.each([[], ["support_demo_operator"], ["support_observer"]].map(roles => ({ roles })))("rejects non-staff identities: %j", async ({ roles }) => {
    const evalFn = vi.fn();
    await expect(new StaffPresenceStore(() => ({ eval: evalFn } as unknown as Redis)).heartbeat({ ...ctx, roles })).rejects.toMatchObject({ status: 403 });
    expect(evalFn).not.toHaveBeenCalled();
  });
  it("prunes expired entries on the shared server, not in each browser", async () => {
    const evalFn = vi.fn(async () => []);
    await new StaffPresenceStore(() => ({ eval: evalFn } as unknown as Redis), () => 91_000).list("tenant_alpha");
    const args = evalFn.mock.calls[0] as unknown[];
    expect(args[0]).toContain("ZREMRANGEBYSCORE"); expect(args.at(-1)).toBe(91_000);
  });
});
