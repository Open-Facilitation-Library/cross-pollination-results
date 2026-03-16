# Cross-Pollination Results

Auto-updating showcase of [cross-pollination](https://github.com/Open-Facilitation-Library/cross-pollination) experiment results from [Harmonica](https://harmonica.chat) deliberation sessions.

**Live site:** [results.openfac.org](https://results.openfac.org)

## What's Cross-Pollination?

Cross-pollination is a structured deliberation technique that exposes participants to diverse viewpoints across two phases:

1. **Phase 1** — Participants share positions independently via AI-moderated conversations
2. **Between phases** — Reasoning is anonymised and synthesised
3. **Phase 2** — Participants reconsider after reading others' perspectives
4. **Outcome** — Compare how views shifted (or stayed stable) without direct debate

This site renders the results — voting distributions, reasoning themes, notable quotes, and opinion shifts between paired sessions.

## How It Works

```
Harmonica API → harmonica-sync → _sessions/*.md → build.js → dist/*.html → GitHub Pages
```

- Sessions are synced every 6 hours via GitHub Action
- `build.js` extracts structured data from AI-generated summaries (sections, votes, quotes)
- Paired P1/P2 sessions are auto-detected and cross-linked
- Static HTML rendered through Mustache templates with a dark observatory theme

## Local Development

```bash
npm install
export HARMONICA_API_KEY=hm_live_...
npm run sync-and-build
# Open dist/index.html in browser
```

## Related

- [cross-pollination](https://github.com/Open-Facilitation-Library/cross-pollination) — Algorithm and methodology
- [harmonica-sync](https://github.com/harmonicabot/harmonica-sync) — Session sync CLI
- [Open Facilitation Library](https://github.com/Open-Facilitation-Library) — Parent organization

## License

MIT
