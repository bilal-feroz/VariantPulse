# VariantPulse Color System

This file defines the official VariantPulse visual color palette.

The design goal is: premium clinical software, serious genomics, warm precision, and strong visual identity.

Avoid generic AI aesthetics:
- no purple gradients
- no neon cyan
- no glowing blue sci-fi UI
- no rainbow gradients
- no excessive glassmorphism
- no overly saturated health-tech blues

The interface should feel closer to:
- precision medicine
- enterprise clinical software
- modern biotech
- high-end research tooling

than to:
- generic AI startup
- crypto dashboard
- futuristic gaming UI

---

## Core Palette

### Primary Garnet

Deep Garnet
`#7A263A`

Use for:
- primary brand color
- active navigation
- key headings
- selected states
- important icons
- primary controls
- main data emphasis

This is the dominant brand color.

---

### Primary Dark

Oxblood
`#481A27`

Use for:
- primary CTA backgrounds
- dark buttons
- hover states
- deep brand contrast
- selected clinical actions
- strong emphasis

Do not use as the page background.

---

### Pulse Accent

Vermilion
`#E85D4A`

Use sparingly.

This color should represent:
- newly detected scientific evidence
- reclassification events
- a meaningful change in genomic knowledge
- active pulse / event / delta states

Do not use this as a general-purpose accent everywhere.

The visual meaning of vermilion is:

**something changed**

---

## Neutral System

### Page Background

Bone
`#F7F4ED`

Use for:
- main app background
- large page surfaces
- side navigation background
- empty canvas areas

This should be the dominant background color.

---

### Card Surface

Warm White
`#FFFEFB`

Use for:
- cards
- modals
- side panels
- clinical review surfaces
- tables
- data containers

---

### Main Text

Carbon
`#17191C`

Use for:
- primary text
- headings
- table values
- critical labels
- body copy requiring high contrast

Avoid pure black unless absolutely necessary.

---

### Muted Text

Slate
`#74777D`

Use for:
- descriptions
- timestamps
- metadata
- secondary labels
- inactive navigation text

---

### Borders

Mineral Grey
`#DDDAD2`

Use for:
- card borders
- separators
- table lines
- subtle dividers
- disabled controls

Borders should be low contrast.

---

## Semantic Colors

### Stable / Connected

Clinical Green
`#277C66`

Use only for:
- connected
- verified
- stable
- live data source
- successful sync
- completed workflow

Do not use green for branding.

---

### Needs Review

Amber
`#D99A28`

Use for:
- review required
- medium priority
- unresolved context
- pending clinician action

---

### Critical Change

Clinical Red
`#C63D3D`

Use for:
- high-priority genomic change
- critical review state
- failed sync
- severe clinical attention state

Do not overuse it.

---

### Informational Evidence

Evidence Blue
`#416B8C`

Use minimally for:
- source metadata
- neutral evidence links
- informational states
- citations

This is not a primary brand color.

---

## Recommended Usage Ratio

The interface should remain mostly neutral.

Approximate visual balance:

- 70% Bone / Warm White
- 15% Carbon / Slate
- 8% Garnet
- 3% Oxblood
- 2% Vermilion
- 2% semantic status colors

The UI should never feel red-heavy.

---

## Component Rules

### Primary CTA

Background:
`#481A27`

Text:
`#FFFFFF`

Hover:
`#7A263A`

Example:

Open Clinical Review

---

### Secondary CTA

Background:
`#FFFEFB`

Text:
`#7A263A`

Border:
`#DDDAD2`

Hover background:
`#F7F4ED`

---

### Active Navigation

Background:
`#F0DFE2`

Text:
`#7A263A`

Icon:
`#7A263A`

Inactive navigation should remain neutral.

---

### Selected Clinical Record

Background:
`#FFF8F6`

Border:
`#E8C5CC`

Left accent:
`#7A263A`

---

### Knowledge Change Event

Old state:
`#74777D`

Transition:
`#E85D4A`

New state:
`#7A263A`

Example:

VUS → Likely Pathogenic

The arrow / pulse / changed indicator should use Vermilion.

---

### Live Data Source

Dot:
`#277C66`

Label:
`#277C66`

Everything else remains neutral.

---

### High Priority Review

Background:
`#FFF1EF`

Text:
`#C63D3D`

Border:
`#F0C5C0`

---

### Medium Priority Review

Background:
`#FFF8E8`

Text:
`#A86E11`

Border:
`#E8D19C`

---

### Low / Stable

Background:
`#EDF6F2`

Text:
`#277C66`

Border:
`#C6DED5`

---

## Gradients

Avoid gradients where possible.

If a subtle brand gradient is absolutely necessary:

`linear-gradient(135deg, #481A27 0%, #7A263A 65%, #E85D4A 100%)`

Use only for:
- hero illustration accents
- selected visualization elements
- brand artwork
- special transition animations

Never use this gradient as the default background for cards or pages.

---

## Data Visualization

Charts should prioritize readability.

Suggested chart sequence:

1. `#7A263A`
2. `#416B8C`
3. `#277C66`
4. `#D99A28`
5. `#E85D4A`
6. `#74777D`

Do not use multiple shades of purple.

For historical vs current genomic interpretation:

Historical:
`#74777D`

Current:
`#7A263A`

Knowledge-change connector:
`#E85D4A`

---

## Visual Meaning

VariantPulse colors should have semantic meaning.

### Garnet
VariantPulse itself.
Clinical intelligence.
Genomic surveillance.
Review workflow.

### Vermilion
Scientific knowledge changed.

### Green
System is healthy / source connected / stable.

### Amber
Human review required.

### Red
High priority or failed state.

### Blue
Neutral external evidence only.

---

## Typography Pairing

Primary text should use Carbon:
`#17191C`

Brand emphasis can use Garnet:
`#7A263A`

Do not color full paragraphs garnet.

Use Garnet mainly for:
- short emphasis
- numbers
- labels
- active UI
- section highlights

---

## Logo Guidance

VariantPulse logo should use:

Primary:
`#7A263A`

Dark:
`#481A27`

Optional pulse detail:
`#E85D4A`

Logo should work on:
- Bone `#F7F4ED`
- Warm White `#FFFEFB`
- Carbon `#17191C`

Avoid blue or purple versions of the logo.

---

## Design Principle

The product should visually communicate:

**Old genomic data is quiet until scientific knowledge changes.**

Most of the interface should therefore stay calm and neutral.

When VariantPulse detects a meaningful change, Vermilion appears as the pulse signal.

That moment should feel intentional and visually important.

---

## CSS Variables

```css
:root {
  --vp-garnet: #7A263A;
  --vp-oxblood: #481A27;
  --vp-vermilion: #E85D4A;

  --vp-bone: #F7F4ED;
  --vp-white: #FFFEFB;
  --vp-carbon: #17191C;
  --vp-slate: #74777D;
  --vp-border: #DDDAD2;

  --vp-success: #277C66;
  --vp-warning: #D99A28;
  --vp-danger: #C63D3D;
  --vp-info: #416B8C;

  --vp-active-bg: #F0DFE2;
  --vp-selected-bg: #FFF8F6;
  --vp-danger-bg: #FFF1EF;
  --vp-warning-bg: #FFF8E8;
  --vp-success-bg: #EDF6F2;
}
```

---

## Tailwind Tokens

```js
colors: {
  vp: {
    garnet: "#7A263A",
    oxblood: "#481A27",
    vermilion: "#E85D4A",
    bone: "#F7F4ED",
    white: "#FFFEFB",
    carbon: "#17191C",
    slate: "#74777D",
    border: "#DDDAD2",
    success: "#277C66",
    warning: "#D99A28",
    danger: "#C63D3D",
    info: "#416B8C",
  }
}
```

---

## AI / Coding Agent Instruction

When generating or editing VariantPulse UI:

- follow this palette exactly
- do not introduce purple
- do not introduce neon blue
- do not introduce random gradients
- do not use generic "AI glow"
- use neutral surfaces first
- use garnet for product identity
- reserve vermilion for scientific change events
- use semantic colors only for their intended state
- prefer subtle shadows over strong glow
- prioritize clinical readability over visual effects
- keep the interface bright, warm, premium, and restrained
- always preserve strong contrast and accessibility

---

## Accessibility note

Slate `#74777D` is about 4.09:1 on Bone and 4.45:1 on Warm White, so it fails WCAG AA (4.5:1) for small text.

- Use `#74777D` for non-text only: icons, dividers, the historical-state connector.
- For small muted text use the text-safe slate `#6B6E74` (about 4.65:1 on Bone, 5.07:1 on Warm White). In code this is the `faint` token.
- The documented amber text `#A86E11` is about 4.05:1 on its soft background; small amber text uses `#94620F` (the `warn` token). `#D99A28` stays a fill / indicator colour.
- Vermilion `#E85D4A` is about 3.1:1 on Bone: indicators and large marks only, never small text.

`npm run verify:contrast` enforces this: every small-text token must clear 4.5:1 on Bone, Warm White and the active / selected backgrounds it is used on, and `#74777D` may not be used as a text token.
