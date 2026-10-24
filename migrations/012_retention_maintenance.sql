-- Migration 012: Retention Maintenance, Persistent Policy Rules, and Durable Telemetry
-- Enforces:
-- 1. SECURITY DEFINER tenant enumeration for background retention workers under forced RLS
-- 2. Durable policy rules column on supportv8.tenant_policies (avoiding replica drift)
-- 3. Durable LLM traces table supportv8.llm_traces under forced RLS (avoiding in-memory trace loss)

-- 1. Add persistent rules column to tenant_policies
ALTER TABLE supportv8.tenant_policies
    ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. SECURITY DEFINER function to enumerate tenant IDs for maintenance routines
CREATE OR REPLACE FUNCTION supportv8.list_active_tenants()
RETURNS TABLE (id VARCHAR(64))
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, supportv8
AS $$
    SELECT id FROM supportv8.tenants ORDER BY id;
$$;

REVOKE ALL ON FUNCTION supportv8.list_active_tenants() FROM PUBLIC;

COMMENT ON FUNCTION supportv8.list_active_tenants() IS
    'Returns active tenant IDs for background maintenance and retention; SECURITY DEFINER intentionally crosses forced RLS.';

-- 3. Durable LLM Traces table with forced RLS
CREATE TABLE IF NOT EXISTS supportv8.llm_traces (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES supportv8.tenants(id) ON DELETE CASCADE,
    trace_id VARCHAR(128) NOT NULL,
    span_id VARCHAR(128) NOT NULL,
    session_id VARCHAR(128) NOT NULL DEFAULT '',
    channel VARCHAR(32) NOT NULL DEFAULT 'web_chat',
    model VARCHAR(64) NOT NULL DEFAULT 'unknown',
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
    latency_ms INT NOT NULL DEFAULT 0,
    guardrail_triggered BOOLEAN NOT NULL DEFAULT FALSE,
    tools_invoked JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supportv8_llm_traces_tenant_created
    ON supportv8.llm_traces(tenant_id, created_at DESC);

ALTER TABLE supportv8.llm_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.llm_traces FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_llm_traces ON supportv8.llm_traces;
CREATE POLICY tenant_isolation_llm_traces ON supportv8.llm_traces
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- 4. Grant least-privilege permissions to supportv8_app role if present
DO $grants$
BEGIN
  IF to_regrole('supportv8_app') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION supportv8.list_active_tenants() TO supportv8_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON supportv8.llm_traces TO supportv8_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON supportv8.tenant_policies TO supportv8_app';
  END IF;
END $grants$;
