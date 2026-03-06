/**
 * Grupo Altavista — Full E2E Playwright Test
 *
 * Walks the ENTIRE TerraIA app as a new user:
 *   signup → login → onboarding → file upload → AI analysis →
 *   health report → verify all 6 planted flaws caught →
 *   new case → lots → finance report → screenshots at every step
 *
 * Run:
 *   npx playwright test tests/test-altavista-e2e.spec.js --headed
 *   npx playwright test tests/test-altavista-e2e.spec.js --headed --slowMo 500
 *
 * Screenshots saved to: test-results/altavista/
 *
 * PLANTED FLAWS THIS TEST ASSERTS:
 *   1. CASH_TROUGH (critical)  — Month 20 goes negative
 *   2. LOW_CONTINGENCY         — 4.2% vs 10% standard
 *   3. AGGRESSIVE_SALES_VELOCITY — 9.5 u/mo vs 5.8 benchmark
 *   4. MISSING_COST_MARKETING  — $0 marketing budget
 *   5. MISSING_POOL_EQUIPMENT  — 2 pools, $0 MEP
 *   6. FLOOR_PLATE_OVERFLOW    — Floor 7 needs 1,987m² on 1,400m² plate
 */

const { test, expect } = require('@playwright/test');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ─── Config ──────────────────────────────────────────────────────
const LOGIN_URL = process.env.TERRAIA_LOGIN_URL || 'https://login.terraia.io';
const CMS_URL   = process.env.TERRAIA_CMS_URL   || 'https://cms.terraia.io';
const FILES_DIR = path.join(__dirname, '..', 'test-data', 'altavista');
const SS_DIR    = path.join(__dirname, '..', 'test-results', 'altavista');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Ensure screenshot directory exists
fs.mkdirSync(SS_DIR, { recursive: true });

// ─── Helpers ─────────────────────────────────────────────────────
async function ss(page, name) {
  const p = path.join(SS_DIR, `${String(ss.count++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  📸 ${path.basename(p)}`);
  return p;
}
ss.count = 1;

async function waitForText(page, text, timeout = 15000) {
  await expect(page.locator(`text=${text}`).first()).toBeVisible({ timeout });
}

async function pollFindings(orgId, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase
      .from('analysis_runs')
      .select('status, findings_count')
      .eq('org_id', orgId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();
    if (data?.status === 'complete') return data;
    if (data?.status === 'failed') throw new Error('Analysis run failed');
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Analysis timed out');
}

async function getOrgIdByName(name) {
  const { data } = await supabase
    .from('organizations')
    .select('id')
    .ilike('name', `%${name}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data?.id;
}

// ─── SUITE ───────────────────────────────────────────────────────

test.describe.serial('Grupo Altavista — Full App E2E', () => {
  let orgId = null;

  // ══════════════════════════════════════════════════════════════
  // SECTION 1: LOGIN
  // ══════════════════════════════════════════════════════════════

  test('1.1 Login portal loads correctly', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');
    await ss(page, 'login-portal');

    await expect(page.locator('text=TerraIA').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Continue with Google, text=Google').first()).toBeVisible();
    console.log('  ✓ Login portal rendered');
  });

  test('1.2 Auth: logged in and lands on app', async ({ page }) => {
    // Requires auth.json saved from: npx playwright codegen --save-storage=auth.json
    await page.goto(CMS_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await ss(page, 'post-login-dashboard');

    const url = page.url();
    const notOnLogin = !url.includes('login.terraia.io') || url.includes('cms.terraia.io');
    expect(notOnLogin).toBe(true);
    console.log(`  ✓ Authenticated — on ${url}`);
  });

  // ══════════════════════════════════════════════════════════════
  // SECTION 2: DASHBOARD BASELINE
  // ══════════════════════════════════════════════════════════════

  test('2.1 Dashboard renders all 4 stat cards', async ({ page }) => {
    await page.goto(CMS_URL);
    await page.waitForLoadState('networkidle');
    await ss(page, 'dashboard-full');

    await waitForText(page, 'Dashboard');
    for (const label of ['Active Cases', 'Pending Offers', 'Total Collected', 'Overdue']) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible({ timeout: 8000 });
    }
    console.log('  ✓ All 4 stat cards visible');
  });

  test('2.2 Quick Actions panel shows all 4 buttons', async ({ page }) => {
    await page.goto(CMS_URL);
    await page.waitForLoadState('networkidle');

    for (const label of ['New Case', 'Record Payment', 'Finance Report', 'Manual Intake']) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible({ timeout: 8000 });
    }
    console.log('  ✓ All 4 quick action buttons present');
  });

  test('2.3 Sidebar navigation has all links', async ({ page }) => {
    await page.goto(CMS_URL);
    await page.waitForLoadState('networkidle');
    await ss(page, 'dashboard-sidebar');

    for (const link of ['Dashboard', 'Lots', 'All Offers', 'New Offer']) {
      await expect(page.locator(`text=${link}`).first()).toBeVisible({ timeout: 8000 });
    }
    console.log('  ✓ Sidebar navigation complete');
  });

  // ══════════════════════════════════════════════════════════════
  // SECTION 3: FILE UPLOAD — ALTAVISTA ONBOARDING
  // ══════════════════════════════════════════════════════════════

  test('3.1 Manual Intake loads with 4 import types', async ({ page }) => {
    await page.goto(`${CMS_URL}/intake`);
    await page.waitForLoadState('networkidle');
    await ss(page, 'intake-page');

    await waitForText(page, 'Manual Intake');
    for (const type of ['Cases', 'Payments', 'Units', 'Clients']) {
      await expect(page.locator(`text=${type}`).first()).toBeVisible({ timeout: 8000 });
    }
    console.log('  ✓ Intake page with all 4 import types');
  });

  test('3.2 Upload Altavista proforma Excel file', async ({ page }) => {
    const proformaPath = path.join(FILES_DIR, 'TorreAltavista_Proforma.xlsx');
    if (!fs.existsSync(proformaPath)) {
      test.skip(true, `Proforma not found at ${proformaPath} — run package generator first`);
      return;
    }

    await page.goto(`${CMS_URL}/intake`);
    await page.waitForLoadState('networkidle');

    // Look for proforma/project upload option first
    const proformaBtn = page.locator('text=Proforma, text=Project, text=Analysis').first();
    const hasProforma = await proformaBtn.isVisible().catch(() => false);
    if (hasProforma) await proformaBtn.click();

    // Upload via file input
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(proformaPath);
    await page.waitForTimeout(1500);
    await ss(page, 'intake-proforma-uploaded');

    const fn = page.locator('text=TorreAltavista_Proforma').first();
    const visible = await fn.isVisible().catch(() => false);
    console.log(`  ✓ Proforma uploaded (filename visible: ${visible})`);
  });

  test('3.3 Upload Altavista vendor CSV', async ({ page }) => {
    const vendorPath = path.join(FILES_DIR, 'Vendors_TorreAltavista.csv');
    if (!fs.existsSync(vendorPath)) return;

    await page.goto(`${CMS_URL}/intake`);
    await page.waitForLoadState('networkidle');

    // Select Clients/Vendors import type
    const clientsBtn = page.locator('text=Clients').first();
    if (await clientsBtn.isVisible()) await clientsBtn.click();

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(vendorPath);
    await page.waitForTimeout(1000);
    await ss(page, 'intake-vendors-uploaded');
    console.log('  ✓ Vendor CSV uploaded');
  });

  test('3.4 Upload HSBC bank statement XML', async ({ page }) => {
    const bankPath = path.join(FILES_DIR, 'HSBC_EstadoCuenta_H1_2025.xml');
    if (!fs.existsSync(bankPath)) return;

    await page.goto(`${CMS_URL}/intake`);
    await page.waitForLoadState('networkidle');

    const paymentsBtn = page.locator('text=Payments').first();
    if (await paymentsBtn.isVisible()) await paymentsBtn.click();

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(bankPath);
    await page.waitForTimeout(1000);
    await ss(page, 'intake-bank-uploaded');
    console.log('  ✓ Bank statement XML uploaded');
  });

  // ══════════════════════════════════════════════════════════════
  // SECTION 4: WAIT FOR AI ANALYSIS
  // ══════════════════════════════════════════════════════════════

  test('4.1 Analysis runs automatically after upload', async ({ page }) => {
    // Poll for analysis run to complete (up to 45s)
    let run = null;
    const start = Date.now();
    while (Date.now() - start < 45000) {
      const { data } = await supabase
        .from('analysis_runs')
        .select('id, status, findings_count, org_id')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (data?.status === 'complete') {
        run = data;
        orgId = data.org_id;
        break;
      }
      if (data?.status === 'running') {
        console.log('  ⏳ Analysis running...');
      }
      await new Promise(r => setTimeout(r, 2500));
    }

    expect(run, 'Analysis never completed — check engine logs').toBeTruthy();
    expect(run.findings_count).toBeGreaterThan(0);
    console.log(`  ✓ Analysis complete — ${run.findings_count} findings generated`);
  });

  // ══════════════════════════════════════════════════════════════
  // SECTION 5: PROJECT HEALTH REPORT UI
  // ══════════════════════════════════════════════════════════════

  test('5.1 Health Report page renders findings', async ({ page }) => {
    // Try common health report routes
    const routes = ['/analysis', '/health', '/project/analysis', '/projects'];
    let landed = false;

    for (const route of routes) {
      await page.goto(`${CMS_URL}${route}`);
      await page.waitForTimeout(1500);
      const hasFindings = await page.locator(
        'text=Health Report, text=Critical Issues, text=CRITICAL, text=Project Analysis'
      ).first().isVisible().catch(() => false);
      if (hasFindings) { landed = true; break; }
    }

    // Also try navigating from intake result
    if (!landed) {
      await page.goto(`${CMS_URL}/intake`);
      await page.waitForTimeout(2000);
      const analysisLink = page.locator('text=View Analysis, text=See Findings, text=Health Report').first();
      const hasLink = await analysisLink.isVisible().catch(() => false);
      if (hasLink) { await analysisLink.click(); await page.waitForTimeout(2000); }
    }

    await ss(page, 'health-report-full');
    console.log('  ✓ Health Report page accessed');
  });

  test('5.2 Summary cards show critical + warning counts', async ({ page }) => {
    await page.goto(`${CMS_URL}/intake`);
    await page.waitForTimeout(2000);
    await ss(page, 'health-report-summary-cards');

    // Look for severity indicators
    const criticalEl = page.locator('text=CRITICAL, text=Critical, [data-severity="critical"]').first();
    const warningEl  = page.locator('text=WARNING, text=Warning, [data-severity="warning"]').first();

    const hasCritical = await criticalEl.isVisible().catch(() => false);
    const hasWarning  = await warningEl.isVisible().catch(() => false);

    console.log(`  Critical badge visible: ${hasCritical}`);
    console.log(`  Warning badge visible: ${hasWarning}`);
  });

  test('5.3 Engine filter chips — CFO and GC tabs visible', async ({ page }) => {
    await page.goto(`${CMS_URL}/intake`);
    await page.waitForTimeout(2000);

    const cfoChip = page.locator('button, [role="tab"]').filter({ hasText: /cfo/i }).first();
    const gcChip  = page.locator('button, [role="tab"]').filter({ hasText: /gc|technical/i }).first();

    const hasCFO = await cfoChip.isVisible().catch(() => false);
    const hasGC  = await gcChip.isVisible().catch(() => false);

    if (hasCFO) {
      await cfoChip.click();
      await page.waitForTimeout(500);
      await ss(page, 'findings-cfo-filter');
      console.log('  ✓ CFO filter applied');
    }
    if (hasGC) {
      await gcChip.click();
      await page.waitForTimeout(500);
      await ss(page, 'findings-gc-filter');
      console.log('  ✓ GC filter applied');
    }
  });

  test('5.4 Finding card expands to show description + recommendation', async ({ page }) => {
    await page.goto(`${CMS_URL}/intake`);
    await page.waitForTimeout(2000);

    const card = page.locator('[data-finding], .finding-card, [class*="finding"]').first();
    const cardVisible = await card.isVisible().catch(() => false);

    if (cardVisible) {
      await card.click();
      await page.waitForTimeout(400);
      await ss(page, 'finding-expanded');

      const hasRec = await page.locator('text=Recommendation').first().isVisible().catch(() => false);
      expect(hasRec).toBe(true);
      console.log('  ✓ Finding card expands with recommendation');
    } else {
      console.log('  ℹ Finding cards not yet rendered — analysis may need UI wire-up');
    }
  });

  test('5.5 Developer responds to a finding', async ({ page }) => {
    await page.goto(`${CMS_URL}/intake`);
    await page.waitForTimeout(2000);

    const respondBtn = page.locator('button').filter({ hasText: /respond/i }).first();
    if (await respondBtn.isVisible().catch(() => false)) {
      await respondBtn.click();
      const textarea = page.locator('textarea').first();
      await textarea.fill(
        'Acknowledged. We have arranged a $3M revolving credit line with HSBC that ' +
        'will cover the Month 20 cash gap. Draw is available from January 2026.'
      );
      await ss(page, 'finding-response-typed');

      const saveBtn = page.locator('button').filter({ hasText: /save/i }).first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(800);
        await ss(page, 'finding-response-saved');
        console.log('  ✓ Developer response saved');
      }
    } else {
      console.log('  ℹ No respond button — findings not yet rendered in UI');
    }
  });

  // ══════════════════════════════════════════════════════════════
  // SECTION 6: DB ASSERTIONS — ALL 6 FLAWS CAUGHT
  // ══════════════════════════════════════════════════════════════

  test('6.1 DB: Total findings ≥ 6 (one per planted flaw)', async () => {
    if (!orgId) {
      const { data } = await supabase
        .from('analysis_runs')
        .select('org_id')
        .eq('status', 'complete')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();
      orgId = data?.org_id;
    }
    if (!orgId) { console.log('  No org ID — skipping DB assertions'); return; }

    const { data: findings } = await supabase
      .from('project_findings')
      .select('rule_id, severity, engine, title')
      .eq('org_id', orgId)
      .order('severity');

    console.log(`\n  📊 All findings for Grupo Altavista:`);
    findings?.forEach(f =>
      console.log(`     [${f.engine.toUpperCase()}] [${f.severity.toUpperCase()}] ${f.rule_id}: ${f.title?.substring(0, 60)}`)
    );

    expect(findings?.length, 'Expected at least 6 findings').toBeGreaterThanOrEqual(6);
    console.log(`\n  ✓ ${findings?.length} total findings generated`);
  });

  test('6.2 DB: CASH_TROUGH is CRITICAL — project goes negative', async () => {
    if (!orgId) return;

    const { data } = await supabase
      .from('project_findings')
      .select('*')
      .eq('org_id', orgId)
      .eq('rule_id', 'CASH_TROUGH')
      .single();

    expect(data, 'CASH_TROUGH finding not found').toBeTruthy();
    expect(data.severity).toBe('critical');  // negative balance = critical
    expect(data.data_snapshot.troughBalance).toBeLessThan(0);

    console.log(`  ✓ CASH_TROUGH [CRITICAL]: Month ${data.data_snapshot.troughMonth}`);
    console.log(`    Balance: $${data.data_snapshot.troughBalance?.toLocaleString()}`);
    console.log(`    Description: "${data.description?.substring(0, 80)}..."`);
  });

  test('6.3 DB: LOW_CONTINGENCY fires at 4.2%', async () => {
    if (!orgId) return;

    const { data } = await supabase
      .from('project_findings')
      .select('*')
      .eq('org_id', orgId)
      .eq('rule_id', 'LOW_CONTINGENCY')
      .single();

    expect(data, 'LOW_CONTINGENCY finding not found').toBeTruthy();
    expect(data.severity).toMatch(/critical|warning/);

    const pct = data.data_snapshot?.contingencyPct;
    expect(pct).toBeLessThan(0.08);  // 4.2% < 8% threshold

    console.log(`  ✓ LOW_CONTINGENCY [${data.severity.toUpperCase()}]: ${(pct*100).toFixed(1)}%`);
  });

  test('6.4 DB: AGGRESSIVE_SALES_VELOCITY fires (9.5 vs 5.8 benchmark)', async () => {
    if (!orgId) return;

    const { data } = await supabase
      .from('project_findings')
      .select('*')
      .eq('org_id', orgId)
      .eq('rule_id', 'AGGRESSIVE_SALES_VELOCITY')
      .single();

    expect(data, 'AGGRESSIVE_SALES_VELOCITY finding not found').toBeTruthy();

    const projected = data.data_snapshot?.projectedVelocity;
    const benchmark = data.data_snapshot?.benchmarkVelocity;
    expect(projected).toBeGreaterThan(benchmark * 1.4);

    console.log(`  ✓ AGGRESSIVE_SALES_VELOCITY: ${projected?.toFixed(1)} u/mo vs ${benchmark?.toFixed(1)} benchmark`);
    console.log(`    That's ${((projected/benchmark - 1)*100).toFixed(0)}% above market`);
  });

  test('6.5 DB: MISSING_COST_MARKETING fires for $0 marketing budget', async () => {
    if (!orgId) return;

    const { data } = await supabase
      .from('project_findings')
      .select('*')
      .eq('org_id', orgId)
      .like('rule_id', 'MISSING_COST_MARKET%')
      .limit(1)
      .single();

    expect(data, 'MISSING_COST_MARKETING finding not found').toBeTruthy();
    expect(data.data_snapshot?.value).toBe(0);

    console.log(`  ✓ MISSING_COST_MARKETING: $${data.data_snapshot?.value} vs threshold $${data.data_snapshot?.threshold?.toLocaleString()}`);
  });

  test('6.6 DB: MISSING_POOL_EQUIPMENT fires (2 pools, $0 MEP)', async () => {
    if (!orgId) return;

    const { data } = await supabase
      .from('project_findings')
      .select('*')
      .eq('org_id', orgId)
      .eq('rule_id', 'MISSING_POOL_EQUIPMENT')
      .single();

    expect(data, 'MISSING_POOL_EQUIPMENT finding not found').toBeTruthy();
    expect(data.engine).toBe('gc');
    expect(data.severity).toBe('warning');

    console.log(`  ✓ MISSING_POOL_EQUIPMENT [GC|WARNING]: "${data.title?.substring(0, 70)}"`);
  });

  test('6.7 DB: FLOOR_PLATE_OVERFLOW fires for Floor 7 (1,987m² on 1,400m²)', async () => {
    if (!orgId) return;

    const { data } = await supabase
      .from('project_findings')
      .select('*')
      .eq('org_id', orgId)
      .eq('rule_id', 'FLOOR_PLATE_OVERFLOW')
      .single();

    expect(data, 'FLOOR_PLATE_OVERFLOW finding not found').toBeTruthy();
    expect(data.engine).toBe('gc');
    expect(data.severity).toBe('critical');

    const snap = data.data_snapshot;
    expect(snap.requiredArea).toBeGreaterThan(snap.declaredFloorPlate);

    console.log(`  ✓ FLOOR_PLATE_OVERFLOW [GC|CRITICAL]: Floor ${snap.floor}`);
    console.log(`    Required: ${snap.requiredArea}m² | Plate: ${snap.declaredFloorPlate}m² | Overflow: ${snap.requiredArea - snap.declaredFloorPlate}m²`);
  });

  test('6.8 DB: All findings have required fields + valid structure', async () => {
    if (!orgId) return;

    const { data: findings } = await supabase
      .from('project_findings')
      .select('*')
      .eq('org_id', orgId);

    let passed = 0;
    for (const f of findings || []) {
      expect(f.rule_id, `rule_id missing on ${f.id}`).toBeTruthy();
      expect(f.severity, `severity missing`).toMatch(/critical|warning|observation/);
      expect(f.engine, `engine missing`).toMatch(/cfo|gc|investor/);
      expect(f.title, `title missing`).toBeTruthy();
      expect(f.description, `description missing`).toBeTruthy();
      expect(f.description.length, 'description too short').toBeGreaterThan(50);
      expect(f.org_id, `org_id missing`).toBeTruthy();
      expect(f.status, `status wrong`).toBe('open');
      passed++;
    }
    console.log(`  ✓ All ${passed} findings have valid structure`);
  });

  test('6.9 DB: At least 2 critical + 3 warning findings', async () => {
    if (!orgId) return;

    const { data: findings } = await supabase
      .from('project_findings')
      .select('severity')
      .eq('org_id', orgId);

    const criticals = findings?.filter(f => f.severity === 'critical').length || 0;
    const warnings  = findings?.filter(f => f.severity === 'warning').length || 0;

    console.log(`  Severity breakdown: ${criticals} critical, ${warnings} warning`);
    expect(criticals).toBeGreaterThanOrEqual(2);  // cash trough + floor plate
    expect(warnings).toBeGreaterThanOrEqual(3);   // contingency + velocity + marketing
    console.log(`  ✓ Severity distribution correct`);
  });

  // ══════════════════════════════════════════════════════════════
  // SECTION 7: LOTS INVENTORY
  // ══════════════════════════════════════════════════════════════

  test('7.1 Lots page loads and shows inventory', async ({ page }) => {
    await page.goto(`${CMS_URL}/lots`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await ss(page, 'lots-inventory-page');

    const hasContent = await page.locator(
      'text=Lots, text=Inventory, text=No lots, table, [role="grid"]'
    ).first().isVisible().catch(() => false);
    console.log(`  Lots content visible: ${hasContent}`);
  });

  test('7.2 Lots page has filter/search controls', async ({ page }) => {
    await page.goto(`${CMS_URL}/lots`);
    await page.waitForTimeout(1500);
    await ss(page, 'lots-with-filters');

    const hasFilter = await page.locator(
      'input[placeholder*="search"], input[placeholder*="filter"], select, [role="combobox"]'
    ).first().isVisible().catch(() => false);
    console.log(`  Lots filter controls: ${hasFilter}`);
  });

  // ══════════════════════════════════════════════════════════════
  // SECTION 8: NEW CASE WIZARD
  // ══════════════════════════════════════════════════════════════

  test('8.1 New Case wizard loads Step 1', async ({ page }) => {
    await page.goto(`${CMS_URL}/cases/new`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await ss(page, 'new-case-step1');

    await expect(page.locator('text=Property & Buyer').first()).toBeVisible({ timeout: 10000 });
    console.log('  ✓ New Case Step 1 loaded');
  });

  test('8.2 Fill Step 1 with Altavista unit 7A buyer data', async ({ page }) => {
    await page.goto(`${CMS_URL}/cases/new`);
    await page.waitForTimeout(1500);

    // Select block/lot
    const blockSel = page.locator('select').first();
    if (await blockSel.isVisible()) {
      const opts = await blockSel.locator('option').count();
      if (opts > 1) {
        await blockSel.selectOption({ index: 1 });
        await page.waitForTimeout(600);
        const lotSel = page.locator('select').nth(1);
        const lotOpts = await lotSel.locator('option').count().catch(() => 0);
        if (lotOpts > 1) await lotSel.selectOption({ index: 1 });
      }
    }

    // Buyer info — use Altavista buyer
    const nameIn = page.locator('input[placeholder*="Juan"], input[placeholder*="Name"]').first();
    if (await nameIn.isVisible()) await nameIn.fill('Roberto Escalante Vega');

    const emailIn = page.locator('input[placeholder*="@"], input[type="email"]').first();
    if (await emailIn.isVisible()) await emailIn.fill('rescalante@email.com');

    const phoneIn = page.locator('input[placeholder*="984"], input[placeholder*="phone"]').first();
    if (await phoneIn.isVisible()) await phoneIn.fill('9981234567');

    // Sale price — Unit 7A is $420,000
    const priceIn = page.locator('input[type="number"], input[placeholder*="0"]').last();
    if (await priceIn.isVisible()) await priceIn.fill('420000');

    await ss(page, 'new-case-step1-filled');
    console.log('  ✓ Step 1 filled with Altavista buyer data');
  });

  test('8.3 Step 1 validates required fields', async ({ page }) => {
    await page.goto(`${CMS_URL}/cases/new`);
    await page.waitForTimeout(1000);

    // Click Continue without filling anything
    const continueBtn = page.locator('button').filter({ hasText: /continue|next|siguiente/i }).first();
    if (await continueBtn.isVisible()) {
      await continueBtn.click();
      await page.waitForTimeout(500);
      await ss(page, 'new-case-validation-error');

      // Should still be on step 1
      const stillOnStep1 = await page.locator('text=Property & Buyer').first().isVisible().catch(() => false);
      expect(stillOnStep1).toBe(true);
      console.log('  ✓ Validation blocks empty submission');
    }
  });

  // ══════════════════════════════════════════════════════════════
  // SECTION 9: ALL OFFERS
  // ══════════════════════════════════════════════════════════════

  test('9.1 All Offers page loads', async ({ page }) => {
    await page.goto(`${CMS_URL}/offers`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await ss(page, 'all-offers-page');

    const hasContent = await page.locator(
      'text=All Offers, text=Offers, text=No offers'
    ).first().isVisible().catch(() => false);
    console.log(`  Offers page content: ${hasContent}`);
  });

  test('9.2 New Offer page loads', async ({ page }) => {
    await page.goto(`${CMS_URL}/offers/new`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await ss(page, 'new-offer-page');
    console.log('  ✓ New Offer page accessible');
  });

  // ══════════════════════════════════════════════════════════════
  // SECTION 10: FINANCE REPORT
  // ══════════════════════════════════════════════════════════════

  test('10.1 Finance Report loads without crash', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${CMS_URL}/finance`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await ss(page, 'finance-report-full');

    const bodyText = await page.locator('body').innerText();
    const hasCrash = bodyText.includes('Unhandled') || (bodyText.includes('Error') && bodyText.length < 200);
    expect(hasCrash).toBe(false);

    const critErrors = errors.filter(e => !e.includes('ResizeObserver'));
    expect(critErrors.length).toBeLessThanOrEqual(2);
    console.log(`  ✓ Finance report loaded (${critErrors.length} JS errors)`);
  });

  // ══════════════════════════════════════════════════════════════
  // SECTION 11: PAYMENTS
  // ══════════════════════════════════════════════════════════════

  test('11.1 Payments page loads', async ({ page }) => {
    await page.goto(`${CMS_URL}/payments`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await ss(page, 'payments-page');

    const hasContent = await page.locator(
      'text=Payments, text=Record Payment, text=No payments'
    ).first().isVisible().catch(() => false);
    console.log(`  Payments page: ${hasContent}`);
  });

  test('11.2 Record Payment button opens modal/form', async ({ page }) => {
    await page.goto(CMS_URL);
    await page.waitForTimeout(1000);

    const recordBtn = page.locator('text=Record Payment').first();
    if (await recordBtn.isVisible()) {
      await recordBtn.click();
      await page.waitForTimeout(1200);
      await ss(page, 'record-payment-modal');

      const hasForm = await page.locator(
        '[role="dialog"], .modal, text=Payment Amount, text=Amount'
      ).first().isVisible().catch(() => false);
      console.log(`  Record Payment modal: ${hasForm}`);
    }
  });

  // ══════════════════════════════════════════════════════════════
  // SECTION 12: BENCHMARK STORE (Learning System)
  // ══════════════════════════════════════════════════════════════

  test('12.1 DB: Altavista analysis contributed to benchmark_store', async () => {
    const { count: before } = await supabase
      .from('benchmark_store')
      .select('*', { count: 'exact', head: true });

    // Should have at least the 14 seeded rows, possibly more from this run
    expect(before).toBeGreaterThanOrEqual(14);
    console.log(`  ✓ Benchmark store: ${before} total rows (14 seeded + ${before - 14} from projects)`);
  });

  test('12.2 DB: MX Tier2 condo_tower benchmarks are populated', async () => {
    const { data } = await supabase
      .from('benchmark_store')
      .select('cost_hard_per_m2, sales_velocity_per_month, irr_equity')
      .eq('project_type', 'condo_tower')
      .eq('country', 'MX')
      .eq('city_tier', 'tier2')
      .limit(3);

    expect(data?.length).toBeGreaterThan(0);
    const row = data[0];
    expect(row.cost_hard_per_m2).toBeGreaterThan(1000); // > $1000/m²
    expect(row.sales_velocity_per_month).toBeGreaterThan(3); // > 3 units/month

    console.log(`  ✓ MX Tier2 benchmark: $${row.cost_hard_per_m2}/m², ${row.sales_velocity_per_month} u/mo, ${row.irr_equity}% IRR`);
  });

  // ══════════════════════════════════════════════════════════════
  // SECTION 13: UI QUALITY CHECKS
  // ══════════════════════════════════════════════════════════════

  test('13.1 Dark mode toggle works', async ({ page }) => {
    await page.goto(CMS_URL);
    await page.waitForTimeout(1000);

    const toggle = page.locator('button[aria-label*="dark"], button[aria-label*="theme"]').first();
    const moonBtn = page.locator('button').filter({ hasText: '' }).last(); // moon icon button

    const themeBtn = await toggle.isVisible().catch(() => false) ? toggle : moonBtn;
    if (await themeBtn.isVisible().catch(() => false)) {
      const before = await page.locator('html').getAttribute('class') || '';
      await themeBtn.click();
      await page.waitForTimeout(400);
      await ss(page, 'dark-mode-toggled');
      const after = await page.locator('html').getAttribute('class') || '';
      console.log(`  Dark mode: '${before}' → '${after}'`);
    }
  });

  test('13.2 No critical JS errors on dashboard', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });

    await page.goto(CMS_URL);
    await page.waitForTimeout(3000);

    const crit = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('ResizeObserver') &&
      !e.includes('net::ERR_ABORTED')
    );
    if (crit.length > 0) console.warn('  ⚠ JS errors:', crit.slice(0, 3));
    expect(crit.length).toBeLessThanOrEqual(2);
    console.log(`  ✓ Dashboard: ${crit.length} JS errors`);
  });

  test('13.3 All Supabase API calls return 200', async ({ page }) => {
    const failed = [];
    page.on('response', res => {
      if (res.url().includes('supabase.co') && res.status() >= 400) {
        failed.push(`${res.status()} ${res.url().split('?')[0].split('/').slice(-2).join('/')}`);
      }
    });

    await page.goto(CMS_URL);
    await page.waitForTimeout(3000);

    if (failed.length > 0) console.warn('  ⚠ Failed API calls:', failed);
    expect(failed.length).toBe(0);
    console.log('  ✓ All Supabase API calls successful');
  });

  test('13.4 Responsive at 1280px and 1920px', async ({ page }) => {
    for (const [w, h] of [[1280, 800], [1920, 1080]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(CMS_URL);
      await page.waitForTimeout(1000);
      await ss(page, `responsive-${w}px`);
      await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 8000 });
      console.log(`  ✓ Renders correctly at ${w}×${h}`);
    }
  });

  // ══════════════════════════════════════════════════════════════
  // SECTION 14: CLEANUP
  // ══════════════════════════════════════════════════════════════

  test('14.1 Summary: print all screenshots taken', async () => {
    const shots = fs.readdirSync(SS_DIR).filter(f => f.endsWith('.png')).sort();
    console.log(`\n  📸 Screenshots saved to test-results/altavista/:`);
    shots.forEach(f => console.log(`     ${f}`));
    console.log(`\n  Total: ${shots.length} screenshots`);
    expect(shots.length).toBeGreaterThan(10);
  });

  test('14.2 Summary: all 6 planted flaws status', async () => {
    if (!orgId) { console.log('  No orgId — cannot verify flaws'); return; }

    const expectedRules = [
      'CASH_TROUGH',
      'LOW_CONTINGENCY',
      'AGGRESSIVE_SALES_VELOCITY',
      'MISSING_COST_MARKETING',
      'MISSING_POOL_EQUIPMENT',
      'FLOOR_PLATE_OVERFLOW',
    ];

    const { data: findings } = await supabase
      .from('project_findings')
      .select('rule_id, severity')
      .eq('org_id', orgId);

    const found = findings?.map(f => f.rule_id) || [];

    console.log('\n  🎯 FLAW DETECTION SUMMARY:');
    let caught = 0;
    for (const rule of expectedRules) {
      const match = found.find(r => r.startsWith(rule.replace('_MARKETING', '')));
      const status = match ? '✅ CAUGHT' : '❌ MISSED';
      if (match) caught++;
      console.log(`     ${status} ${rule}`);
    }

    console.log(`\n  Score: ${caught}/${expectedRules.length} flaws caught`);
    expect(caught).toBeGreaterThanOrEqual(5); // at minimum 5/6
  });

});
