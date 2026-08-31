import { hashPassword, verifyPasswordHash } from "./password";
import { verifyKeycloakPassword, mapRealmRolesToSupportRole } from "./keycloak";

export interface UserCredentialRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  tenantSlug: string;
  role: "superadmin" | "operator" | "cx_lead" | "contractor_lead" | "technician" | "contractor" | "observer";
  status: "active" | "suspended" | "pending";
  createdAt: string;
  lastLoginAt?: string;
}

// Default master password for seeded demo accounts: SupportV8#2026!Secure
const DEFAULT_DEMO_PASSWORD = "SupportV8#2026!Secure";
const DEFAULT_DEMO_HASH = hashPassword(DEFAULT_DEMO_PASSWORD);

export const INITIAL_USER_CREDENTIALS: UserCredentialRecord[] = [
  {
    id: "usr_acme_master",
    email: "acme@servicev8.com",
    passwordHash: DEFAULT_DEMO_HASH,
    name: "Acme Master Admin",
    tenantSlug: "acme",
    role: "cx_lead",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "usr_acme_admin",
    email: "admin@acme.com",
    passwordHash: DEFAULT_DEMO_HASH,
    name: "Sarah Chen",
    tenantSlug: "acme",
    role: "cx_lead",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "usr_acme_david",
    email: "david.kim@acme.com",
    passwordHash: DEFAULT_DEMO_HASH,
    name: "David Kim",
    tenantSlug: "acme",
    role: "operator",
    status: "active",
    createdAt: "2026-01-15T00:00:00.000Z",
  },
  {
    id: "usr_acme_sarah",
    email: "sarah.chen@acme.com",
    passwordHash: DEFAULT_DEMO_HASH,
    name: "Sarah Chen",
    tenantSlug: "acme",
    role: "cx_lead",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "usr_acme_movers_admin",
    email: "admin@acme-movers.com",
    passwordHash: DEFAULT_DEMO_HASH,
    name: "Admin Acme Movers",
    tenantSlug: "acme-movers",
    role: "cx_lead",
    status: "active",
    createdAt: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "usr_meridian_lead",
    email: "dispatch@meridian.com",
    passwordHash: DEFAULT_DEMO_HASH,
    name: "Meridian Field Dispatch",
    tenantSlug: "meridian",
    role: "contractor_lead",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

export class UserCredentialStore {
  private users: Map<string, UserCredentialRecord> = new Map();

  constructor(initialUsers: UserCredentialRecord[] = INITIAL_USER_CREDENTIALS) {
    for (const u of initialUsers) {
      this.users.set(u.email.toLowerCase().trim(), { ...u });
    }
  }

  public getUserByEmail(email: string): UserCredentialRecord | undefined {
    return this.users.get(email.toLowerCase().trim());
  }

  public listUsers(tenantSlug?: string): UserCredentialRecord[] {
    const list = Array.from(this.users.values());
    if (!tenantSlug) return list;
    return list.filter((u) => u.tenantSlug.toLowerCase() === tenantSlug.toLowerCase());
  }

  public registerUser(params: {
    email: string;
    password: string;
    name?: string;
    tenantSlug?: string;
    role?: UserCredentialRecord["role"];
  }): { success: boolean; user?: UserCredentialRecord; error?: string } {
    const cleanEmail = params.email.toLowerCase().trim();
    if (!cleanEmail || !params.password) {
      return { success: false, error: "Email and password are required." };
    }

    if (this.users.has(cleanEmail)) {
      return { success: false, error: `An account with email '${cleanEmail}' already exists.` };
    }

    const cleanSlug = (params.tenantSlug || cleanEmail.split("@")[1].split(".")[0] || "acme").toLowerCase().trim();
    const name = params.name?.trim() || cleanEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    const passwordHash = hashPassword(params.password);

    const newUser: UserCredentialRecord = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      email: cleanEmail,
      passwordHash,
      name,
      tenantSlug: cleanSlug,
      role: params.role || "operator",
      status: "active",
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    this.users.set(cleanEmail, newUser);
    return { success: true, user: newUser };
  }

  public async authenticate(
    email: string,
    password: string,
    tenantSlug?: string
  ): Promise<{ success: boolean; user?: UserCredentialRecord; error?: string }> {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !password) {
      return { success: false, error: "Email and password are required." };
    }

    // 1. Check Keycloak ROPC if configured and live
    if (process.env.KEYCLOAK_ADMIN_BASE_URL) {
      const kcResult = await verifyKeycloakPassword(cleanEmail, password);
      if (kcResult.ok) {
        let user = this.users.get(cleanEmail);
        const roles = kcResult.decodedClaims?.realm_access?.roles || [];
        const mappedRole = mapRealmRolesToSupportRole(roles);
        const tenantFromClaim = kcResult.decodedClaims?.attributes?.tenant_id?.[0] || kcResult.decodedClaims?.tenant_id;
        const resolvedSlug = (tenantFromClaim || tenantSlug || cleanEmail.split("@")[1].split(".")[0] || "acme").toLowerCase().trim();

        if (!user) {
          // Provision local record from Keycloak verified login
          const res = this.registerUser({
            email: cleanEmail,
            password,
            tenantSlug: resolvedSlug,
            role: mappedRole,
          });
          user = res.user;
        } else {
          user.role = mappedRole;
          user.tenantSlug = resolvedSlug;
        }
        if (user) {
          user.lastLoginAt = new Date().toISOString();
          return { success: true, user };
        }
      }
    }

    // 2. Check local salted scrypt credential store
    const user = this.users.get(cleanEmail);
    if (!user) {
      return { success: false, error: "Account not found. Please check your email or sign up." };
    }

    if (user.status === "suspended") {
      return { success: false, error: "Account is suspended. Please contact administrator." };
    }

    const isValid = verifyPasswordHash(password, user.passwordHash);
    if (!isValid) {
      return { success: false, error: "Incorrect password. Please try again." };
    }

    user.lastLoginAt = new Date().toISOString();
    return { success: true, user };
  }

  public changePassword(
    email: string,
    oldPassword: string,
    newPassword: string
  ): { success: boolean; error?: string } {
    const cleanEmail = email.toLowerCase().trim();
    const user = this.users.get(cleanEmail);
    if (!user) {
      return { success: false, error: "Account not found." };
    }

    const isValid = verifyPasswordHash(oldPassword, user.passwordHash);
    if (!isValid) {
      return { success: false, error: "Current password is incorrect." };
    }

    user.passwordHash = hashPassword(newPassword);
    return { success: true };
  }

  public resetPassword(email: string, newPassword: string): { success: boolean; error?: string } {
    const cleanEmail = email.toLowerCase().trim();
    const user = this.users.get(cleanEmail);
    if (!user) {
      return { success: false, error: "Account not found." };
    }
    user.passwordHash = hashPassword(newPassword);
    return { success: true };
  }
}

export const credentialStore = new UserCredentialStore();
