<div align="center">
  <img src="public/logo.png" alt="VariantPulse" width="88" />
  <h1>VariantPulse</h1>
  <p><strong>Genomic Change Intelligence</strong></p>
  <p><em>Your DNA didn't change. Science did.</em></p>
</div>

---

## The problem

A patient has genetic testing. A variant comes back as **VUS, a variant of uncertain
significance**. The report is filed, and the patient goes home.

Years later, new functional studies are published, new submissions reach ClinVar, and an expert
panel reviews the variant. The consensus moves. The variant is now considered pathogenic.

The patient's DNA has not changed. The evidence around it has.

But the report in the record system still says what it said on the day it was issued, and nobody
is watching. Reclassification is not an edge case; it is the normal behaviour of a field where
evidence accumulates faster than old reports are revisited. At population scale, that gap widens
quietly and continuously.

## What VariantPulse does

VariantPulse continuously compares historical genomic findings against current scientific
evidence and surfaces:

- **what changed**: the interpretation on record versus the interpretation held today
- **when and why**: the submissions, review status and literature behind the move
- **who is affected**: every historical record carrying the changed variant
- **where sources disagree**: global consensus against regional evidence
- **what needs a human**: a prioritised clinical review queue

Then it carries each case to a documented end: a named owner and a review deadline, a decision
with its rationale, follow-up approved by a second clinician, and a closed case, with the history
of who did what at every step. For a partner who wants to evaluate before anything changes, a
silent pilot replays it over historical data and measures it against expert review.

It raises cases. It does not diagnose, and it never writes to a patient record.

> **AI assists. Clinicians decide.**

## Architecture

```
Record system (read-only)
        │
        ▼
Variant normaliser ──── HGVS resolved to a stable internal key
        │
        ▼
Evidence sources ────── live ClinVar · ClinVar Jan 2023 · gnomAD v4 · CTGA · PubMed
        │
        ▼
Diff engine ─────────── deterministic band comparison, no model involved
        │
        ▼
Impact mapper ───────── every record carrying a changed variant
        │
        ▼
Evidence intelligence ─ brief composed from the cited records
        │
        ▼
Review queue ────────── prioritised cases with full reasoning attached
        │
        ▼
Named owner ─────────── review deadline by priority; escalation when it passes
        │
        ▼
Human decision ──────── refer, await evidence, or no action, with a rationale
        │
        ▼
Approved follow-up ──── a second clinician approves anything that reaches a patient
        │
        ▼
Closed case ─────────── with a note; every step in an append-only history
```

### Why change detection is deterministic

Whether a variant was reclassified is decided by comparing two normalised codes, never by a
language model. Free-text classifications from any source are mapped onto a fixed taxonomy
(`PATHOGENIC`, `LIKELY_PATHOGENIC`, `VUS`, `LIKELY_BENIGN`, `BENIGN`, `CONFLICTING`,
`NOT_PROVIDED`), grouped into clinical bands, and compared. The same inputs always produce the
same verdict, and every verdict carries its reasoning.

Change types: `CLASSIFICATION_DRIFT` (crossed the actionable boundary, in either direction),
`EVIDENCE_STRENGTHENED`, `EVIDENCE_WEAKENED` (toward benign without leaving the uncertain band),
`CONSENSUS_CONFLICT`, `REGIONAL_CONFLICT` (shown as *Regional signal*: regional evidence deserves
review while the global reading is unchanged) and `NO_MATERIAL_CHANGE`. Movement within the benign
band is not material. Regional evidence never produces a classification: frequency is evidence to
weigh, and catalogue readings are quoted, not adopted.

**Review priority** (`CRITICAL` / `HIGH` / `MEDIUM` / `LOW`) is a triage signal for the queue,
derived from listed factors that are shown alongside it. It is explicitly *not* a validated
clinical risk score and says nothing about any individual patient.

Evidence summaries are composed from the structured fields on screen by fixed templates, so every
sentence traces back to a cited field. No language model decides or phrases a verdict in this build.

## Tech stack

| | |
|---|---|
| Framework | Next.js 15 (App Router) · React 19 |
| Language | TypeScript, strict |
| Styling | Tailwind CSS v4 |
| 3D | three.js, loaded only when a 3D view is on screen; every shape is generated in code, with no model or image files. The hand-drawn SVG helix stands in until WebGL is ready, and wherever it is unavailable |
| Icons | lucide-react |
| Evidence | NCBI ClinVar and PubMed via E-utilities |

## Running locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

```bash
npm run build             # production build
npm run verify            # tree, type-check, lint, data, history and contrast checks
npm test                  # unit tests (Vitest)
npm run verify:history    # historical vs current, variant by variant (--live, --archive)
npm run evidence:refresh  # re-pull the ClinVar snapshot (deliberate; never at runtime)
```

`npm run verify` runs six gates:

| Gate | What it catches |
|---|---|
| `verify:tree` | generated output, `node_modules`, `.env` files or Wrangler secrets tracked by git |
| `type-check` | `tsc --noEmit` |
| `lint` | `eslint` |
| `verify:data` | incoherent clinical data |
| `verify:history` | prints historical against current for every variant |
| `verify:contrast` | inaccessible colour |

CI runs every gate, the unit tests and the Cloudflare Worker build on each push to `main` and each
pull request (`.github/workflows/ci.yml`).

**`verify:tree`** exists because `.open-next/` (1,400+ bundled files from `npm run cf:build`) and
`.wrangler/` (local SQLite state) were once committed. ESLint and TypeScript now ignore both, but a
tracked copy still churns on every build, so the gate fails with the exact `git rm --cached`
command to run if either, or anything else generated or secret, is ever tracked again.

**`verify:data`** checks what the type system cannot, and runs the application's own engine
against the snapshot to do it: identifiers that disagree between the panel, the snapshot and
`provenance.json`; malformed HGVS; duplicate records; a historical classification that does not
match the January 2023 release, or current evidence leaking into history; frequencies outside 0–1;
a patient-impact join that drops a record; an unchanged variant that opens a case; and, most
importantly, any reclassification that cannot be reproduced from the supplied historical and
current data, or that the source evaluated *before* the classification it supposedly superseded.
It ends by printing the computed counts.

**`verify:contrast`** parses the design tokens out of `globals.css` and asserts
every foreground clears WCAG 2.1 AA against each surface it is actually painted on.
Small uppercase labels are still "normal text" under 1.4.3, so the faintest tone is
held to 4.5:1 rather than the 3:1 allowed for large text; the lightness hierarchy is
therefore shallow by design and size, case and tracking carry it instead.

No environment variables are required. VariantPulse reads public endpoints that need no key, and
works fully offline against its verified evidence snapshot. `VARIANTPULSE_OFFLINE=1` switches
live reads off entirely.

## Data and demo

**Synthetic patient records · Real public genomic evidence.** Every patient is fabricated; every
variant, classification, frequency and catalogue reading is public and cited.

| | What it is | Where it lives |
|---|---|---|
| **Patients** | 26 synthetic hospital records (`VP-xxxxx`): no real person, clinician or institution | `src/data/workspace.ts` |
| **Variants** | 15 real ClinVar variants, each identified by its VCV accession and, where one exists, its rsID | `src/data/workspace.ts` |
| **Historical evidence** | For 14 variants, ClinVar's own classification in its **January 2023** release (`variant_summary_2023-01`), with the review status of the day. MYBPC3 c.776delinsTT was not in ClinVar then: its classification on record is the synthetic hospital's report of a novel variant, and is labelled as such everywhere | `src/data/workspace.ts`, `src/data/provenance.json` |
| **Current evidence** | Live NCBI ClinVar, one batched E-utilities request per sync | `src/lib/clinvar.ts` |
| **Offline fallback** | A saved ClinVar snapshot, verified identical to a live read (15 of 15 records) when it was imported | `src/data/evidence-snapshot.json` |
| **Regional evidence** | gnomAD v4 allele counts for the Middle Eastern genetic ancestry group and all samples, for every variant; and, for three variants, the reading of the Catalogue for Transmission Genetics in Arabs (CTGA, Centre for Arab Genomic Studies), quoted and attributed | `src/data/regional.ts` |
| **Genome map** | GRCh38 chromosome lengths (UCSC hg38) and centromeres (the p11/q11 boundary in the hg38 cytoBand table), fixed properties of the assembly. Each variant stands at the GRCh38 position its ClinVar record gives; a test checks every one against ClinVar's own cytogenetic band | `src/lib/genome.ts` |

With the bundled snapshot, `npm run verify:data` computes: **11 reclassifications** (10 against the
January 2023 release, 1 against the modelled hospital report), **1 consensus conflict**, **2 regional
signals**, **3 unchanged classifications** (two of which raise nothing at all) and **13 review
cases covering 23 synthetic patients**. The lead case is **BRCA1 c.5056C>T**: uncertain significance
in January 2023, likely pathogenic after expert-panel review (last evaluated 18 August 2025), carried
by four synthetic patients. Live ClinVar can move these numbers; the interface always shows the
computed values.

**Safety.** VariantPulse does not diagnose, and it never alters a clinical record. It raises a case
and a clinician decides.

### How each source was checked

Every non-synthetic value was re-checked against its primary source on 25 September 2026:

- **ClinVar, January 2023 and after**: the historical classification, review status and rsID of each
  variant against NCBI's archived `variant_summary_2023-01` (GRCh38 rows), and the January 2024 and
  January 2025 checkpoints in `provenance.json` against those releases.
  `npm run verify:history -- --archive` repeats the January 2023 check.
- **ClinVar, current**: the snapshot against a live E-utilities read, field by field.
  `npm run verify:history -- --live` repeats it.
- **gnomAD v4**: allele counts against the gnomAD API (dataset `gnomad_r4`). Counts are the joint
  exome-and-genome figures, except for the four variants gnomAD holds only in exomes, which are
  labelled as exome counts. Three variants are absent from gnomAD v4 altogether.
- **CTGA**: each quoted reading against its CTGA variant page, linked from the interface.

### Live reads and fallback

Evidence is read live from ClinVar on every sync. If that call fails, times out, or returns a
partial response, the workspace serves its verified snapshot instead and **says so**: the status
switches from `Live ClinVar evidence` to `Cached verified evidence` everywhere, with the reason
attached. A partial response is discarded rather than mixed with cached records, and a failed read
is remembered for 30 seconds so a dead network costs one timeout rather than one per page; an
explicit sync always retries. Change detection runs locally, so the queue stays correct with every
external source down. For a room with no reliable network, start the app with
`VARIANTPULSE_OFFLINE=1` to switch live reads off.

If live ClinVar has moved on since the snapshot, the live values are used and the difference is
reported on the Data sources page and in the server log. The snapshot is never overwritten at
runtime; refreshing it is a deliberate `npm run evidence:refresh`, which reads the panel from
`src/data/workspace.ts` and refuses to replace a complete snapshot with a partial one.

## The review workflow

Every case moves through the same six steps, drawn at the top of the case: **evidence updated →
records matched → owner assigned → decision documented → follow-up approved → case closed**, each
with who did it and when.

- **Owner and deadline.** Opening a review takes ownership; the service lead can assign or reassign.
  A case must be decided within 7, 14, 30 or 60 days of being raised, by priority. These are
  placeholders for a pilot to agree with the partner. An undecided case past its deadline is
  escalated to the service lead once, and the history says so.
- **Decisions**: *Refer to genetics*, *Needs further evidence* (holds the case open) or *No action*.
  Each needs a written rationale, and an amendment is added beside the original, never over it.
- **Follow-up** is proposed from the decision (a genetics referral, notifying the ordering
  clinicians, a patient explanation letter) and approved or declined by someone other than its
  proposer. A patient letter can be drafted only through an approved letter follow-up.
- **Closure** needs a settled decision, nothing awaiting approval, an approved genetics referral for
  a referral decision, and a note. Only the owner or the service lead can close; reopening is
  recorded. Amending a decision supersedes follow-ups still open under the old one, and a proposer
  can withdraw a follow-up nobody has approved yet.
- **Roles.** Four demonstration identities, switched from the top bar, show separation of duties:
  a reviewing clinician (proposes follow-ups), the service lead (approves them, closes, assigns, and
  proposes none, so every approval has a second person), a data steward (imports, retention) and a
  read-only pilot sponsor. The interface says which role an unavailable action needs.

Each alert also has a **What changed?** panel: ClinVar's own reading then and now, in its words,
with links to the archived release and the live record; the reading at each archived checkpoint;
VariantPulse's change type and priority, labelled as inference rather than a source statement; how
every record was matched; conflicts and limitations; and data freshness. It downloads as an
evidence snapshot.

## Pilot tooling

- **Silent pilot** (`/pilot`). While on, nothing reaches a patient and nothing is exported, but
  review carries on so it can be measured. A **retrospective replay** runs ClinVar's archived
  releases against the classifications on record: VariantPulse would have held 4 open alerts by
  January 2024, 7 by January 2025 and 12 by September 2026. The **evaluation** computes agreement
  with expert review, missed changes, false or duplicate alerts, review time per case and import
  errors, only from labels entered in the session or loaded from a reference set, and success
  criteria stay unset until agreed with the partner. No figure is supplied.
- **Data onboarding** (`/onboarding`). A structured-file import validated row by row in the
  browser: missing fields, national-ID-shaped or personal record keys, GRCh37 rows, HGVS notation,
  identifiers that disagree, transcript versions, duplicates and unmonitored variants. Nothing is
  accepted silently, and a synthetic sample file carries one seeded problem per row.
- **Oversight** (`/oversight`). The sponsor's view: records monitored, cases awaiting a decision,
  overdue cases, turnaround, each reviewer's load, a deadline forecast, and referrals and letters.
- **Trust & governance** (`/governance`). Hosting options, a controls matrix (what this demonstration
  does against what a pilot needs), the register of external data flows including AI services, the
  AI inventory, known limitations, human-oversight controls, session deletion, and the whole
  package as a downloadable Markdown document. It describes; it does not certify.

### What is real and what is synthetic

This distinction is maintained deliberately and is stated throughout the interface.

**Real:**

- All fifteen monitored variants are genuine ClinVar records. Their current classifications,
  review statuses, submission counts, evaluation dates, dbSNP identifiers and coordinates are
  read from ClinVar; their historical classifications come from ClinVar's own archived releases.
- Population frequencies are gnomAD v4 allele counts. The Middle Eastern group is about 3,000
  people out of roughly 800,000, which is itself the regional evidence gap.
- CTGA readings are quoted from the catalogue and attributed. They are never presented as a
  VariantPulse classification.
- Linked publications, and the literature cited as regional context, are real and linked to PubMed.

**Synthetic:**

- Every patient record, record identifier, clinician, department and laboratory is fabricated.
  None corresponds to a real person or institution.
- The date each synthetic hospital report was issued is synthetic, and kept separate from the
  date of the ClinVar release the classification on record comes from.
- MYBPC3 c.776delinsTT's classification on record is a modelled hospital report, because ClinVar
  held no record of the variant in January 2023.

Nothing in VariantPulse is endorsed by, supplied by or integrated with any hospital, national
programme, registry or government entity. A sync walks the 26 synthetic records and nothing
else: there is no generated background volume behind the numbers.

## The accent and the alarm

The brand accent is the crimson of the mark. Critical status is also red, which is
a hazard: in a triage tool the alarm colour must never read as decoration. Two
things keep them apart. The accent is rose-leaning and held at a different hue from
the vermillion used for critical, and, more reliably, since hue alone is weak here,
only a `CRITICAL` priority is rendered as a **filled** badge. Everything else is
tinted. The distinction is carried by weight, which survives both a projector and a
colour-vision deficiency.

## Clinician in the loop

VariantPulse is decision support. It is not a certified medical device and has not been through
regulatory assessment.

- It **never** alters a patient record. The record system is read-only.
- It **never** issues or changes a diagnosis.
- It does not rank a regional source above a global one; where they disagree, it says so and asks
  for a human.
- Every generated summary is labelled as such and shown beside the citations it was composed from.
- No patient identifier, genotype or record content leaves the workspace. Live ClinVar reads send
  variant identifiers only. With an AI key configured, the evidence summary sends the case's variant
  facts, and a patient letter is sent for rewording only with its record reference, test date, team
  and clinician replaced by placeholders, restored after the reply is checked. Every flow is
  registered on the Trust & governance page.
- Review actions are attributed to the signed-in person and role, and recorded in the audit trail.

## Walkthrough

One synthetic patient from historical result to documented review, then how a partner would
evaluate it. The same path is linked step by step at the foot of `/pilot`.

1. **Home**. A historical synthetic patient, VP-10247: BRCA1 c.5056C>T, reported in 2023 as
   uncertain significance, which is what ClinVar said in its January 2023 release. Each bead on
   the helix is a monitored finding, coloured by what its evidence did: drag to turn it, and hover
   or tab to a bead to see the change (arrow keys move between them).
2. **Run evidence sync**. Reads current ClinVar live (or the verified snapshot offline), compares
   classifications, walks the 26 synthetic records and compares regional evidence; a ring scans
   along the helix as it runs. It ends on the highest-priority change: uncertain significance →
   likely pathogenic, four synthetic patients, one clinical review case.
3. **Open the case**. *What changed?* shows ClinVar's reading then and now, the archived
   checkpoints, how the four records were matched, and what limits the evidence.
4. **Take ownership and decide**. Open the review, write a rationale, choose *Refer to genetics*,
   and propose the suggested follow-ups.
5. **Approve and close**. Sign in as Dr. S. Hamdan, the service lead, from the prompt on the case;
   approve the follow-ups; close with a note. The journey reads six of six, with names and dates.
6. **Evaluate**. On `/pilot`, switch silent mode on, label a few alerts and silent variants, and
   watch the metrics fill in; the replay shows when each alert would first have fired.
7. **Onboard, oversee, govern**. Load the sample file on `/onboarding`, read the sponsor's view on
   `/oversight`, and download the governance package from `/governance`.
8. **Audit trail**. Every action above, with who, which role and when, exportable as CSV or JSON.

`/variants` stands every monitored variant on a to-scale map of the 24 chromosomes; the filters
and the list are linked to it both ways. Each variant's page shows its own chromosome, with the
band and position.

Global search is on `Ctrl`/`Cmd` + `K` and covers record IDs, gene symbols, HGVS strings, ClinVar
accessions and case numbers.

## Deploying to Cloudflare

The app runs on Cloudflare Workers through OpenNext, at `variantpulse.kanbanstudios.ae` (the custom
domain is declared in `wrangler.jsonc`, with `VARIANTPULSE_EVIDENCE_MODE=live`).

```bash
npx wrangler login
npm run cf:deploy          # builds with OpenNext, then deploys the Worker
```

If your Cloudflare login can reach more than one account, set `CLOUDFLARE_ACCOUNT_ID` to the
account that owns the zone first. To enable AI drafting, add the key as a Worker secret
(`npx wrangler secret put AI_API_KEY`); without it every summary and letter uses its template.
`.open-next/` and `.wrangler/` are build output: never commit them (`verify:tree` will stop you).

## Credits

The helix and the genome map are generated in code by VariantPulse itself: no model, texture or
image file is shipped or fetched. An earlier 3D model, licensed for non-commercial use only, has
been removed from the repository.

---

<div align="center">
  <sub><strong>VariantPulse</strong> · Genomic Change Intelligence · Built by Team Kanban</sub>
</div>
