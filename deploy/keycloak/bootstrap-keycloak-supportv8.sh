#!/usr/bin/env bash
# ==============================================================================
# ServiceV8 SupportV8 — Automated Keycloak Realm & Security Bootstrap
# Aligned with growthv8, knowledgev8, and forge auth architecture standards
# ==============================================================================

set -euo pipefail

KEYCLOAK_URL="${KEYCLOAK_URL:-https://keycloak.servicev8.com}"
ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM="supportv8"
KCADM="${KCADM_PATH:-kcadm.sh}"

echo "======================================================================"
echo "⚡ Bootstrapping SupportV8 Keycloak Realm: ${REALM}"
echo "   Target Server: ${KEYCLOAK_URL}"
echo "======================================================================"

# 1. Authenticate with Keycloak master realm
echo "🔑 Authenticating as master admin..."
$KCADM config credentials \
  --server "${KEYCLOAK_URL}" \
  --realm master \
  --user "${ADMIN_USER}" \
  --password "${ADMIN_PASSWORD}"

# 2. Provision or update the supportv8 realm
echo "🌐 Provisioning realm: ${REALM}..."
if $KCADM get "realms/${REALM}" >/dev/null 2>&1; then
  $KCADM update "realms/${REALM}" \
    -s enabled=true \
    -s registrationAllowed=false \
    -s loginWithEmailAllowed=true \
    -s registrationEmailAsUsername=true \
    -s resetPasswordAllowed=true \
    -s sslRequired=external \
    -s bruteForceProtected=true \
    -s displayName="ServiceV8 Support (SupportV8)"
  echo "✅ Realm ${REALM} exists and updated."
else
  $KCADM create realms \
    -s realm="${REALM}" \
    -s enabled=true \
    -s registrationAllowed=false \
    -s loginWithEmailAllowed=true \
    -s registrationEmailAsUsername=true \
    -s resetPasswordAllowed=true \
    -s sslRequired=external \
    -s bruteForceProtected=true \
    -s displayName="ServiceV8 Support (SupportV8)"
  echo "✅ Realm ${REALM} created."
fi

# 3. Create Realm Roles
echo "🛡️  Configuring Realm Roles..."
ROLES=(
  "support_superadmin:Full platform administration and tenant overrides"
  "support_cx_lead:CX Director / Lead, triage rules, policy authoring, auto-refunds"
  "support_operator:Frontline support operator, ticket triage, live chat resolution"
  "support_contractor_lead:Contractor technician lead, job orders, PIN verification"
  "support_technician:Field technician, electronic lockbox site passes"
  "support_observer:Read-only access to metrics, compliance audit logs"
)

for ROLE_SPEC in "${ROLES[@]}"; do
  ROLE_NAME="${ROLE_SPEC%%:*}"
  ROLE_DESC="${ROLE_SPEC#*:}"
  $KCADM create roles -r "${REALM}" -s name="${ROLE_NAME}" -s description="${ROLE_DESC}" 2>/dev/null || echo "   Role ${ROLE_NAME} already exists"
done

# 4. Create Client Scopes
echo "📦 Configuring Client Scopes..."
SCOPES=(
  "support.tickets:Read and manage customer support tickets and queues"
  "support.refunds:Issue autonomous refunds and credit vouchers under policy limits"
  "support.voice:Configure voice telephony agents, SIP bindings, and speech sessions"
  "support.knowledge:Query pgvector knowledge base and manage verified articles"
  "support.tenant:Access tenant organization profile, settings, and team roster"
)

for SCOPE_SPEC in "${SCOPES[@]}"; do
  SCOPE_NAME="${SCOPE_SPEC%%:*}"
  SCOPE_DESC="${SCOPE_SPEC#*:}"
  $KCADM create client-scopes -r "${REALM}" -s name="${SCOPE_NAME}" -s description="${SCOPE_DESC}" -s protocol=openid-connect 2>/dev/null || echo "   Scope ${SCOPE_NAME} already exists"
done

# 5. Provision Public Web Client (supportv8-app) for ROPC and PKCE Login
echo "📱 Configuring Public Client: supportv8-app..."
if $KCADM get clients -r "${REALM}" -q clientId=supportv8-app --fields id 2>/dev/null | grep -q id; then
  echo "   Client supportv8-app already exists"
else
  $KCADM create clients -r "${REALM}" \
    -s clientId=supportv8-app \
    -s name="SupportV8 Web Console & ROPC" \
    -s enabled=true \
    -s publicClient=true \
    -s standardFlowEnabled=true \
    -s directAccessGrantsEnabled=true \
    -s 'redirectUris=["https://*.support.servicev8.com/*", "https://support.servicev8.com/*", "http://localhost:3000/*", "http://localhost:3001/*"]' \
    -s 'webOrigins=["+"]'
  echo "✅ Client supportv8-app created"
fi

# 6. Provision Confidential Admin Service Account (supportv8-admin-sa)
echo "🔒 Configuring Confidential Admin Service Account: supportv8-admin-sa..."
if $KCADM get clients -r "${REALM}" -q clientId=supportv8-admin-sa --fields id 2>/dev/null | grep -q id; then
  echo "   Client supportv8-admin-sa already exists"
else
  $KCADM create clients -r "${REALM}" \
    -s clientId=supportv8-admin-sa \
    -s name="SupportV8 Realm User Management Principal" \
    -s enabled=true \
    -s publicClient=false \
    -s serviceAccountsEnabled=true \
    -s standardFlowEnabled=false \
    -s directAccessGrantsEnabled=false
  echo "✅ Client supportv8-admin-sa created"
fi

# Grant manage-users role to supportv8-admin-sa
$KCADM add-roles -r "${REALM}" \
  --uusername service-account-supportv8-admin-sa \
  --cclientid realm-management --rolename manage-users \
  2>/dev/null || echo "   manage-users role already granted"

# 7. Provision Confidential Interservice Client (supportv8-service)
echo "🔗 Configuring Interservice Principal: supportv8-service..."
if $KCADM get clients -r "${REALM}" -q clientId=supportv8-service --fields id 2>/dev/null | grep -q id; then
  echo "   Client supportv8-service already exists"
else
  $KCADM create clients -r "${REALM}" \
    -s clientId=supportv8-service \
    -s name="SupportV8 Interservice & Gateway Principal" \
    -s enabled=true \
    -s publicClient=false \
    -s serviceAccountsEnabled=true \
    -s standardFlowEnabled=false \
    -s directAccessGrantsEnabled=false
  echo "✅ Client supportv8-service created"
fi

# 8. Create Groups & Hierarchy
echo "👥 Creating Groups..."
GROUPS=(
  "Platform Administrators"
  "CX Directors & Leads"
  "Frontline Support Operators"
  "Field Contractors & Technicians"
  "Compliance & Audit Observers"
)

for GRP in "${GROUPS[@]}"; do
  $KCADM create groups -r "${REALM}" -s name="${GRP}" 2>/dev/null || echo "   Group '${GRP}' already exists"
done

# 9. Seed Standard Demo Users
echo "👤 Seeding Core Accounts..."
USERS=(
  "acme@servicev8.com:SupportV8#2026!Secure:Acme:Admin:tenant_acme:support_cx_lead,support_superadmin:/CX Directors & Leads"
  "admin@acme.com:SupportV8#2026!Secure:Sarah:Chen:tenant_acme:support_cx_lead:/CX Directors & Leads"
  "david.kim@acme.com:SupportV8#2026!Secure:David:Kim:tenant_acme:support_operator:/Frontline Support Operators"
  "admin@acme-movers.com:SupportV8#2026!Secure:Admin:Acme Movers:tenant_acme_movers:support_cx_lead:/CX Directors & Leads"
  "dispatch@meridian.com:SupportV8#2026!Secure:Meridian:Dispatch:tenant_meridian:support_contractor_lead:/Field Contractors & Technicians"
)

for USER_SPEC in "${USERS[@]}"; do
  IFS=":" read -r U_EMAIL U_PASS U_FNAME U_LNAME U_TENANT U_ROLES U_GRP <<< "${USER_SPEC}"
  if $KCADM get users -r "${REALM}" -q email="${U_EMAIL}" --fields id 2>/dev/null | grep -q id; then
    echo "   User ${U_EMAIL} already exists"
  else
    $KCADM create users -r "${REALM}" \
      -s username="${U_EMAIL}" \
      -s email="${U_EMAIL}" \
      -s firstName="${U_FNAME}" \
      -s lastName="${U_LNAME}" \
      -s enabled=true \
      -s emailVerified=true \
      -s "attributes.tenant_id=[\"${U_TENANT}\"]"
    $KCADM set-password -r "${REALM}" --username "${U_EMAIL}" --new-password "${U_PASS}"
    
    # Assign Roles
    IFS="," read -ra ROLE_ARR <<< "${U_ROLES}"
    for R in "${ROLE_ARR[@]}"; do
      $KCADM add-roles -r "${REALM}" --uusername "${U_EMAIL}" --rolename "${R}" 2>/dev/null || true
    done
    echo "✅ User ${U_EMAIL} created with credentials and roles."
  fi
done

# 10. Clear Cache
echo "🧹 Clearing Keycloak Realm & User Caches..."
$KCADM create clear-realm-cache -r "${REALM}" 2>/dev/null || true
$KCADM create clear-user-cache -r "${REALM}" 2>/dev/null || true

echo "======================================================================"
echo "🎉 SupportV8 Keycloak Realm (${REALM}) Bootstrap Completed Successfully!"
echo "======================================================================"
