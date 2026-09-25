# VariantPulse — Product Brief (hackathon MVP)

**Genomic Change Intelligence for Healthcare** · Built by Team Kanban

A patient's genetic result was filed years ago as a VUS. The DNA never changes; the scientific
evidence around it does. VariantPulse notices when the interpretation of a variant moves, finds
every historical patient who carries it, compares global and regional evidence, and opens a
human clinical review.

Copy to use (and little else):

- **The same DNA. A different meaning.** (primary)
- **Your DNA didn't change. Science did.** (secondary)
- **AI assists. Clinicians decide.**
- "Built by Team Kanban" — small and tasteful, never loud.

Design and colour rules live in [`docs/color-system.md`](./color-system.md). It is authoritative.

---

## What already exists — extend it, don't rebuild it

| Area | Where |
|---|---|
| Stack | Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4, framer-motion, lucide-react |
| Normalised taxonomy and clinical bands | `src/lib/classification.ts` |
| Deterministic change detection (`CLASSIFICATION_DRIFT`, `EVIDENCE_STRENGTHENED`, `EVIDENCE_WEAKENED`, `CONSENSUS_CONFLICT`, `REGIONAL_CONFLICT`, `NO_MATERIAL_CHANGE`) | `src/lib/analysis.ts`, `src/lib/priority.ts` |
| Live NCBI ClinVar read (6 s timeout) with fallback to the bundled snapshot; mode reported as `live` / `cached` | `src/lib/clinvar.ts`, `src/data/evidence-snapshot.json` |
| Synthetic hospital data: 32 patients (`VP-xxxxx`), 12 monitored variants, modelled regional index | `src/data/workspace.ts`, `src/data/regional.ts` |
| Pages | `/`, `/patients`, `/patients/[id]`, `/variants`, `/variants/[key]`, `/evidence`, `/regional`, `/review`, `/review/[caseId]`, `/activity`, `/sources`, `/settings`; APIs `/api/analysis`, `/api/sync` |
| Evidence brief, audit trail, review actions, command palette (Ctrl/Cmd+K) | `src/components/*`, `/activity` |
| Quality gates | `npm run verify` = type-check + lint + `verify:data` + `verify:contrast` |

## The demo story (real data, synthetic patients)

- Variant **BRCA1 c.5522G>T** (p.Ser1841Ile), ClinVar **VCV000869004**.
- Hospital record: reported **VUS** on 2023-04-18.
- ClinVar today: **Likely pathogenic** — criteria provided, multiple submitters, no conflicts;
  last evaluated **2025-11-06**. Show the real evaluation date; never invent one.
- **4** historical patients carry it: **VP-10283, VP-10491, VP-10822, VP-11034** (tested 2023),
  all "Not reviewed".

---

## Design direction

- Follow `docs/color-system.md` exactly: bone/warm-white surfaces, garnet identity, oxblood primary
  CTA, vermilion **only** for "something changed". Replace the current crimson tokens in
  `src/app/globals.css` and update `scripts/verify-contrast.mjs` so WCAG AA still passes.
- Logo: `public/logo.png` (transparent PNG) is the official mark, together with `src/app/icon.png`
  and `src/app/apple-icon.png`. Use it as-is — never redraw, recolour or replace it.
  `logo new.png` in the repo root is an unused duplicate and can be deleted.
- Graphic-first, calm, clinical. Minimal text. **Not** a generic dashboard: no rows of KPI cards,
  no decorative charts, no large tables on the home screen. The sidebar stays compact.
- Purposeful motion (framer-motion). Respect `prefers-reduced-motion`.

---

## Workstream A — Home is the story graph

One composition that reads left to right in five seconds:

**PAST** (historical record: 2023 · BRCA1 · VUS) → **VARIANTPULSE CORE** (the genomic object;
evidence streams in from ClinVar, literature, regional evidence, hospital records) → **PRESENT**
(VUS → Likely pathogenic) → **AFFECTED PATIENTS** (4 avatars branching out) → **CLINICAL REVIEW**
(one clinician / review node).

- The graph *is* the page. Remove the bottom row of dashboard cards; keep at most one or two
  supporting elements.
- One primary action: **Run evidence sync**.

### Run evidence sync — the choreography

Deterministic, 4–7 seconds, identical on every run, with a skip control:

1. evidence sources activate (clinical-green "connected" dots)
2. data flows along the connectors into the core
3. the core scans the variant nodes
4. one variant lights up (vermilion pulse)
5. the classification changes on screen: VUS → Likely pathogenic
6. links travel into the historical hospital records
7. the 4 affected patients appear
8. a clinical review case is created; "Open clinical review" goes to that case

End state: **Your DNA didn't change. Science did.** · **AI assists. Clinicians decide.**

- The sequence must not wait on the network. Drive it from the local analysis (demo mode). A live
  ClinVar read may run in the background but must never alter or delay the sequence; report it
  only through the live/cached indicator.
- A page reload returns to the initial state. With reduced motion, jump to the end state.

## Workstream B — Clinical depth

- **Then vs Now** component: 2023 · VUS → *science evolves* → today · Likely pathogenic (cite the
  ClinVar evaluation date). "The DNA has not changed. Only the interpretation has." Use it on the
  variant page and the review case.
- **Patient impact graph**: the changed variant linked to its affected patients — not a
  spreadsheet. Selecting a patient shows the synthetic ID, test date, original classification,
  current evidence, clinical owner and review status.
- **Global vs regional**: two evidence lanes that visibly diverge when they disagree and converge on
  a **Human review required** node. Never imply one source is automatically right.
- **Review actions only**: Open clinical review · Request more evidence · Assign reviewer ·
  Create follow-up · Mark reviewed. There is never an "automatically change diagnosis" action.
  Every action lands in the audit trail (`/activity`).
- Restyle the evidence brief to the palette; keep it printable and downloadable.

## Workstream C — Evidence engine and data (small)

- Change detection stays deterministic. No model ever decides a classification; AI only phrases
  summaries of cited, structured evidence.
- Normalised values: Benign, Likely benign, VUS, Likely pathogenic, Pathogenic, Conflicting
  (plus Not provided).
- **Demo mode** is the default for the pitch: it uses the bundled snapshot, so the BRCA1 story is
  identical every time. Live mode is an enhancement. The UI always shows which is active. No API
  failure may break a page.
- Numbers must agree. The home story is BRCA1 → 4 patients. Wherever workspace totals appear
  (e.g. 11 records across all changed variants), label them so they never contradict the story.
- Keep the dataset shape: ~30 synthetic patients, 12 variants, ≥ 2 classification changes,
  2 regional conflicts, unchanged controls, several patients sharing a changed variant. IDs are
  `VP-xxxxx` only — never Emirates IDs. Show "Synthetic demonstration data" wherever patients appear.
- Optional, only if cheap and safe: MyVariant.info enrichment behind the same fallback.
- Fix the stale comment in `src/data/workspace.ts` (`BRCA1:c.5309G>T` → `BRCA1:c.5522G>T`).

## Workstream D — QA and demo readiness

- Gates for every change: `npm ci`, `npm run lint`, `npm run type-check`, `npm run build`,
  `npm run verify:data`, `npm run verify:contrast`, `npm test`.
- Add a small unit-test setup (Vitest) covering classification normalisation, change detection,
  and the demo-story invariants (VUS → Likely pathogenic, exactly 4 affected patients, a review
  case exists).
- Check every route at 1366×768, 1440×900 and 1920×1080, plus tablet and mobile widths: no
  overflow or clipping, no console errors, no hydration warnings, no dead buttons, all images load.
- Simulate a ClinVar failure (offline or timeout): cached mode shows and everything keeps working.
- In `next.config.ts`: `devIndicators: false`, and set `outputFileTracingRoot` to the project
  directory.

---

## Acceptance test — the pitch demo

Must pass from a clean page load, every time, with the network disabled:

1. Open `/` → historical patient **VP-10283**: BRCA1, 2023, VUS.
2. Click **Run evidence sync**.
3. Evidence flows from the sources into VariantPulse.
4. "New evidence found."
5. **VUS → Likely pathogenic.**
6. **4 historical patients** located.
7. **Clinical review case created** → "Open clinical review" opens it.
8. **Your DNA didn't change. Science did. AI assists. Clinicians decide.**

No randomness. No dependency on external APIs.

## Git workflow

- Integration branch: **`hackathon`**. Each workstream works on its own branch cut from
  `hackathon` and opens a PR into `hackathon`.
- Merge into `hackathon` only when every gate passes. Never push to or merge into `main`, never
  force-push. The final `hackathon` → `main` PR is reviewed and merged by the repository owner.
- One design system, one demo dataset, one normalised variant model — no duplicate types and no
  parallel mock data.
