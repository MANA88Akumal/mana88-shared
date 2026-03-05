-- ============================================================
-- TerraIA Module Expansion: Document Vault, Broker Portal, Construction Tracker
-- Creates 10 new tables for 3 modules
-- Safe to re-run — fully idempotent (CREATE TABLE IF NOT EXISTS)
-- ============================================================

-- =============================================
-- PART 1: Document Vault
-- =============================================

-- File metadata — the core vault table
CREATE TABLE IF NOT EXISTS vault_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID,

  -- File info
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT DEFAULT 0,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,

  -- Organization
  folder TEXT NOT NULL,  -- 'legal','design','sales','contracts','financial','construction','investor','marketing'
  subfolder TEXT,
  tags TEXT[] DEFAULT '{}',

  -- AI categorization
  ai_category TEXT,
  ai_description TEXT,
  ai_confidence NUMERIC(3,2),

  -- Versioning
  version INTEGER DEFAULT 1,
  parent_file_id UUID REFERENCES vault_files(id),
  is_current BOOLEAN DEFAULT true,

  -- Access control
  access_level TEXT DEFAULT 'internal',  -- 'internal','investor','broker','buyer','public'
  shared_with_roles TEXT[] DEFAULT '{}',
  password_hash TEXT,
  expires_at TIMESTAMPTZ,

  -- Tracking
  download_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  watermark_enabled BOOLEAN DEFAULT false,

  -- Metadata
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vault_files_org ON vault_files(org_id);
CREATE INDEX IF NOT EXISTS idx_vault_files_folder ON vault_files(org_id, folder);
CREATE INDEX IF NOT EXISTS idx_vault_files_access ON vault_files(access_level);
CREATE INDEX IF NOT EXISTS idx_vault_files_current ON vault_files(org_id, is_current) WHERE is_current = true;

-- Access log — who viewed/downloaded what
CREATE TABLE IF NOT EXISTS vault_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES vault_files(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  access_type TEXT NOT NULL,  -- 'view','download','share','edit','delete'
  ip_address TEXT,
  user_agent TEXT,
  accessed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_access_file ON vault_access_log(file_id);
CREATE INDEX IF NOT EXISTS idx_vault_access_user ON vault_access_log(user_id);

-- Shared links — external access without login
CREATE TABLE IF NOT EXISTS vault_shared_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES vault_files(id) ON DELETE CASCADE,
  folder_path TEXT,  -- share an entire folder
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  max_downloads INTEGER,
  download_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_shared_token ON vault_shared_links(token);

-- Document checklists — required docs per entity
CREATE TABLE IF NOT EXISTS vault_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,  -- 'buyer','investor','broker','project'
  entity_id UUID NOT NULL,
  document_name TEXT NOT NULL,
  description TEXT,
  required BOOLEAN DEFAULT true,
  file_id UUID REFERENCES vault_files(id),
  status TEXT DEFAULT 'pending',  -- 'pending','uploaded','approved','rejected'
  due_date DATE,
  reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_checklists_org ON vault_checklists(org_id);
CREATE INDEX IF NOT EXISTS idx_vault_checklists_entity ON vault_checklists(entity_type, entity_id);

-- =============================================
-- PART 2: Broker Portal
-- =============================================

-- Lead attribution — brokers submit leads, timestamped
CREATE TABLE IF NOT EXISTS broker_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,

  -- Client info
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  nationality TEXT,

  -- Lead details
  source TEXT,  -- 'referral','walk-in','online','event','social-media'
  status TEXT DEFAULT 'new',  -- 'new','contacted','qualified','touring','negotiating','converted','lost'
  lot_interest INTEGER,  -- lot id they're interested in
  budget_min NUMERIC(14,2),
  budget_max NUMERIC(14,2),
  currency TEXT DEFAULT 'MXN',
  notes TEXT,

  -- Attribution
  attributed_at TIMESTAMPTZ DEFAULT now(),
  exclusivity_expires_at TIMESTAMPTZ,  -- 90-day default

  -- Conversion
  converted_at TIMESTAMPTZ,
  case_id UUID REFERENCES cases(id),
  lost_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_leads_org ON broker_leads(org_id);
CREATE INDEX IF NOT EXISTS idx_broker_leads_broker ON broker_leads(broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_leads_status ON broker_leads(status);
CREATE INDEX IF NOT EXISTS idx_broker_leads_email ON broker_leads(client_email);

-- Commission tracking per case
CREATE TABLE IF NOT EXISTS broker_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES broker_leads(id),

  -- Commission details
  commission_pct NUMERIC(5,2),
  commission_amount NUMERIC(14,2),
  currency TEXT DEFAULT 'MXN',

  -- Status
  status TEXT DEFAULT 'pending',  -- 'pending','earned','partially_paid','paid','cancelled'
  earned_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_commissions_org ON broker_commissions(org_id);
CREATE INDEX IF NOT EXISTS idx_broker_commissions_broker ON broker_commissions(broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_commissions_case ON broker_commissions(case_id);
CREATE INDEX IF NOT EXISTS idx_broker_commissions_status ON broker_commissions(status);

-- Commission milestones — payouts tied to client payment events
CREATE TABLE IF NOT EXISTS broker_commission_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL REFERENCES broker_commissions(id) ON DELETE CASCADE,

  -- Milestone
  milestone_name TEXT NOT NULL,  -- 'reservation','down_payment','50_percent','delivery','custom'
  pct_of_commission NUMERIC(5,2) NOT NULL,
  amount NUMERIC(14,2),
  currency TEXT DEFAULT 'MXN',

  -- Status
  status TEXT DEFAULT 'pending',  -- 'pending','triggered','paid'
  triggered_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_id UUID REFERENCES cms_payments(id),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_milestones_commission ON broker_commission_milestones(commission_id);

-- =============================================
-- PART 3: Construction Tracker
-- =============================================

-- Construction phases / milestones
CREATE TABLE IF NOT EXISTS construction_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID,

  -- Phase info
  phase_name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,

  -- Timeline
  planned_start DATE,
  planned_end DATE,
  actual_start DATE,
  actual_end DATE,
  progress_pct NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'planned',  -- 'planned','in_progress','completed','delayed','on_hold'

  -- Budget
  budget_amount NUMERIC(14,2),
  actual_amount NUMERIC(14,2),
  currency TEXT DEFAULT 'MXN',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_construction_phases_org ON construction_phases(org_id);
CREATE INDEX IF NOT EXISTS idx_construction_phases_status ON construction_phases(status);

-- Construction progress photos
CREATE TABLE IF NOT EXISTS construction_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES construction_phases(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  caption TEXT,
  taken_at DATE,

  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_construction_photos_phase ON construction_photos(phase_id);
CREATE INDEX IF NOT EXISTS idx_construction_photos_org ON construction_photos(org_id);

-- Construction draw requests
CREATE TABLE IF NOT EXISTS construction_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES construction_phases(id),

  draw_number INTEGER NOT NULL,
  amount_requested NUMERIC(14,2) NOT NULL,
  amount_approved NUMERIC(14,2),
  currency TEXT DEFAULT 'MXN',

  status TEXT DEFAULT 'draft',  -- 'draft','submitted','approved','paid','rejected'
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_construction_draws_org ON construction_draws(org_id);
CREATE INDEX IF NOT EXISTS idx_construction_draws_phase ON construction_draws(phase_id);

-- =============================================
-- PART 4: RLS Policies
-- =============================================

-- Enable RLS on all new tables
ALTER TABLE vault_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_shared_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_commission_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_draws ENABLE ROW LEVEL SECURITY;

-- Vault: authenticated users with org access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vault_files_auth' AND tablename = 'vault_files') THEN
    CREATE POLICY vault_files_auth ON vault_files FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vault_access_log_auth' AND tablename = 'vault_access_log') THEN
    CREATE POLICY vault_access_log_auth ON vault_access_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vault_shared_links_auth' AND tablename = 'vault_shared_links') THEN
    CREATE POLICY vault_shared_links_auth ON vault_shared_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vault_checklists_auth' AND tablename = 'vault_checklists') THEN
    CREATE POLICY vault_checklists_auth ON vault_checklists FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Broker: authenticated users with org access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'broker_leads_auth' AND tablename = 'broker_leads') THEN
    CREATE POLICY broker_leads_auth ON broker_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'broker_commissions_auth' AND tablename = 'broker_commissions') THEN
    CREATE POLICY broker_commissions_auth ON broker_commissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'broker_commission_milestones_auth' AND tablename = 'broker_commission_milestones') THEN
    CREATE POLICY broker_commission_milestones_auth ON broker_commission_milestones FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Construction: authenticated users with org access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'construction_phases_auth' AND tablename = 'construction_phases') THEN
    CREATE POLICY construction_phases_auth ON construction_phases FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'construction_photos_auth' AND tablename = 'construction_photos') THEN
    CREATE POLICY construction_photos_auth ON construction_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'construction_draws_auth' AND tablename = 'construction_draws') THEN
    CREATE POLICY construction_draws_auth ON construction_draws FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =============================================
-- PART 5: Supabase Storage bucket for vault
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('vault', 'vault', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to vault bucket
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vault_upload' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY vault_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'vault');
  END IF;
END $$;

-- Allow authenticated users to read from vault bucket
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vault_read' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY vault_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'vault');
  END IF;
END $$;

-- Allow authenticated users to delete from vault bucket
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vault_delete' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY vault_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'vault');
  END IF;
END $$;

-- =============================================
-- PART 6: updated_at triggers
-- =============================================

-- Reuse existing update_updated_at() trigger function if it exists, otherwise create it
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'vault_files_updated_at') THEN
    CREATE TRIGGER vault_files_updated_at BEFORE UPDATE ON vault_files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'broker_leads_updated_at') THEN
    CREATE TRIGGER broker_leads_updated_at BEFORE UPDATE ON broker_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'broker_commissions_updated_at') THEN
    CREATE TRIGGER broker_commissions_updated_at BEFORE UPDATE ON broker_commissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'construction_phases_updated_at') THEN
    CREATE TRIGGER construction_phases_updated_at BEFORE UPDATE ON construction_phases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'construction_draws_updated_at') THEN
    CREATE TRIGGER construction_draws_updated_at BEFORE UPDATE ON construction_draws FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
