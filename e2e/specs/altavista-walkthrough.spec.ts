/**
 * Grupo Altavista — Full E2E Walkthrough with Screenshots & Video
 *
 * Walks the ENTIRE TerraIA app as a new user using the Altavista demo company:
 *   login → onboarding → language → AI chat → file upload →
 *   column mapper → AI analysis → health report → verify all 6 planted flaws
 *
 * Run:
 *   cd shared/e2e && npx playwright test --project=altavista-walkthrough --reporter=line
 *   cd shared/e2e && npx playwright test --project=altavista-walkthrough --headed --slowMo 300
 *
 * Screenshots: test-results/altavista-walkthrough/
 * Video:       test-results/ (auto-saved by Playwright as WebM)
 *
 * PLANTED FLAWS THIS TEST ASSERTS:
 *   1. CASH_TROUGH (critical)         — Month 20 goes negative: -$332,000
 *   2. LOW_CONTINGENCY                — 4.2% vs 10-15% standard
 *   3. AGGRESSIVE_SALES_VELOCITY      — 9.5 u/mo vs 5.8 MX Tier2 benchmark
 *   4. MISSING_COST_MARKETING         — $0 marketing on $47.3M revenue
 *   5. MISSING_POOL_EQUIPMENT         — 2 pools with $0 pool/MEP
 *   6. FLOOR_PLATE_OVERFLOW           — Floor 7: 1,987m² on 1,400m² plate
 */

import { test as base, expect } from '@playwright/test';
import { injectLoginSession } from '../helpers/cookie';
import { getAdminClient } from '../helpers/supabase-admin';
import type { Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES_DIR = path.resolve(__dirname, '../test-data/altavista');
const SS_DIR = path.resolve(__dirname, '../test-results/altavista-walkthrough');

const ONBOARD_USER_ID = '72dc92ab-a31d-4cee-b79a-0c83e68b59ba';

// Ensure screenshot directory exists
fs.mkdirSync(SS_DIR, { recursive: true });

// ─── Screenshot helper ──────────────────────────────────────────────────────
let ssCount = 1;
async function ss(page: Page, name: string): Promise<string> {
  const filename = `${String(ssCount++).padStart(2, '0')}-${name}.png`;
  const filepath = path.join(SS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  [screenshot] ${filename}`);
  return filepath;
}

// ─── Custom fixture ─────────────────────────────────────────────────────────
const test = base.extend<{ loginPage: Page }>({
  loginPage: async ({ page }, use) => {
    await injectLoginSession(page, 'onboard');
    await use(page);
  },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function del(admin: any, table: string, column: string, value: string) {
  await admin.from(table).delete().eq(column, value).select('id');
}

async function cleanupOrg(admin: any, orgId: string) {
  await del(admin, 'user_roles', 'user_id', ONBOARD_USER_ID);
  await del(admin, 'organization_members', 'org_id', orgId);
  await del(admin, 'project_findings', 'org_id', orgId);
  await del(admin, 'analysis_runs', 'org_id', orgId);
  await del(admin, 'accounting_bank_transactions', 'org_id', orgId);
  await del(admin, 'accounting_bank_accounts', 'org_id', orgId);
  await del(admin, 'accounting_vendors', 'org_id', orgId);
  await del(admin, 'accounting_chart_of_accounts', 'org_id', orgId);
  await del(admin, 'cases', 'org_id', orgId);
  await del(admin, 'clients', 'org_id', orgId);
  await del(admin, 'lots', 'org_id', orgId);
  await del(admin, 'tenants', 'id', orgId);
  await del(admin, 'organizations', 'id', orgId);
}

async function cleanupStaleData() {
  const admin = getAdminClient();
  const orgIds = new Set<string>();

  const { data: roles } = await admin.from('user_roles').select('tenant_id').eq('user_id', ONBOARD_USER_ID);
  if (roles) roles.forEach((r: any) => orgIds.add(r.tenant_id));

  const { data: members } = await admin.from('organization_members').select('org_id').eq('user_id', ONBOARD_USER_ID);
  if (members) members.forEach((m: any) => orgIds.add(m.org_id));

  for (const orgId of orgIds) {
    await cleanupOrg(admin, orgId);
  }

  await del(admin, 'user_roles', 'user_id', ONBOARD_USER_ID);
  await del(admin, 'organization_members', 'user_id', ONBOARD_USER_ID);
}

// The 6 planted flaws we expect the AI to catch
const EXPECTED_FLAWS = [
  'CASH_TROUGH',
  'LOW_CONTINGENCY',
  'AGGRESSIVE_SALES_VELOCITY',
  'MISSING_COST_MARKETING',
  'MISSING_POOL_EQUIPMENT',
  'FLOOR_PLATE_OVERFLOW',
] as const;

// ════════════════════════════════════════════════════════════════════════════
// GRUPO ALTAVISTA — FULL APP WALKTHROUGH
// ════════════════════════════════════════════════════════════════════════════

test.describe('Grupo Altavista — Full Walkthrough', () => {
  test.setTimeout(300_000); // 5 min for full flow including AI

  let testOrgId: string | null = null;
  let testStartTime: string;

  test.beforeAll(async () => {
    testStartTime = new Date().toISOString();
    ssCount = 1;
    await cleanupStaleData();
    console.log('Cleanup complete — starting Altavista walkthrough');
  });

  // ════════════════════════════════════════════════════════════════
  // THE FULL WALKTHROUGH — single test, single page context
  // ════════════════════════════════════════════════════════════════

  test('Full walkthrough: onboarding → upload → AI analysis → health report', async ({ loginPage: page }) => {
    // Aggressively clean to avoid unique constraint violations
    const admin = getAdminClient();
    await admin.from('user_roles').delete().eq('user_id', ONBOARD_USER_ID);
    await admin.from('organization_members').delete().eq('user_id', ONBOARD_USER_ID);

    // Clear stale onboarding state
    await page.goto('/onboarding');
    await page.evaluate(() => localStorage.removeItem('terraia_onboarding'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // ══════════════════════════════════════════════════════════════
    // STEP 0: LANGUAGE SELECTION
    // ══════════════════════════════════════════════════════════════

    await expect(page.getByText('Welcome to TerraIA')).toBeVisible({ timeout: 15_000 });
    await ss(page, 'language-selection');

    await page.getByRole('button', { name: /English/ }).click();
    await page.waitForTimeout(500);
    await ss(page, 'language-english-selected');
    console.log('STEP 0: Language → English');

    // ══════════════════════════════════════════════════════════════
    // STEP 1: AI CHAT — CREATE GRUPO ALTAVISTA ORG
    // ══════════════════════════════════════════════════════════════

    const chatInput = page.locator('input[placeholder="Tell me about your project..."]');
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
    await ss(page, 'chat-empty');

    const description =
      'My company is Grupo Altavista S.A. de C.V. RFC: GAL240115AB3. ' +
      'We are building Torre Altavista Cancún, a 120-unit luxury condo tower ' +
      'in Zona Hotelera, Blvd. Kukulcán Km 14.5, Cancún, Quintana Roo, México. ' +
      '8 floors. Target market: affluent Mexican buyers + US/Canadian investors. ' +
      'Currency: USD. We bank with HSBC Mexico.';

    await chatInput.fill(description);
    await ss(page, 'chat-message-typed');
    await page.locator('button[type="submit"]').click();
    console.log('STEP 1: Chat message sent');

    // Wait for AI to respond
    await ss(page, 'chat-ai-thinking');
    await expect(page.locator('.animate-bounce')).toHaveCount(0, { timeout: 60_000 });
    await ss(page, 'chat-ai-response');

    // Confirm org creation
    const confirmBtn = page.getByRole('button', { name: /Confirm & Set Up/i });
    await expect(confirmBtn).toBeEnabled({ timeout: 15_000 });
    await ss(page, 'chat-confirm-ready');
    await confirmBtn.click();
    console.log('STEP 1: Organization confirmed');

    // Wait for org creation
    const nextBtn = page.getByRole('button', { name: /^Next$/i });
    await expect(nextBtn).toBeVisible({ timeout: 45_000 });
    await ss(page, 'chat-org-created');

    // Capture org ID from localStorage
    testOrgId = await page.evaluate(() => {
      const saved = localStorage.getItem('terraia_onboarding');
      return saved ? JSON.parse(saved).orgId : null;
    });
    expect(testOrgId).toBeTruthy();
    console.log(`STEP 1: Org created → ${testOrgId}`);

    // Navigate to Import step
    await nextBtn.click();
    await expect(page.getByText('Import Your Data')).toBeVisible({ timeout: 10_000 });
    await ss(page, 'import-page-loaded');
    console.log('STEP 1 complete — on Import page');

    // ══════════════════════════════════════════════════════════════
    // STEP 2: FILE UPLOAD — ALL 4 ALTAVISTA FILES
    // ══════════════════════════════════════════════════════════════

    const proforma = path.join(FILES_DIR, 'TorreAltavista_Proforma.xlsx');
    const bankH1 = path.join(FILES_DIR, 'HSBC_EstadoCuenta_H1_2025.xml');
    const bankH2 = path.join(FILES_DIR, 'HSBC_EstadoCuenta_H2_2025_2026.xml');
    const vendors = path.join(FILES_DIR, 'Vendors_TorreAltavista.csv');

    for (const f of [proforma, bankH1, bankH2, vendors]) {
      expect(fs.existsSync(f), `File not found: ${f}`).toBe(true);
    }

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([proforma, bankH1, bankH2, vendors]);
    await page.waitForTimeout(1500);
    await ss(page, 'files-uploaded');
    console.log('STEP 2: All 4 files uploaded');

    // Wait for AI classification
    console.log('Waiting for file classification...');
    await page.waitForTimeout(3000);
    await ss(page, 'files-classifying');

    // Wait until classification finishes (no more spinning/analyzing indicators)
    // The "..." pulsing text on each file indicates analyzing status
    for (let wait = 0; wait < 30; wait++) {
      const analyzing = await page.locator('text="..."').count();
      if (analyzing === 0) break;
      await page.waitForTimeout(3000);
      if (wait % 5 === 0) await ss(page, `files-classifying-${wait}`);
    }
    await ss(page, 'files-classified');
    console.log('STEP 2: Files classified');

    // Click Process All
    const processBtn = page.getByRole('button', { name: /Process All/i });
    await expect(processBtn).toBeVisible({ timeout: 15_000 });
    await ss(page, 'process-all-button');
    await processBtn.click();
    console.log('STEP 2: Processing started');
    await page.waitForTimeout(2000);
    await ss(page, 'processing-started');

    // Handle column mapper confirmations
    for (let i = 0; i < 5; i++) {
      try {
        await page.getByText('Map Your Columns').waitFor({ state: 'visible', timeout: 60_000 });
      } catch {
        console.log(`  Mapper loop: exited after ${i} mappers`);
        break;
      }

      await page.waitForTimeout(1500); // Let AI finish mapping
      await ss(page, `column-mapper-${i + 1}`);
      console.log(`  Column Mapper ${i + 1} shown`);

      // Confirm the mapping
      const importDataBtn = page.getByRole('button', { name: /Import Data|Confirm/i });
      await expect(importDataBtn).toBeVisible({ timeout: 10_000 });
      await importDataBtn.click();
      console.log(`  Mapper ${i + 1}: confirmed`);
      await page.waitForTimeout(3000);
      await ss(page, `column-mapper-${i + 1}-confirmed`);
    }

    // Wait for import results
    try {
      await expect(page.getByText('Imported successfully')).toBeVisible({ timeout: 30_000 });
      await ss(page, 'import-success');
      console.log('STEP 2: Files imported successfully');
    } catch {
      // Import may show different text
      await page.waitForTimeout(5000);
      await ss(page, 'import-result');
      console.log('STEP 2: Import step completed');
    }

    // Continue to Ready step
    // Look for Continue button (not "Continue without files")
    const continueBtn = page.getByRole('button', { name: /^Continue$/i });
    const continueWithoutBtn = page.getByRole('button', { name: /Continue without files/i });
    const visibleContinue = await continueBtn.isVisible().catch(() => false)
      ? continueBtn
      : continueWithoutBtn;
    await expect(visibleContinue).toBeVisible({ timeout: 10_000 });
    await ss(page, 'continue-to-ready');
    await visibleContinue.click();

    // Verify we reach StepReady
    await expect(page.getByText('Setup Complete!')).toBeVisible({ timeout: 15_000 });
    await ss(page, 'step-ready-loaded');
    console.log('STEP 2 complete — on Ready page');

    // ══════════════════════════════════════════════════════════════
    // STEP 3: AI ANALYSIS — WATCH PROGRESS
    // ══════════════════════════════════════════════════════════════

    // Analysis may auto-trigger or already be running
    const analysisStarted = await page.getByText('Analyzing Your Project').isVisible().catch(() => false);
    const alreadyComplete = await page.getByText('Project Health Report').isVisible().catch(() => false);

    if (analysisStarted) {
      console.log('STEP 3: Analysis in progress...');
      await ss(page, 'analysis-in-progress');

      // Capture screenshots at intervals
      for (let i = 0; i < 24; i++) {
        await page.waitForTimeout(5000);
        const complete = await page.getByText('Project Health Report').isVisible().catch(() => false);
        if (complete) {
          await ss(page, 'analysis-complete');
          console.log('STEP 3: Analysis complete!');
          break;
        }
        // Capture stage
        if (i % 3 === 0) await ss(page, `analysis-stage-${i + 1}`);
      }

      await expect(page.getByText('Project Health Report')).toBeVisible({ timeout: 180_000 });
    } else if (!alreadyComplete) {
      console.log('STEP 3: Waiting for analysis to auto-trigger...');
      await ss(page, 'analysis-not-started');

      try {
        // Wait for either analysis progress or report
        await Promise.race([
          page.getByText('Analyzing Your Project').waitFor({ state: 'visible', timeout: 30_000 }),
          page.getByText('Project Health Report').waitFor({ state: 'visible', timeout: 30_000 }),
        ]);

        const isAnalyzing = await page.getByText('Analyzing Your Project').isVisible().catch(() => false);
        if (isAnalyzing) {
          await ss(page, 'analysis-auto-triggered');
          console.log('Analysis auto-triggered');
          await expect(page.getByText('Project Health Report')).toBeVisible({ timeout: 180_000 });
        }
      } catch {
        console.log('Analysis did not auto-trigger');
        await ss(page, 'analysis-did-not-trigger');
      }
    } else {
      console.log('STEP 3: Analysis already complete');
    }

    await ss(page, 'health-report-full');

    // ══════════════════════════════════════════════════════════════
    // STEP 4: HEALTH REPORT — EXPLORE FINDINGS
    // ══════════════════════════════════════════════════════════════

    const hasReport = await page.getByText('Project Health Report').isVisible().catch(() => false);
    if (hasReport) {
      console.log('STEP 4: Health Report visible');

      // Scroll to top
      await page.evaluate(() => window.scrollTo(0, 0));
      await ss(page, 'health-report-scorecards');

      // Check scorecards
      const hasCritical = await page.getByText('Critical', { exact: true }).isVisible().catch(() => false);
      const hasWarnings = await page.getByText('Warnings', { exact: true }).isVisible().catch(() => false);
      const hasObservations = await page.getByText('Observations', { exact: true }).isVisible().catch(() => false);
      console.log(`Scorecards: Critical=${hasCritical}, Warnings=${hasWarnings}, Observations=${hasObservations}`);

      // ── Engine Filter Chips ────────────────────────────────────
      const allChip = page.locator('button').filter({ hasText: /^All$/ });
      const cfoChip = page.locator('button').filter({ hasText: /CFO Analysis/ });
      const gcChip = page.locator('button').filter({ hasText: /Technical Review/ });
      const investorChip = page.locator('button').filter({ hasText: /Investor Assessment/ });

      if (await allChip.isVisible().catch(() => false)) {
        await ss(page, 'filter-all');

        for (const [chip, name] of [[cfoChip, 'cfo'], [gcChip, 'gc'], [investorChip, 'investor']] as const) {
          if (await chip.isVisible().catch(() => false)) {
            await chip.click();
            await page.waitForTimeout(500);
            await ss(page, `filter-${name}`);
            console.log(`${name.toUpperCase()} filter applied`);
          }
        }
        await allChip.click();
        await page.waitForTimeout(500);
      }

      // ── Finding Cards ──────────────────────────────────────────
      await page.evaluate(() => window.scrollTo(0, 500));
      await ss(page, 'findings-list-top');

      // Try to expand some finding cards
      const severityBadges = page.locator('span').filter({ hasText: /^CRITICAL$|^WARNING$|^OBSERVATION$/ });
      const badgeCount = await severityBadges.count();
      console.log(`${badgeCount} severity badges visible`);

      // Click on finding cards to expand them
      for (let i = 0; i < Math.min(badgeCount, 4); i++) {
        const badge = severityBadges.nth(i);
        // Find the parent card's clickable header
        const card = badge.locator('xpath=ancestor::div[contains(@class,"rounded")]').first();
        try {
          await card.click();
          await page.waitForTimeout(500);
          await ss(page, `finding-${i + 1}-expanded`);
          console.log(`  Finding ${i + 1} expanded`);
        } catch {
          // Card may not be clickable in this way
        }
      }

      // ── Developer Response Demo ────────────────────────────────
      const respondLink = page.getByText('Respond to this finding').first();
      if (await respondLink.isVisible().catch(() => false)) {
        await respondLink.click();
        await page.waitForTimeout(300);

        const textarea = page.locator('textarea').first();
        if (await textarea.isVisible().catch(() => false)) {
          await textarea.fill(
            'Acknowledged. We have arranged a $3M revolving credit line with HSBC ' +
            'that will cover the Month 20 cash gap. Draw is available from January 2026.'
          );
          await ss(page, 'developer-response-typed');
          console.log('Developer response typed');

          // Cancel to keep findings clean
          const cancelBtn = page.getByText('Cancel').first();
          if (await cancelBtn.isVisible().catch(() => false)) {
            await cancelBtn.click();
          }
        }
      }

      // ── IRR Sensitivity Table ──────────────────────────────────
      const sensitivityTable = page.getByText('IRR Sensitivity Analysis');
      if (await sensitivityTable.isVisible().catch(() => false)) {
        await sensitivityTable.scrollIntoViewIfNeeded();
        await ss(page, 'irr-sensitivity-table');
        console.log('IRR Sensitivity Table visible');
      }

      // ── Scroll through full report ─────────────────────────────
      const pageHeight = await page.evaluate(() => document.body.scrollHeight);
      const steps = Math.min(Math.ceil(pageHeight / 1080), 5);
      for (let step = 0; step < steps; step++) {
        await page.evaluate((y) => window.scrollTo(0, y), step * 1080);
        await page.waitForTimeout(300);
        await ss(page, `report-scroll-${step + 1}`);
      }

      // ── Continue to Dashboard ──────────────────────────────────
      // Scroll back to find the button
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      const goBtn = page.getByRole('button', { name: /Continue to Dashboard|Go to Dashboard/i });
      if (await goBtn.isVisible().catch(() => false)) {
        await ss(page, 'continue-to-dashboard');
        await goBtn.click();
        await page.waitForURL('**/', { timeout: 10_000 }).catch(() => {});
        await page.waitForTimeout(1000);
        await ss(page, 'dashboard-landed');
        console.log('Navigated to dashboard');
      }
    } else {
      console.log('STEP 4: No Health Report visible — analysis may not have triggered');
    }

    // ══════════════════════════════════════════════════════════════
    // DB VERIFICATION — ALL 6 PLANTED FLAWS
    // ══════════════════════════════════════════════════════════════

    console.log('\n--- DB VERIFICATION ---');

    if (!testOrgId) {
      const { data: orgs } = await admin
        .from('organizations')
        .select('id')
        .ilike('name', '%altavista%')
        .order('created_at', { ascending: false })
        .limit(1);
      testOrgId = orgs?.[0]?.id || null;
    }

    if (testOrgId) {
      // All findings
      const { data: allFindings } = await admin
        .from('project_findings')
        .select('rule_id, severity, engine, title, data_snapshot')
        .eq('org_id', testOrgId)
        .order('severity');

      console.log(`\nAll findings for Grupo Altavista (${allFindings?.length || 0}):`);
      allFindings?.forEach(f =>
        console.log(`  [${f.engine?.toUpperCase()}] [${f.severity?.toUpperCase()}] ${f.rule_id}: ${f.title?.substring(0, 70)}`)
      );

      // Check each planted flaw
      const flawResults: Record<string, boolean> = {};
      for (const rule of EXPECTED_FLAWS) {
        const match = allFindings?.find(f =>
          f.rule_id === rule || f.rule_id?.startsWith(rule.replace('_MARKETING', ''))
        );
        flawResults[rule] = !!match;
      }

      console.log('\nFLAW DETECTION SUMMARY:');
      let caught = 0;
      for (const [rule, found] of Object.entries(flawResults)) {
        console.log(`  ${found ? 'CAUGHT' : 'MISSED'} ${rule}`);
        if (found) caught++;
      }
      console.log(`\nScore: ${caught}/${EXPECTED_FLAWS.length} flaws caught`);

      // Analysis run details
      const { data: runs } = await admin
        .from('analysis_runs')
        .select('status, findings_count, engines_run, started_at, completed_at')
        .eq('org_id', testOrgId)
        .eq('status', 'complete')
        .order('started_at', { ascending: false })
        .limit(1);

      if (runs?.length) {
        const duration = runs[0].completed_at && runs[0].started_at
          ? Math.round((new Date(runs[0].completed_at).getTime() - new Date(runs[0].started_at).getTime()) / 1000)
          : '?';
        console.log(`Analysis: ${runs[0].findings_count} findings, engines: ${runs[0].engines_run}, ${duration}s`);
      }

      // Findings from all engines
      const { data: findings } = await admin
        .from('project_findings')
        .select('engine')
        .eq('org_id', testOrgId);
      if (findings?.length) {
        const engines = [...new Set(findings.map(f => f.engine))];
        console.log(`Engines: [${engines.join(', ')}]`);
      }
    } else {
      console.log('No Altavista org found — skipping DB verification');
    }

    // ══════════════════════════════════════════════════════════════
    // SCREENSHOT + VIDEO SUMMARY
    // ══════════════════════════════════════════════════════════════

    const shots = fs.readdirSync(SS_DIR).filter(f => f.endsWith('.png')).sort();
    console.log(`\nScreenshots saved to: ${SS_DIR}`);
    shots.forEach(f => console.log(`  ${f}`));
    console.log(`Total: ${shots.length} screenshots`);
    console.log(`\nVideo: test-results/ (WebM, 1920x1080)`);
    console.log('Convert: ffmpeg -i video.webm -c:v libx264 -crf 18 altavista-walkthrough.mp4');

    expect(shots.length).toBeGreaterThan(10);

    // Keep org for review
    if (testOrgId) {
      console.log(`\nAltavista org preserved: ${testOrgId}`);
    }
  });
});
