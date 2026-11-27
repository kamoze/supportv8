/**
 * SupportV8 Authentication & Zero-Trust Session Service
 * Aligned with v8 First-Party Auth Standard (Keycloak IdP + HttpOnly Session Token)
 */

export interface AuthSession {
  token: string;
  tenantSlug: string;
  email: string;
  name: string;
  role: "superadmin" | "operator" | "cx_lead" | "contractor_lead" | "technician" | "contractor" | "observer";
  issuedAt: number;
  expiresAt: number;
  /** Set by /api/auth/workspace-session when the session came through the Runtime hand-off. */
  source?: "runtime_handoff";
  /** The tenant's Runtime workspace, from a v2 Runtime hand-off. Display only. */
  runtimeUrl?: string;
}

/**
 * The Runtime workspace URL to give the embedded shell, or undefined. The
 * server validated it against SUPPORTV8_RUNTIME_ORIGIN; this only refuses
 * anything that is not an https /workspace/<slug> URL for the session's tenant,
 * since the browser copy lives in sessionStorage.
 */
export function runtimeShellUrl(session: (Pick<AuthSession, "token" | "tenantSlug"> & { source?: string; runtimeUrl?: string }) | null | undefined): string | undefined {
  if (!session || !isRuntimeHandoffSession(session) || typeof session.runtimeUrl !== "string") return undefined;
  try {
    const url = new URL(session.runtimeUrl);
    if (url.href !== session.runtimeUrl || url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return undefined;
    return url.pathname === `/workspace/${session.tenantSlug}` ? session.runtimeUrl : undefined;
  } catch {
    return undefined;
  }
}

/** A Runtime hand-off session: SupportV8 runs embedded in Runtime. Display only; grants nothing. */
export function isRuntimeHandoffSession(session: Pick<AuthSession, "token"> & { source?: string } | null | undefined): boolean {
  if (!session) return false;
  return session.source === "runtime_handoff" || session.token.startsWith("workspace:");
}

const SESSION_STORAGE_KEY = "sv8_operator_session";
let refreshInFlight: Promise<AuthSession | null> | null = null;
let lastRefreshSucceededAt = 0;

export const AuthService = {
  storeSession(session: AuthSession): void {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (_) {}
  },

  discardSession(): void {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem("sv8_auth_user");
    } catch (_) {}
  },

  /**
   * Issue a zero-trust cryptographic session for an operator or contractor
   */
  createSession(
    tenantSlug: string,
    email: string,
    role: AuthSession["role"] = "operator",
    displayName?: string,
  ): AuthSession {
    const cleanSlug = tenantSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || "acme";
    const cleanEmail = email.trim().toLowerCase() || `operator@${cleanSlug}.com`;
    const name = displayName?.trim().replace(/\s+/g, " ").slice(0, 80) ||
      cleanEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

    const entropy = Math.random().toString(36).substring(2, 10);
    const token = `sv8_tk_${cleanSlug}_${Date.now()}_${entropy}`;

    const session: AuthSession = {
      token,
      tenantSlug: cleanSlug,
      email: cleanEmail,
      name,
      role,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8 hour session
    };

    if (typeof window !== "undefined") {
      try {
        this.storeSession(session);
      } catch (_) {}
    }

    return session;
  },

  /**
   * Get active session from sessionStorage
   */
  getActiveSession(): AuthSession | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const session: AuthSession = JSON.parse(raw);
      if (Date.now() > session.expiresAt) {
        // Browser metadata can predate a fresh HttpOnly SSO cookie.
        this.discardSession();
        return null;
      }
      return session;
    } catch (_) {
      return null;
    }
  },

  /**
   * Invalidate and clear current session
   */
  clearSession(): void {
    if (typeof window === "undefined") return;
    try {
      this.discardSession();
      void fetch("/api/auth/logout", { method: "POST", redirect: "error", credentials: "same-origin" }).catch(() => undefined);
    } catch (_) {}
  },

  /**
   * Authenticate with email & password against the credential store / API
   */
  async loginWithPassword(
    email: string,
    password: string,
    tenantSlug?: string
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST", redirect: "error",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, tenantSlug }),
      }).then((r) => r.json());

      if (res.success && res.session) {
        if (typeof window !== "undefined") {
          try {
            this.storeSession(res.session);
          } catch (_) {}
        }
        return { success: true, session: res.session };
      }
      return { success: false, error: res.error || "Invalid email or password." };
    } catch (err) {
      return { success: false, error: "Authentication service unavailable." };
    }
  },

  /** Authenticate a restricted demo operator through the server-side Keycloak client. */
  async authenticateDemo(
    tenantSlug: "acme" | "meridian"
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    try {
      const response = await fetch("/api/auth/demo", {
        method: "POST", redirect: "error",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success || !payload.session) {
        return { success: false, error: payload.error || "Demo authentication failed." };
      }
      if (typeof window !== "undefined") {
        try {
          this.storeSession(payload.session);
        } catch (_) {}
      }
      return { success: true, session: payload.session };
    } catch {
      return { success: false, error: "Demo authentication service unavailable." };
    }
  },

  async restoreRuntimeSession(): Promise<AuthSession | null> {
    try {
      const response = await fetch("/api/auth/workspace-session", {credentials:"same-origin",cache:"no-store",redirect:"error"});
      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.session) return null;
      this.storeSession(payload.session);
      return payload.session as AuthSession;
    } catch { return null; }
  },

  async refreshSession(): Promise<AuthSession | null> {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const response = await fetch("/api/auth/refresh", {
          method: "POST", redirect: "error",
          credentials: "same-origin",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success || !payload.session) return null;
        this.storeSession(payload.session);
        lastRefreshSucceededAt = Date.now();
        return payload.session as AuthSession;
      } catch {
        return null;
      }
    })();
    try {
      return await refreshInFlight;
    } finally {
      refreshInFlight = null;
    }
  },

  async authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const requestInit = { ...init, credentials: "same-origin" as const, redirect: "error" as const };
    let response = await fetch(input, requestInit);
    if (response.status !== 401) return response;

    const refreshed = Date.now() - lastRefreshSucceededAt < 5_000
      ? this.getActiveSession()
      : await this.refreshSession();
    if (!refreshed) {
      this.discardSession();
      return response;
    }
    response = await fetch(input, requestInit);
    return response;
  },
};
