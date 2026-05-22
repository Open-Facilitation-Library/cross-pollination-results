# Cross-Pollination Results Site — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-page static site that showcases cross-pollination experiment results from Harmonica sessions, auto-synced via harmonica-sync and deployed to GitHub Pages.

**Architecture:** Node.js build script reads harmonica-sync markdown output, extracts structured sections from AI summaries by splitting on H2 headings, renders through Mustache HTML templates, outputs static files to `dist/`. GitHub Action syncs every 6 hours and rebuilds.

**Tech Stack:** Node.js, Mustache, marked, gray-matter, harmonica-sync, GitHub Actions, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-03-16-cross-pollination-results-design.md`

**Reference:** Maria Milosh's landing page at `https://github.com/maria-milosh/maria-milosh.github.io/blob/main/demo_landing.html` — dark theme, DM fonts, lime green accent, grid overlay, progressive disclosure.

---

## File Structure

```
cross-pollination-results/
├── _sessions/                          # harmonica-sync output (gitignored in dist, committed in repo)
│   └── (generated .md files)
├── templates/
│   ├── session.html                    # Mustache template for individual session pages
│   └── index.html                      # Mustache template for experiment index
├── static/
│   └── style.css                       # Shared dark theme (Maria-inspired)
├── build.js                            # Build script: parse markdown → render HTML → write dist/
├── harmonica.config.json               # harmonica-sync configuration
├── session-template.md                 # Mustache template for harmonica-sync markdown output
├── package.json                        # Project manifest + dependencies
├── CNAME                               # Custom domain for GitHub Pages
├── .gitignore                          # dist/ ignored
├── README.md                           # Project documentation
└── .github/
    └── workflows/
        └── sync-and-build.yml          # Sync + build + deploy pipeline
```

---

## Chunk 1: Repository Setup & Build Infrastructure

### Task 1: Create GitHub repo and scaffold project

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `CNAME`
- Create: `README.md`

- [ ] **Step 1: Create the repo on GitHub**

```bash
gh repo create Open-Facilitation-Library/cross-pollination-results --public --description "Cross-pollination experiment results — auto-synced from Harmonica" --clone
```

- [ ] **Step 2: Initialize package.json**

```bash
cd cross-pollination-results
npm init -y
npm install mustache marked gray-matter
```

Then edit `package.json` to set name/description/scripts:

```json
{
  "name": "cross-pollination-results",
  "version": "1.0.0",
  "description": "Cross-pollination experiment results site",
  "type": "module",
  "private": true,
  "scripts": {
    "build": "node build.js",
    "sync": "npx harmonica-sync",
    "sync-and-build": "npm run sync && npm run build"
  },
  "dependencies": {
    "gray-matter": "^4.0.3",
    "marked": "^15.0.0",
    "mustache": "^4.2.0"
  }
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
```

- [ ] **Step 4: Create CNAME**

```
results.openfac.org
```

- [ ] **Step 5: Create README.md**

```markdown
# Cross-Pollination Results

Experiment results from [cross-pollination](https://github.com/Open-Facilitation-Library/cross-pollination) sessions run on [Harmonica](https://harmonica.chat).

Sessions are auto-synced via [harmonica-sync](https://github.com/harmonicabot/harmonica-sync) and rendered as static pages.

## Local Development

```bash
npm install
export HARMONICA_API_KEY=hm_live_...
npm run sync-and-build
# Open dist/index.html in browser
```

## How It Works

1. GitHub Action runs every 6 hours
2. `harmonica-sync` fetches session data → writes markdown to `_sessions/`
3. `build.js` parses markdown → renders HTML templates → writes to `dist/`
4. `dist/` deployed to GitHub Pages at results.openfac.org

Part of the [Open Facilitation Library](https://github.com/Open-Facilitation-Library).
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore CNAME README.md
git commit -m "feat: scaffold project with dependencies"
```

---

### Task 2: Create harmonica-sync configuration and session template

**Files:**
- Create: `harmonica.config.json`
- Create: `session-template.md`
- Create: `_sessions/.gitkeep`

- [ ] **Step 1: Create harmonica.config.json**

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

- [ ] **Step 2: Create session-template.md**

This is the Mustache template harmonica-sync uses to render session markdown. Based on the default template from harmonica-sync but with fields our build script expects:

```markdown
---
title: "{{{topic}}}"
date: {{date}}
session_id: {{id}}
participants: {{participant_count}}
status: {{status}}
goal: "{{{goal}}}"
tags:
{{#tags}}
  - {{{.}}}
{{/tags}}
---

# {{{topic}}}
{{#critical}}
**Critical Question:** {{{critical}}}
{{/critical}}

{{#context}}
## Context

{{{context}}}
{{/context}}

{{#summary}}
## Summary

{{{summary}}}
{{/summary}}

{{#responses}}
## Participant Responses

{{#participants}}
### Participant {{number}}

{{#messages}}
> {{{content}}}

{{/messages}}
{{/participants}}
{{/responses}}
```

- [ ] **Step 3: Create _sessions/.gitkeep**

Empty file to ensure the directory is tracked by git.

- [ ] **Step 4: Run harmonica-sync to fetch the first session**

```bash
export HARMONICA_API_KEY=hm_live_...  # get from Harmonica dashboard
npx harmonica-sync
```

Expected: `_sessions/2026-03-13-p1-donation-collective-choice.md` (or similar) created.

- [ ] **Step 5: Verify the synced markdown has expected frontmatter fields**

```bash
head -15 _sessions/*.md
```

Expected: YAML frontmatter with `title`, `date`, `session_id`, `participants`, `status`, `tags`.

- [ ] **Step 6: Commit**

```bash
git add harmonica.config.json session-template.md _sessions/
git commit -m "feat: add harmonica-sync config and first synced session"
```

---

### Task 3: Build script — markdown parser and section extractor

**Files:**
- Create: `build.js`

- [ ] **Step 1: Write build.js with core parsing logic**

The build script has three responsibilities: (a) parse session markdown, (b) extract structured data, (c) render templates. This step implements (a) and (b).

```js
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import Mustache from 'mustache';

const SESSIONS_DIR = '_sessions';
const TEMPLATES_DIR = 'templates';
const STATIC_DIR = 'static';
const DIST_DIR = 'dist';

// --- Section extraction ---

function extractSections(markdownBody) {
  // Split on H2 headings (## ), keeping the heading text
  const lines = markdownBody.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)$/);
    if (h2Match) {
      if (current) sections.push(current);
      current = { heading: h2Match[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
    // Lines before first H2 are ignored (already in frontmatter/H1)
  }
  if (current) sections.push(current);

  return sections.map(s => ({
    heading: s.heading,
    id: s.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    content_md: s.lines.join('\n').trim(),
    content_html: marked(s.lines.join('\n').trim()),
  }));
}

// --- Voting extraction ---

const VOTE_PATTERNS = [
  // **Option Name**: ~XX% or **Option Name**: ~XX% (description)
  /\*\*(.+?)\*\*[:\s]+~?(\d+)%/g,
  // **Option Name** — XX%
  /\*\*(.+?)\*\*\s*[—–-]\s*~?(\d+)%/g,
  // Option Name: XX%
  /^[-*]\s*(.+?):\s*~?(\d+)%/gm,
];

function extractVotes(markdownBody) {
  const votes = [];
  const seen = new Set();

  for (const pattern of VOTE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(markdownBody)) !== null) {
      const name = match[1].trim();
      if (!seen.has(name)) {
        seen.add(name);
        votes.push({ name, percent: parseInt(match[2], 10) });
      }
    }
    if (votes.length > 0) break; // Use first pattern that matches
  }

  return votes;
}

// --- Quote extraction ---

function extractQuotes(markdownBody) {
  const quotes = [];
  // Match Notable Quote patterns: *"quoted text"* (italic-wrapped quotes in summaries)
  const italicQuoteRegex = /\*"(.+?)"\*/g;
  let match;
  while ((match = italicQuoteRegex.exec(markdownBody)) !== null) {
    quotes.push(match[1].trim());
  }
  // Also match markdown blockquotes that look like participant quotes (Conv. N)
  const blockquoteRegex = /^>\s*\*?"?(.+?)"?\*?\s*$/gm;
  while ((match = blockquoteRegex.exec(markdownBody)) !== null) {
    const text = match[1].trim();
    if (text.length > 40 && !quotes.includes(text)) { // Only substantial quotes
      quotes.push(text);
    }
  }
  return quotes.slice(0, 6); // Limit to 6 best quotes
}

// --- Pair detection ---

function detectPairs(sessions) {
  const groups = {};
  for (const session of sessions) {
    const title = session.frontmatter.title || '';
    const stripped = title.replace(/^P[12]\s+/i, '').trim();
    if (!groups[stripped]) groups[stripped] = [];
    groups[stripped].push(session);
  }
  // Mark pairs
  for (const [key, group] of Object.entries(groups)) {
    if (group.length >= 2) {
      const p1 = group.find(s => /^P1\b/i.test(s.frontmatter.title));
      const p2 = group.find(s => /^P2\b/i.test(s.frontmatter.title));
      if (p1 && p2) {
        p1.pair = p2;
        p2.pair = p1;
        p1.isPhase1 = true;
        p2.isPhase2 = true;
      }
    }
  }
}

// --- Session loading ---

function loadSessions() {
  if (!existsSync(SESSIONS_DIR)) return [];

  const files = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.md'));
  return files.map(file => {
    const raw = readFileSync(join(SESSIONS_DIR, file), 'utf-8');
    const { data: frontmatter, content: body } = matter(raw);
    const sections = extractSections(body);
    const votes = extractVotes(body);
    const quotes = extractQuotes(body);
    const slug = basename(file, '.md');

    return { file, slug, frontmatter, body, sections, votes, quotes };
  }).sort((a, b) => (b.frontmatter.date || '').localeCompare(a.frontmatter.date || ''));
}

// --- Build ---

function build() {
  const sessions = loadSessions();
  detectPairs(sessions);

  mkdirSync(DIST_DIR, { recursive: true });

  // Load templates
  const sessionTemplate = readFileSync(join(TEMPLATES_DIR, 'session.html'), 'utf-8');
  const indexTemplate = readFileSync(join(TEMPLATES_DIR, 'index.html'), 'utf-8');

  // Render each session page
  for (const session of sessions) {
    const outDir = join(DIST_DIR, session.slug);
    mkdirSync(outDir, { recursive: true });

    const html = Mustache.render(sessionTemplate, {
      title: session.frontmatter.title,
      date: session.frontmatter.date,
      session_id: session.frontmatter.session_id,
      participants: session.frontmatter.participants,
      status: session.frontmatter.status,
      goal: session.frontmatter.goal || '',
      sections: session.sections,
      votes: session.votes,
      has_votes: session.votes.length > 0,
      quotes: session.quotes.map(q => ({ text: q })),
      has_quotes: session.quotes.length > 0,
      has_pair: !!session.pair,
      is_phase1: !!session.isPhase1,
      pair_slug: session.pair?.slug,
      pair_title: session.pair?.frontmatter.title,
    });

    writeFileSync(join(outDir, 'index.html'), html);
  }

  // Render index page
  const indexHtml = Mustache.render(indexTemplate, {
    sessions: sessions.map(s => ({
      title: s.frontmatter.title,
      date: s.frontmatter.date,
      participants: s.frontmatter.participants,
      status: s.frontmatter.status,
      slug: s.slug,
      has_pair: !!s.pair,
    })),
  });
  writeFileSync(join(DIST_DIR, 'index.html'), indexHtml);

  // Copy static assets
  if (existsSync(STATIC_DIR)) {
    cpSync(STATIC_DIR, DIST_DIR, { recursive: true });
  }

  // Copy CNAME
  if (existsSync('CNAME')) {
    cpSync('CNAME', join(DIST_DIR, 'CNAME'));
  }

  console.log(`Built ${sessions.length} session page(s) → ${DIST_DIR}/`);
}

build();
```

- [ ] **Step 2: Test the build script with the synced session**

```bash
node build.js
```

Expected: Fails because `templates/session.html` and `templates/index.html` don't exist yet. That's expected — confirms the parser runs up to the template-loading step.

- [ ] **Step 3: Commit**

```bash
git add build.js
git commit -m "feat: add build script with markdown parser and section extractor"
```

---

## Chunk 2: HTML Templates & Styling

### Task 4: Create the shared CSS theme

**Files:**
- Create: `static/style.css`

- [ ] **Step 1: Write style.css**

Use @frontend-design skill. Reference Maria's landing page HTML (provided in the spec) for the exact aesthetic. The CSS should closely match Maria Milosh's dark aesthetic:
- Dark background (`#0e0f0c`), surface (`#161712`), border (`#2a2b26`)
- Accent lime green (`#c8f060`), gold secondary (`#f0d060`)
- DM font family: DM Serif Display (headings), DM Sans (body), DM Mono (labels)
- Grid background overlay via `body::before`
- `.wrap` — centered content, max-width 900px
- `.quick-nav` — sticky nav with monospace links
- `.eyebrow` — monospace uppercase label
- `.question-block` — surface bg, accent left border
- `.section-label` — monospace uppercase section header
- `.details-card` — collapsible `<details>` styling (like Maria's `.charity` pattern)
- `.vote-bar` — CSS-only horizontal bar chart (colored bar + percentage label)
- `.quote-block` — styled blockquote for notable quotes
- `.steps` — 2-column grid for methodology steps
- `.step` — card with large background number
- `.status-badge` — pill for active/completed status
- Responsive: single column below 600px
- Fade-up animation on page load

The CSS file should be self-contained (no build step). Google Fonts loaded via `<link>` in HTML templates.

**Required CSS classes** (referenced by templates):

| Class | Purpose |
|-------|---------|
| `.wrap` | Centered content container, max-width 900px |
| `.quick-nav`, `.quick-nav a` | Sticky nav bar with monospace links |
| `.logo` | Header logo text |
| `.status-badge`, `.status-badge.active`, `.status-badge.completed` | Status pill badges |
| `.hero` | Hero section with fade-up animation |
| `.eyebrow` | Monospace uppercase label |
| `.meta` | Inline metadata (participant count, date) |
| `.question-block`, `.question-label`, `.question-text` | Accent-bordered question card |
| `.section-label` | Monospace uppercase section header |
| `.vote-bars`, `.vote-bar`, `.vote-label`, `.vote-track`, `.vote-fill`, `.vote-percent` | CSS-only horizontal bar chart |
| `.details-card`, `.details-body` | Collapsible `<details>` card styling |
| `.steps`, `.step`, `.step-phase` | 2-column methodology grid with big background numbers |
| `.session-list`, `.session-card`, `.session-card-header`, `.session-card-meta` | Index page session cards |
| `.pair-badge` | Small badge indicating paired sessions |
| `.note` | Footer text |

- [ ] **Step 2: Commit**

```bash
git add static/style.css
git commit -m "feat: add dark theme CSS inspired by Maria's landing page"
```

---

### Task 5: Create the session page HTML template

**Files:**
- Create: `templates/session.html`

- [ ] **Step 1: Write session.html Mustache template**

Use @frontend-design skill. This is the main results page template. Structure (from spec):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{title}} — Cross-Pollination Results</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../style.css" />
</head>
<body>
<div class="wrap">

  <!-- 1. Header -->
  <header>
    <a href="../" class="logo">Cross-Pollination Results</a>
    <span class="status-badge {{status}}">{{status}}</span>
  </header>

  <!-- 2. Quick nav -->
  <nav class="quick-nav">
    <a href="#question">Question</a>
    <a href="#results">Results</a>
    {{#sections}}
    <a href="#{{id}}">{{heading}}</a>
    {{/sections}}
    <a href="#methodology">How it works</a>
  </nav>

  <!-- 3. Hero -->
  <section class="hero">
    <p class="eyebrow">Experiment Results</p>
    <h1>{{title}}</h1>
    <div class="meta">
      <span>{{participants}} participants</span>
      <span>{{date}}</span>
    </div>
  </section>

  <!-- 4. The Question (goal) -->
  <section id="question">
    <div class="question-block">
      <p class="question-label">The Question</p>
      <div class="question-text">{{{goal}}}</div>
    </div>
  </section>

  <!-- 5. Key Results (voting bars) -->
  {{#has_votes}}
  <section id="results">
    <p class="section-label">Voting Distribution</p>
    <div class="vote-bars">
      {{#votes}}
      <div class="vote-bar">
        <div class="vote-label">{{name}}</div>
        <div class="vote-track">
          <div class="vote-fill" style="width: {{percent}}%"></div>
        </div>
        <div class="vote-percent">~{{percent}}%</div>
      </div>
      {{/votes}}
    </div>
  </section>
  {{/has_votes}}
  {{^has_votes}}
  {{#sections.0}}
  <section id="results">
    <p class="section-label">Key Results</p>
    <div class="details-body">{{{content_html}}}</div>
  </section>
  {{/sections.0}}
  {{/has_votes}}

  <!-- 6-7. Summary sections (collapsible) -->
  {{#sections}}
  <section id="{{id}}">
    <details class="details-card" open>
      <summary><h3>{{heading}}</h3></summary>
      <div class="details-body">{{{content_html}}}</div>
    </details>
  </section>
  {{/sections}}

  <!-- 8. Opinion Shift (conditional — paired sessions only) -->
  {{#has_pair}}
  <section id="opinion-shift">
    <p class="section-label">Opinion Shift</p>
    <div class="question-block">
      {{#is_phase1}}
      <p class="question-text">This is Phase 1. After participants saw anonymised reasoning from others, they reconsidered their positions in <a href="../{{pair_slug}}/">Phase 2: {{pair_title}}</a>.</p>
      {{/is_phase1}}
      {{^is_phase1}}
      <p class="question-text">This is Phase 2. Participants revised their positions after reading anonymised reasoning from <a href="../{{pair_slug}}/">Phase 1: {{pair_title}}</a>.</p>
      {{/is_phase1}}
    </div>
  </section>
  {{/has_pair}}

  <!-- 9. Methodology -->
  <section id="methodology">
    <p class="section-label">How Cross-Pollination Works</p>
    <div class="steps">
      <div class="step" data-n="1">
        <p class="step-phase">Phase 1</p>
        <h3>Share your view</h3>
        <p>Each participant has a private conversation with an AI moderator, sharing their position and reasoning.</p>
      </div>
      <div class="step" data-n="2">
        <p class="step-phase">Between phases</p>
        <h3>Ideas are collected</h3>
        <p>All reasoning is anonymised and neutrally rephrased — no names, no attribution.</p>
      </div>
      <div class="step" data-n="3">
        <p class="step-phase">Phase 2</p>
        <h3>Hear others' thinking</h3>
        <p>Participants read others' anonymised reasoning, then restate their position after reflection.</p>
      </div>
      <div class="step" data-n="4">
        <p class="step-phase">Outcome</p>
        <h3>Collective picture</h3>
        <p>Compare initial and final positions to see how views shifted — or stayed stable — without direct debate.</p>
      </div>
    </div>
  </section>

  <!-- 10. Footer -->
  <footer class="note">
    <p>Session ID: {{session_id}} · Powered by <a href="https://harmonica.chat">Harmonica</a> · Part of the <a href="https://github.com/Open-Facilitation-Library">Open Facilitation Library</a></p>
    <p><a href="https://openfac.substack.com">Subscribe to OFL updates</a></p>
  </footer>

</div>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add templates/session.html
git commit -m "feat: add session results page template"
```

---

### Task 6: Create the index page HTML template

**Files:**
- Create: `templates/index.html`

- [ ] **Step 1: Write index.html Mustache template**

Use @frontend-design skill. Simple listing page:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cross-Pollination Results</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="style.css" />
</head>
<body>
<div class="wrap">

  <header>
    <span class="logo">Cross-Pollination Results</span>
  </header>

  <section class="hero">
    <p class="eyebrow">Open Facilitation Library</p>
    <h1>Experiment <em>Results</em></h1>
    <p class="question-text">Cross-pollination exposes participants to diverse viewpoints, fostering perspective-taking without forcing consensus. These are the results.</p>
  </section>

  <section>
    <p class="section-label">Sessions</p>
    <div class="session-list">
      {{#sessions}}
      <a href="{{slug}}/" class="session-card">
        <div class="session-card-header">
          <h3>{{title}}</h3>
          <span class="status-badge {{status}}">{{status}}</span>
        </div>
        <div class="session-card-meta">
          <span>{{participants}} participants</span>
          <span>{{date}}</span>
          {{#has_pair}}<span class="pair-badge">paired</span>{{/has_pair}}
        </div>
      </a>
      {{/sessions}}
    </div>
  </section>

  <footer class="note">
    <p>Powered by <a href="https://harmonica.chat">Harmonica</a> · <a href="https://github.com/Open-Facilitation-Library">Open Facilitation Library</a> · <a href="https://openfac.substack.com">Subscribe</a></p>
  </footer>

</div>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add templates/index.html
git commit -m "feat: add index page template"
```

---

### Task 7: Run full build and verify output

**Files:**
- No new files — verification step

- [ ] **Step 1: Run the build**

```bash
node build.js
```

Expected: `Built 1 session page(s) → dist/`

- [ ] **Step 2: Verify dist/ structure**

```bash
ls -R dist/
```

Expected:
```
dist/index.html
dist/style.css
dist/CNAME
dist/2026-03-13-p1-donation-collective-choice/index.html
```

- [ ] **Step 3: Open in browser and visually verify**

Open `dist/index.html` in a browser. Check:
- Dark theme renders correctly
- Index page shows the session card
- Click through to session page
- Voting bars render with correct percentages
- Collapsible sections work
- Quick nav links scroll to sections
- Methodology section shows 4 steps

- [ ] **Step 4: Iterate on CSS/templates with @frontend-design**

Use the `frontend-design` skill to refine the visual design. Compare against Maria's landing page. Adjust spacing, typography, animations until the quality matches.

- [ ] **Step 5: Commit any refinements**

```bash
git add static/ templates/
git commit -m "feat: refine visual design"
```

---

## Chunk 3: GitHub Actions & Deployment

### Task 8: Create the GitHub Action workflow

**Files:**
- Create: `.github/workflows/sync-and-build.yml`

- [ ] **Step 1: Write the workflow file**

```yaml
name: Sync & Build

on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  sync-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Sync sessions from Harmonica
        env:
          HARMONICA_API_KEY: ${{ secrets.HARMONICA_API_KEY }}
        run: npx harmonica-sync

      - name: Commit and push synced sessions
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add _sessions/
          git diff --cached --quiet || (git commit -m "sync: update sessions from Harmonica" && git push)

      - name: Build site
        run: node build.js

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/sync-and-build.yml
git commit -m "feat: add sync-and-build GitHub Action"
```

---

### Task 9: Configure GitHub repo settings and secrets

**Files:**
- No files — repo configuration

- [ ] **Step 1: Add HARMONICA_API_KEY secret**

```bash
gh secret set HARMONICA_API_KEY --repo Open-Facilitation-Library/cross-pollination-results
```

(Paste the API key when prompted. Get it from Harmonica dashboard → Settings → API Keys.)

- [ ] **Step 2: Enable GitHub Pages**

```bash
gh api repos/Open-Facilitation-Library/cross-pollination-results/pages \
  --method POST \
  --field source='{"branch":"gh-pages","path":"/"}' \
  --field build_type="legacy" 2>/dev/null || echo "Pages may already be configured"
```

- [ ] **Step 3: Trigger the workflow manually to verify**

```bash
gh workflow run sync-and-build.yml --repo Open-Facilitation-Library/cross-pollination-results
```

Watch the run:
```bash
gh run watch --repo Open-Facilitation-Library/cross-pollination-results
```

Expected: Workflow completes successfully, `gh-pages` branch created with built files.

- [ ] **Step 4: Verify the deployed site**

Check `https://open-facilitation-library.github.io/cross-pollination-results/` loads. The custom domain (`results.openfac.org`) requires DNS configuration outside of this plan — flag to user.

---

### Task 10: Push all changes and final verification

- [ ] **Step 1: Push to origin**

```bash
git push origin main
```

- [ ] **Step 2: Verify the GitHub Action triggers on push**

```bash
gh run list --repo Open-Facilitation-Library/cross-pollination-results --limit 1
```

- [ ] **Step 3: DNS reminder**

Remind user: To use `results.openfac.org`, add a CNAME DNS record pointing `results` to `open-facilitation-library.github.io`. This is done in the domain registrar, not in this repo.
