const authority=vi.hoisted(()=>({authorize:vi.fn(async()=>({slug:"alpha"}))}));
vi.mock("@/lib/auth/canonical-request-workspace",()=>({authorizeCanonicalRequestWorkspace:authority.authorize}));
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const keycloak = vi.hoisted(() => ({
  refreshKeycloakAccessToken: vi.fn(),
}));

vi.mock("@/lib/auth/keycloak", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/keycloak")>();
  return { ...actual, refreshKeycloakAccessToken: keycloak.refreshKeycloakAccessToken };
});

import { POST } from "../src/app/api/auth/refresh/route";

describe("operator session renewal", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("rotates the access and refresh cookies without changing tenant identity", async () => {
    vi.stubEnv("NODE_ENV", "production");
    keycloak.refreshKeycloakAccessToken.mockResolvedValue({
      ok: true,
      accessToken: "next-access",
      refreshToken: "next-refresh",
      expiresIn: 300,
      refreshExpiresIn: 28_800,
      decodedClaims: {
        sub: "operator-1",
        tenant_id: "tenant_alpha",
        preferred_username: "jordan@alpha.example",
        given_name: "Jordan",
        realm_access: { roles: ["support_operator"] },
      },
    });
    const response = await POST(new NextRequest("https://alpha.support.servicev8.com/api/auth/refresh", {
      method: "POST",
      headers: {host:"alpha.support.servicev8.com",origin:"https://alpha.support.servicev8.com", cookie: "sv8_refresh_token=current-refresh" },
    }));
    const payload = await response.json();
    const cookies = response.headers.getSetCookie().join("\n");

    expect(response.status).toBe(200);
    expect(keycloak.refreshKeycloakAccessToken).toHaveBeenCalledWith("current-refresh");
    expect(payload.session).toMatchObject({ tenantSlug: "alpha", name: "Jordan", role: "operator" });
    expect(cookies).toContain("sv8_access_token=next-access");
    expect(cookies).toContain("sv8_refresh_token=next-refresh");
  });

  it("fails closed when no renewable credential is present", async () => {
    const response = await POST(new NextRequest("https://alpha.support.servicev8.com/api/auth/refresh", {
      method: "POST",
    }));

    expect(response.status).toBe(401);
    expect(keycloak.refreshKeycloakAccessToken).not.toHaveBeenCalled();
  });
});


it("rejects a cross-site refresh before touching the identity provider",async()=>{
 vi.stubEnv("NODE_ENV","production");try{
 const r=await POST(new NextRequest("https://alpha.support.servicev8.com/api/auth/refresh",{method:"POST",headers:{host:"alpha.support.servicev8.com",origin:"https://other.example",cookie:"sv8_refresh_token=old"}}));
 expect(r.status).toBe(403);expect(keycloak.refreshKeycloakAccessToken).not.toHaveBeenCalled();
 }finally{vi.unstubAllEnvs()}
});


it("does not issue cookies after current membership or binding revocation",async()=>{
 vi.stubEnv("NODE_ENV","production");try{
 keycloak.refreshKeycloakAccessToken.mockResolvedValue({ok:true,accessToken:"next",decodedClaims:{tenant_id:"canonical-id"}});
 authority.authorize.mockRejectedValueOnce(new Error("revoked"));
 const r=await POST(new NextRequest("https://alpha.support.servicev8.com/api/auth/refresh",{method:"POST",headers:{host:"alpha.support.servicev8.com",origin:"https://alpha.support.servicev8.com",cookie:"sv8_refresh_token=old"}}));
 expect(r.status).toBe(403);expect(r.headers.getSetCookie()).toEqual([]);
 }finally{vi.unstubAllEnvs()}
});
