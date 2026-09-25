# VariantPulse: verified data update (Huda)

Copy these files over the matching paths in the repo. Nothing else changes. Tested: `tsc` passes, `next build` passes, and the app runs live against ClinVar.

## What changed
Every variant's "then" classification now equals what **ClinVar actually said in its January 2023 release**. Every "now" is today's live ClinVar. So every alert in the demo is a real, dated reclassification. Proof for each one is in `src/data/provenance.json`: its ClinVar status in Jan 2023, 2024, 2025 and Sep 2026, plus gnomAD frequencies.

Regional frequencies are now **real gnomAD v4 Middle Eastern figures**. The regional *assertions* are still modelled, and the code says so.

## The 12 monitored variants (21 synthetic patients)
| Variant | ClinVar Jan 2023 | ClinVar now | Patients | Why it's in the demo |
|---|---|---|---|---|
| BRCA1 c.5056C>T | VUS | Likely pathogenic (expert panel, Aug 2025) | 4 | Headline case. VUS → conflicting → LP |
| BRCA2 c.7847C>T | VUS | Pathogenic (expert panel, Jul 2026) | 2 | Changed this summer |
| TP53 c.589G>A | VUS | Likely pathogenic (expert panel) | 2 | Includes a child from cascade testing |
| LDLR c.1381G>T | VUS | Likely pathogenic (expert panel) | 2 | Familial hypercholesterolaemia |
| PTEN c.149T>C | VUS | Pathogenic (expert panel) | 1 | Paediatric |
| MYBPC3 c.26-2A>G | Pathogenic | VUS (expert panel, Nov 2025) | 2 | Reverse danger: family on cardiac surveillance |
| HBB c.380T>G | Pathogenic | VUS (Apr 2026) | 1 | UAE premarital screening. Regional conflict |
| BRCA2 c.9538C>T | VUS | Benign (expert panel) | 2 | Good news: reassurance |
| TP53 c.784G>A | VUS | Likely benign (expert panel) | 1 | Good news |
| BRCA1 c.5123C>T | VUS | Conflicting | 1 | Experts now disagree |
| LDLR c.2479G>A | VUS | VUS | 2 | Control: no false alarm |
| CFTR c.601G>A | VUS | VUS | 1 | ~4× more common in Middle Eastern gnomAD. Regional conflict |

App now shows: **8 evidence changes · 19 patients impacted · 2 regional conflicts · 1 consensus conflict**.

## Problems found in the old data
- Headline BRCA1 c.5309G>T was already **Pathogenic (expert panel) since 2018**, so a 2023 "VUS" was wrong.
- The GLRA1 and LDLR c.1706-10G>A "regional conflict" cases were already **benign / likely benign in 2023**, not VUS.
- 4 variants (TP53 c.440T>G, SCN5A, MSH2 c.1006C>G, BRCA2 c.9028C>A) **weren't in ClinVar at all in Jan 2023**.

## Real numbers for the pitch (ClinVar germline, Jan 2023 → Sep 2026)
- **5,022** variants went VUS → pathogenic / likely pathogenic
- **1,703** went pathogenic / likely pathogenic → VUS (patients may have had surgery or surveillance on a result that no longer holds)
- **17,274** went VUS → benign / likely benign
- **64,129** went VUS → conflicting
- gnomAD v4's Middle Eastern group is **~3,000 people out of ~800,000 (<0.4%)**

Sources: NCBI ClinVar `variant_summary` monthly archives (2023-01, 2024-01, 2025-01, current) and the gnomAD v4 API.
