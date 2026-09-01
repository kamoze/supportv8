import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/mock-data";
import { credentialStore } from "@/lib/auth/credential-store";
import { passwordPolicyError } from "@/lib/auth/password-policy";
import { otpStore, OtpStoreUnavailableError } from "@/lib/auth/otp-store";
import {
  tenantSignupRegistry,
  TenantRegistryUnavailableError,
} from "@/lib/auth/tenant-signup-registry";

class SignupProvisioningError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "SignupProvisioningError";
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      domain,
      adminName,
      adminEmail,
      verificationReceipt,
      password,
      primaryStream = "customers",
    } = body;

    if (!name || !domain || !adminEmail || !password) {
      return NextResponse.json(
        { success: false, error: "Name, domain, administrator email, and password are required" },
        { status: 400 }
      );
    }

    const passwordError = passwordPolicyError(password);
    if (passwordError) {
      return NextResponse.json({ success: false, error: passwordError }, { status: 400 });
    }

    const productionIdentityRequired = process.env.NODE_ENV === "production";
    if (
      productionIdentityRequired &&
      (!process.env.KEYCLOAK_ADMIN_BASE_URL ||
        !process.env.KEYCLOAK_ADMIN_CLIENT_ID ||
        !process.env.KEYCLOAK_ADMIN_CLIENT_SECRET)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Account provisioning is temporarily unavailable. Please try again.",
        },
        { status: 503 }
      );
    }

    const cleanDomain = domain.trim().toLowerCase();
    const reservedDomains = ["acme", "meridian", "default", "admin", "api", "support", "app", "global", "servicev8"];

    if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(cleanDomain)) {
      return NextResponse.json(
        { success: false, error: "Workspace subdomain must be 3-63 lowercase letters, numbers, or hyphens." },
        { status: 400 }
      );
    }

    if (reservedDomains.includes(cleanDomain)) {
      return NextResponse.json(
        { success: false, error: `Subdomain slug '${cleanDomain}' is already registered or reserved.` },
        { status: 409 }
      );
    }

    const cleanAdminEmail = adminEmail.trim().toLowerCase();
    const hasVerification = await otpStore.consumeSignupReceipt(
      String(verificationReceipt || ""),
      cleanAdminEmail,
      cleanDomain
    );
    if (!hasVerification) {
      return NextResponse.json(
        { success: false, error: "Email verification is required before creating a workspace." },
        { status: 403 }
      );
    }

    const tenantId = `tenant_${cleanDomain.replace(/[^a-z0-9]/g, "_")}`;
    const resolvedAdminName = adminName?.trim() || `${name} Administrator`;
    const operatingMode = "copilot";

    if (
      process.env.NODE_ENV !== "production" &&
      credentialStore.getUserByEmail(cleanAdminEmail)
    ) {
      return NextResponse.json(
        { success: false, error: `An account with email '${cleanAdminEmail}' already exists.` },
        { status: 409 }
      );
    }

    const tenantReserved = await tenantSignupRegistry.reserve({
      tenantId,
      tenantSlug: cleanDomain,
      name: name.trim(),
      operatingMode,
    });
    if (!tenantReserved) {
      return NextResponse.json(
        { success: false, error: `Subdomain slug '${cleanDomain}' is already registered.` },
        { status: 409 }
      );
    }

    let identityCreated = false;
    try {
      const cleanEmail = cleanAdminEmail;

      // Production signups must create the authoritative Keycloak identity.
      if (
        productionIdentityRequired ||
        process.env.KEYCLOAK_ADMIN_CLIENT_SECRET ||
        process.env.KEYCLOAK_ADMIN_BASE_URL
      ) {
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
          identityCreated = true;
        } catch (kcErr: any) {
          if (kcErr?.identityMayExist === true) {
            identityCreated = true;
          }
          if (kcErr?.name === "KeycloakUserExists") {
            throw new SignupProvisioningError(
              409,
              `An account with email '${cleanEmail}' already exists in Keycloak IdP.`
            );
          }
          if (productionIdentityRequired || process.env.KEYCLOAK_ADMIN_CLIENT_SECRET) {
            throw new SignupProvisioningError(
              502,
              "Account provisioning is temporarily unavailable. Please try again."
            );
          }
          console.warn("[supportV8] Keycloak dev notice:", kcErr?.message || kcErr);
        }
      }

      if (!productionIdentityRequired) {
        const credentialResult = credentialStore.registerUser({
          email: cleanEmail,
          password,
          name: resolvedAdminName,
          tenantSlug: cleanDomain,
          role: "cx_lead",
        });
        if (!credentialResult.success) {
          throw new SignupProvisioningError(
            409,
            credentialResult.error || "Administrator account could not be created."
          );
        }
      }

      // Persist registered tenant workspace and custom organization name
      db.setTenant(cleanDomain, {
        name: name.trim(),
        adminName: resolvedAdminName,
        mode: operatingMode,
      });

      db.tenant = {
        tenantId,
        name: name.trim(),
        mode: operatingMode,
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
    } catch (error) {
      // Once the authoritative identity exists, keep the tenant reservation.
      // Releasing it could let another email claim the same tenant after a
      // downstream local-cache failure.
      if (!identityCreated) {
        await tenantSignupRegistry.release(tenantId).catch(() => undefined);
      }
      throw error;
    }
  } catch (err: unknown) {
    const status =
      err instanceof OtpStoreUnavailableError ||
      err instanceof TenantRegistryUnavailableError ||
      err instanceof SignupProvisioningError
        ? err.status
        : 400;
    const message =
      err instanceof OtpStoreUnavailableError ||
      err instanceof TenantRegistryUnavailableError ||
      err instanceof SignupProvisioningError
        ? err.message
        : "Workspace registration failed. Please check your details and try again.";
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
