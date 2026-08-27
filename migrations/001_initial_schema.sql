-- ============================================================================
-- supportV8 — PostgreSQL Initial Schema with Row-Level Security (RLS) & pgvector
-- Basis: supportV8 Product Design Specification v0.3
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    domain VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    operating_mode VARCHAR(32) NOT NULL DEFAULT 'autonomous',
    autonomy_threshold VARCHAR(32) NOT NULL DEFAULT 'medium',
    confidence_min NUMERIC(4, 2) NOT NULL DEFAULT 0.85,
    feature_flags JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Issues Table (Derived Intelligence - not replacing helpdesk systems of record)
CREATE TABLE IF NOT EXISTS issues (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source VARCHAR(32) NOT NULL,
    external_id VARCHAR(128) NOT NULL,
    source_url TEXT NOT NULL,
    customer_ref VARCHAR(128) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_tier VARCHAR(32) NOT NULL DEFAULT 'standard',
    summary TEXT NOT NULL,
    category VARCHAR(64) NOT NULL,
    product VARCHAR(128) NOT NULL,
    version VARCHAR(64) NOT NULL,
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
    embedding vector(1536), -- pgvector embedding for semantic RAG retrieval
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issues_tenant ON issues(tenant_id);
CREATE INDEX IF NOT EXISTS idx_issues_problem ON issues(tenant_id, problem_id);
CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_issues_embedding ON issues USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS on Issues
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_issues ON issues
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- 3. Problems Table (Systemic Incidents)
CREATE TABLE IF NOT EXISTS problems (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    suspected_cause TEXT NOT NULL,
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
    owner VARCHAR(128) NOT NULL,
    recommended_actions TEXT[] NOT NULL DEFAULT '{}',
    communications_count INT NOT NULL DEFAULT 0,
    verification_state VARCHAR(32) NOT NULL DEFAULT 'unverified',
    source_systems TEXT[] NOT NULL DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problems_tenant ON problems(tenant_id);
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_problems ON problems
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- 4. Actionable Insights Table
CREATE TABLE IF NOT EXISTS insights (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    finding TEXT NOT NULL,
    evidence TEXT[] NOT NULL DEFAULT '{}',
    confidence NUMERIC(4, 2) NOT NULL DEFAULT 0.9,
    affected_segment VARCHAR(128) NOT NULL,
    business_impact VARCHAR(32) NOT NULL DEFAULT 'low',
    likely_driver TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    recommended_operation VARCHAR(128),
    action_payload JSONB DEFAULT '{}',
    status VARCHAR(32) NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_tenant ON insights(tenant_id);
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_insights ON insights
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- 5. Knowledge Articles & Proposals Table
CREATE TABLE IF NOT EXISTS knowledge_articles (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    category VARCHAR(64) NOT NULL,
    usage_count INT NOT NULL DEFAULT 0,
    csat_score NUMERIC(3, 2) NOT NULL DEFAULT 5.0,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    summary TEXT NOT NULL,
    content TEXT,
    embedding vector(1536),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_tenant ON knowledge_articles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kb_embedding ON knowledge_articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_knowledge ON knowledge_articles
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- 5b. Knowledge Documents (Direct S3 Uploads for RAG Ingestion)
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(32) NOT NULL,
    file_size_bytes INT NOT NULL,
    s3_key TEXT NOT NULL,
    s3_url TEXT NOT NULL,
    category VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    chunk_count INT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'indexed',
    summary TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_docs_tenant ON knowledge_documents(tenant_id);
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_kb_docs ON knowledge_documents
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- 5c. Knowledge Document Chunks (pgvector Embeddings)
CREATE TABLE IF NOT EXISTS knowledge_document_chunks (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_tenant ON knowledge_document_chunks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_doc ON knowledge_document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_vector ON knowledge_document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
ALTER TABLE knowledge_document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_kb_chunks ON knowledge_document_chunks
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- 5d. Knowledge Web Sources (Website Crawl Ingestion)
CREATE TABLE IF NOT EXISTS knowledge_web_sources (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    crawl_depth INT NOT NULL DEFAULT 1,
    page_count INT NOT NULL DEFAULT 1,
    chunk_count INT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'indexed',
    last_crawled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    s3_snapshot_url TEXT,
    summary TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kb_web_tenant ON knowledge_web_sources(tenant_id);
ALTER TABLE knowledge_web_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_kb_web ON knowledge_web_sources
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- 6. Action Gateway Audit Table
CREATE TABLE IF NOT EXISTS action_audit_records (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    actor_id VARCHAR(128) NOT NULL,
    actor_type VARCHAR(32) NOT NULL,
    operation_id VARCHAR(128) NOT NULL,
    risk VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB,
    reasoning TEXT NOT NULL,
    confidence NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON action_audit_records(tenant_id);
ALTER TABLE action_audit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_audit ON action_audit_records
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
