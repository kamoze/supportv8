import { describe, expect, it, vi } from "vitest";
import { createNativeLoginAuthority } from "../src/lib/auth/native-login-authority";
const registration = { id: "tenant_alpha", accountId: "canonical-account", slug: "alpha", name: "Alpha", status: "active" as const, url: "https://alpha.support.servicev8.com/" };
const claims = { iss: "https://identity.example.test/realms/servicev8", sub: "verified-subject", tenant_id: registration.id, account_id: registration.accountId };
const request = new Request("https://alpha.support.servicev8.com/api/auth/login");
function fixture() {
 const workspace = vi.fn(async () => registration), native = vi.fn(async () => true);
 const membership = vi.fn(async () => ({ tenantId: registration.id, accountId: registration.accountId, identitySubject: claims.sub, status: "active", role: "member" }));
 return { workspace, native, membership, current: createNativeLoginAuthority({ canonicalIssuer: () => claims.iss, workspace, native, membership }) };
}
describe("canonical identity and current native compatibility at session issuance", () => {
 it("admits only matching canonical claims, exact current membership and existing native identity", async () => {
  const f = fixture(); expect(await f.current(registration, claims, request)).toEqual(registration);
  expect(f.membership).toHaveBeenCalledWith(registration, "verified-subject", expect.any(AbortSignal)); expect(f.native).toHaveBeenCalledWith(registration);
 });
 it("rejects a same-subject legacy issuer before reading membership or the native workspace", async () => {
  for (const issuer of [undefined, "https://identity.example.test/realms/supportv8", "https://foreign.example.test/realms/servicev8"]) {
   const f = fixture(); await expect(f.current(registration, { ...claims, iss: issuer }, request)).rejects.toMatchObject({ status: 403 });
   expect(f.workspace).not.toHaveBeenCalled(); expect(f.membership).not.toHaveBeenCalled(); expect(f.native).not.toHaveBeenCalled();
  }
 });
 it("denies unavailable canonical issuer configuration without guessing a realm", async () => {
  const f = fixture(), current = createNativeLoginAuthority({ ...f, canonicalIssuer: () => undefined });
  await expect(current(registration, claims, request)).rejects.toMatchObject({ status: 503 }); expect(f.membership).not.toHaveBeenCalled();
 });
 it("denies an opaque canonical ID distinct from the legacy native ID without guessing an alias", async () => {
  const f = fixture(), canonical = { ...registration, id: "bcae2c0b-49d5-4c3b-8359-8b9d11694186" };
  await expect(f.current(canonical, { ...claims, tenant_id: canonical.id }, request)).rejects.toMatchObject({ status: 503, message: "This workspace identity mapping is not ready for sign-in." });
  expect(f.native).not.toHaveBeenCalled(); expect(f.membership).not.toHaveBeenCalled();
  await expect(f.current(canonical, claims, request)).rejects.toMatchObject({ status: 403 });
 });
 it("rejects missing/foreign tenant, account, subject and persisted mapping", async () => {
  for (const patch of [{ tenant_id: "tenant_other" }, { account_id: "foreign" }, { account_id: undefined }, { sub: undefined }]) await expect(fixture().current(registration, { ...claims, ...patch }, request)).rejects.toMatchObject({ status: 403 });
  const f = fixture(); f.native.mockResolvedValue(false); await expect(f.current(registration, claims, request)).rejects.toMatchObject({ status: 503 });
 });
 it("freshly denies revocation or owner mismatch after the credential operation", async () => {
  for (const patch of [{ status: "suspended" }, { identitySubject: "other" }, { tenantId: "foreign" }, { accountId: "foreign" }]) {
   const f = fixture(); f.membership.mockResolvedValue({ tenantId: registration.id, accountId: registration.accountId, identitySubject: claims.sub, status: "active", role: "member", ...patch });
   await expect(f.current(registration, claims, request)).rejects.toMatchObject({ status: 403 });
  }
  const f = fixture(); f.workspace.mockResolvedValue({ ...registration, accountId: "reassigned" }); await expect(f.current(registration, claims, request)).rejects.toMatchObject({ status: 403 });
 });
});
