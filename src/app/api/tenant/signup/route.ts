import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/mock-data";
import { credentialStore } from "@/lib/auth/credential-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      domain,
      adminName,
      adminEmail,
      password = "SupportV8#2026!Secure",
      initialMode = "copilot",
      primaryStream = "customers",
    } = body;

    if (!name || !domain) {
      return NextResponse.json({ success: false, error: "Name and domain are required" }, { status: 400 });
    }

    const cleanDomain = domain.trim().toLowerCase();
    const reservedDomains = ["acme", "meridian", "default", "admin", "api", "support", "app", "global", "servicev8"];

    if (reservedDomains.includes(cleanDomain)) {
      return NextResponse.json(
        { success: false, error: `Subdomain slug '${cleanDomain}' is already registered or reserved.` },
        { status: 409 }
      );
    }

    const tenantId = `tenant_${cleanDomain.replace(/[^a-z0-9]/g, "_")}`;
    
    const resolvedAdminName = adminName?.trim() || `${name} Administrator`;
    
    // Register administrator credentials with cryptographic scrypt password hashing
    if (adminEmail && password) {
      const cleanEmail = adminEmail.toLowerCase().trim();

      credentialStore.upsertUser({
        email: cleanEmail,
        password,
        name: resolvedAdminName,
        tenantSlug: cleanDomain,
        role: "cx_lead",
      });

      // Enforce Keycloak user registration when Keycloak admin credentials exist
      if (process.env.KEYCLOAK_ADMIN_CLIENT_SECRET || process.env.KEYCLOAK_ADMIN_BASE_URL) {
        try {
          const { createKeycloakUser } = await import("@/lib/auth/keycloak");
          const nameParts = resolvedAdminName.split(" ");
          const firstName = nameParts[0] || name;
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Administrator";

          await createKeycloakUser(cleanEmail, password, {
            firstName,
            lastName,
            tenantId,
            organizationName: name,
            roles: ["support_cx_lead"],
          });
        } catch (kcErr: any) {
          if (kcErr?.name === "KeycloakUserExists") {
            return NextResponse.json(
              { success: false, error: `An account with email '${cleanEmail}' already exists in Keycloak IdP.` },
              { status: 409 }
            );
          }
          if (process.env.KEYCLOAK_ADMIN_CLIENT_SECRET) {
            return NextResponse.json(
              { success: false, error: `Keycloak IdP user creation failed: ${kcErr.message || kcErr}` },
              { status: 502 }
            );
          }
          console.warn("[supportV8] Keycloak dev notice:", kcErr?.message || kcErr);
        }
      }
    }

    // Persist registered tenant workspace and custom organization name
    db.setTenant(cleanDomain, {
      name: name.trim(),
      adminName: resolvedAdminName,
      mode: initialMode,
    });

    db.tenant = {
      tenantId,
      name: name.trim(),
      mode: initialMode,
      featureFlags: {
        observeMode: true,
        copilotMode: true,
        autonomousMode: false, // Activated upon commercial entitlement from servicev8-registry
        problemCorrelation: true,
        businessImpact: true,
        knowledgeIntelligence: true,
        proactiveComms: false,
        staleWorkSweep: true,
      },
    };

    const ssoToken = `sso_tk_${tenantId}_${Date.now().toString(36)}`;
    const studioMarketplaceUrl = `http://studiov8.servicev8.internal:3000/marketplace?tenantId=${encodeURIComponent(tenantId)}&ssoToken=${encodeURIComponent(ssoToken)}`;

    const recommendedEmployees =
      primaryStream === "contractors"
        ? [
            { id: "beaver_manager_alex", name: "Alex", role: "Contractor & CX Lead", status: "recommended_marketplace" },
          ]
        : primaryStream === "enquiries"
        ? [
            { id: "beaver_curator_barnaby", name: "Barnaby", role: "Knowledge Intelligence", status: "recommended_marketplace" },
            { id: "beaver_analyst_arthur", name: "Arthur", role: "Technical Triage Lead", status: "recommended_marketplace" },
          ]
        : [
            { id: "beaver_sophia_voice", name: "Sophia", role: "Customer Success Lead", status: "recommended_marketplace" },
          ];

    return NextResponse.json({
      success: true,
      message: `Tenant '${name}' successfully onboarded with UI workspace & basic automation`,
      tenant: db.tenant,
      adminEmail,
      ssoToken,
      studioMarketplaceUrl,
      operatingMode: "copilot",
      recommendedEmployees,
      provisionedCapabilities: [
        "ticket.read",
        "ticket.write",
        "ticket.triage",
        "customer.health.read",
        "knowledge.query",
      ],
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Signup failed" },
      { status: 400 }
    );
  }
}
