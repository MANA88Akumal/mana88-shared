# Grupo Altavista — TerraIA Demo Company Package

## Company
- **Legal Name:** Grupo Altavista S.A. de C.V.
- **RFC:** GAL240115AB3
- **HQ:** Cancún, Quintana Roo, México
- **Sector:** Luxury residential development (Zona Hotelera)

## Project: Torre Altavista Cancún
120-unit luxury condo tower, 8 floors, Blvd. Kukulcán Km 14.5.
Target market: affluent Mexican buyers + US/Canadian investors.

## Capital Structure
- Equity: $2,500,000 (thin — developer over-leveraged)
- Construction Loan HSBC: $21,300,000 (75% LTC)
- Pre-Sale Deposits: ~$4,600,000
- **Total: $28,400,000**

## Files in This Package
| File | Description |
|------|-------------|
| TorreAltavista_Proforma.xlsx | 4-sheet Excel: Summary, Units, Cash Flow, Budget |
| HSBC_EstadoCuenta_H1_2025.xml | Bank statement Feb–Jun 2025 |
| HSBC_EstadoCuenta_H2_2025_2026.xml | Bank statement Jul 2025–Apr 2026 |
| Vendors_TorreAltavista.csv | 30 vendors |

## PLANTED FLAWS — AI Must Catch All 6

| # | Engine | Rule ID | What's Planted |
|---|--------|---------|----------------|
| 1 | CFO | CASH_TROUGH **CRITICAL** | Month 20 (May-26) goes **negative: -$332,000** |
| 2 | CFO | LOW_CONTINGENCY | Contingency = $705k = **4.2%** of hard costs (standard: 10-15%) |
| 3 | CFO | AGGRESSIVE_SALES_VELOCITY | 9.5 units/mo projected vs **5.8 MX Tier2 benchmark** |
| 4 | CFO | MISSING_COST_MARKETING | **$0 marketing** on $47.3M revenue project |
| 5 | GC | MISSING_POOL_EQUIPMENT | 2 pools (rooftop + lap) with **$0 pool/MEP** in budget |
| 6 | GC | FLOOR_PLATE_OVERFLOW | Floor 7: 18 units × 92m² + 20% = **1,987m² on 1,400m² plate** |

*Bonus: LTC_TOO_HIGH may also fire — 75% LTC is at the lender limit.*

## Use For
1. Manual walkthrough: signup → onboarding → upload files → review AI findings
2. Playwright E2E test: automated upload + assertion that all 6 flaws are caught
3. Sales demos: show prospects a real project with real findings
