# travelrecap.my

Your travel recap using Google Maps Timeline data.

A single-page static website that presents your travel statistics, trends, and location data in a **typography-first storytelling layout** with scroll-fade animations and subtle vector infographics.

## Features

- **Typography-First Design**: Large, bold statistics that tell your travel story as you scroll
- **Scroll Animations**: Content fades in smoothly from background to foreground as you navigate
- **Vector Background Infographics**: Subtle globe and journey-line illustrations enhance the visual experience
- **Travel Statistics**: View total distance, unique places, countries visited, and check-ins
- **Time & Records**: See time distribution (moving vs stationary) and personal records
- **Environmental Impact**: Estimated carbon footprint and tree offset calculations
- **Interactive Map**: Visualize your timeline visits on a map by uploading your data
- **Privacy Focused**: All data processing happens locally in your browser. No data is sent to any server.

## Project Structure

```
travelrecap.my/
├── index.html              # Main single-page website (static frontend)
├── script.js               # Frontend logic (Leaflet map, JSON parsing)
├── data/
│   ├── timeline.json       # Example/Default travel data (ignored by git)
│   ├── countries.geojson   # Country borders for offline reverse geocoding (committed)
└── README.md               # This file
```

## Setup & Usage

### Running Locally

Since this is a static website, you can run it with any static file server.

1. Clone or download this repository
2. From the project root, start a simple static server:
   - Using Python: `python -m http.server 8000`
   - Or using Node.js: `npx serve`
3. Open `http://localhost:8000/index.html` in your browser

### Visualizing Your Data

1. Export your timeline data from Google Takeout (JSON format).
2. Open the application in your browser.
3. Click the **Choose File** button in the "Upload Your Timeline Data" section.
4. Select your `GoogleTimeline.json` file.
5. The map will populate with markers for your visited locations.

### Offline country lookup (`data/countries.geojson`)

To keep everything fully offline while still showing which **countries** you visited, the app uses a local GeoJSON file of country borders:

- **File path**: `data/countries.geojson`
- **What it does**: Maps each visit’s latitude/longitude to a country name using a point‑in‑polygon check (no external APIs).
- **Git tracking**: `data/` is ignored by default, but `data/countries.geojson` is explicitly whitelisted in `.gitignore` so it can be versioned and shared.

If you ever need to **update or replace** this file:

1. Download a new world‑countries GeoJSON dataset (follow https://github.com/datasets/geo-countries).
2. Save it as `data/countries.geojson`, overwriting the existing file.

## Data Privacy

This application is **100% Client-Side**.
- Your `GoogleTimeline.json` is parsed directly in your browser using JavaScript.
- No data is uploaded to any server or database.
- The "Lat/Long" coordinates are used to plot markers directly on the map.

## Visual Design

The UI follows a **storytelling approach**:

1. **Large Typography**: Key statistics are displayed in oversized text (up to 8xl) that dominates each section
2. **Vertical Scroll Flow**: Content is arranged vertically with generous spacing, revealing stats as you scroll
3. **Fade-in Animations**: Each section animates from transparent/scaled to full visibility using `IntersectionObserver`
4. **Vector Backgrounds**: Subtle SVG infographics (globe meridians, journey paths, dotted trails) provide visual depth without distraction
5. **Dark Mode Support**: All text and background elements adapt to light/dark themes

## Technologies Used

- **HTML5**: Structure and semantic markup
- **Tailwind CSS**: Utility-first CSS framework (via CDN)
- **Vanilla JavaScript**: Data processing, DOM manipulation, and scroll animations
- **Leaflet.js**: Interactive maps
- **CartoDB**: Map tiles
- **IntersectionObserver API**: Scroll-triggered animations
- **Jest**: Unit testing framework (via Node.js)

## Development & Testing

This project now supports unit testing for its core logic, which is isolated in `timeline-utils.js`.

### 1. Install Dependencies
Initialize the Node.js environment to install Jest:
```bash
npm install
```

### 2. Run Tests
Execute the test suite to verify the JSON transformation logic:
```bash
npm test
```

### 3. File Structure for Logic
- `timeline-utils.js`: Contains pure business logic (JSON parsing, stats calculation, geo helpers).
- `script.js`: Handles UI rendering and DOM updates, delegating logic to `timelineUtils`.
- `tests/`: Contains Jest test files.

## License

See LICENSE file for details.
