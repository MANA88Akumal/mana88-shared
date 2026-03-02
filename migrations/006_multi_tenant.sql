-- ============================================================
-- MANA 88 Multi-Tenant Migration
-- Handles pre-existing user_roles table with different schema
-- Safe to re-run — fully idempotent
-- ============================================================

-- =============================================
-- PART 1: tenants table
-- =============================================

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

INSERT INTO tenants (slug, name, domain, logo_url) VALUES (
  'mana88', 'MANA 88 Akumal', 'manaakumal.com',
  'https://manaakumal.com/wp-content/uploads/2025/06/logo-white-simple.png'
) ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- PART 2: Fix existing user_roles table
-- It already exists with (id int, user_id, role, created_at)
-- We need to add: tenant_id, app_access, is_active, granted_by
-- =============================================

DO $$
BEGIN
  -- Add tenant_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_roles' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added tenant_id to user_roles';
  END IF;

  -- Add app_access if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_roles' AND column_name='app_access'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN app_access JSONB DEFAULT '[]';
    RAISE NOTICE 'Added app_access to user_roles';
  END IF;

  -- Add is_active if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_roles' AND column_name='is_active'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    RAISE NOTICE 'Added is_active to user_roles';
  END IF;

  -- Add granted_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_roles' AND column_name='granted_by'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN granted_by UUID REFERENCES auth.users(id);
    RAISE NOTICE 'Added granted_by to user_roles';
  END IF;
END $$;

-- Backfill user_roles.tenant_id for existing rows
DO $$
DECLARE
  mana_id UUID;
BEGIN
  SELECT id INTO mana_id FROM tenants WHERE slug = 'mana88';
  IF mana_id IS NOT NULL THEN
    UPDATE user_roles SET tenant_id = mana_id WHERE tenant_id IS NULL;
    UPDATE user_roles SET app_access = '["accounting","cms","investors"]'::jsonb WHERE app_access = '[]'::jsonb OR app_access IS NULL;
    UPDATE user_roles SET is_active = TRUE WHERE is_active IS NULL;
  END IF;
END $$;

-- Now safe to set NOT NULL and add unique constraint
DO $$
DECLARE
  null_count INT;
BEGIN
  SELECT count(*) INTO null_count FROM user_roles WHERE tenant_id IS NULL;
  IF null_count = 0 THEN
    ALTER TABLE user_roles ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- Add unique constraint if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_roles'::regclass AND contype = 'u'
      AND conname = 'user_roles_user_id_tenant_id_key'
  ) THEN
    BEGIN
      ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_tenant_id_key UNIQUE(user_id, tenant_id);
    EXCEPTION WHEN duplicate_table THEN NULL;
    END;
  END IF;
END $$;

-- =============================================
-- PART 3: Create missing utility tables
-- =============================================

CREATE TABLE IF NOT EXISTS accounting_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type VARCHAR(50) DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT,
  type VARCHAR(50) DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting_planning_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100) NOT NULL,
  description TEXT,
  amount NUMERIC(14,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'MXN',
  frequency VARCHAR(20) DEFAULT 'monthly',
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting_planning_tranches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  expected_date DATE,
  status VARCHAR(50) DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PART 4: Add tenant_id to all business tables
-- Uses dynamic SQL — checks table + column existence first
-- =============================================

DO $$
DECLARE
  tbl TEXT;
  tables_to_alter TEXT[] := ARRAY[
    'accounting_bank_transactions',
    'accounting_facturas',
    'accounting_cash_log',
    'accounting_categories',
    'accounting_bank_accounts',
    'accounting_notifications',
    'accounting_bank_statements',
    'accounting_bank_balances',
    'accounting_factura_conceptos',
    'accounting_factura_batches',
    'accounting_chart_of_accounts',
    'accounting_vendors',
    'accounting_planning_expenses',
    'accounting_planning_tranches',
    'cases',
    'clients',
    'lots',
    'brokers',
    'payment_schedule',
    'cms_payments',
    'approvals',
    'cms_audit_log',
    'cms_notifications',
    'offers',
    'offer_notes',
    'documents',
    'profiles',
    'project_settings',
    'cap_table',
    'investment_tranches',
    'monthly_revenue',
    'costs',
    'saved_scenarios',
    'scenario_projections',
    'scenario_financing_mix',
    'scenario_config',
    'pricing_phases',
    'financing_plans',
    'scenarios'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_alter LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN tenant_id UUID REFERENCES tenants(id)', tbl);
      RAISE NOTICE 'Added tenant_id to %', tbl;
    END IF;
  END LOOP;
END $$;

-- =============================================
-- PART 5: Backfill all existing rows to MANA 88
-- =============================================

DO $$
DECLARE
  mana_id UUID;
  tbl TEXT;
  row_count INT;
  tables_to_backfill TEXT[] := ARRAY[
    'accounting_bank_transactions',
    'accounting_facturas',
    'accounting_cash_log',
    'accounting_categories',
    'accounting_bank_accounts',
    'accounting_notifications',
    'accounting_bank_statements',
    'accounting_bank_balances',
    'accounting_factura_conceptos',
    'accounting_factura_batches',
    'accounting_chart_of_accounts',
    'accounting_vendors',
    'accounting_planning_expenses',
    'accounting_planning_tranches',
    'cases',
    'clients',
    'lots',
    'brokers',
    'payment_schedule',
    'cms_payments',
    'approvals',
    'cms_audit_log',
    'cms_notifications',
    'offers',
    'offer_notes',
    'documents',
    'profiles',
    'project_settings',
    'cap_table',
    'investment_tranches',
    'monthly_revenue',
    'costs',
    'saved_scenarios',
    'scenario_projections',
    'scenario_financing_mix',
    'scenario_config',
    'pricing_phases',
    'financing_plans',
    'scenarios'
  ];
BEGIN
  SELECT id INTO mana_id FROM tenants WHERE slug = 'mana88';
  IF mana_id IS NULL THEN
    RAISE EXCEPTION 'MANA 88 tenant not found';
  END IF;

  FOREACH tbl IN ARRAY tables_to_backfill LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format('UPDATE %I SET tenant_id = $1 WHERE tenant_id IS NULL', tbl) USING mana_id;
      GET DIAGNOSTICS row_count = ROW_COUNT;
      IF row_count > 0 THEN
        RAISE NOTICE 'Backfilled % rows in %', row_count, tbl;
      END IF;
    END IF;
  END LOOP;
END $$;

-- =============================================
-- PART 6: Set NOT NULL (only where safe)
-- =============================================

DO $$
DECLARE
  tbl TEXT;
  null_count INT;
  tables_to_constrain TEXT[] := ARRAY[
    'accounting_bank_transactions',
    'accounting_facturas',
    'accounting_cash_log',
    'accounting_categories',
    'accounting_bank_accounts',
    'accounting_notifications',
    'cases',
    'clients',
    'lots',
    'brokers',
    'payment_schedule',
    'cms_payments',
    'approvals'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_constrain LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format('SELECT count(*) FROM %I WHERE tenant_id IS NULL', tbl) INTO null_count;
      IF null_count = 0 THEN
        EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', tbl);
        RAISE NOTICE 'Set NOT NULL on %.tenant_id', tbl;
      ELSE
        RAISE NOTICE 'WARNING: % has % NULL tenant_id rows — skipping NOT NULL', tbl, null_count;
      END IF;
    END IF;
  END LOOP;
END $$;

-- =============================================
-- PART 7: Indexes (all dynamic SQL)
-- =============================================

DO $$
DECLARE
  tbl TEXT;
  idx_name TEXT;
  tables_to_index TEXT[] := ARRAY[
    'accounting_bank_transactions',
    'accounting_facturas',
    'accounting_cash_log',
    'cases',
    'clients',
    'lots',
    'brokers',
    'payment_schedule',
    'cms_payments',
    'approvals'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_index LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id'
    ) THEN
      idx_name := 'idx_' || tbl || '_tenant';
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = idx_name) THEN
        EXECUTE format('CREATE INDEX %I ON %I(tenant_id)', idx_name, tbl);
        RAISE NOTICE 'Created index %', idx_name;
      END IF;
    END IF;
  END LOOP;

  -- user_roles indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_roles_user') THEN
    CREATE INDEX idx_user_roles_user ON user_roles(user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_roles_tenant') THEN
    CREATE INDEX idx_user_roles_tenant ON user_roles(tenant_id);
  END IF;
END $$;

-- =============================================
-- PART 8: RLS helper function
-- =============================================

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

-- =============================================
-- PART 9: RLS policies (all dynamic SQL)
-- =============================================

DO $$
DECLARE
  tbl TEXT;
  tables_for_rls TEXT[] := ARRAY[
    'accounting_bank_transactions',
    'accounting_facturas',
    'accounting_cash_log',
    'accounting_categories',
    'accounting_bank_accounts',
    'accounting_notifications',
    'cases',
    'clients',
    'lots',
    'brokers',
    'payment_schedule',
    'cms_payments',
    'approvals'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_for_rls LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I FOR ALL USING (tenant_id = get_current_tenant_id())',
        tbl
      );
      RAISE NOTICE 'RLS enabled on %', tbl;
    END IF;
  END LOOP;
END $$;

-- RLS for tenants (uses dynamic SQL to reference user_roles.tenant_id safely)
DO $$
BEGIN
  ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_select ON tenants;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_roles' AND column_name='tenant_id'
  ) THEN
    CREATE POLICY tenant_select ON tenants
      FOR SELECT USING (
        id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE)
      );
    RAISE NOTICE 'RLS policy created on tenants';
  ELSE
    -- Fallback: allow all reads until user_roles has tenant_id
    CREATE POLICY tenant_select ON tenants FOR SELECT USING (true);
    RAISE NOTICE 'WARNING: user_roles missing tenant_id, using permissive tenants policy';
  END IF;
END $$;

-- RLS for user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_roles_select ON user_roles;
CREATE POLICY user_roles_select ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- =============================================
-- PART 10: Seed user_roles from profiles
-- =============================================

DO $$
DECLARE
  mana_id UUID;
  seeded_count INT;
BEGIN
  SELECT id INTO mana_id FROM tenants WHERE slug = 'mana88';

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_roles' AND column_name='tenant_id'
  ) THEN
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
    )
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS seeded_count = ROW_COUNT;
    RAISE NOTICE 'Seeded % users from profiles into user_roles', seeded_count;
  END IF;
END $$;

-- =============================================
-- PART 11: Updated_at trigger
-- =============================================

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

-- =============================================
-- VERIFY
-- =============================================
SELECT 'Migration complete' AS status,
       (SELECT count(*) FROM tenants) AS tenants,
       (SELECT count(*) FROM user_roles) AS user_roles,
       (SELECT count(*) FROM information_schema.columns
        WHERE table_schema='public' AND column_name='tenant_id') AS tables_with_tenant_id;
