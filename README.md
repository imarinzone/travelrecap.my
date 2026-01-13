# travelrecap.my

Your travel recap using Google Maps Timeline data.

A single-page static website that recreates the Google Timeline 2024 update interface, displaying your travel statistics, trends, highlights, and location data in a beautiful, modern UI.

## Features

- **Travel Statistics**: View your countries, cities, and places visited
- **Travel Summary**: See your total distance traveled and percentage around the world
- **Travel Modes**: Breakdown by walking, driving, transit, motorcycling, and flying
- **Visit Trends**: Track shopping and food & drink visits
- **City & Place Highlights**: Visual gallery of visited cities and places
- **Trip Highlights**: Recent trip information with dates
- **All-Time Data**: Comprehensive statistics across all your travels
## Project Structure

```
travelrecap.my/
├── index.html            # Main single-page website (static frontend)
├── script.js             # Frontend logic (Leaflet map, API calls)
├── data/
│   ├── timeline.json     # All travel data in JSON format (used by current frontend)
│   └── GoogleTimeline.json # Raw Google Takeout timeline export (large)
├── images/
│   └── globe.png         # Globe image for travel summary card
├── backend/
│   ├── main.go           # Go HTTP API server (place_locations endpoint)
│   ├── go.mod            # Go module + dependencies
│   └── Dockerfile        # Backend Docker build
├── db/
│   └── schema.sql        # Postgres schema (visits, place_locations tables)
├── scripts/
│   └── import_visits.py  # Python script to import visit data from GoogleTimeline.json
├── docker-compose.yaml   # Dockerized Postgres + backend API
├── requirements.txt      # Python dependencies (psycopg2-binary, geopy)
└── README.md             # This file
```

## Setup

### Frontend only (static)

This mode renders all the non-interactive statistics from `data/timeline.json` without requiring Docker or a database.  
The interactive Leaflet map section will show a friendly message if the backend API is not running.

1. Clone or download this repository
2. From the project root, start a simple static server (recommended to avoid CORS issues):
   - Using Python: `python -m http.server 8000`
   - Or using Node.js: `npx serve`
3. Open `http://localhost:8000/index.html` in your browser

### Frontend + Backend + Postgres (full experience)

Prerequisites:
- Docker and Docker Compose installed
- Python 3.7+ installed (for the import script)

1. Start Postgres and the Go backend API (from project root):
   ```bash
   make up
   ```
   This will:
   - Start the Postgres container
   - Apply `db/schema.sql` on first startup
   - Build and start the Go backend on `http://localhost:8080`
2. Import your Google Timeline data into Postgres:
   ```bash
   make install           # once, to install Python deps
   make import            # or: make import-dry-run / make import-no-geocode
   ```
3. Serve the frontend (from project root):
   ```bash
   python -m http.server 8000
   # or: npx serve
   ```
4. Open `http://localhost:8000/index.html` in your browser.
   - All static cards are rendered from `data/timeline.json`
   - The **Interactive Map** section calls `http://localhost:8080/api/place-locations`
     to plot all `place_locations` on a Leaflet map with CartoDB light/dark styles.

### Importing Visit Data from GoogleTimeline.json

The Python import script (`scripts/import_visits.py`) extracts visit segments from `data/GoogleTimeline.json` and stores them in Postgres with reverse geocoding support.

**Prerequisites:**
- Python 3.7+ installed
- Postgres container running (see above)

**Setup:**
1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Ensure Postgres is running:
   ```bash
   docker-compose up -d postgres
   ```

**Import Options:**

**Option 1: Full import with geocoding (recommended)**
- Extracts visits and reverse geocodes coordinates to get city, state, country, and address
- Uses OpenStreetMap Nominatim (free, no API key required)
- Caches geocoded data by `place_id` to avoid duplicate API calls
- Rate limited to 1 request/second to respect Nominatim usage policy

```bash
python scripts/import_visits.py
```

**Option 2: Import without geocoding (faster)**
- Only stores lat/lng coordinates, no location names
- Useful for quick imports or when geocoding service is unavailable

```bash
python scripts/import_visits.py --skip-geocode
```

**Option 3: Dry run (preview only)**
- Preview what would be imported without inserting into database

```bash
python scripts/import_visits.py --dry-run
```

**What gets imported:**
- `visits` table – visit segments with:
  - `start_time`, `lat`, `lng`, `probability`, `place_id`
  - Location data is accessed via `place_id` foreign key to `place_locations`
- `place_locations` table – cached geocoded data keyed by `place_id`
  - Contains: `city`, `state`, `country`, `address`, `geocoded_at`
  - Automatically populated during import when geocoding is enabled
  - Reused for future imports to avoid re-geocoding

**Environment Variables:**
The script uses these environment variables (with defaults):
- `DB_HOST` (default: `localhost`)
- `DB_PORT` (default: `5432`)
- `DB_USER` (default: `travelrecap`)
- `DB_PASSWORD` (default: `travelrecap_password`)
- `DB_NAME` (default: `travelrecap`)

## Data Format

### Frontend `timeline.json`

All travel data for the current frontend is stored in `data/timeline.json`. The JSON structure includes:

- **metadata**: Year, update date, location history status, warnings
- **statistics**: Countries, cities (with new count), places (with new count)
- **travelSummary**: Total distance and percentage around world
- **travelModes**: Array of travel modes with distance, time, and monthly data
- **visitTrends**: Array of visit categories with time, places, and monthly data
- **citiesVisited**: Array of cities with images and "new" status
- **placesVisited**: Array of places with images and "new" status
- **tripHighlights**: Recent trip information
- **allTimeData**: All-time statistics
- **map**: Map center coordinates and visited locations

### Database Schema (Postgres)

The database schema is defined in `db/schema.sql` and automatically applied when the Docker container first starts.

**Tables:**

- **place_locations** – Cache for geocoded location data
  - `place_id` (TEXT PRIMARY KEY) – Google place identifier
  - `lat`, `lng` (DOUBLE PRECISION) – Coordinates
  - `city`, `state`, `country` (TEXT) – Location components
  - `address` (TEXT) – Full formatted address
  - `geocoded_at`, `created_at`, `updated_at` (TIMESTAMPTZ)

- **visits** – Visit segments from Google Timeline
  - `id` (BIGSERIAL PRIMARY KEY)
  - `start_time` (TIMESTAMPTZ) – Visit start time
  - `lat`, `lng` (DOUBLE PRECISION) – Visit coordinates
  - `probability` (DOUBLE PRECISION) – Visit probability score
  - `place_id` (TEXT) – Google place identifier (nullable, FK to `place_locations`)
  - `created_at` (TIMESTAMPTZ) – Record creation timestamp
  - Foreign key: `place_id` → `place_locations(place_id)`

**Indexes:**
- `place_locations`: lat/lng, city/country
- `visits`: start_time, lat/lng, place_id

**Note:** Location data (city, state, country, address) is stored in the `place_locations` table and accessed via the `place_id` foreign key relationship. This normalizes the schema and avoids data duplication.


## Customization

### Updating Travel Data

**Option 1: Using Database (Recommended)**
1. Import your Google Timeline visit data:
   ```bash
   python scripts/import_visits.py
   ```
2. Query the `visits` and `place_locations` tables directly from your application
3. Build custom views and statistics from the imported data

**Option 2: Using Static File**
Edit `data/timeline.json` to update your travel statistics. The website will automatically render the new data.

### Styling

The website uses Tailwind CSS via CDN. You can customize the styling by:
- Modifying Tailwind utility classes in `index.html`
- Adding custom CSS in a `<style>` tag
- Using a Tailwind build process for production

### Images

Currently, the website uses placeholder images from Unsplash. To use your own images:
1. Add images to an `assets/images/` directory
2. Update the image URLs in `data/timeline.json` to point to your local images

## Technologies Used

- **HTML5**: Structure and semantic markup
- **Tailwind CSS**: Utility-first CSS framework (via CDN)
- **Vanilla JavaScript**: Data fetching and dynamic rendering
- **JSON**: Data storage format
- **PostgreSQL**: Database for storing visit data
- **Python**: Import script with reverse geocoding
- **Docker**: Containerized database setup
- **Geopy/Nominatim**: Reverse geocoding service (OpenStreetMap)

## Browser Support

Works in all modern browsers that support:
- ES6 JavaScript features
- Fetch API
- CSS Grid and Flexbox

## License

See LICENSE file for details.
