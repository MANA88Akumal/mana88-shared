-- ============================================================
-- Grant permissions for AI engine tables
-- Tables already exist (created by user), just need GRANTs + RLS
-- ============================================================

-- Grant permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON project_findings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON analysis_runs TO authenticated;
GRANT SELECT ON benchmark_store TO authenticated;

-- Ensure RLS policies exist (tables were created with RLS enabled)
-- project_findings: org_id based isolation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'project_findings' AND policyname = 'tenant_isolation'
  ) THEN
    DROP POLICY IF EXISTS "org_isolation" ON project_findings;
    CREATE POLICY tenant_isolation ON project_findings FOR ALL
      USING (org_id = (SELECT org_id FROM organization_members WHERE user_id = auth.uid() LIMIT 1));
  END IF;
END $$;

-- analysis_runs: org_id based isolation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'analysis_runs' AND policyname = 'tenant_isolation'
  ) THEN
    DROP POLICY IF EXISTS "org_isolation" ON analysis_runs;
    CREATE POLICY tenant_isolation ON analysis_runs FOR ALL
      USING (org_id = (SELECT org_id FROM organization_members WHERE user_id = auth.uid() LIMIT 1));
  END IF;
END $$;

SELECT 'Migration 009 complete — AI engine permissions granted' AS status;
