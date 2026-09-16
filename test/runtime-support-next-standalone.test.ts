import { createHmac, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer, request as httpRequest, type Server } from "node:http";
import { createServer as createNetServer } from "node:net";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.SUPPORTV8_NEXT_STANDALONE_PROOF === "1";
const localDatabaseUrl =
  "postgres://postgres@127.0.0.1:52996/support_runtime_handoff_test";
const rbacDatabaseUrl =
  "postgres://postgres@127.0.0.1:52996/support_runtime_rbac_test";
const ciDatabaseUrl =
  "postgresql://postgres:support-workspace-test@127.0.0.1:5432/postgres";
const tenantHost = "synthetic-support.support.servicev8.com";
const workspaceId = `tenant_rt_${"a".repeat(48)}`;
const handoffSecret = "standalone-handoff-secret-at-least-32-bytes";
const sessionSecret = "standalone-session-secret-at-least-32-bytes";

function recognizedServerHost(
  databaseUrl: string,
  host: string,
  ci = process.env.CI === "true",
) {
  const loopback = host === "127.0.0.1" || host === "::1";
  const privateNetwork =
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(host);
  return loopback || (databaseUrl === ciDatabaseUrl && ci && privateNetwork);
}

function demoToken() {
  const payload = Buffer.from(
    JSON.stringify({ realm_access: { roles: ["support_demo_operator"] } }),
  ).toString("base64url");
  return `header.${payload}.signature`;
}

describe("standalone PostgreSQL fixture safety gate", () => {
  it("accepts a private sidecar address only for the exact CI fixture in CI", () => {
    expect(recognizedServerHost(ciDatabaseUrl, "172.18.0.2", true)).toBe(true);
    expect(recognizedServerHost(ciDatabaseUrl, "172.18.0.2", false)).toBe(
      false,
    );
    expect(recognizedServerHost(localDatabaseUrl, "172.18.0.2", true)).toBe(
      false,
    );
  });
});

function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      version: "servicev8.support-handoff.v1",
      iss: "runtime",
      aud: "supportv8-service-app",
      sub: "synthetic-member",
      accountId: "synthetic-account",
      tenantId: "synthetic-registry",
      verticalId: "runtime",
      installationId: "synthetic-install",
      externalWorkspaceId: workspaceId,
      tenantDomain: "synthetic-support",
      role: "support:read",
      destination: `https://${tenantHost}/auth/runtime/handoff`,
      iat: now,
      exp: now + 60,
      jti: randomUUID(),
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", handoffSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function freePort() {
  const server = createNetServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

function standaloneRequest(
  port: number,
  path: string,
  options: { method?: string; headers?: Record<string, string> } = {},
) {
  return new Promise<{
    status: number;
    headers: Record<string, string | string[] | undefined>;
    body: string;
  }>((resolve, reject) => {
    const request = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: options.method ?? "GET",
        headers: options.headers,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.once("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    request.once("error", reject);
    request.end();
  });
}

describe.skipIf(!enabled)("actual Next standalone public Host contract", () => {
  let database: Pool;
  let registry: Server;
  let application: ChildProcess;
  let registryPort: number;
  let appPort: number;
  let memberActive = true;
  const runtimeRole = "support_runtime_standalone_fixture_v1";
  let schemaCreated = false;
  let runtimeRoleCreated = false;

  beforeAll(async () => {
    const configuredDatabase =
      process.env.SUPPORTV8_WORKSPACE_TEST_DATABASE_URL ?? "";
    expect([localDatabaseUrl, rbacDatabaseUrl, ciDatabaseUrl]).toContain(
      configuredDatabase,
    );
    const parsed = new URL(configuredDatabase);
    database = new Pool({ connectionString: configuredDatabase });
    const identity = await database.query<{
      database: string;
      host: string;
      port: number;
    }>(
      "SELECT current_database() database, host(inet_server_addr()) host, inet_server_port() port",
    );
    expect(identity.rows[0]).toMatchObject({
      database: parsed.pathname.slice(1),
      port: Number(parsed.port),
    });
    expect(
      recognizedServerHost(configuredDatabase, identity.rows[0]?.host ?? ""),
    ).toBe(true);
    const tableCount = await database.query<{ count: string }>(
      "SELECT count(*)::text count FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')",
    );
    if (
      configuredDatabase === localDatabaseUrl ||
      configuredDatabase === rbacDatabaseUrl
    )
      expect(tableCount.rows[0]?.count).toBe("0");
    const roleConflict = await database.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$1) exists",
      [runtimeRole],
    );
    if (roleConflict.rows[0]?.exists)
      throw new Error(
        `Standalone proof refuses pre-existing role: ${runtimeRole}`,
      );
    try {
      await database.query(
        `CREATE ROLE ${runtimeRole} LOGIN PASSWORD 'synthetic-only'`,
      );
      runtimeRoleCreated = true;
      await database.query(
        "CREATE SCHEMA supportv8; CREATE TABLE supportv8.tenants(id varchar(64) PRIMARY KEY,domain varchar(128) UNIQUE NOT NULL,name varchar(255) NOT NULL,operating_mode varchar(32) NOT NULL DEFAULT 'autonomous',servicev8_account_id varchar(128),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()); CREATE TABLE supportv8.issues(id varchar(64) PRIMARY KEY,tenant_id varchar(64) NOT NULL REFERENCES supportv8.tenants(id),source varchar(32) NOT NULL,external_id varchar(128) NOT NULL,customer_ref varchar(128) NOT NULL,customer_name varchar(255) NOT NULL,summary text NOT NULL,priority varchar(32) NOT NULL,source_status varchar(32) NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL); ALTER TABLE supportv8.issues ENABLE ROW LEVEL SECURITY; ALTER TABLE supportv8.issues FORCE ROW LEVEL SECURITY; CREATE POLICY tenant_isolation_issues ON supportv8.issues USING(tenant_id=current_setting('app.current_tenant_id',true)) WITH CHECK(tenant_id=current_setting('app.current_tenant_id',true))",
      );
      schemaCreated = true;
      await database.query(
        await readFile(
          new URL(
            "../migrations/005_runtime_support_workspaces.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await database.query(
        await readFile(
          new URL(
            "../migrations/007_runtime_support_handoff_uses.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await database.query(
        "INSERT INTO supportv8.tenants(id,domain,name,servicev8_account_id) VALUES($1,'synthetic-support','Synthetic','synthetic-account')",
        [workspaceId],
      );
      await database.query(
        "INSERT INTO supportv8.runtime_support_workspaces(installation_id,operation_id,account_id,registry_tenant_id,vertical_id,tenant_domain,subject,native_tenant_id,native_domain,state) VALUES('synthetic-install','synthetic-operation','synthetic-account','synthetic-registry','runtime','synthetic-support','synthetic-member',$1,'synthetic-support','workspace_created')",
        [workspaceId],
      );
      await database.query(
        "INSERT INTO supportv8.issues(id,tenant_id,source,external_id,customer_ref,customer_name,summary,priority,source_status,created_at,updated_at) VALUES('synthetic-ticket',$1,'runtime','SYN-101','synthetic-customer','Synthetic Customer','Synthetic dispatch needs review','urgent','open','2026-09-16T10:00:00Z','2026-09-16T11:00:00Z')",
        [workspaceId],
      );
      await database.query(
        `GRANT USAGE ON SCHEMA supportv8 TO ${runtimeRole}; GRANT SELECT,INSERT,DELETE ON supportv8.runtime_support_handoff_uses TO ${runtimeRole}; GRANT SELECT ON supportv8.tenants,supportv8.runtime_support_workspaces,supportv8.issues TO ${runtimeRole}`,
      );

      registry = createServer((request, response) => {
        response.setHeader("content-type", "application/json");
        if (
          request.method === "POST" &&
          request.url === "/realms/test/protocol/openid-connect/token"
        ) {
          response.end(
            JSON.stringify({ access_token: "synthetic-registry-token" }),
          );
          return;
        }
        if (
          request.url?.startsWith(
            "/v1/tenants/synthetic-registry/memberships/synthetic-member",
          )
        ) {
          response.end(
            JSON.stringify({
              accountId: "synthetic-account",
              tenantId: "synthetic-registry",
              identitySubject: "synthetic-member",
              email: "synthetic@example.test",
              role: "MEMBER",
              status: memberActive ? "active" : "revoked",
              slug: "synthetic-support",
            }),
          );
          return;
        }
        if (request.url?.startsWith("/v1/projections/installations")) {
          response.end(
            JSON.stringify({
              installations: [
                {
                  accountId: "synthetic-account",
                  tenantId: "synthetic-registry",
                  verticalId: "runtime",
                  installationId: "synthetic-install",
                  productId: "servicev8.service-app.supportv8",
                  productVersion: "1.0.0",
                  productKind: "service_app",
                  entitlementStatus: "active",
                  tenantDomain: "synthetic-support",
                  installationState: "active",
                  serviceAppReadiness: { state: "ready" },
                  serviceAppPlanAccess: { state: "included" },
                  serviceAppBinding: {
                    schemaVersion: "servicev8.service-app-binding.v1",
                    appKey: "supportv8",
                    externalWorkspaceId: workspaceId,
                    poolAccountId: "synthetic-account",
                    provisioningState: "provisioned",
                    poolBindingState: "verified",
                  },
                },
              ],
            }),
          );
          return;
        }
        response.statusCode = 404;
        response.end(JSON.stringify({ error: "not found" }));
      });
      registry.listen(0, "127.0.0.1");
      await once(registry, "listening");
      registryPort = (registry.address() as { port: number }).port;

      const appDatabase = new URL(configuredDatabase);
      appDatabase.username = runtimeRole;
      appDatabase.password = "synthetic-only";
      appPort = await freePort();
      application = spawn(process.execPath, [".next/standalone/server.js"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          HOSTNAME: "127.0.0.1",
          PORT: String(appPort),
          DATABASE_URL: appDatabase.toString(),
          REGISTRY_URL: `http://127.0.0.1:${registryPort}/`,
          SERVICEV8_OIDC_ISSUER: `http://127.0.0.1:${registryPort}/realms/test`,
          SUPPORTV8_RUNTIME_REGISTRY_CLIENT_ID: "synthetic-client",
          SUPPORTV8_RUNTIME_REGISTRY_CLIENT_SECRET: "synthetic-client-secret",
          SUPPORTV8_SERVICE_APP_RUNTIME_SECRET: handoffSecret,
          SUPPORTV8_RUNTIME_SESSION_SECRET: sessionSecret,
          NODE_ENV: "production",
        },
        stdio: "ignore",
      });
      for (let attempt = 0; attempt < 50; attempt += 1) {
        try {
          await fetch(`http://127.0.0.1:${appPort}/api/health`);
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (attempt === 49) throw new Error("standalone server did not start");
      }
    } catch (error) {
      await cleanup();
      throw error;
    }
  }, 30_000);

  async function cleanup() {
    application?.kill("SIGTERM");
    if (application && application.exitCode === null)
      await once(application, "exit").catch(() => undefined);
    if (registry?.listening)
      await new Promise<void>((resolve) => registry.close(() => resolve()));
    if (database) {
      if (schemaCreated)
        await database
          .query("DROP SCHEMA supportv8 CASCADE")
          .catch(() => undefined);
      if (runtimeRoleCreated)
        await database.query(`DROP ROLE ${runtimeRole}`).catch(() => undefined);
    }
    schemaCreated = false;
    runtimeRoleCreated = false;
  }
  afterAll(async () => {
    await cleanup();
    await database?.end();
  });

  it("carries the host-bound session through the real page and ticket API, then denies revocation", async () => {
    const handoff = await standaloneRequest(
      appPort,
      `/auth/runtime/handoff?token=${encodeURIComponent(token())}`,
      { headers: { host: tenantHost, "x-forwarded-host": "attacker.example" } },
    );
    expect(handoff.status).toBe(303);
    expect(handoff.headers.location).toBe("/runtime");
    const setCookie = handoff.headers["set-cookie"]?.[0];
    expect(setCookie).toContain("__Host-sv8_runtime_support=");
    const cookie = setCookie!.split(";", 1)[0]!;

    const populated = await standaloneRequest(appPort, "/runtime", {
      headers: { host: tenantHost, cookie },
    });
    expect(populated.status).toBe(200);
    expect(populated.body).toContain("Synthetic Customer");
    expect(populated.body).toContain("Synthetic dispatch needs review");

    const api = await standaloneRequest(
      appPort,
      "/api/runtime/tickets?limit=10",
      { headers: { host: tenantHost, cookie } },
    );
    expect(api.status).toBe(200);
    expect(JSON.parse(api.body).tickets).toEqual([
      expect.objectContaining({
        ticketRef: "SYN-101",
        customerName: "Synthetic Customer",
      }),
    ]);

    await database.query(
      "DELETE FROM supportv8.issues WHERE id='synthetic-ticket'",
    );
    const empty = await standaloneRequest(appPort, "/runtime", {
      headers: { host: tenantHost, cookie },
    });
    expect(empty.status).toBe(200);
    expect(empty.body).toContain("No support tickets yet");

    memberActive = false;
    expect(
      (
        await standaloneRequest(appPort, "/api/runtime/tickets", {
          headers: { host: tenantHost, cookie },
        })
      ).status,
    ).toBe(401);
    const denied = await standaloneRequest(appPort, "/runtime", {
      headers: { host: tenantHost, cookie },
    });
    expect(denied.status).toBe(200);
    expect(denied.body).toContain("Access denied");
    memberActive = true;
  });

  it("renders denied instead of throwing for missing or malformed tenant Host", async () => {
    const cases: Array<Record<string, string>> = [
      {},
      { host: "support.servicev8.com" },
      { host: "bad.example" },
    ];
    for (const headers of cases) {
      const response = await standaloneRequest(appPort, "/runtime", {
        headers,
      });
      expect(response.status).toBe(200);
      expect(response.body).toContain("Access denied");
    }
  });

  it("clears the cookie for the public HTTPS origin and rejects missing or mismatched origin", async () => {
    const valid = await standaloneRequest(appPort, "/auth/runtime/logout", {
      method: "POST",
      headers: {
        host: tenantHost,
        origin: `https://${tenantHost}`,
        "sec-fetch-site": "same-origin",
        cookie: `sv8_access_token=${demoToken()}; __Host-sv8_runtime_support=synthetic-runtime-session`,
      },
    });
    expect(valid.status).toBe(303);
    expect(valid.headers["set-cookie"]?.[0]).toBe(
      "__Host-sv8_runtime_support=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    );
    expect(valid.headers["set-cookie"]?.[0]).not.toContain("sv8_access_token");
    for (const origin of [undefined, "https://attacker.example"]) {
      const headers: Record<string, string> = { host: tenantHost };
      if (origin) headers.origin = origin;
      expect(
        (
          await standaloneRequest(appPort, "/auth/runtime/logout", {
            method: "POST",
            headers,
          })
        ).status,
      ).toBe(403);
    }
  });
});
