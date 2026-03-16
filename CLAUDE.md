# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Static site that showcases cross-pollination experiment results from Harmonica deliberation sessions. Sessions are auto-synced from Harmonica's API via harmonica-sync, parsed by a Node.js build script, and deployed to GitHub Pages at `results.openfac.org`.

Part of the [Open Facilitation Library](https://github.com/Open-Facilitation-Library) (OFL).

## Commands

```bash
npm run build          # Parse _sessions/*.md → render HTML → write to dist/
npm run sync           # Fetch sessions from Harmonica API → write markdown to _sessions/
npm run sync-and-build # Both in sequence
```

Requires `HARMONICA_API_KEY` env var for sync (get from Harmonica dashboard → Settings → API Keys).

## Architecture

### Data Flow

```
Harmonica API → harmonica-sync → _sessions/*.md → build.js → dist/*.html → GitHub Pages
```

### build.js Pipeline

Single-file build script (ESM). Reads `_sessions/*.md`, extracts structured data, renders Mustache templates to `dist/`.

1. **Load**: Parse YAML frontmatter (gray-matter) + markdown body from each session file
2. **Normalize**: Strip `\r\n` → `\n` (Windows CRLF fix — critical, breaks H2 regex without it)
3. **Extract sections**: Split markdown body on `## ` headings → `{ heading, id, content_html }[]`
4. **Extract votes**: Regex patterns for `**Option**: ~XX%` format variations → bar chart data
5. **Extract quotes**: Italic-wrapped quotes + blockquotes > 40 chars → up to 6 highlights
6. **Detect pairs**: Group sessions by topic after stripping `P1`/`P2` prefix → cross-link paired sessions
7. **Render**: Mustache templates (`templates/session.html`, `templates/index.html`) → `dist/`
8. **Copy**: `static/` assets + `CNAME` → `dist/`

### Key Gotchas

- **gray-matter parses YAML dates into JS Date objects**, not strings. Use `formatDate()` helper when passing to Mustache templates.
- **Pair detection relies on P1/P2 naming convention** in session topics (e.g., "P1 Donation Collective Choice" / "P2 Donation Collective Choice"). Not enforced by Harmonica.
- **Vote extraction is best-effort** with 3 regex patterns. Falls back to rendering first section as-is when no percentages found.
- **Session template conditionally renders Opinion Shift section** only when `has_pair` is true.

### Templates

- `session-template.md` — Mustache template for harmonica-sync (controls markdown output format + frontmatter fields)
- `templates/session.html` — Mustache template for individual results pages
- `templates/index.html` — Mustache template for experiment index
- `static/style.css` — Dark observatory theme (DM fonts, lime green accent `#c8f060`, grid overlay)

### Deployment

- GitHub Action (`.github/workflows/sync-and-build.yml`) runs every 6 hours + manual dispatch
- Deploys `dist/` to `gh-pages` branch via `peaceiris/actions-gh-pages`
- Custom domain `results.openfac.org` via CNAME
- Secret: `HARMONICA_API_KEY` (repo settings)
