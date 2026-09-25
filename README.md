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
is watching. Reclassification is not an edge case - it is the normal behaviour of a field where
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
Evidence sources ────── ClinVar · regional index · literature index
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

Change types: `CLASSIFICATION_DRIFT` (crossed the actionable boundary), `EVIDENCE_STRENGTHENED`,
`EVIDENCE_WEAKENED`, `CONSENSUS_CONFLICT`, `REGIONAL_CONFLICT`, `NO_MATERIAL_CHANGE`.

**Review priority** (`CRITICAL` / `HIGH` / `MEDIUM` / `LOW`) is a triage signal for the queue,
derived from listed factors that are shown alongside it. It is explicitly *not* a validated
clinical risk score and says nothing about any individual patient.

A model is used only to phrase the evidence summary, and only from structured fields that are
already on screen beside it.

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
npm run verify            # type-check, lint, data and contrast checks
npm run evidence:refresh  # re-pull the ClinVar snapshot
```

`npm run verify` runs four gates:

| Gate | What it catches |
|---|---|
| `type-check` | `tsc --noEmit` |
| `lint` | `eslint` |
| `verify:data` | incoherent clinical data |
| `verify:contrast` | inaccessible colour |

**`verify:data`** checks what the type system cannot: that every monitored variant
is backed by a real evidence record, that no patient points at a variant outside
the panel, that no citation renders as a link with no text, and, most importantly,
that no variant is presented as reclassified when the source last evaluated it
*before* the report it is supposed to have superseded. A case built on that premise
would be false, and it is the kind of error that reads as plausible right up until a
clinician checks it.

**`verify:contrast`** parses the design tokens out of `globals.css` and asserts
every foreground clears WCAG 2.1 AA against each surface it is actually painted on.
Small uppercase labels are still "normal text" under 1.4.3, so the faintest tone is
held to 4.5:1 rather than the 3:1 allowed for large text; the lightness hierarchy is
therefore shallow by design and size, case and tracking carry it instead.

No environment variables are required. VariantPulse reads public endpoints that need no key, and
works fully offline against its bundled evidence snapshot.

One is optional. With `AI_API_KEY` set in `.env.local` (see `.env.example`), a case drafts its
evidence summary with Claude, and the patient letter offers "Improve with AI". The model sees only
that case's data, has 8 seconds to answer, and its output is checked before it is shown: every
sentence must end with a source tag drawn from the case, and nothing may read as clinical advice.
Without a key, after a timeout, or when a check fails, the same summary is composed from a fixed
template, so nothing on screen depends on the model.

## Data sources

| Source | What it provides | Live? |
|---|---|---|
| **ClinVar** (NCBI E-utilities) | Current classification, review status, submission counts, evaluation dates, dbSNP and genomic coordinates | **Yes**, read at each sync |
| **PubMed** (NCBI E-utilities) | Publications linked to each variant record | Captured when the snapshot is refreshed |
| **Regional evidence index** | Arab and Gulf population observations | Modelled, see below |
| **Record system** | Historical genomic findings | Synthetic, see below |

### Live reads and fallback

Evidence is read live from ClinVar on every sync. If that call fails, times out, or returns a
partial response, the workspace serves its bundled snapshot instead and **says so**: the status
indicator switches from `live` to `cached` everywhere, with the reason attached. A partial
response is discarded rather than mixed with cached records, so a single comparison never spans
two different reads. Change detection runs locally, so the queue stays correct even with every
external source down.

Refresh the snapshot with `npm run evidence:refresh`.

## What is real and what is synthetic

This distinction is maintained deliberately and is stated throughout the interface.

**Real:**

- All twelve monitored variants are genuine ClinVar records, identified by their VCV accession.
  Their classifications, review statuses, submission counts, evaluation dates, dbSNP identifiers
  and genomic coordinates are read from ClinVar.
- Linked publications are real, cited by PMID and linked to PubMed.
- The literature cited in the regional evidence layer is real and peer-reviewed.

**Synthetic:**

- Every patient record, record identifier, clinician, department and laboratory is fabricated.
  None corresponds to a real person or institution.
- The historical classifications attributed to this workspace's record system are modelled; they
  represent what a hospital is taken to have reported at the time of testing.
- The regional index's cohort counts and per-variant assertions are modelled for this workspace.
  They are not live extracts from any national programme or registry, and nothing in VariantPulse
  is endorsed by or integrated with any government entity. The cited regional literature is real
  and is provided as supporting context for *why* regional interpretation can diverge, not as a
  per-variant assertion.

The finding corpus is generated from a fixed seed, so a sync genuinely walks all 12,482 records
on every run rather than reporting a number it did not compute.

## The accent and the alarm

The palette is defined in [docs/color-system.md](docs/color-system.md) and implemented as
tokens in `src/app/globals.css`. The interface is mostly neutral, with a bone (`#F7F4ED`) canvas,
warm-white (`#FFFEFB`) cards, carbon (`#17191C`) text, mineral-grey (`#DDDAD2`) borders, so
that colour always means something:

- **Garnet** (`#7A263A`) is VariantPulse itself: active navigation, selection, key numbers.
  Primary actions are **oxblood** (`#481A27`) with a garnet hover.
- **Vermilion** (`#E85D4A`) means one thing: *scientific knowledge changed*. It marks the
  reclassification pulse and the change connector (VUS → Likely pathogenic), and nothing else.
  It is used only as an indicator or large mark, never as small text.
- **Clinical green** is a connected or healthy source, **amber** is human review required,
  **clinical red** is high priority or a failed state, and **evidence blue** is neutral
  citation metadata. None of them is used for branding.

Garnet, vermilion and clinical red are all warm reds, which is a hazard in a triage tool. The
distinction is carried by role and weight rather than hue alone: only a `CRITICAL` priority is a
**filled** badge, everything else is tinted, and vermilion appears only at the moment of change.

Every text pairing clears WCAG AA, enforced by `npm run verify:contrast`. Where an exact
palette colour falls short as small text (slate `#74777D` is 4.09:1 on bone, amber text
`#A86E11` is 4.05:1 on its soft background), a text-safe token derived from it is used for text
(`faint` `#6B6E74`, `warn` `#94620F`) and the original is kept for icons, dots and fills.

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

1. **Home**. The change in one screen: what was reported, what is held now, who is affected.
2. **Run evidence sync**. Re-reads ClinVar, walks all 12,482 findings, and reports what it found.
3. **Evidence changes requiring attention**. Each item opens a review case.
4. **Open a case**. Patient impact on the left, the evidence in the centre, the decision on the
   right. Expand *How VariantPulse reached this result* for the full eight-step derivation.
5. **Regional insights**. Where global and regional evidence disagree, and why that matters for a
   population the reference cohorts under-represent.
6. **Generate evidence brief**. A clinician-facing brief, printable and downloadable.
7. **Activity**. The audit trail behind all of it.

Global search is on `Ctrl`/`Cmd` + `K` and covers record IDs, gene symbols, HGVS strings, ClinVar
accessions and case numbers.

---

<div align="center">
  <sub><strong>VariantPulse</strong> · Genomic Change Intelligence · Built by Team Kanban</sub>
</div>

<div align="center">
  <sub><strong>Team Members</strong> · Bilal Feroz Khan · Awaiz Ahmed · Huda Mueen</sub>
</div>
