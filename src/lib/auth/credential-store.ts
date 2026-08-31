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

export const QA_PRESET_CREDENTIALS: UserCredentialRecord[] = [
  {
    id: "usr_lexi_plant",
    email: "lexi14425@gmail.com",
    passwordHash: hashPassword("1@aBcdef"),
    name: "Alexis Akpabio",
    tenantSlug: "lexi-s-planthouse",
    role: "cx_lead",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "usr_winnie_shoes",
    email: "lisadynamite1@gmail.com",
    passwordHash: hashPassword("2#abcdefg"),
    name: "Winifred Douglas",
    tenantSlug: "winnie-shoes-demo",
    role: "cx_lead",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "usr_lexi_win",
    email: "lexi14425@gmail.com",
    passwordHash: hashPassword("45678901"),
    name: "Alexis Akpabio",
    tenantSlug: "windowsdemo",
    role: "cx_lead",
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

  private getKey(email: string, tenantSlug?: string): string {
    const cleanEmail = email.toLowerCase().trim();
    if (!tenantSlug) return cleanEmail;
    const cleanSlug = tenantSlug.toLowerCase().trim();
    return `${cleanEmail}:${cleanSlug}`;
  }

  constructor(initialUsers: UserCredentialRecord[] = INITIAL_USER_CREDENTIALS) {
    for (const u of initialUsers) {
      const key = this.getKey(u.email, u.tenantSlug);
      this.users.set(key, { ...u });
      if (!this.users.has(u.email.toLowerCase().trim())) {
        this.users.set(u.email.toLowerCase().trim(), { ...u });
      }
    }
    for (const u of QA_PRESET_CREDENTIALS) {
      const key = this.getKey(u.email, u.tenantSlug);
      if (!this.users.has(key)) {
        this.users.set(key, { ...u });
      }
    }
    const persisted = loadPersistedUsers();
    for (const [key, u] of Object.entries(persisted)) {
      this.users.set(key.toLowerCase().trim(), { ...u });
    }
  }

  public getUserByEmail(email: string, tenantSlug?: string): UserCredentialRecord | undefined {
    const cleanEmail = email.toLowerCase().trim();
    const cleanSlug = tenantSlug?.toLowerCase().trim();

    if (cleanSlug && cleanSlug !== "global") {
      const key = this.getKey(cleanEmail, cleanSlug);
      let user = this.users.get(key);
      if (user) return user;
    }

    let user = this.users.get(cleanEmail);
    if (!user || (cleanSlug && cleanSlug !== "global" && user.tenantSlug.toLowerCase() !== cleanSlug)) {
      // Look for matching user in memory or persisted store
      const allUsers = Array.from(this.users.values());
      const match = allUsers.find(
        (u) => u.email.toLowerCase() === cleanEmail && (!cleanSlug || cleanSlug === "global" || u.tenantSlug.toLowerCase() === cleanSlug)
      );
      if (match) return match;

      const persisted = loadPersistedUsers();
      for (const [_, pUser] of Object.entries(persisted)) {
        if (pUser.email.toLowerCase() === cleanEmail && (!cleanSlug || cleanSlug === "global" || pUser.tenantSlug.toLowerCase() === cleanSlug)) {
          this.users.set(this.getKey(cleanEmail, pUser.tenantSlug), pUser);
          return pUser;
        }
      }
    }
    return user;
  }

  public listUsers(tenantSlug?: string): UserCredentialRecord[] {
    const list = Array.from(this.users.values());
    const unique = Array.from(new Map(list.map((u) => [`${u.email}:${u.tenantSlug}`, u])).values());
    if (!tenantSlug) return unique;
    return unique.filter((u) => u.tenantSlug.toLowerCase() === tenantSlug.toLowerCase());
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
    const key = this.getKey(cleanEmail, cleanSlug);

    let existing = this.users.get(key) || this.getUserByEmail(cleanEmail, cleanSlug);

    if (existing) {
      if (!params.allowOverwrite) {
        return { success: false, error: `An account with email '${cleanEmail}' already exists in workspace '${cleanSlug}'.` };
      }
      existing.passwordHash = passwordHash;
      existing.name = name;
      existing.tenantSlug = cleanSlug;
      if (params.role) existing.role = params.role;
      existing.status = "active";
      existing.passwordModified = true;
      existing.lastLoginAt = new Date().toISOString();
      this.users.set(key, existing);
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

    this.users.set(key, newUser);
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

    const cleanSlug = tenantSlug?.toLowerCase().trim();
    let user = this.getUserByEmail(cleanEmail, cleanSlug);

    // 1. If user is found, verify password hash
    if (user) {
      if (user.status === "suspended") {
        return { success: false, error: "Account is suspended. Please contact administrator." };
      }

      const isValid = verifyPasswordHash(password, user.passwordHash);
      if (isValid) {
        // Enforce strict tenant boundary
        if (cleanSlug && cleanSlug !== "global" && user.role !== "superadmin" && user.tenantSlug.toLowerCase() !== cleanSlug) {
          return {
            success: false,
            error: `Cross-tenant access denied: Account ${user.email} is registered under '${user.tenantSlug}', not '${cleanSlug}'. Strict tenant domain isolation and Row-Level Security (RLS) enforced.`,
          };
        }

        user.lastLoginAt = new Date().toISOString();
        savePersistedUsers(this.users);
        return { success: true, user };
      }

      // If user provided a password that didn't match the specific tenant record, check if there's another workspace for this email matching this password
      if (!cleanSlug || cleanSlug === "global") {
        const otherWorkspaces = this.listUsers().filter((u) => u.email.toLowerCase() === cleanEmail);
        for (const other of otherWorkspaces) {
          if (verifyPasswordHash(password, other.passwordHash)) {
            other.lastLoginAt = new Date().toISOString();
            savePersistedUsers(this.users);
            return { success: true, user: other };
          }
        }
      }

      // Password didn't match local hash; check if Keycloak accepts it (e.g. password rotated in IdP)
      const kcConfig = getKeycloakConfig();
      if (!user.passwordModified && kcConfig.adminBaseUrl) {
        const kcResult = await verifyKeycloakPassword(cleanEmail, password);
        if (kcResult.ok) {
          user.passwordHash = hashPassword(password);
          user.lastLoginAt = new Date().toISOString();
          savePersistedUsers(this.users);

          if (cleanSlug && cleanSlug !== "global" && user.role !== "superadmin" && user.tenantSlug.toLowerCase() !== cleanSlug) {
            return {
              success: false,
              error: `Cross-tenant access denied: Account ${user.email} is registered under '${user.tenantSlug}', not '${cleanSlug}'. Strict tenant domain isolation and Row-Level Security (RLS) enforced.`,
            };
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
          if (cleanSlug && cleanSlug !== "global" && user.role !== "superadmin" && user.tenantSlug.toLowerCase() !== cleanSlug) {
            return {
              success: false,
              error: `Cross-tenant access denied: Account ${user.email} is registered under '${user.tenantSlug}', not '${cleanSlug}'. Strict tenant domain isolation and Row-Level Security (RLS) enforced.`,
            };
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
    newPassword: string,
    tenantSlug?: string
  ): { success: boolean; error?: string } {
    const cleanEmail = email.toLowerCase().trim();
    let user = this.getUserByEmail(cleanEmail, tenantSlug);
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

  public resetPassword(email: string, newPassword: string, tenantSlug?: string): { success: boolean; error?: string } {
    const cleanEmail = email.toLowerCase().trim();
    let user = this.getUserByEmail(cleanEmail, tenantSlug);
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
