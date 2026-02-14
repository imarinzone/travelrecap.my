<p align="center">
  <strong>mytravelrecap</strong>
</p>
<p align="center">
  Your travel recap from Google Maps Timeline — 100% client-side, private, and open source.
</p>

<p align="center">
  <a href="https://github.com/imarinzone/mytravelrecap/blob/main/LICENSE"><img src="https://img.shields.io/github/license/imarinzone/mytravelrecap?color=blue" alt="License: MIT"></a>
  <a href="https://github.com/imarinzone/mytravelrecap"><img src="https://img.shields.io/github/package-json/v/imarinzone/mytravelrecap?label=version" alt="Version"></a>
  <a href="https://github.com/imarinzone/mytravelrecap"><img src="https://img.shields.io/github/languages/count/imarinzone/mytravelrecap" alt="Languages"></a>
  <a href="https://github.com/imarinzone/mytravelrecap"><img src="https://img.shields.io/github/repo-size/imarinzone/mytravelrecap" alt="Repo size"></a>
  <a href="https://github.com/imarinzone/mytravelrecap/issues"><img src="https://img.shields.io/github/issues/imarinzone/mytravelrecap" alt="Issues"></a>
</p>

---

A single-page static site that turns your **Google Takeout timeline** into a typography-first story: scroll-fade animations, vector infographics, and an interactive map — all running in your browser. No data is sent to any server.

## Table of contents

- [Features](#-features)
- [Quick start](#-quick-start)
- [Usage](#-usage)
- [Caching (local storage)](#caching-local-storage)
- [Configuration](#configuration)
- [Project structure](#-project-structure)
- [Development](#-development)
- [Deployment](#-deployment)
- [Privacy & design](#-privacy--design)
- [Tech stack](#-tech-stack)
- [Contributing](#-contributing)
- [License](#-license)

---

## Features

| | |
|---|---|
| **Typography-first layout** | Large, bold stats that tell your travel story as you scroll |
| **Scroll animations** | Content fades in from background to foreground with `IntersectionObserver` |
| **Vector infographics** | Subtle globe and journey-line illustrations |
| **Travel stats** | Total distance, unique places, countries visited, check-ins |
| **Time & records** | Moving vs stationary time, personal records |
| **Environmental impact** | Estimated carbon footprint and tree offset |
| **Interactive map** | Visualize timeline visits by uploading your JSON |
| **Privacy-first** | 100% client-side; no server uploads |

---

## Quick start

The site is **100% static**: CSS is committed, so no build is required to run or deploy.

```bash
git clone https://github.com/imarinzone/mytravelrecap.git
cd mytravelrecap
npx serve
```

Open **http://localhost:3000** (or the port shown). No `npm install` or build step needed — open `index.html` with any static server (or even `file://` for basic use).

---

## Usage

### Visualizing your data

1. **Export your timeline** (device-specific):
   - **Android**: Settings → Location → Location Services → Timeline → **Export Timeline data** → choose Google Drive or local folder → Save. Wait for the export notification.
   - **iOS**: Google Maps → profile picture → Settings → Personal Content → Location settings → **Export Timeline data** → Save to Files. The file is usually named `location-history.json`.
2. Open the app in your browser.
3. Click **Choose File** in “Upload Your Timeline Data” and select the exported file.
4. The map and stats will update with your locations and metrics.

### Offline country lookup

Country names are resolved offline using `data/countries.geojson` (point-in-polygon, no APIs). The file is committed; to update it, replace it with a [world countries GeoJSON](https://github.com/datasets/geo-countries) and save as `data/countries.geojson`.

### Caching (local storage)

- **IndexedDB** (non-PII): Country boundaries GeoJSON and world globe GeoJSON are cached in the browser so repeat visits skip re-downloading. Stored under the database `mytravelrecap_geodata`. If IndexedDB is unavailable (e.g. private browsing), the app falls back to fetching from the network.
- **localStorage** (small prefs): Theme (light/dark), selected map year, and map style are stored so your choices persist across sessions. No timeline or location data is persisted.

### Configuration

App behaviour is controlled by **`config.js`** (loaded before `script.js`). Edit it to change:

| Key | Default | Description |
|-----|---------|-------------|
| `MARKER_CLUSTER_THRESHOLD` | 500 | Use marker clustering above this many map locations |
| `HEATMAP_THRESHOLD` | 500 | Use heatmap layer above this many locations (single canvas) |
| `PROBABILITY_THRESHOLD` | 0 | Min visit probability (0–1) to include when parsing; visits below are excluded (e.g. `0.2` to drop low-confidence places) |
| `MARKER_BATCH_SIZE` | 200 | Markers added per frame when batching (keeps UI responsive) |
| `SHARE_IMAGE_WIDTH` / `SHARE_IMAGE_HEIGHT` | 1080 × 1920 | Share image dimensions (fixed layout) |
| `DATA_DEMO_URL` | `data/demo.json` | URL for demo data (e.g. “Try demo”) |
| `GEOJSON_COUNTRIES_URL` | `data/countries.geojson` | URL for country boundaries GeoJSON |

just edit `config.js` and refresh.

---

## Project structure

```
mytravelrecap/
├── index.html           # Single-page app
├── config.js            # App config (map thresholds, share image size, data URLs)
├── script.js            # UI, map, and DOM logic
├── timeline-utils.js    # Parsing, stats, geo helpers
├── geodata-cache.js     # IndexedDB cache for GeoJSON (countries, world globe)
├── tailwind.css         # Built Tailwind v4 CSS (committed; one-command: npm run build)
├── src/tailwind.css     # Tailwind v4 source (@import "tailwindcss", @source, keyframes)
├── vercel.json          # Headers (no build step)
├── data/
│   └── countries.geojson
├── components/
├── tests/
└── README.md
```

---

## Development

```bash
npm install
npm test                 # Jest tests for timeline-utils
npm run build            # One command: rebuild tailwind.css (after editing src/tailwind.css or content)
npm run watch:css        # Watch Tailwind while developing
```

- **Tests**: Core logic lives in `timeline-utils.js`; tests are in `tests/`.
- **Tailwind**: Tailwind v4 via `@tailwindcss/cli`. `tailwind.css` is committed. To regenerate after editing `src/tailwind.css`, run **`npm run build`** (one command), then commit. No build runs on deploy.
- **Localhost**: Vercel Speed Insights is disabled on localhost to keep the console clean.

---

## Deployment

Optimized for [Vercel](https://vercel.com):

- **Build**: `npm run build` (Tailwind → `tailwind.css`).
- **Headers**: Custom `Permissions-Policy` in `vercel.json` (no `browsing-topics`).
- **Output**: Static files from repo root.

Push to your connected repo; no extra config needed.

---

## Privacy & design

- **Client-only**: Your timeline file is parsed in the browser. Nothing is uploaded.
- **Local storage**: Only non-PII is persisted: GeoJSON reference data (IndexedDB) and small preferences like theme and map year (localStorage). Your timeline, segments, and visited locations are never written to disk; they live in memory for the session only.
- **Storytelling UI**: Large type, vertical scroll, fade-in sections, SVG backgrounds, and dark mode support.

---

## Tech stack

| Category | Tools |
|----------|--------|
| Markup & styling | HTML5, Tailwind CSS v4 (committed `tailwind.css`; one-command rebuild: `npm run build`) |
| Logic | Vanilla JavaScript |
| Maps | Leaflet.js, CartoDB tiles |
| Animations | IntersectionObserver, CSS keyframes |
| Testing | Jest |

---

## Contributing

Contributions are welcome.

1. Open an [issue](https://github.com/imarinzone/mytravelrecap/issues) for bugs or ideas.
2. Fork the repo, create a branch, and open a [pull request](https://github.com/imarinzone/mytravelrecap/pulls).
3. Run `npm test` before submitting.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
