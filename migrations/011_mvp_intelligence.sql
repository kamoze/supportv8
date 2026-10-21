-- ============================================================================
-- supportV8 — MVP Intelligence Forward-Only Data Plane Schema
-- Migration: 011_mvp_intelligence.sql
-- Enforces: Strict Tenant Isolation (RLS), Deduplication, Retention & Outbox
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS supportv8;

-- Ensure prerequisite core tables exist if running against a clean schema
CREATE TABLE IF NOT EXISTS supportv8.tenants (
    id VARCHAR(64) PRIMARY KEY,
    domain VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    operating_mode VARCHAR(32) NOT NULL DEFAULT 'autonomous',
    servicev8_account_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supportv8.issues (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES supportv8.tenants(id) ON DELETE CASCADE,
    source VARCHAR(32) NOT NULL,
    external_id VARCHAR(128) NOT NULL,
    source_url TEXT NOT NULL DEFAULT '',
    customer_ref VARCHAR(128) NOT NULL DEFAULT '',
    customer_name VARCHAR(255) NOT NULL DEFAULT '',
    customer_tier VARCHAR(32) NOT NULL DEFAULT 'standard',
    summary TEXT NOT NULL DEFAULT '',
    category VARCHAR(64) NOT NULL DEFAULT '',
    product VARCHAR(128) NOT NULL DEFAULT '',
    version VARCHAR(64) NOT NULL DEFAULT '',
    sentiment VARCHAR(32) NOT NULL DEFAULT 'neutral',
    sentiment_score NUMERIC(4, 2) NOT NULL DEFAULT 0.0,
    sentiment_trajectory VARCHAR(32) NOT NULL DEFAULT 'stable',
    priority VARCHAR(32) NOT NULL DEFAULT 'normal',
    confidence NUMERIC(4, 2) NOT NULL DEFAULT 0.85,
    business_impact VARCHAR(32) NOT NULL DEFAULT 'low',
    resolution_risk_score NUMERIC(4, 2) NOT NULL DEFAULT 0.1,
    problem_id VARCHAR(64),
    source_status VARCHAR(32) NOT NULL DEFAULT 'open',
    tags TEXT[] NOT NULL DEFAULT '{}',
    recommended_action TEXT,
    timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    assigned_to VARCHAR(255),
    assigned_agent VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supportv8.problems (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES supportv8.tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    suspected_cause TEXT NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    confidence NUMERIC(4, 2) NOT NULL DEFAULT 0.9,
    impact VARCHAR(32) NOT NULL DEFAULT 'medium',
    affected_customer_count INT NOT NULL DEFAULT 0,
    affected_enterprise_count INT NOT NULL DEFAULT 0,
    estimated_revenue_exposure NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    linked_issue_ids TEXT[] NOT NULL DEFAULT '{}',
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trend VARCHAR(32) NOT NULL DEFAULT 'stable',
    owner VARCHAR(128) NOT NULL DEFAULT 'system',
    recommended_actions TEXT[] NOT NULL DEFAULT '{}',
    communications_count INT NOT NULL DEFAULT 0,
    verification_state VARCHAR(32) NOT NULL DEFAULT 'unverified',
    source_systems TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. Source Connections: Opaque Action Gateway connection references only
CREATE TABLE IF NOT EXISTS supportv8.source_connections (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES supportv8.tenants(id) ON DELETE CASCADE,
    account_id VARCHAR(64) NOT NULL,
    provider VARCHAR(32) NOT NULL DEFAULT 'zendesk',
    connection_id VARCHAR(128) NOT NULL,
    connector_key VARCHAR(64) NOT NULL DEFAULT 'zendesk',
    external_account_id VARCHAR(128) NOT NULL,
    base_url TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'degraded', 'disabled')),
    last_event_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_supportv8_source_connections_tenant_connector
    ON supportv8.source_connections (tenant_id, connector_key);
CREATE INDEX IF NOT EXISTS idx_supportv8_source_connections_tenant
    ON supportv8.source_connections (tenant_id);

-- 2. Interaction Events: Raw payload, expires_at, processing state, lease and retry fields
CREATE TABLE IF NOT EXISTS supportv8.interaction_events (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES supportv8.tenants(id) ON DELETE CASCADE,
    account_id VARCHAR(64) NOT NULL,
    connection_id VARCHAR(128) NOT NULL,
    connector_key VARCHAR(64) NOT NULL DEFAULT 'zendesk',
    source VARCHAR(32) NOT NULL DEFAULT 'zendesk',
    event_id VARCHAR(128) NOT NULL,
    source_reference VARCHAR(128) NOT NULL,
    customer_reference VARCHAR(128) NOT NULL,
    source_url TEXT NOT NULL,
    text TEXT NOT NULL,
    sender VARCHAR(32) NOT NULL DEFAULT 'customer' CHECK (sender IN ('customer', 'agent', 'system')),
    occurred_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    correlation_id VARCHAR(128) NOT NULL,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL,
    processing_state VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (processing_state IN ('pending', 'processing', 'completed', 'failed')),
    locked_by VARCHAR(64),
    locked_at TIMESTAMPTZ,
    retry_count INT NOT NULL DEFAULT 0,
    retry_at TIMESTAMPTZ,
    error_code VARCHAR(64),
    issue_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_supportv8_interaction_event UNIQUE (tenant_id, source, event_id)
);

-- 3. Interaction Outbox: Deterministic event keys
CREATE TABLE IF NOT EXISTS supportv8.interaction_outbox (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES supportv8.tenants(id) ON DELETE CASCADE,
    event_key VARCHAR(128) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT uq_supportv8_outbox_key UNIQUE (tenant_id, event_key)
);

-- 4. Tenant Policies: raw_context_retention_hours constrained to 1..168
CREATE TABLE IF NOT EXISTS supportv8.tenant_policies (
    tenant_id VARCHAR(64) PRIMARY KEY REFERENCES supportv8.tenants(id) ON DELETE CASCADE,
    raw_context_retention_hours INT NOT NULL DEFAULT 72 CHECK (raw_context_retention_hours BETWEEN 1 AND 168),
    mode VARCHAR(32) NOT NULL DEFAULT 'observe' CHECK (mode IN ('observe', 'copilot', 'autonomous')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Action Receipts: Keyed by (tenant_id, idempotency_key)
CREATE TABLE IF NOT EXISTS supportv8.action_receipts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES supportv8.tenants(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(255) NOT NULL,
    action VARCHAR(64) NOT NULL,
    capability VARCHAR(64),
    issue_id VARCHAR(64),
    action_execution_id VARCHAR(128),
    status VARCHAR(32) NOT NULL,
    actor JSONB,
    payload JSONB,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_supportv8_action_receipt_idempotency UNIQUE (tenant_id, idempotency_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supportv8_events_claim
    ON supportv8.interaction_events(processing_state, retry_at, received_at)
    WHERE processing_state IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_supportv8_events_expiry
    ON supportv8.interaction_events(expires_at);

CREATE INDEX IF NOT EXISTS idx_supportv8_events_tenant
    ON supportv8.interaction_events(tenant_id);

CREATE INDEX IF NOT EXISTS idx_supportv8_outbox_tenant_status
    ON supportv8.interaction_outbox(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_supportv8_receipts_tenant
    ON supportv8.action_receipts(tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_supportv8_issues_tenant_source_ext
    ON supportv8.issues (tenant_id, source, external_id);

CREATE INDEX IF NOT EXISTS idx_supportv8_problems_tenant_status
    ON supportv8.problems (tenant_id, status);

-- Enable and FORCE Row-Level Security on all tenant-owned tables
ALTER TABLE supportv8.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.issues FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_issues ON supportv8.issues;
CREATE POLICY tenant_isolation_issues ON supportv8.issues
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE supportv8.problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.problems FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_problems ON supportv8.problems;
CREATE POLICY tenant_isolation_problems ON supportv8.problems
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE supportv8.source_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.source_connections FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_source_connections ON supportv8.source_connections;
CREATE POLICY tenant_isolation_source_connections ON supportv8.source_connections
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE supportv8.interaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.interaction_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_interaction_events ON supportv8.interaction_events;
CREATE POLICY tenant_isolation_interaction_events ON supportv8.interaction_events
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE supportv8.interaction_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.interaction_outbox FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_interaction_outbox ON supportv8.interaction_outbox;
CREATE POLICY tenant_isolation_interaction_outbox ON supportv8.interaction_outbox
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE supportv8.tenant_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.tenant_policies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_tenant_policies ON supportv8.tenant_policies;
CREATE POLICY tenant_isolation_tenant_policies ON supportv8.tenant_policies
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE supportv8.action_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.action_receipts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_action_receipts ON supportv8.action_receipts;
CREATE POLICY tenant_isolation_action_receipts ON supportv8.action_receipts
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- SECURITY DEFINER worker claim function for cross-tenant interaction processing
CREATE OR REPLACE FUNCTION supportv8.claim_interaction_events(
    worker_id VARCHAR,
    claim_limit INT DEFAULT 10
)
RETURNS SETOF supportv8.interaction_events
LANGUAGE sql
SECURITY DEFINER
SET search_path=pg_catalog,supportv8
AS $$
    WITH candidates AS (
        SELECT id
        FROM supportv8.interaction_events
        WHERE (processing_state = 'pending' OR (processing_state = 'failed' AND retry_at <= NOW()))
        ORDER BY received_at ASC
        LIMIT GREATEST(1, LEAST(claim_limit, 100))
        FOR UPDATE SKIP LOCKED
    )
    UPDATE supportv8.interaction_events e
    SET processing_state = 'processing',
        locked_by = worker_id,
        locked_at = NOW(),
        updated_at = NOW()
    FROM candidates
    WHERE e.id = candidates.id
    RETURNING e.*;
$$;

REVOKE ALL ON FUNCTION supportv8.claim_interaction_events(VARCHAR, INT) FROM PUBLIC;

COMMENT ON FUNCTION supportv8.claim_interaction_events(VARCHAR, INT) IS
    'Worker interaction claim across tenants; SECURITY DEFINER intentionally crosses forced RLS after EXECUTE is revoked from PUBLIC.';

-- Grant least-privilege access to supportv8_app role if it exists (no BYPASSRLS)
DO $grants$
BEGIN
  IF to_regrole('supportv8_app') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON supportv8.issues, supportv8.problems TO supportv8_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON supportv8.source_connections, supportv8.interaction_events, supportv8.interaction_outbox, supportv8.tenant_policies, supportv8.action_receipts TO supportv8_app';
    EXECUTE 'GRANT EXECUTE ON FUNCTION supportv8.claim_interaction_events(VARCHAR, INT) TO supportv8_app';
  END IF;
END $grants$;
