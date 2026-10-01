-- ============================================================================
-- supportV8 — Customer Directory & Omnichannel Biodata Store
-- Supports local customer profiles, target system sync, and RLS tenant isolation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS supportv8.customers (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES supportv8.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL DEFAULT '',
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(64) NOT NULL DEFAULT '',
    customer_tier VARCHAR(32) NOT NULL DEFAULT 'standard' CHECK (customer_tier IN ('standard', 'premium', 'enterprise', 'vip')),
    source_system VARCHAR(64) NOT NULL DEFAULT 'local' CHECK (source_system IN ('local', 'stripe', 'zendesk', 'intercom', 'orderv8', 'shopify', 'manual')),
    external_customer_ref VARCHAR(128),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_supportv8_customers_tenant 
    ON supportv8.customers(tenant_id);

CREATE INDEX IF NOT EXISTS idx_supportv8_customers_tenant_email 
    ON supportv8.customers(tenant_id, LOWER(email));

CREATE INDEX IF NOT EXISTS idx_supportv8_customers_tenant_name 
    ON supportv8.customers(tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_supportv8_customers_tenant_company 
    ON supportv8.customers(tenant_id, company_name);

CREATE UNIQUE INDEX IF NOT EXISTS uq_supportv8_customers_tenant_email 
    ON supportv8.customers(tenant_id, LOWER(email));

ALTER TABLE supportv8.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.customers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_customers ON supportv8.customers;
CREATE POLICY tenant_isolation_customers ON supportv8.customers
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
