-- ============================================================
-- Migration 011: AI Dialogue Layer
-- Adds developer_response, ai_followup, response_at columns
-- to project_findings for the conversational AI feature.
-- ============================================================

-- Add developer_response column
ALTER TABLE project_findings
  ADD COLUMN IF NOT EXISTS developer_response TEXT;

-- Add AI follow-up column
ALTER TABLE project_findings
  ADD COLUMN IF NOT EXISTS ai_followup TEXT;

-- Add response timestamp
ALTER TABLE project_findings
  ADD COLUMN IF NOT EXISTS response_at TIMESTAMPTZ;

SELECT 'Migration 011 complete — AI dialogue columns added' AS status;
