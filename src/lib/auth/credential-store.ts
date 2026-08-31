import fs from "fs";
import path from "path";
import { hashPassword, verifyPasswordHash } from "./password";
import { verifyKeycloakPassword, mapRealmRolesToSupportRole, getKeycloakConfig } from "./keycloak";

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
  passwordModified?: boolean;
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

function getStoragePath(): string | null {
  try {
    if (process.env.NODE_ENV === "test" || process.env.VITEST) {
      return null;
    }
    if (typeof process !== "undefined" && process.cwd) {
      return path.join(process.cwd(), ".sv8_users.json");
    }
  } catch (_) {}
  return null;
}

function loadPersistedUsers(): Record<string, UserCredentialRecord> {
  const filePath = getStoragePath();
  if (!filePath) return {};
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (_) {}
  return {};
}

function savePersistedUsers(users: Map<string, UserCredentialRecord>): void {
  const filePath = getStoragePath();
  if (!filePath) return;
  try {
    const obj: Record<string, UserCredentialRecord> = {};
    for (const [k, v] of users.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf-8");
  } catch (_) {}
}

export class UserCredentialStore {
  private users: Map<string, UserCredentialRecord> = new Map();

  constructor(initialUsers: UserCredentialRecord[] = INITIAL_USER_CREDENTIALS) {
    for (const u of initialUsers) {
      this.users.set(u.email.toLowerCase().trim(), { ...u });
    }
    const persisted = loadPersistedUsers();
    for (const [email, u] of Object.entries(persisted)) {
      this.users.set(email.toLowerCase().trim(), { ...u });
    }
  }

  public getUserByEmail(email: string): UserCredentialRecord | undefined {
    const cleanEmail = email.toLowerCase().trim();
    let user = this.users.get(cleanEmail);
    if (!user) {
      const persisted = loadPersistedUsers();
      if (persisted[cleanEmail]) {
        user = persisted[cleanEmail];
        this.users.set(cleanEmail, user);
      }
    }
    return user;
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
    allowOverwrite?: boolean;
  }): { success: boolean; user?: UserCredentialRecord; error?: string } {
    const cleanEmail = params.email.toLowerCase().trim();
    if (!cleanEmail || !params.password) {
      return { success: false, error: "Email and password are required." };
    }

    const cleanSlug = (params.tenantSlug || cleanEmail.split("@")[1].split(".")[0] || "acme").toLowerCase().trim();
    const name = params.name?.trim() || cleanEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    const passwordHash = hashPassword(params.password);

    let existing = this.users.get(cleanEmail);
    if (!existing) {
      const persisted = loadPersistedUsers();
      if (persisted[cleanEmail]) {
        existing = persisted[cleanEmail];
      }
    }

    if (existing) {
      if (!params.allowOverwrite) {
        return { success: false, error: `An account with email '${cleanEmail}' already exists.` };
      }
      existing.passwordHash = passwordHash;
      existing.name = name;
      existing.tenantSlug = cleanSlug;
      if (params.role) existing.role = params.role;
      existing.status = "active";
      existing.passwordModified = true;
      existing.lastLoginAt = new Date().toISOString();
      this.users.set(cleanEmail, existing);
      savePersistedUsers(this.users);
      return { success: true, user: existing };
    }

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
    savePersistedUsers(this.users);
    return { success: true, user: newUser };
  }

  public upsertUser(params: {
    email: string;
    password: string;
    name?: string;
    tenantSlug?: string;
    role?: UserCredentialRecord["role"];
  }): { success: boolean; user?: UserCredentialRecord; error?: string } {
    return this.registerUser({ ...params, allowOverwrite: true });
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

    let user = this.getUserByEmail(cleanEmail);

    // 1. If user is in local store, verify password hash
    if (user) {
      if (user.status === "suspended") {
        return { success: false, error: "Account is suspended. Please contact administrator." };
      }

      const isValid = verifyPasswordHash(password, user.passwordHash);
      if (isValid) {
        // Enforce strict tenant boundary
        if (tenantSlug) {
          const cleanTenantSlug = tenantSlug.toLowerCase().trim();
          const userTenantSlug = user.tenantSlug.toLowerCase().trim();

          if (cleanTenantSlug && cleanTenantSlug !== "global" && user.role !== "superadmin" && userTenantSlug !== cleanTenantSlug) {
            return {
              success: false,
              error: `Cross-tenant access denied: Account ${user.email} is registered under '${user.tenantSlug}', not '${cleanTenantSlug}'. Strict tenant domain isolation and Row-Level Security (RLS) enforced.`,
            };
          }
        }

        user.lastLoginAt = new Date().toISOString();
        savePersistedUsers(this.users);
        return { success: true, user };
      }

      // Password didn't match local hash; check if Keycloak accepts it (e.g. password rotated in IdP)
      const kcConfig = getKeycloakConfig();
      if (!user.passwordModified && kcConfig.adminBaseUrl) {
        const kcResult = await verifyKeycloakPassword(cleanEmail, password);
        if (kcResult.ok) {
          user.passwordHash = hashPassword(password);
          user.lastLoginAt = new Date().toISOString();
          savePersistedUsers(this.users);

          if (tenantSlug) {
            const cleanTenantSlug = tenantSlug.toLowerCase().trim();
            const userTenantSlug = user.tenantSlug.toLowerCase().trim();
            if (cleanTenantSlug && cleanTenantSlug !== "global" && user.role !== "superadmin" && userTenantSlug !== cleanTenantSlug) {
              return {
                success: false,
                error: `Cross-tenant access denied: Account ${user.email} is registered under '${user.tenantSlug}', not '${cleanTenantSlug}'. Strict tenant domain isolation and Row-Level Security (RLS) enforced.`,
              };
            }
          }
          return { success: true, user };
        }
      }

      return { success: false, error: "Incorrect password. Please try again." };
    }

    // 2. User not found in local store; verify against Keycloak IdP (e.g. QA-created realm user)
    const kcConfig = getKeycloakConfig();
    if (kcConfig.adminBaseUrl) {
      const kcResult = await verifyKeycloakPassword(cleanEmail, password);
      if (kcResult.ok) {
        const roles = kcResult.decodedClaims?.realm_access?.roles || [];
        const mappedRole = mapRealmRolesToSupportRole(roles);
        const tenantFromClaim = kcResult.decodedClaims?.attributes?.tenant_id?.[0] || kcResult.decodedClaims?.tenant_id;
        const resolvedSlug = (tenantFromClaim || tenantSlug || cleanEmail.split("@")[1].split(".")[0] || "acme").toLowerCase().trim();

        const res = this.registerUser({
          email: cleanEmail,
          password,
          tenantSlug: resolvedSlug,
          role: mappedRole,
        });

        user = res.user;
        if (user) {
          if (tenantSlug) {
            const cleanTenantSlug = tenantSlug.toLowerCase().trim();
            const userTenantSlug = user.tenantSlug.toLowerCase().trim();
            if (cleanTenantSlug && cleanTenantSlug !== "global" && user.role !== "superadmin" && userTenantSlug !== cleanTenantSlug) {
              return {
                success: false,
                error: `Cross-tenant access denied: Account ${user.email} is registered under '${user.tenantSlug}', not '${cleanTenantSlug}'. Strict tenant domain isolation and Row-Level Security (RLS) enforced.`,
              };
            }
          }
          return { success: true, user };
        }
      }
    }

    return { success: false, error: "Account not found. Please check your email or sign up." };
  }

  public changePassword(
    email: string,
    oldPassword: string,
    newPassword: string
  ): { success: boolean; error?: string } {
    const cleanEmail = email.toLowerCase().trim();
    let user = this.users.get(cleanEmail);
    if (!user) {
      const persisted = loadPersistedUsers();
      if (persisted[cleanEmail]) {
        user = persisted[cleanEmail];
        this.users.set(cleanEmail, user);
      }
    }
    if (!user) {
      return { success: false, error: "Account not found." };
    }

    const isValid = verifyPasswordHash(oldPassword, user.passwordHash);
    if (!isValid) {
      return { success: false, error: "Current password is incorrect." };
    }

    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: "New password must be at least 6 characters." };
    }

    user.passwordHash = hashPassword(newPassword);
    user.passwordModified = true;
    savePersistedUsers(this.users);
    return { success: true };
  }

  public resetPassword(email: string, newPassword: string): { success: boolean; error?: string } {
    const cleanEmail = email.toLowerCase().trim();
    let user = this.users.get(cleanEmail);
    if (!user) {
      const persisted = loadPersistedUsers();
      if (persisted[cleanEmail]) {
        user = persisted[cleanEmail];
        this.users.set(cleanEmail, user);
      }
    }
    if (!user) {
      return { success: false, error: "Account not found." };
    }
    user.passwordHash = hashPassword(newPassword);
    user.passwordModified = true;
    savePersistedUsers(this.users);
    return { success: true };
  }
}

const globalForAuth = globalThis as unknown as { __sv8_credential_store?: UserCredentialStore };
export const credentialStore = globalForAuth.__sv8_credential_store ?? new UserCredentialStore();
if (process.env.NODE_ENV !== "production") {
  globalForAuth.__sv8_credential_store = credentialStore;
}
