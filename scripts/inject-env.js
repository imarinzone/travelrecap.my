#!/usr/bin/env node
/**
 * Injects environment variables into config.js at build time.
 * Used on Vercel: set GOOGLE_PLACES_API_KEY in Project Settings → Environment Variables.
 */

const fs = require('fs');
const path = require('path');

const key = (process.env.GOOGLE_PLACES_API_KEY || '').trim();
const configPath = path.join(__dirname, '..', 'config.js');

// Only overwrite config.js when the env var is set (e.g. on Vercel). Locally, keep config.js as-is.
if (!key) {
    console.log('GOOGLE_PLACES_API_KEY not set; leaving config.js unchanged');
    process.exit(0);
}

const content = `// App config – edit values here (loaded before script.js)
// GOOGLE_PLACES_API_KEY is injected at build time from env (e.g. Vercel).
window.__APP_CONFIG__ = {
    MARKER_CLUSTER_THRESHOLD: 500,
    HEATMAP_THRESHOLD: 500,
    /** Min visit probability (0–1) to include when parsing timeline; visits below are excluded. Default 0 = include all. */
    PROBABILITY_THRESHOLD: 0.8,
    MARKER_BATCH_SIZE: 200,
    SHARE_IMAGE_WIDTH: 1080,
    SHARE_IMAGE_HEIGHT: 1920,
    DATA_DEMO_URL: 'data/demo.json',
    GEOJSON_COUNTRIES_URL: 'data/countries.geojson',
    /** Optional: Google Places API (New) key for favorite-spot details (address, photo). If empty, only "Open in Google Maps" link is shown. */
    GOOGLE_PLACES_API_KEY: ${JSON.stringify(key)}
};
`;

fs.writeFileSync(configPath, content, 'utf8');
console.log('config.js written (GOOGLE_PLACES_API_KEY from env)');
