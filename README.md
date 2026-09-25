<div align="center">
  <img src="public/logo.png" alt="VariantPulse" width="88" />
  <h1>VariantPulse</h1>
  <p><strong>Genomic Change Intelligence</strong></p>
  <p><em>Your DNA didn't change. Science did.</em></p>
</div>

---

## The problem

A patient has genetic testing. A variant comes back as **VUS — a variant of uncertain
significance**. The report is filed, and the patient goes home.

Years later, new functional studies are published, new submissions reach ClinVar, and an expert
panel reviews the variant. The consensus moves. The variant is now considered pathogenic.

The patient's DNA has not changed. The evidence around it has.

But the report in the record system still says what it said on the day it was issued, and nobody
is watching. Reclassification is not an edge case — it is the normal behaviour of a field where
evidence accumulates faster than old reports are revisited. At population scale, that gap widens
quietly and continuously.

## What VariantPulse does

VariantPulse continuously compares historical genomic findings against current scientific
evidence and surfaces:

- **what changed** — the interpretation on record versus the interpretation held today
- **when and why** — the submissions, review status and literature behind the move
- **who is affected** — every historical record carrying the changed variant
- **where sources disagree** — global consensus against regional evidence
- **what needs a human** — a prioritised clinical review queue

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
Human decision ──────── a clinician decides; nothing is written automatically
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
npm run verify            # type-check, lint, data, history and contrast checks
npm run verify:history    # historical vs current, variant by variant (--live, --archive)
npm run evidence:refresh  # re-pull the ClinVar snapshot (deliberate; never at runtime)
```

`npm run verify` runs five gates:

| Gate | What it catches |
|---|---|
| `type-check` | `tsc --noEmit` |
| `lint` | `eslint` |
| `verify:data` | incoherent clinical data |
| `verify:history` | prints historical against current for every variant |
| `verify:contrast` | inaccessible colour |

**`verify:data`** checks what the type system cannot, and runs the application's own engine
against the snapshot to do it: identifiers that disagree between the panel, the snapshot and
`provenance.json`; malformed HGVS; duplicate records; a historical classification that does not
match the January 2023 release, or current evidence leaking into history; frequencies outside 0–1;
a patient-impact join that drops a record; an unchanged variant that opens a case; and — most
importantly — any reclassification that cannot be reproduced from the supplied historical and
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

With the bundled snapshot, `npm run verify:data` computes: **11 reclassifications** (10 against the
January 2023 release, 1 against the modelled hospital report), **1 consensus conflict**, **2 regional
signals**, **3 unchanged classifications** — two of which raise nothing at all — and **13 review
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
partial response, the workspace serves its verified snapshot instead and **says so** — the status
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
the vermillion used for critical, and — more reliably, since hue alone is weak here
— only a `CRITICAL` priority is rendered as a **filled** badge. Everything else is
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
- Only a variant identifier is ever sent to an external service. No patient identifier, genotype,
  or record content leaves the workspace.
- Review actions are attributed to the signed-in clinician and recorded in the audit trail.

## Walkthrough

1. **Home** — a historical synthetic patient, VP-10247: BRCA1 c.5056C>T, reported in 2023 as
   uncertain significance, which is what ClinVar said in its January 2023 release.
2. **Run evidence sync** — reads current ClinVar live (or the verified snapshot offline), compares
   classifications, walks the 26 synthetic records and compares regional evidence. It ends on the
   highest-priority change: uncertain significance → likely pathogenic, four synthetic patients,
   one clinical review case.
3. **Evidence changes requiring attention** — each item opens a review case. The unchanged
   controls (LDLR c.2479G>A, BRCA1 c.1140dup) raise nothing.
4. **Open a case** — patient impact on the left, the evidence in the centre, the decision on the
   right. Expand *How VariantPulse reached this result* for the full eight-step derivation.
5. **Regional insights** — gnomAD v4 Middle Eastern frequencies against the global figure, CTGA
   readings, the two regional signals (HBB c.380T>G, CFTR c.601G>A), and the two cases where the
   regional record was ahead of ClinVar (Hb D-Punjab, MYBPC3 c.776delinsTT).
6. **Generate evidence brief** — a clinician-facing brief, printable and downloadable.
7. **Activity** — the audit trail behind all of it.

Global search is on `Ctrl`/`Cmd` + `K` — record IDs, gene symbols, HGVS strings, ClinVar
accessions and case numbers.

---

<div align="center">
  <sub><strong>VariantPulse</strong> · Genomic Change Intelligence · Built by Team Kanban</sub>
</div>
