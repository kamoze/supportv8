#!/usr/bin/env bun
/**
 * Automated Keycloak Realm Provisioner for SupportV8
 * Directly calls Keycloak Admin REST API using standard HTTPS
 */

const KEYCLOAK_URL = (process.env.KEYCLOAK_URL || "https://keycloak.servicev8.com").replace(/\/$/, "");
const ADMIN_USER = process.env.KEYCLOAK_ADMIN_USER || process.argv[2] || "admin";
const ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || process.argv[3] || "";
const REALM = "supportv8";

console.log(`\n======================================================`);
console.log(`🚀 Keycloak Provisioner for SupportV8`);
console.log(`   Target: ${KEYCLOAK_URL}`);
console.log(`   Realm:  ${REALM}`);
console.log(`   Admin:  ${ADMIN_USER}`);
console.log(`======================================================\n`);

async function run() {
  if (!ADMIN_PASSWORD) {
    console.error(`❌ Error: Please provide KEYCLOAK_ADMIN_PASSWORD as env var or argument.`);
    console.error(`   Usage: bun scripts/bootstrap-keycloak-rest.ts <admin_user> <admin_password>`);
    console.error(`   Example: bun scripts/bootstrap-keycloak-rest.ts admin MySecretPassword123`);
    process.exit(1);
  }

  // 1. Authenticate with master meridian-bootstrap-cli or admin-cli
  console.log(`🔑 Obtaining master admin token...`);
  let tokenRes = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "meridian-bootstrap-cli",
      username: ADMIN_USER,
      password: ADMIN_PASSWORD,
    }),
  });

  let tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.access_token) {
    // Fallback to admin-cli
    tokenRes = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "admin-cli",
        username: ADMIN_USER,
        password: ADMIN_PASSWORD,
      }),
    });
    tokenData = await tokenRes.json().catch(() => ({}));
  }

  if (!tokenRes.ok || !tokenData.access_token) {
    console.error(`❌ Failed to authenticate with Keycloak: ${tokenData.error_description || tokenData.error || tokenRes.status}`);
    process.exit(1);
  }

  const token = tokenData.access_token;
  console.log(`✅ Master admin token obtained successfully.\n`);

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Helper for admin fetch
  async function adminFetch(path: string, options: RequestInit = {}) {
    return fetch(`${KEYCLOAK_URL}${path}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });
  }

  // 2. Provision Roles
  console.log(`🛡️ Provisioning Realm Roles...`);
  const roles = [
    { name: "support_superadmin", description: "Full platform administration and system overrides" },
    { name: "support_cx_lead", description: "CX Director / Lead, triage rules, policy authoring, auto-refunds up to $500" },
    { name: "support_operator", description: "Frontline support operator, ticket triage, live chat resolution" },
    { name: "support_contractor_lead", description: "Contractor technician lead, job orders, PIN verification" },
    { name: "support_technician", description: "Field technician, electronic lockbox site passes" },
    { name: "support_observer", description: "Read-only access to metrics and audit logs" },
  ];

  for (const role of roles) {
    const res = await adminFetch(`/admin/realms/${REALM}/roles`, {
      method: "POST",
      body: JSON.stringify(role),
    });
    if (res.status === 201) {
      console.log(`   ✅ Role created: ${role.name}`);
    } else if (res.status === 409) {
      console.log(`   ℹ️  Role already exists: ${role.name}`);
    } else {
      console.log(`   ⚠️  Role ${role.name} status: ${res.status}`);
    }
  }

  // 3. Provision Client Scopes
  console.log(`\n📦 Provisioning Client Scopes...`);
  const scopes = [
    { name: "support.tickets", description: "Read and manage customer support tickets and queues" },
    { name: "support.refunds", description: "Issue autonomous refunds and credit vouchers under policy limits" },
    { name: "support.voice", description: "Configure voice telephony agents, SIP bindings, and speech sessions" },
    { name: "support.knowledge", description: "Query pgvector knowledge base and manage verified articles" },
    { name: "support.tenant", description: "Access tenant organization profile, settings, and team roster" },
  ];

  for (const scope of scopes) {
    const res = await adminFetch(`/admin/realms/${REALM}/client-scopes`, {
      method: "POST",
      body: JSON.stringify({ ...scope, protocol: "openid-connect" }),
    });
    if (res.status === 201) {
      console.log(`   ✅ Scope created: ${scope.name}`);
    } else if (res.status === 409) {
      console.log(`   ℹ️  Scope already exists: ${scope.name}`);
    } else {
      console.log(`   ⚠️  Scope ${scope.name} status: ${res.status}`);
    }
  }

  // 4. Provision Groups
  console.log(`\n👥 Provisioning Groups...`);
  const groups = [
    "Platform Administrators",
    "CX Directors & Leads",
    "Frontline Support Operators",
    "Field Contractors & Technicians",
    "Compliance & Audit Observers",
  ];

  for (const groupName of groups) {
    const res = await adminFetch(`/admin/realms/${REALM}/groups`, {
      method: "POST",
      body: JSON.stringify({ name: groupName }),
    });
    if (res.status === 201) {
      console.log(`   ✅ Group created: ${groupName}`);
    } else if (res.status === 409) {
      console.log(`   ℹ️  Group already exists: ${groupName}`);
    }
  }

  // 5. Provision Users
  console.log(`\n👤 Provisioning Core User Accounts & Passwords...`);
  const users = [
    {
      email: "acme@servicev8.com",
      firstName: "Acme",
      lastName: "Admin",
      roles: ["support_cx_lead", "support_superadmin"],
      tenant: "tenant_acme",
    },
    {
      email: "admin@acme.com",
      firstName: "Sarah",
      lastName: "Chen",
      roles: ["support_cx_lead"],
      tenant: "tenant_acme",
    },
    {
      email: "david.kim@acme.com",
      firstName: "David",
      lastName: "Kim",
      roles: ["support_operator"],
      tenant: "tenant_acme",
    },
    {
      email: "dispatch@meridian.com",
      firstName: "Meridian",
      lastName: "Dispatch",
      roles: ["support_contractor_lead"],
      tenant: "tenant_meridian",
    },
  ];

  const defaultPassword = "SupportV8#2026!Secure";

  for (const u of users) {
    // Check if user exists
    const searchRes = await adminFetch(`/admin/realms/${REALM}/users?email=${encodeURIComponent(u.email)}`);
    const searchData = (await searchRes.json().catch(() => [])) as any[];

    let userId: string;
    if (searchData.length > 0) {
      userId = searchData[0].id;
      console.log(`   ℹ️  User exists: ${u.email} (ID: ${userId})`);
    } else {
      const createRes = await adminFetch(`/admin/realms/${REALM}/users`, {
        method: "POST",
        body: JSON.stringify({
          username: u.email,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          enabled: true,
          emailVerified: true,
          attributes: {
            tenant_id: [u.tenant],
          },
        }),
      });

      if (createRes.status === 201) {
        const location = createRes.headers.get("location");
        userId = location ? location.split("/").pop()! : "";
        console.log(`   ✅ User created: ${u.email}`);
      } else {
        console.log(`   ⚠️  User ${u.email} create status: ${createRes.status}`);
        continue;
      }
    }

    // Set Password
    if (userId) {
      const pwdRes = await adminFetch(`/admin/realms/${REALM}/users/${userId}/reset-password`, {
        method: "PUT",
        body: JSON.stringify({
          type: "password",
          value: defaultPassword,
          temporary: false,
        }),
      });
      if (pwdRes.ok) {
        console.log(`      🔑 Password set: ${defaultPassword}`);
      }

      // Assign Roles
      for (const rName of u.roles) {
        // Get role representation
        const rRes = await adminFetch(`/admin/realms/${REALM}/roles/${encodeURIComponent(rName)}`);
        if (rRes.ok) {
          const rData = await rRes.json();
          await adminFetch(`/admin/realms/${REALM}/users/${userId}/role-mappings/realm`, {
            method: "POST",
            body: JSON.stringify([rData]),
          });
          console.log(`      🛡️  Assigned role: ${rName}`);
        }
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎉 SupportV8 Keycloak Provisioning Completed!`);
  console.log(`======================================================\n`);
}

run().catch((err) => {
  console.error(`💥 Fatal error:`, err);
  process.exit(1);
});
