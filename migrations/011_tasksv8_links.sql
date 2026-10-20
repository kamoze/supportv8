-- ============================================================================
-- supportV8 — TaskV8 Work Bridge Schema & Transactional Outbox
-- Enables link-only TaskV8 integration, outbox dispatch, and outcome receipts
-- with forced RLS tenant isolation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS supportv8.tasksv8_links (
    tenant_id text NOT NULL,
    account_id text NOT NULL,
    ticket_id text NOT NULL,
    task_id text,
    task_uri text,
    source_revision integer NOT NULL,
    last_event_id text NOT NULL,
    last_receipt_id text,
    outcome_state text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, ticket_id)
);

CREATE TABLE IF NOT EXISTS supportv8.tasksv8_outbox (
    tenant_id text NOT NULL,
    account_id text NOT NULL,
    event_id text NOT NULL,
    request_digest text NOT NULL,
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    lease_token uuid,
    lease_expires_at timestamptz,
    attempt_count integer NOT NULL DEFAULT 0,
    receipt_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, event_id)
);

CREATE TABLE IF NOT EXISTS supportv8.tasksv8_outcome_receipts (
    tenant_id text NOT NULL,
    event_id text NOT NULL,
    payload_digest text NOT NULL,
    receipt_id uuid NOT NULL DEFAULT gen_random_uuid(),
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, event_id)
);

-- Indexes for efficient outbox worker claiming and link lookups
CREATE INDEX IF NOT EXISTS idx_supportv8_tasksv8_outbox_pending
    ON supportv8.tasksv8_outbox(tenant_id, status, created_at)
    WHERE status IN ('pending', 'leased');

CREATE INDEX IF NOT EXISTS idx_supportv8_tasksv8_links_task_id
    ON supportv8.tasksv8_links(tenant_id, task_id);

CREATE INDEX IF NOT EXISTS idx_supportv8_tasksv8_outcome_receipts_receipt_id
    ON supportv8.tasksv8_outcome_receipts(tenant_id, receipt_id);

-- Enable and FORCE Row Level Security on all three tables
ALTER TABLE supportv8.tasksv8_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.tasksv8_links FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_tasksv8_links ON supportv8.tasksv8_links;
CREATE POLICY tenant_isolation_tasksv8_links ON supportv8.tasksv8_links
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE supportv8.tasksv8_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.tasksv8_outbox FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_tasksv8_outbox ON supportv8.tasksv8_outbox;
CREATE POLICY tenant_isolation_tasksv8_outbox ON supportv8.tasksv8_outbox
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE supportv8.tasksv8_outcome_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.tasksv8_outcome_receipts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_tasksv8_outcome_receipts ON supportv8.tasksv8_outcome_receipts;
CREATE POLICY tenant_isolation_tasksv8_outcome_receipts ON supportv8.tasksv8_outcome_receipts
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
