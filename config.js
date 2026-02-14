// App config – edit values here (loaded before script.js)
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
    /** Optional: Google Places API (New) key for favorite-spot details (address, photo). If empty, only "Open in Google Maps" link is shown. Set locally here or in production via env GOOGLE_PLACES_API_KEY (e.g. Vercel). */
    GOOGLE_PLACES_API_KEY: ''
};
