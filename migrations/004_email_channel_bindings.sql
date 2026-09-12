CREATE TABLE IF NOT EXISTS supportv8.email_channel_bindings (
  tenant_id varchar(64) PRIMARY KEY REFERENCES supportv8.tenants(id) ON DELETE CASCADE,
  servicev8_account_id varchar(128) NOT NULL,
  connection_id varchar(128) NOT NULL,
  connector_key varchar(128) NOT NULL,
  recipient varchar(320) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (servicev8_account_id, connection_id)
);

ALTER TABLE supportv8.email_channel_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.email_channel_bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_email_channel_bindings ON supportv8.email_channel_bindings
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

CREATE TABLE IF NOT EXISTS supportv8.email_channel_binding_history (
  id bigserial PRIMARY KEY,
  tenant_id varchar(64) NOT NULL REFERENCES supportv8.tenants(id) ON DELETE CASCADE,
  source_event_id varchar(255) NOT NULL,
  action varchar(16) NOT NULL CHECK (action IN ('created', 'verified', 'rotated')),
  previous_binding jsonb,
  current_binding jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_event_id)
);

ALTER TABLE supportv8.email_channel_binding_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.email_channel_binding_history FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_email_channel_binding_history ON supportv8.email_channel_binding_history
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
