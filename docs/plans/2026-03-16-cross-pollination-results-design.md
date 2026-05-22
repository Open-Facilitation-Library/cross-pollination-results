# Cross-Pollination Results Site — Design Spec

## Overview

A multi-page static site under the OFL GitHub org (`Open-Facilitation-Library/cross-pollination-results`) that showcases results from cross-pollination experiments run on the Harmonica platform. Data flows automatically from Harmonica sessions via harmonica-sync, through a Node.js build script, to GitHub Pages.

**Domain:** Subdomain of openfac.org (e.g., `results.openfac.org`)

**First session:** `hst_dbf516d28d66` — P1 Donation Collective Choice (50 participants, charity allocation study by Maria Milosh)

## Design Aesthetic

Inspired by Maria Milosh's landing page (`maria-milosh.github.io/demo_landing.html`):
- Dark background (`#0e0f0c`), grid overlay
- DM font family (DM Serif Display, DM Sans, DM Mono)
- Lime green accent (`#c8f060`), gold secondary (`#f0d060`)
- Monospace uppercase labels, progressive disclosure via `<details>` elements
- Sticky quick-nav, fade-up animations

## Repository Structure

```
cross-pollination-results/
├── _sessions/              # harmonica-sync output (markdown files)
├── templates/
│   ├── session.html        # Single session results page template (Mustache)
│   └── index.html          # Index page listing all experiments
├── static/
│   └── style.css           # Shared dark theme
├── dist/                   # Built output (gitignored, deployed to GH Pages)
├── build.js                # Node.js build script
├── harmonica.config.json   # harmonica-sync config
├── session-template.md     # harmonica-sync Mustache template
├── package.json            # Dependencies: mustache, marked, gray-matter
├── CNAME                   # Custom domain
└── .github/
    └── workflows/
        └── sync-and-build.yml
```

## Data Flow

```
Harmonica API → harmonica-sync → _sessions/*.md → build.js → dist/*.html → GitHub Pages
```

1. **Sync**: harmonica-sync fetches session data, writes markdown files to `_sessions/` with YAML frontmatter + summary body
2. **Parse**: `build.js` reads each markdown file, extracts frontmatter and splits body into structured sections by H2 headings
3. **Render**: Each session rendered through `session.html` Mustache template. Index page lists all sessions.
4. **Deploy**: GitHub Action commits `dist/` and deploys to GitHub Pages

## Session Page Template Structure

1. **Header** — "Cross-Pollination Results" logo + session status tag
2. **Quick nav** — sticky navigation anchoring to page sections
3. **Hero** — session title, "EXPERIMENT RESULTS" eyebrow, participant count, date
4. **The Question** — session goal/topic in accent-bordered block
5. **Key Results** — voting distribution as CSS-only horizontal bars (percentages extracted from summary)
6. **Reasoning by Option** — collapsible `<details>` sections per option with arguments and blockquote highlights
7. **Cross-Cutting Themes** — collapsible thematic sections from summary
8. **Opinion Shift** *(conditional)* — only renders when paired P2 session exists. Before/after comparison.
9. **Methodology** — "How Cross-Pollination Works" 4-step grid explaining the technique
10. **Footer** — links to OFL, Substack, session metadata

## Index Page Structure

Dark-themed list of all experiments — title, date, participant count, status badge, link. Sorted by date descending.

## Showcasing Cross-Pollination

The site demonstrates cross-pollination's value through multiple lenses, adapting to available data:

**Single session (always available):**
- Reasoning richness — depth and diversity of arguments
- Convergence/divergence patterns — where people agree vs. stay divided
- Framework diversity — different reasoning approaches for the same question

**Paired sessions (when P1+P2 exist):**
- Opinion shift — how views changed after exposure to other perspectives
- Most persuasive arguments — which reasoning moved people

### Adaptive Rendering

- Sections 1-7, 9-10 always render
- Section 8 (Opinion Shift) only renders when build script detects a paired session
- Pairing detection: topic prefix matching (e.g., "P1 Donation..." / "P2 Donation...")

## Build Script (`build.js`) Design

**Dependencies:** `mustache`, `marked`, `gray-matter`

**Core logic:**

1. Read all `_sessions/*.md` files
2. For each file:
   - Parse frontmatter → title, date, id, participants, status
   - Parse markdown body → HTML
   - Extract structured sections by splitting on H2 headings → `{ heading, content_html }[]`
   - Detect voting distribution: percentage patterns like `~35%` near option names → data array for bar rendering
   - Detect notable quotes: blockquotes → quotes array
3. Detect pairs: group sessions by topic prefix (strip P1/P2)
4. Render each session through `session.html` template → `dist/<slug>/index.html`
5. Render `index.html` with session list
6. Copy `static/style.css` and `CNAME` to `dist/`

**Section extraction is heading-based, not content-specific.** The parser splits on H2s and renders all sections as collapsible blocks. Works for any session topic.

**Voting percentage extraction** uses multiple regex patterns to handle format variations in AI-generated summaries:
- `**Option Name**: ~XX%` (bold label with tilde)
- `**Option Name** — XX%` (em dash separator)
- `Option Name: XX%` (plain text)

If no percentages are found, the Key Results section renders the first H2 section as-is (no bar chart). This is an acceptable degradation — the section still shows useful content, just without the visual bars.

## harmonica-sync Configuration

```json
{
  "sync": {
    "search": ["Cross-Pollination", "Donation Collective Choice"],
    "minParticipants": 1,
    "requireSummary": true
  },
  "output": {
    "dir": "_sessions",
    "filename": "{{date}}-{{slug}}.md",
    "template": "./session-template.md"
  }
}
```

`requireSummary: true` ensures we only sync sessions that have summary content — the entire page template depends on it. The `template` field points to our custom Mustache template so harmonica-sync produces frontmatter fields matching what `build.js` expects.

**`{{slug}}`** is derived by harmonica-sync from the session topic: lowercased, spaces replaced with hyphens, special characters stripped (e.g., "P1 Donation Collective Choice" → `p1-donation-collective-choice`).

## GitHub Action

**Trigger:** Cron every 6 hours + manual `workflow_dispatch`

**Steps:**
1. Checkout repo
2. `npx harmonica-sync`
3. `node build.js`
4. Commit `dist/` if changed
5. Deploy to GitHub Pages

**Secrets:** `HARMONICA_API_KEY`

## Deployment

- GitHub Pages deployed via `gh-pages` branch (the GitHub Action pushes `dist/` contents to `gh-pages` using `peaceiris/actions-gh-pages` or equivalent)
- CNAME file for custom subdomain of openfac.org
- DNS: CNAME record pointing subdomain to `open-facilitation-library.github.io`

## Known Limitations

- **Pair detection is convention-based.** Relies on P1/P2 topic prefix naming. Not enforced by Harmonica — future experiments must follow the convention for pairing to work.
- **Voting extraction is best-effort.** Multiple regex patterns handle known formats, but novel summary formats may not match. Degrades gracefully to rendered markdown.
- **Methodology section is static.** Hardcoded educational content about cross-pollination. Needs manual update if the methodology evolves.
