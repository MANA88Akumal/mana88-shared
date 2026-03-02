-- ============================================================
-- MANA 88 Multi-Tenant Migration
-- Adds tenant isolation to all business tables
-- ============================================================

-- 1. Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  logo_url TEXT,
  brand_primary VARCHAR(7) DEFAULT '#ce9e62',
  brand_secondary VARCHAR(7) DEFAULT '#2c2c2c',
  brand_accent VARCHAR(7) DEFAULT '#c1432e',
  brand_bg VARCHAR(7) DEFAULT '#faf8f5',
  enabled_apps JSONB DEFAULT '["accounting","cms","investors"]',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed MANA 88 as tenant #1
INSERT INTO tenants (slug, name, domain, logo_url) VALUES (
  'mana88', 'MANA 88 Akumal', 'manaakumal.com',
  'https://manaakumal.com/wp-content/uploads/2025/06/logo-white-simple.png'
) ON CONFLICT (slug) DO NOTHING;

-- 2. User roles table (replaces profiles.role + profiles.system_access)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,  -- platform_admin, tenant_admin, finance, sales_mgr, broker, investor, viewer
  app_access JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

-- 3. Add tenant_id to accounting tables
ALTER TABLE accounting_bank_transactions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE accounting_facturas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE accounting_cash_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE accounting_categories ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE accounting_bank_accounts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE accounting_notifications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Add tenant_id to CMS tables
ALTER TABLE cases ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE lots ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE payment_schedule ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE cms_payments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Add tenant_id to offers if exists
DO $$ BEGIN
  ALTER TABLE offers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Add tenant_id to cms_notifications if exists
DO $$ BEGIN
  ALTER TABLE cms_notifications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 4. Backfill all existing data to MANA 88 tenant
DO $$
DECLARE
  mana_id UUID;
BEGIN
  SELECT id INTO mana_id FROM tenants WHERE slug = 'mana88';

  -- Accounting tables
  UPDATE accounting_bank_transactions SET tenant_id = mana_id WHERE tenant_id IS NULL;
  UPDATE accounting_facturas SET tenant_id = mana_id WHERE tenant_id IS NULL;
  UPDATE accounting_cash_log SET tenant_id = mana_id WHERE tenant_id IS NULL;
  UPDATE accounting_categories SET tenant_id = mana_id WHERE tenant_id IS NULL;
  UPDATE accounting_bank_accounts SET tenant_id = mana_id WHERE tenant_id IS NULL;
  UPDATE accounting_notifications SET tenant_id = mana_id WHERE tenant_id IS NULL;

  -- CMS tables
  UPDATE cases SET tenant_id = mana_id WHERE tenant_id IS NULL;
  UPDATE clients SET tenant_id = mana_id WHERE tenant_id IS NULL;
  UPDATE lots SET tenant_id = mana_id WHERE tenant_id IS NULL;
  UPDATE brokers SET tenant_id = mana_id WHERE tenant_id IS NULL;
  UPDATE payment_schedule SET tenant_id = mana_id WHERE tenant_id IS NULL;
  UPDATE cms_payments SET tenant_id = mana_id WHERE tenant_id IS NULL;
  UPDATE approvals SET tenant_id = mana_id WHERE tenant_id IS NULL;
END $$;

-- Backfill offers if exists
DO $$
DECLARE mana_id UUID;
BEGIN
  SELECT id INTO mana_id FROM tenants WHERE slug = 'mana88';
  UPDATE offers SET tenant_id = mana_id WHERE tenant_id IS NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Backfill cms_notifications if exists
DO $$
DECLARE mana_id UUID;
BEGIN
  SELECT id INTO mana_id FROM tenants WHERE slug = 'mana88';
  UPDATE cms_notifications SET tenant_id = mana_id WHERE tenant_id IS NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 5. Make tenant_id NOT NULL after backfill
ALTER TABLE accounting_bank_transactions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE accounting_facturas ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE accounting_cash_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE accounting_categories ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE accounting_bank_accounts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE accounting_notifications ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE cases ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE clients ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE lots ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE brokers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE payment_schedule ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE cms_payments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE approvals ALTER COLUMN tenant_id SET NOT NULL;

-- 6. Indexes for tenant_id
CREATE INDEX IF NOT EXISTS idx_accounting_bank_transactions_tenant ON accounting_bank_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounting_facturas_tenant ON accounting_facturas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounting_cash_log_tenant ON accounting_cash_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cases_tenant ON cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lots_tenant ON lots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_brokers_tenant ON brokers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant ON user_roles(tenant_id);

-- 7. RLS helper function
CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT tenant_id
    FROM user_roles
    WHERE user_id = auth.uid() AND is_active = TRUE
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Enable RLS and create policies for accounting tables
ALTER TABLE accounting_bank_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON accounting_bank_transactions;
CREATE POLICY tenant_isolation ON accounting_bank_transactions
  FOR ALL USING (tenant_id = get_current_tenant_id());

ALTER TABLE accounting_facturas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON accounting_facturas;
CREATE POLICY tenant_isolation ON accounting_facturas
  FOR ALL USING (tenant_id = get_current_tenant_id());

ALTER TABLE accounting_cash_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON accounting_cash_log;
CREATE POLICY tenant_isolation ON accounting_cash_log
  FOR ALL USING (tenant_id = get_current_tenant_id());

ALTER TABLE accounting_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON accounting_categories;
CREATE POLICY tenant_isolation ON accounting_categories
  FOR ALL USING (tenant_id = get_current_tenant_id());

ALTER TABLE accounting_bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON accounting_bank_accounts;
CREATE POLICY tenant_isolation ON accounting_bank_accounts
  FOR ALL USING (tenant_id = get_current_tenant_id());

ALTER TABLE accounting_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON accounting_notifications;
CREATE POLICY tenant_isolation ON accounting_notifications
  FOR ALL USING (tenant_id = get_current_tenant_id());

-- RLS for CMS tables
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON cases;
CREATE POLICY tenant_isolation ON cases
  FOR ALL USING (tenant_id = get_current_tenant_id());

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON clients;
CREATE POLICY tenant_isolation ON clients
  FOR ALL USING (tenant_id = get_current_tenant_id());

ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON lots;
CREATE POLICY tenant_isolation ON lots
  FOR ALL USING (tenant_id = get_current_tenant_id());

ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON brokers;
CREATE POLICY tenant_isolation ON brokers
  FOR ALL USING (tenant_id = get_current_tenant_id());

ALTER TABLE payment_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON payment_schedule;
CREATE POLICY tenant_isolation ON payment_schedule
  FOR ALL USING (tenant_id = get_current_tenant_id());

ALTER TABLE cms_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON cms_payments;
CREATE POLICY tenant_isolation ON cms_payments
  FOR ALL USING (tenant_id = get_current_tenant_id());

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON approvals;
CREATE POLICY tenant_isolation ON approvals
  FOR ALL USING (tenant_id = get_current_tenant_id());

-- RLS for tenants and user_roles
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON tenants;
CREATE POLICY tenant_select ON tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE)
  );

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_roles_select ON user_roles;
CREATE POLICY user_roles_select ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- 9. Seed existing admin users into user_roles
DO $$
DECLARE
  mana_id UUID;
BEGIN
  SELECT id INTO mana_id FROM tenants WHERE slug = 'mana88';

  INSERT INTO user_roles (user_id, tenant_id, role, app_access, is_active)
  SELECT
    p.id,
    mana_id,
    COALESCE(p.role, 'viewer'),
    '["accounting","cms","investors"]'::jsonb,
    TRUE
  FROM profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id AND ur.tenant_id = mana_id
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 10. Updated_at trigger for tenants
CREATE OR REPLACE FUNCTION update_tenant_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tenant_updated_at ON tenants;
CREATE TRIGGER trigger_update_tenant_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_updated_at();
