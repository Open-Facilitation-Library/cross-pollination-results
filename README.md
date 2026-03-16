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
