CREATE TABLE IF NOT EXISTS supportv8.runtime_order_handoffs (
  tenant_id varchar(64) NOT NULL REFERENCES supportv8.tenants(id) ON DELETE CASCADE,
  case_ref varchar(128) NOT NULL,
  objective_id varchar(128) NOT NULL,
  installation_id varchar(128) NOT NULL,
  hire_id varchar(128) NOT NULL,
  ticket_reference varchar(128) NOT NULL,
  receipt_ref varchar(191) NOT NULL,
  next_step text NOT NULL,
  knowledge_title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, case_ref),
  UNIQUE (tenant_id, receipt_ref)
);
ALTER TABLE supportv8.runtime_order_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.runtime_order_handoffs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON supportv8.runtime_order_handoffs FOR ALL
  USING (tenant_id = supportv8.current_tenant_id())
  WITH CHECK (tenant_id = supportv8.current_tenant_id());
