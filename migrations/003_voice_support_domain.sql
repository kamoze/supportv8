ALTER TABLE supportv8.tenants
  ADD COLUMN IF NOT EXISTS servicev8_account_id varchar(128);

CREATE UNIQUE INDEX IF NOT EXISTS uq_supportv8_tenants_servicev8_account
  ON supportv8.tenants(servicev8_account_id)
  WHERE servicev8_account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS supportv8.voice_tool_effects (
  tenant_id varchar(64) NOT NULL REFERENCES supportv8.tenants(id) ON DELETE CASCADE,
  session_id varchar(128) NOT NULL,
  tool_call_id varchar(128) NOT NULL,
  hire_id varchar(128) NOT NULL,
  installation_id varchar(128) NOT NULL,
  operation varchar(64) NOT NULL,
  result_reference varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, session_id, tool_call_id)
);
ALTER TABLE supportv8.voice_tool_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.voice_tool_effects FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON supportv8.voice_tool_effects FOR ALL
  USING (tenant_id = supportv8.current_tenant_id())
  WITH CHECK (tenant_id = supportv8.current_tenant_id());
