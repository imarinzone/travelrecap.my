// Leaflet Map Configuration
let map = null;
let markers = null;
let currentStyle = 'light';
let selectedYear = null;
let allLocations = []; // Store loaded locations for filtering
let allSegments = []; // Store all timeline segments (visits and activities)
let globe = null; // Globe instance
let summaryGlobe = null;
let isSummaryGlobeSyncing = false;
let isMapOverlayOpen = false;
let lastMapView = null;
let isMapInitialized = false;
let mapYears = [];
let isDataLoaded = false;
let lastYearStats = null;
let lastAllTimeStats = null;

// CartoDB Tile Layer URLs
const tileLayers = {
    light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
        crossOrigin: true
    }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
        crossOrigin: true
    })
};

// Load country boundaries GeoJSON for offline country lookup
async function loadCountryGeoJSON() {
    if (!window.timelineUtils || typeof timelineUtils.setCountryGeoJSON !== 'function') {
        return;
    }

    try {
        const response = await fetch('data/countries.geojson');
        if (!response.ok) {
            timelineUtils.Logger.warn('countries.geojson not found or failed to load');
            return;
        }
        const geojson = await response.json();
        timelineUtils.setCountryGeoJSON(geojson);
    } catch (error) {
        timelineUtils.Logger.warn('Error loading countries.geojson for offline geocoding', error);
    }
}

// Initialize map
function initMap() {
    if (isMapInitialized) return;
    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
        console.error('Leaflet library not loaded');
        const errorMsg = 'Map library failed to load. Please check your internet connection.';
        if (typeof showShareToast === 'function') {
            showShareToast(errorMsg, 'error');
        } else {
            alert(errorMsg);
        }
        return;
    }

    // Load saved style preference (now synced with global theme)
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
        currentStyle = savedTheme;
    }

    // Create map with default center (will be adjusted based on data bounds)
    map = L.map('map', {
        center: [20, 0],
        zoom: 2,
        zoomControl: true
    });

    // Add initial tile layer
    tileLayers[currentStyle].addTo(map);
    updateStyleButtons();
    updateMapTheme();

    // Initialize marker layer (using LayerGroup instead of clustering to show individual points)
    markers = L.layerGroup();
    map.addLayer(markers);

    // Initialize year timeline if data already loaded
    if (isDataLoaded && mapYears.length > 0) {
        initializeYearFilter(mapYears);
    }

    // Load saved year preference
    const savedYear = localStorage.getItem('mapYear');
    if (savedYear) {
        selectedYear = savedYear === '' ? null : savedYear;
    }

    // Setup fullscreen listeners
    setupFullscreenListeners();
    isMapInitialized = true;
}

// Initialize year filter as modern horizontal timeline
function initializeYearFilter(availableYears) {
    const timelineContainer = document.getElementById('timeline-years');
    const timelineSelectorContainer = document.getElementById('timeline-selector-container');
    
    if (!timelineContainer) return;
    
    timelineContainer.innerHTML = '';

    // Add sliding knob for active year (like theme toggle)
    const knob = document.createElement('span');
    knob.className = 'timeline-switch-knob';
    timelineContainer.appendChild(knob);
    
    // Sort years ascending for timeline display (oldest to newest left to right)
    availableYears.sort((a, b) => a - b);
    
    // Show the timeline selector if we have years
    if (availableYears.length > 0 && timelineSelectorContainer) {
        timelineSelectorContainer.classList.remove('hidden');
        timelineSelectorContainer.classList.add('flex');
    }
    
    // Add "All" button first
    const allYearsBtn = document.createElement('button');
    allYearsBtn.className = 'timeline-year-btn' + (!selectedYear ? ' active' : '');
    allYearsBtn.textContent = 'All';
    allYearsBtn.dataset.year = '';
    allYearsBtn.addEventListener('click', () => selectTimelineYear(''));
    timelineContainer.appendChild(allYearsBtn);

    // Create year buttons
    availableYears.forEach((year) => {
        const yearBtn = document.createElement('button');
        yearBtn.className = 'timeline-year-btn';
        if (selectedYear && parseInt(selectedYear) === year) {
            yearBtn.classList.add('active');
        }
        yearBtn.dataset.year = year;
        yearBtn.textContent = year;
        yearBtn.addEventListener('click', () => selectTimelineYear(year.toString()));
        
        timelineContainer.appendChild(yearBtn);
    });

    // If we have years and no selected year (or invalid one), select the most recent one
    if (availableYears.length > 0 && (!selectedYear || !availableYears.includes(parseInt(selectedYear)))) {
        selectedYear = availableYears[availableYears.length - 1]; // Most recent (last in ascending order)
        localStorage.setItem('mapYear', selectedYear);
        updateTimelineSelection();
        
        // Update title to reflect year
        document.getElementById('header-title').textContent = `Your ${selectedYear} Recap`;
    }
}

// Select a year from the timeline
function selectTimelineYear(year) {
    selectedYear = year === '' ? null : year;
    localStorage.setItem('mapYear', year);
    updateTimelineSelection();
    
    // Update header title
    if (selectedYear) {
        document.getElementById('header-title').textContent = `Your ${selectedYear} Recap`;
    } else {
        document.getElementById('header-title').textContent = `Your Travel Recap`;
    }
    
    // Trigger the same filter logic as the old dropdown
    onYearFilterChange({ target: { value: year } });
}

// Update visual selection state on timeline
function updateTimelineSelection() {
    const timelineContainer = document.getElementById('timeline-years');
    if (!timelineContainer) return;
    
    // Update all year buttons
    const yearBtns = timelineContainer.querySelectorAll('.timeline-year-btn');
    yearBtns.forEach(btn => {
        const btnYear = btn.dataset.year;
        if (btnYear === (selectedYear || '')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Move the sliding knob to the active button
    const activeBtn = timelineContainer.querySelector('.timeline-year-btn.active');
    const knob = timelineContainer.querySelector('.timeline-switch-knob');
    if (knob && activeBtn) {
        const left = activeBtn.offsetLeft;
        const width = activeBtn.offsetWidth;
        knob.style.width = `${width}px`;
        knob.style.transform = `translateX(${left}px)`;
    }
}

// ===== GLOBAL THEME SYSTEM =====

let currentTheme = 'light';

// Initialize global theme
function initGlobalTheme() {
    // Check for saved theme preference or system preference
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
        currentTheme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        currentTheme = 'dark';
    }
    
    applyGlobalTheme(currentTheme);
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('appTheme')) {
            applyGlobalTheme(e.matches ? 'dark' : 'light');
        }
    });
}

// ===== GLOBAL LOADING OVERLAY =====

function showLoadingScreen(message) {
    let overlay = document.getElementById('global-loading-overlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'global-loading-overlay';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '9998';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.background = 'rgba(15, 23, 42, 0.75)'; // slate-900/75
        overlay.style.backdropFilter = 'blur(6px)';

        const inner = document.createElement('div');
        inner.id = 'global-loading-inner';
        inner.style.padding = '20px 28px';
        inner.style.borderRadius = '16px';
        inner.style.background = 'rgba(15, 23, 42, 0.9)';
        inner.style.boxShadow = '0 20px 40px rgba(0,0,0,0.45)';
        inner.style.display = 'flex';
        inner.style.flexDirection = 'row';
        inner.style.alignItems = 'center';
        inner.style.gap = '12px';
        inner.style.color = '#e5e7eb';
        inner.style.fontSize = '14px';
        inner.style.fontWeight = '500';

        const spinner = document.createElement('div');
        spinner.style.width = '18px';
        spinner.style.height = '18px';
        spinner.style.borderRadius = '9999px';
        spinner.style.border = '2px solid rgba(148, 163, 184, 0.5)';
        spinner.style.borderTopColor = '#60a5fa';
        spinner.style.animation = 'travelrecap-spin 0.8s linear infinite';

        const text = document.createElement('span');
        text.id = 'global-loading-message';
        text.textContent = message || 'Processing your timeline...';

        inner.appendChild(spinner);
        inner.appendChild(text);
        overlay.appendChild(inner);
        document.body.appendChild(overlay);

        // Inject a minimal keyframes rule once
        if (!document.getElementById('travelrecap-loading-style')) {
            const style = document.createElement('style');
            style.id = 'travelrecap-loading-style';
            style.textContent = '@keyframes travelrecap-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
    } else {
        overlay.style.display = 'flex';
        const msgEl = document.getElementById('global-loading-message');
        if (msgEl) {
            msgEl.textContent = message || 'Processing your timeline...';
        }
    }
}

function hideLoadingScreen() {
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Apply global theme
function applyGlobalTheme(theme) {
    currentTheme = theme;
    const body = document.body;
    
    if (theme === 'dark') {
        body.classList.add('dark');
    } else {
        body.classList.remove('dark');
    }
    
    // Update theme toggle buttons
    updateThemeButtons();
    
    // Sync map style with global theme
    if (map) {
        switchMapStyle(theme);
    } else {
        currentStyle = theme;
    }
    
    localStorage.setItem('appTheme', theme);
}

// Update theme button states
function updateThemeButtons() {
    const lightBtn = document.getElementById('theme-light');
    const darkBtn = document.getElementById('theme-dark');
    
    if (!lightBtn || !darkBtn) return;
    
    if (currentTheme === 'light') {
        lightBtn.classList.add('active');
        darkBtn.classList.remove('active');
        lightBtn.setAttribute('aria-pressed', 'true');
        darkBtn.setAttribute('aria-pressed', 'false');
    } else {
        lightBtn.classList.remove('active');
        darkBtn.classList.add('active');
        lightBtn.setAttribute('aria-pressed', 'false');
        darkBtn.setAttribute('aria-pressed', 'true');
    }
}

// Switch global theme
function switchGlobalTheme(theme) {
    applyGlobalTheme(theme);
}

// Handle file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const statusSpan = document.getElementById('upload-status');
    if (!statusSpan) {
        return;
    }
    statusSpan.textContent = 'Parsing...';

    const reader = new FileReader();
    reader.onload = function (e) {
        // Show a full-screen loading overlay before heavy parsing/processing
        showLoadingScreen('Crunching your timeline data. This may take a minute for large files…');

        // Defer heavy work to the next tick so the browser can paint the overlay
        setTimeout(() => {
            try {
                const json = JSON.parse(e.target.result);
                
                // Validate JSON structure
                if (!json.semanticSegments) {
                    const keys = Object.keys(json).join(', ');
                    throw new Error(`Invalid JSON structure. Expected 'semanticSegments' but found keys: ${keys.substring(0, 200)}`);
                }
                if (!Array.isArray(json.semanticSegments)) {
                    throw new Error(`'semanticSegments' should be an array but got: ${typeof json.semanticSegments}`);
                }
                
                processAndRenderData(json);
                timelineUtils.Logger.info('Loaded data successfully');
                statusSpan.className = 'text-sm font-medium text-green-600';
                statusSpan.textContent = 'Done!';
            } catch (error) {
                timelineUtils.Logger.error('Error parsing JSON:', error);
                // Show detailed error message
                statusSpan.innerHTML = `<span class="block">Error: ${error.message}</span>`;
                statusSpan.className = 'text-sm font-medium text-red-600 max-w-md';
            } finally {
                hideLoadingScreen();
            }
        }, 50);
    };
    // Let the user know we started processing
    showLoadingScreen('Loading your Google Timeline file…');
    reader.readAsText(file);
}

function buildDemoData() {
    const places = [
        { id: 'demo-nyc', name: 'New York City', lat: 40.7128, lng: -74.0060, country: 'United States' },
        { id: 'demo-paris', name: 'Paris', lat: 48.8566, lng: 2.3522, country: 'France' },
        { id: 'demo-tokyo', name: 'Tokyo', lat: 35.6762, lng: 139.6503, country: 'Japan' },
        { id: 'demo-delhi', name: 'New Delhi', lat: 28.6139, lng: 77.2090, country: 'India' }
    ];

    const activities = [
        { type: 'IN_PASSENGER_VEHICLE', distanceMeters: 185000 },
        { type: 'WALKING', distanceMeters: 12000 },
        { type: 'FLYING', distanceMeters: 920000 }
    ];

    const semanticSegments = [];
    const years = [2019, 2020, 2021, 2022, 2023, 2024];

    years.forEach((year, index) => {
        const primaryPlace = places[index % places.length];
        const secondaryPlace = places[(index + 1) % places.length];
        const activityOne = activities[index % activities.length];
        const activityTwo = activities[(index + 1) % activities.length];

        const toLatLng = (lat, lng) => `${lat.toFixed(6)}°, ${lng.toFixed(6)}°`;

        semanticSegments.push({
            startTime: `${year}-03-10T09:00:00Z`,
            endTime: `${year}-03-10T18:00:00Z`,
            country: primaryPlace.country,
            visit: {
                topCandidate: {
                    placeLocation: {
                        name: primaryPlace.name,
                        latLng: toLatLng(primaryPlace.lat, primaryPlace.lng)
                    },
                    placeId: primaryPlace.id
                },
                probability: 0.92
            }
        });

        semanticSegments.push({
            startTime: `${year}-06-22T10:30:00Z`,
            endTime: `${year}-06-22T15:45:00Z`,
            country: secondaryPlace.country,
            visit: {
                topCandidate: {
                    placeLocation: {
                        name: secondaryPlace.name,
                        latLng: toLatLng(secondaryPlace.lat, secondaryPlace.lng)
                    },
                    placeId: secondaryPlace.id
                },
                probability: 0.87
            }
        });

        semanticSegments.push({
            startTime: `${year}-07-01T07:00:00Z`,
            endTime: `${year}-07-01T11:00:00Z`,
            activity: {
                distanceMeters: activityOne.distanceMeters,
                topCandidate: { type: activityOne.type }
            }
        });

        semanticSegments.push({
            startTime: `${year}-10-12T12:00:00Z`,
            endTime: `${year}-10-12T15:00:00Z`,
            activity: {
                distanceMeters: activityTwo.distanceMeters,
                topCandidate: { type: activityTwo.type }
            }
        });
    });

    return { semanticSegments };
}

function loadDemoData() {
    const statusSpan = document.getElementById('upload-status');
    if (statusSpan) {
        statusSpan.textContent = 'Loading demo data...';
        statusSpan.className = 'text-sm font-medium text-gray-500 dark:text-gray-400 min-h-[20px]';
    }

    showLoadingScreen('Loading demo experience…');
    setTimeout(() => {
        try {
            const demoData = buildDemoData();
            processAndRenderData(demoData);
            if (statusSpan) {
                statusSpan.textContent = 'Demo loaded!';
                statusSpan.className = 'text-sm font-medium text-green-600';
            }
        } catch (error) {
            timelineUtils.Logger.error('Error loading demo data:', error);
            if (statusSpan) {
                statusSpan.textContent = 'Demo failed to load.';
                statusSpan.className = 'text-sm font-medium text-red-600';
            }
        } finally {
            hideLoadingScreen();
        }
    }, 50);
}

// Process Google Timeline JSON & Update UI
function processAndRenderData(json) {
    timelineUtils.Logger.time('Data Processing');
    // Use the utility to process raw JSON
    const processed = timelineUtils.processTimelineData(json);

    allSegments = processed.allSegments;
    allLocations = processed.allLocations;
    const years = processed.years;
    mapYears = [...years];
    isDataLoaded = true;

    timelineUtils.Logger.info(`Parsed ${allLocations.length} locations`);
    timelineUtils.Logger.timeEnd('Data Processing');

    // Calculate initial stats to get countries for the globe
    const initialStats = timelineUtils.calculateStats(allSegments);

    // Hide background globe and show main globe with visited countries
    hideBackgroundGlobe();
    
    // Initialize or update Globe
    const globeContainer = document.getElementById('globe-container');
    if (globeContainer) {
        globeContainer.innerHTML = ''; // Clear previous globe
        const visitedCountries = Array.from(initialStats.countries);
        
        // Store globally for reveal globe to use
        window.visitedCountriesArray = visitedCountries;
        
        globe = new Globe('globe-container', visitedCountries);

        // Fade in
        globeContainer.classList.remove('opacity-0');
        globeContainer.classList.add('opacity-50');
    }

    // Initialize UI with data
    initializeYearFilter(years);

    // Auto-select the latest year (last in ascending sorted list)
    if (years.length > 0) {
        const sortedYears = [...years].sort((a, b) => a - b);
        selectedYear = sortedYears[sortedYears.length - 1].toString(); // Latest year
        localStorage.setItem('mapYear', selectedYear);
        updateTimelineSelection();
        
        // Update header title
        document.getElementById('header-title').textContent = `Your ${selectedYear} Recap`;
        
        // Hide description after data loads
        const headerDesc = document.getElementById('header-description');
        if (headerDesc) headerDesc.classList.add('hidden');
    }

    renderDashboard();

    // Hide initial upload section once data is successfully parsed and rendered
    const uploadSection = document.getElementById('upload-section');
    if (uploadSection) {
        uploadSection.classList.add('hidden');
    }

    const shareButton = document.getElementById('taskbar-share');
    if (shareButton) {
        shareButton.classList.remove('hidden');
    }

    // Reveal "Upload a new file" action in the footer
    const restartButton = document.getElementById('restart-button');
    if (restartButton) {
        restartButton.classList.remove('hidden');
    }

    // Smooth-scroll to the dashboard area
    const dashboard = document.getElementById('dashboard-content');
    if (dashboard && typeof dashboard.scrollIntoView === 'function') {
        dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Main render function that updates all sections based on selectedYear
function renderDashboard() {
    // 1. Render Map
    renderMarkers();

    // 2. Filter data for statistics
    const currentYear = selectedYear ? parseInt(selectedYear) : null;
    let statsSegments = allSegments;

    if (currentYear) {
        statsSegments = allSegments.filter(s => {
            if (!s.startTime) return false;
            return new Date(s.startTime).getFullYear() === currentYear;
        });
        document.getElementById('header-title').textContent = `Your ${currentYear} Recap`;
    } else {
        document.getElementById('header-title').textContent = `Your Travel Recap`;
    }

    // 3. Calculate Stats using Utility
    const stats = timelineUtils.calculateStats(statsSegments);

    const allTimeStats = timelineUtils.calculateStats(allSegments);
    const advancedStats = timelineUtils.calculateAdvancedStats(statsSegments);

    lastYearStats = stats;
    lastAllTimeStats = allTimeStats;

    // 4. Update UI Sections
    renderStatistics(stats);
    renderTravelSummary(stats);
    initSummaryGlobe();
    renderTravelTrends(stats.transport);
    renderVisitTrends(stats.visits);
    renderHighlights(stats.visits, statsSegments);
    renderAllTimeStats(allTimeStats);

    // 5. Render New Metrics
    renderEcoImpact(advancedStats.eco);
    renderTimeDistribution(advancedStats.time);
    renderRecordBreakers(advancedStats.records, statsSegments);
    
    // 6. Render Transport Breakdown and Top Places (new typography sections)
    renderTransportBreakdown(stats.transport);
    renderTopPlacesSection(stats.visits);

    // 6. Reveal Dashboard
    const dashboard = document.getElementById('dashboard-content');
    if (dashboard) {
        dashboard.classList.remove('hidden');

        // Initialize general scroll animations for stats
        initScrollAnimations();
        
        // Initialize globe-to-map reveal animation (replaces old globe scroll animation)
        initGlobeMapReveal();
    }
}

function renderEcoImpact(ecoStats) {
    // Update Typography Story Section for Eco
    const totalKg = Math.round(ecoStats.totalCo2 / 1000);
    const treesNeeded = Math.ceil(totalKg / 25); // Approx 25kg CO2 per tree per year
    
    // Eco CO2 story element
    const ecoCo2El = document.getElementById('stat-eco-co2');
    if (ecoCo2El) {
        ecoCo2El.textContent = `${totalKg.toLocaleString()} kg CO₂`;
    }
    
    // Trees count element
    const treesCountEl = document.getElementById('stat-trees-count');
    if (treesCountEl) {
        treesCountEl.textContent = treesNeeded.toLocaleString();
    }
    
    // Keep backward compatibility with hidden grid
    const grid = document.getElementById('eco-impact-grid');
    if (grid) {
        grid.innerHTML = '';
    }
}

function renderTimeDistribution(timeStats) {
    // Convert milliseconds to human-readable format
    function formatDuration(ms) {
        const hours = ms / (1000 * 60 * 60);
        const days = hours / 24;
        
        if (days >= 1) {
            // Show days if >= 1 day
            const roundedDays = Math.round(days * 10) / 10; // 1 decimal place
            return { value: roundedDays, unit: roundedDays === 1 ? 'day' : 'days' };
        } else {
            // Show hours if < 1 day
            const roundedHours = Math.round(hours);
            return { value: roundedHours, unit: roundedHours === 1 ? 'hour' : 'hours' };
        }
    }
    
    const movingFormatted = formatDuration(timeStats.moving);
    const stationaryFormatted = formatDuration(timeStats.stationary);
    
    // Time moving story element
    const timeMovingEl = document.getElementById('stat-time-moving');
    const timeMovingUnitEl = document.getElementById('stat-time-moving-unit');
    if (timeMovingEl) {
        timeMovingEl.textContent = movingFormatted.value;
    }
    if (timeMovingUnitEl) {
        timeMovingUnitEl.textContent = movingFormatted.unit;
    }
    
    // Time stationary story element
    const timeStationaryEl = document.getElementById('stat-time-stationary');
    const timeStationaryUnitEl = document.getElementById('stat-time-stationary-unit');
    if (timeStationaryEl) {
        timeStationaryEl.textContent = stationaryFormatted.value;
    }
    if (timeStationaryUnitEl) {
        timeStationaryUnitEl.textContent = stationaryFormatted.unit;
    }
    
    // Keep backward compatibility with hidden container
    const container = document.getElementById('time-distribution-stats');
    if (container) {
        container.innerHTML = '';
    }
}

function renderRecordBreakers(records, segments) {
    // Calculate records with dates from segments
    let longestDriveRecord = { distance: 0, date: null };
    let longestWalkRecord = { distance: 0, date: null };
    
    segments.forEach(segment => {
        if (segment.activity && segment.activity.distanceMeters) {
            const type = segment.activity.topCandidate?.type || 'UNKNOWN';
            const distance = segment.activity.distanceMeters;
            const date = segment.startTime ? new Date(segment.startTime) : null;
            
            if ((type === 'IN_PASSENGER_VEHICLE' || type === 'IN_VEHICLE') && distance > longestDriveRecord.distance) {
                longestDriveRecord = { distance, date };
            }
            if ((type === 'WALKING' || type === 'RUNNING') && distance > longestWalkRecord.distance) {
                longestWalkRecord = { distance, date };
            }
        }
    });
    
    // Format date helper
    const formatDate = (date) => {
        if (!date) return '';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    
    // Update Typography Story Section for Records
    const driveKm = (longestDriveRecord.distance / 1000).toFixed(1);
    const walkKm = (longestWalkRecord.distance / 1000).toFixed(1);
    
    // Longest drive story element
    const longestDriveEl = document.getElementById('stat-longest-drive');
    if (longestDriveEl) {
        longestDriveEl.textContent = `${driveKm} km`;
    }
    const longestDriveDateEl = document.getElementById('stat-longest-drive-date');
    if (longestDriveDateEl && longestDriveRecord.date) {
        longestDriveDateEl.textContent = formatDate(longestDriveRecord.date);
    }
    
    // Longest walk story element
    const longestWalkEl = document.getElementById('stat-longest-walk');
    if (longestWalkEl) {
        longestWalkEl.textContent = `${walkKm} km`;
    }
    const longestWalkDateEl = document.getElementById('stat-longest-walk-date');
    if (longestWalkDateEl && longestWalkRecord.date) {
        longestWalkDateEl.textContent = formatDate(longestWalkRecord.date);
    }
    
    // Keep backward compatibility with hidden container
    const container = document.getElementById('record-breakers-stats');
    if (container) {
        container.innerHTML = '';
    }
}

// Transport labels mapping
const transportConfig = {
    'IN_PASSENGER_VEHICLE': { label: 'Driving' },
    'IN_VEHICLE': { label: 'Driving' },
    'IN_TAXI': { label: 'Taxi' },
    'FLYING': { label: 'Flying' },
    'IN_BUS': { label: 'Bus' },
    'IN_TRAIN': { label: 'Train' },
    'IN_SUBWAY': { label: 'Subway' },
    'IN_TRAM': { label: 'Tram' },
    'WALKING': { label: 'Walking' },
    'RUNNING': { label: 'Running' },
    'CYCLING': { label: 'Cycling' },
    'MOTORCYCLING': { label: 'Motorcycle' },
    'IN_FERRY': { label: 'Ferry' },
    'SAILING': { label: 'Sailing' },
    'SKIING': { label: 'Skiing' },
    'UNKNOWN': { label: 'Other' }
};

function renderTransportBreakdown(transportStats) {
    const grid = document.getElementById('stat-transport-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Sort by distance (descending) and take top 8
    const sortedTransport = Object.entries(transportStats)
        .sort(([, a], [, b]) => b.distanceMeters - a.distanceMeters)
        .slice(0, 8);
    
    if (sortedTransport.length === 0) {
        grid.innerHTML = '<p class="col-span-full text-gray-500 dark:text-gray-400">No transport data available</p>';
        return;
    }
    
    sortedTransport.forEach(([type, data]) => {
        const config = transportConfig[type] || transportConfig['UNKNOWN'];
        const distanceKm = Math.round(data.distanceMeters / 1000);
        const durationHours = Math.round(data.durationMs / (1000 * 60 * 60));
        
        const card = document.createElement('div');
        card.className = 'transport-stat-card';
        card.innerHTML = `
            <div class="transport-label">${config.label}</div>
            <div class="transport-value">${distanceKm.toLocaleString()} km</div>
            <div class="transport-sublabel">${data.count} trips • ${durationHours}h</div>
        `;
        grid.appendChild(card);
    });
}

function renderTopPlacesSection(visitStats) {
    const grid = document.getElementById('stat-top-places-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Get all places sorted by visit count (include places without names)
    const allPlaces = Object.values(visitStats)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
    
    if (allPlaces.length === 0) {
        grid.innerHTML = '<p class="col-span-full text-gray-500 dark:text-gray-400">No places found</p>';
        return;
    }
    
    allPlaces.forEach((place, index) => {
        const card = document.createElement('div');
        card.className = 'place-stat-card';
        
        // Use name if available, otherwise show coordinates
        const hasName = place.name && place.name !== "Unknown Place";
        const displayName = hasName ? place.name : formatLatLng(place.latLng);
        const displayTitle = hasName ? place.name : place.latLng;
        
        card.innerHTML = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                    <span class="text-gray-400 dark:text-gray-500 text-sm flex-shrink-0">#${index + 1}</span>
                    <span class="place-name ${!hasName ? 'text-gray-500 dark:text-gray-400 font-mono text-sm' : ''}" title="${displayTitle}">${displayName}</span>
                </div>
                ${place.country ? `<p class="text-xs text-gray-400 dark:text-gray-500 ml-6 mt-0.5">${place.country}</p>` : ''}
            </div>
            <div class="text-right flex-shrink-0">
                <div class="place-count">${place.count}</div>
                <div class="place-count-label">visits</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Helper to format lat/lng string for display
function formatLatLng(latLngStr) {
    if (!latLngStr) return 'Unknown Location';
    // Parse and format to shorter decimal places
    const parts = latLngStr.replace(/°/g, '').split(',');
    if (parts.length !== 2) return latLngStr;
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());
    if (isNaN(lat) || isNaN(lng)) return latLngStr;
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function renderStatistics(stats) {
    // Update Typography Story Sections (new approach)
    const distanceKm = Math.round(stats.totalDistanceMeters / 1000);
    const uniquePlacesCount = Object.keys(stats.visits || {}).length;
    const countriesCount = stats.countries.size;
    
    // Distance story section
    const distanceEl = document.getElementById('stat-distance');
    if (distanceEl) {
        distanceEl.textContent = `${distanceKm.toLocaleString()} km`;
    }
    
    const distanceSubtitle = document.getElementById('stat-distance-subtitle');
    if (distanceSubtitle) {
        if (distanceKm > 40000) {
            distanceSubtitle.textContent = "That's like travelling around the Earth!";
        } else if (distanceKm > 10000) {
            distanceSubtitle.textContent = "You've covered some serious ground.";
        } else if (distanceKm > 1000) {
            distanceSubtitle.textContent = "You've been on quite the journey.";
        } else {
            distanceSubtitle.textContent = "Every kilometer counts.";
        }
    }
    
    // Places & Countries story section
    const placesCount = document.getElementById('stat-places-count');
    if (placesCount) {
        placesCount.textContent = uniquePlacesCount.toLocaleString();
    }
    
    const countriesCountEl = document.getElementById('stat-countries-count');
    if (countriesCountEl) {
        countriesCountEl.textContent = countriesCount.toLocaleString();
    }
    
    // Visits story section
    const visitsEl = document.getElementById('stat-visits');
    if (visitsEl) {
        visitsEl.textContent = stats.totalVisits.toLocaleString();
    }
    
    // Also keep backward compatibility with hidden grid (for any other code referencing it)
    const grid = document.getElementById('statistics-grid');
    if (grid) {
        grid.innerHTML = '';
    }
}

function createStatCard(title, value, iconName) {
    const div = document.createElement('div');
    // Glass styling for stat cards
    div.className = 'glass rounded-2xl p-6 shadow-sm flex items-center transform hover:scale-105 transition-transform duration-300';
    div.innerHTML = `
        <div class="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 mr-4 shadow-inner">
            <span class="material-icons-round" style="font-size: 28px;">${iconName}</span> 
        </div>
        <div>
            <p class="text-sm font-medium text-gray-500 uppercase tracking-wide">${title}</p>
            <p class="text-3xl font-bold text-gray-900">${value}</p>
        </div>
    `;
    return div;
}

// ===== ANIMATED STAT SCENE SYSTEM =====

/**
 * Creates an SVG scene layer based on the scene type
 */
function createSceneLayer(sceneType, data = {}) {
    const layer = document.createElement('div');
    layer.className = 'stat-scene-layer';

    switch (sceneType) {
        case 'plane':
            layer.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-br from-sky-100 to-blue-200">
                    <svg class="absolute w-16 h-16 text-blue-500 animate-plane-glide" viewBox="0 0 24 24" fill="currentColor" style="top: 30%; left: 0;">
                        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                    </svg>
                    <div class="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-blue-300/30 to-transparent"></div>
                </div>
            `;
            break;

        case 'car':
            layer.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-br from-slate-100 to-gray-200">
                    <div class="absolute bottom-4 left-0 right-0 h-1 bg-gray-400/50"></div>
                    <svg class="absolute w-12 h-12 text-blue-600 animate-car-drive" viewBox="0 0 24 24" fill="currentColor" style="bottom: 8px; left: 0;">
                        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                    </svg>
                </div>
            `;
            break;

        case 'train':
            layer.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-br from-orange-50 to-amber-100">
                    <div class="absolute bottom-4 left-0 right-0 h-1 bg-amber-400/50"></div>
                    <svg class="absolute w-12 h-12 text-amber-600 animate-train-drive" viewBox="0 0 24 24" fill="currentColor" style="bottom: 8px; left: 0;">
                        <path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V8h5v3zm2 0V8h5v3h-5zm3.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                    </svg>
                </div>
            `;
            break;

        case 'bus':
            layer.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-100">
                    <div class="absolute bottom-4 left-0 right-0 h-1 bg-emerald-400/50"></div>
                    <svg class="absolute w-12 h-12 text-emerald-600 animate-car-drive" viewBox="0 0 24 24" fill="currentColor" style="bottom: 8px; left: 0;">
                        <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
                    </svg>
                </div>
            `;
            break;

        case 'walking':
            layer.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-br from-green-50 to-teal-100">
                    <div class="absolute bottom-2 left-0 right-0 h-2 bg-gradient-to-r from-green-200/50 via-green-300/50 to-green-200/50 rounded-full"></div>
                    <svg class="absolute w-10 h-10 text-teal-600 animate-walk-cycle" viewBox="0 0 24 24" fill="currentColor" style="bottom: 12px; left: 0;">
                        <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>
                    </svg>
                    <!-- Dust particles -->
                    <div class="absolute bottom-3 left-1/4 w-1 h-1 bg-teal-300 rounded-full opacity-50 animate-ping"></div>
                    <div class="absolute bottom-3 left-1/2 w-1 h-1 bg-teal-300 rounded-full opacity-50 animate-ping animation-delay-300"></div>
                </div>
            `;
            break;

        case 'cycling':
            layer.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-br from-lime-50 to-green-100">
                    <div class="absolute bottom-4 left-0 right-0 h-1 bg-green-400/50"></div>
                    <svg class="absolute w-12 h-12 text-green-600 animate-bike-ride" viewBox="0 0 24 24" fill="currentColor" style="bottom: 8px; left: 0;">
                        <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/>
                    </svg>
                </div>
            `;
            break;

        case 'motorcycle':
            layer.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-br from-red-50 to-orange-100">
                    <div class="absolute bottom-4 left-0 right-0 h-1 bg-orange-400/50"></div>
                    <svg class="absolute w-12 h-12 text-orange-600 animate-car-drive" viewBox="0 0 24 24" fill="currentColor" style="bottom: 8px; left: 0;">
                        <path d="M19.44 9.03L15.41 5H11v2h3.59l2 2H5c-2.8 0-5 2.2-5 5s2.2 5 5 5c2.46 0 4.45-1.69 4.9-4h1.65l2.77-2.77c-.21.54-.32 1.14-.32 1.77 0 2.8 2.2 5 5 5s5-2.2 5-5c0-2.65-1.97-4.77-4.56-4.97zM7.82 15C7.4 16.15 6.28 17 5 17c-1.63 0-3-1.37-3-3s1.37-3 3-3c1.28 0 2.4.85 2.82 2H5v2h2.82zM19 17c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
                    </svg>
                </div>
            `;
            break;

        case 'city':
            const buildingCount = Math.min(Math.max(data.count || 3, 3), 8);
            let buildings = '';
            for (let i = 0; i < buildingCount; i++) {
                const height = 30 + Math.random() * 40;
                const width = 12 + Math.random() * 8;
                const left = (i * (100 / buildingCount)) + Math.random() * 5;
                const delay = i * 100;
                const windows = Math.floor(height / 12);
                let windowsHtml = '';
                for (let w = 0; w < windows; w++) {
                    windowsHtml += `<div class="w-1 h-1 bg-yellow-300 rounded-sm animate-window-twinkle" style="animation-delay: ${w * 300 + delay}ms"></div>`;
                }
                buildings += `
                    <div class="absolute bottom-0 bg-gradient-to-t from-slate-600 to-slate-500 rounded-t-sm animate-city-breathe flex flex-col items-center justify-end gap-1 pb-1" 
                         style="height: ${height}%; width: ${width}%; left: ${left}%; animation-delay: ${delay}ms;">
                        ${windowsHtml}
                    </div>
                `;
            }
            layer.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-b from-indigo-100 via-purple-50 to-slate-200">
                    ${buildings}
                    <div class="absolute bottom-0 left-0 right-0 h-2 bg-slate-400"></div>
                </div>
            `;
            break;

        case 'places':
            layer.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-br from-rose-50 to-pink-100">
                    <svg class="absolute w-8 h-8 text-rose-500 animate-pin-drop" viewBox="0 0 24 24" fill="currentColor" style="top: 20%; left: 25%;">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    <svg class="absolute w-6 h-6 text-rose-400 animate-pin-drop animation-delay-200" viewBox="0 0 24 24" fill="currentColor" style="top: 35%; left: 60%;">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    <svg class="absolute w-5 h-5 text-rose-300 animate-pin-drop animation-delay-500" viewBox="0 0 24 24" fill="currentColor" style="top: 50%; left: 40%;">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                </div>
            `;
            break;

        case 'globe':
            layer.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-br from-blue-100 to-indigo-200">
                    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 animate-orbital-float shadow-lg">
                        <div class="absolute inset-2 rounded-full border-2 border-blue-200/50"></div>
                        <div class="absolute top-1/2 left-0 right-0 h-0.5 bg-blue-200/50 -translate-y-1/2"></div>
                    </div>
                </div>
            `;
            break;

        case 'trees':
            const treeCount = Math.min(Math.max(data.count || 3, 2), 6);
            let trees = '';
            for (let i = 0; i < treeCount; i++) {
                const height = 40 + Math.random() * 30;
                const left = 10 + (i * (80 / treeCount)) + Math.random() * 5;
                const delay = i * 200;
                trees += `
                    <div class="absolute bottom-2" style="left: ${left}%; animation-delay: ${delay}ms;">
                        <div class="animate-tree-grow" style="animation-delay: ${delay}ms;">
                            <svg class="w-8 h-12 text-green-600 animate-tree-sway" style="animation-delay: ${delay + 500}ms;" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2L4 12h3v8h2v-8h2l-3-4h2l-3-4h2l-3-4zm-1 14h2v6h-2v-6z"/>
                            </svg>
                        </div>
                    </div>
                `;
            }
            layer.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-b from-sky-100 to-green-100">
                    ${trees}
                    <div class="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-amber-700 to-amber-600 rounded-t"></div>
                </div>
            `;
            break;

        case 'eco-footprint':
            layer.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-br from-gray-100 to-slate-200">
                    <div class="absolute bottom-4 left-1/2 -translate-x-1/2">
                        <svg class="w-16 h-16 text-slate-400 animate-character-breathe" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-2 18h4v-6h3l-3-9H9l-3 9h3v6z"/>
                        </svg>
                    </div>
                    <!-- CO2 cloud -->
                    <div class="absolute top-4 right-4 w-8 h-5 bg-gray-400/50 rounded-full animate-smoke-puff"></div>
                    <div class="absolute top-6 right-8 w-6 h-4 bg-gray-400/40 rounded-full animate-smoke-puff animation-delay-500"></div>
                </div>
            `;
            break;

        case 'factory':
            layer.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-br from-orange-50 to-red-100">
                    <div class="absolute bottom-0 left-1/4 w-12 h-16 bg-gradient-to-t from-gray-600 to-gray-500 rounded-t">
                        <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-6 bg-gray-700 rounded-t"></div>
                    </div>
                    <!-- Smoke -->
                    <div class="absolute top-4 left-1/3 w-4 h-4 bg-gray-400 rounded-full animate-smoke-puff"></div>
                    <div class="absolute top-6 left-1/3 w-3 h-3 bg-gray-300 rounded-full animate-smoke-puff animation-delay-300"></div>
                    <div class="absolute top-8 left-1/4 w-5 h-5 bg-gray-400 rounded-full animate-smoke-puff animation-delay-700"></div>
                </div>
            `;
            break;

        case 'stationary':
            layer.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100">
                    <div class="absolute bottom-4 left-1/2 -translate-x-1/2">
                        <!-- Person sitting on bench -->
                        <div class="relative animate-character-breathe">
                            <svg class="w-12 h-12 text-indigo-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z"/>
                            </svg>
                        </div>
                        <!-- Bench -->
                        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-14 h-1.5 bg-amber-700 rounded"></div>
                    </div>
                </div>
            `;
            break;

        case 'moving':
            layer.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-100">
                    <div class="absolute bottom-2 left-0 right-0 h-1 bg-emerald-300/50 rounded-full"></div>
                    <svg class="absolute w-10 h-10 text-emerald-600 animate-walk-cycle" viewBox="0 0 24 24" fill="currentColor" style="bottom: 8px; left: 0;">
                        <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>
                    </svg>
                </div>
            `;
            break;

        case 'distance':
            layer.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-br from-blue-100 to-cyan-100">
                    <svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 60" preserveAspectRatio="none">
                        <path d="M0,50 Q25,30 50,40 T100,35" stroke="#60a5fa" stroke-width="2" fill="none" stroke-dasharray="4 2" class="animate-road-dash"/>
                    </svg>
                    <svg class="absolute w-8 h-8 text-blue-600 animate-plane-glide" viewBox="0 0 24 24" fill="currentColor" style="top: 20%; left: 0;">
                        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                    </svg>
                </div>
            `;
            break;

        default:
            layer.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-br from-gray-100 to-slate-200"></div>
            `;
    }

    return layer;
}

/**
 * Creates an animated stat scene container with background animation and content overlay
 */
function createAnimatedStatScene({ title, value, subtitle, sceneType, data = {} }) {
    const container = document.createElement('div');
    container.className = 'stat-scene opacity-0 scroll-trigger transform hover:scale-[1.02] transition-transform duration-300 shadow-lg';

    // Create the animated background layer
    const sceneLayer = createSceneLayer(sceneType, data);
    container.appendChild(sceneLayer);

    // Create the content overlay
    const content = document.createElement('div');
    content.className = 'stat-scene-content bg-gradient-to-t from-black/40 via-black/20 to-transparent';
    content.innerHTML = `
        <p class="text-xs font-semibold text-white/80 uppercase tracking-wider drop-shadow-sm">${title}</p>
        <p class="text-2xl font-bold text-white drop-shadow-md">${value}</p>
        ${subtitle ? `<p class="text-xs text-white/70 drop-shadow-sm">${subtitle}</p>` : ''}
    `;
    container.appendChild(content);

    return container;
}

/**
 * Creates an animated transport mode card for travel trends
 */
function createTransportSceneCard(type, distanceKm, durationHours) {
    let sceneType = 'car';
    let label = type;

    switch (type) {
        case 'IN_PASSENGER_VEHICLE': sceneType = 'car'; label = 'Car'; break;
        case 'WALKING': sceneType = 'walking'; label = 'Walking'; break;
        case 'IN_TRAIN': sceneType = 'train'; label = 'Train'; break;
        case 'IN_BUS': sceneType = 'bus'; label = 'Bus'; break;
        case 'FLYING': sceneType = 'plane'; label = 'Flying'; break;
        case 'CYCLING': sceneType = 'cycling'; label = 'Cycling'; break;
        case 'MOTORCYCLING': sceneType = 'motorcycle'; label = 'Motorbike'; break;
        default: sceneType = 'car'; label = type.replace('IN_', '').replace(/_/g, ' ');
    }

    return createAnimatedStatScene({
        title: label,
        value: `${distanceKm.toLocaleString()} km`,
        subtitle: `${durationHours} hrs`,
        sceneType: sceneType,
        data: { distanceKm, durationHours }
    });
}

/**
 * Creates an animated time distribution scene with sitting vs walking figures
 */
function createTimeDistributionScene(movingPct, stationaryPct, movingHours, stationaryHours) {
    const container = document.createElement('div');
    container.className = 'space-y-4';

    // Stationary scene
    const stationaryScene = document.createElement('div');
    stationaryScene.className = 'relative overflow-hidden rounded-xl h-24 opacity-0 scroll-trigger';
    const stationaryOpacity = 0.5 + (stationaryPct / 200);
    stationaryScene.innerHTML = `
        <div class="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100">
            <div class="absolute bottom-2 left-6">
                <div class="relative animate-character-breathe" style="opacity: ${stationaryOpacity}">
                    <svg class="w-10 h-10 text-indigo-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z"/>
                    </svg>
                </div>
                <div class="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-12 h-1 bg-amber-700 rounded"></div>
            </div>
        </div>
        <div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
        <div class="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
            <span class="text-white font-medium text-sm drop-shadow">Stationary</span>
            <div class="text-right">
                <span class="text-white font-bold text-lg drop-shadow">${stationaryPct}%</span>
                <span class="text-white/70 text-xs block drop-shadow">${Math.round(stationaryHours)} hrs</span>
            </div>
        </div>
        <div class="absolute top-0 left-0 right-0 h-1 bg-white/20">
            <div class="h-full bg-indigo-400 transition-all duration-1000" style="width: ${stationaryPct}%"></div>
        </div>
    `;
    container.appendChild(stationaryScene);

    // Moving scene
    const movingScene = document.createElement('div');
    movingScene.className = 'relative overflow-hidden rounded-xl h-24 opacity-0 scroll-trigger';
    // Add a slight delay via data attribute or just let the observer stagger naturally if they are separate
    // Or we can add a specific class for delay if needed, but let's stick to simple first.
    // To maintain the staggered feel, we can add a data-delay attribute if we want to get fancy with the observer,
    // but the original had animation-delay-200 class. We can keep that class, but it applies to the animation which is now triggered by the class addition.
    // So if we add the animation class later, the delay will still apply.
    movingScene.classList.add('animation-delay-200');

    const movingOpacity = 0.5 + (movingPct / 200);
    movingScene.innerHTML = `
        <div class="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-100">
            <div class="absolute bottom-1 left-0 right-0 h-1 bg-emerald-300/50 rounded-full"></div>
            <svg class="absolute w-8 h-8 text-emerald-600 animate-walk-cycle" viewBox="0 0 24 24" fill="currentColor" style="bottom: 8px; left: 0; opacity: ${movingOpacity}">
                <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>
            </svg>
        </div>
        <div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
        <div class="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
            <span class="text-white font-medium text-sm drop-shadow">On the Move</span>
            <div class="text-right">
                <span class="text-white font-bold text-lg drop-shadow">${movingPct}%</span>
                <span class="text-white/70 text-xs block drop-shadow">${Math.round(movingHours)} hrs</span>
            </div>
        </div>
        <div class="absolute top-0 left-0 right-0 h-1 bg-white/20">
            <div class="h-full bg-emerald-400 transition-all duration-1000" style="width: ${movingPct}%"></div>
        </div>
    `;
    container.appendChild(movingScene);

    return container;
}

/**
 * Creates an animated record breaker scene
 */
function createRecordBreakerScene(type, value, unit) {
    const container = document.createElement('div');
    container.className = 'relative overflow-hidden rounded-xl h-20 opacity-0 scroll-trigger transform hover:scale-[1.02] transition-transform duration-300';

    const isWalk = type === 'walk';
    const bgGradient = isWalk ? 'from-green-50 to-teal-100' : 'from-slate-100 to-blue-100';
    const iconColor = isWalk ? 'text-teal-600' : 'text-blue-600';
    const animClass = isWalk ? 'animate-walk-cycle' : 'animate-car-drive';
    const barColor = isWalk ? 'bg-teal-400' : 'bg-blue-400';

    const icon = isWalk
        ? `<path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>`
        : `<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>`;

    container.innerHTML = `
        <div class="absolute inset-0 bg-gradient-to-br ${bgGradient}">
            <div class="absolute bottom-2 left-0 right-0 h-0.5 bg-gray-400/30"></div>
            <svg class="absolute w-8 h-8 ${iconColor} ${animClass}" viewBox="0 0 24 24" fill="currentColor" style="bottom: 6px; left: 0;">
                ${icon}
            </svg>
        </div>
        <div class="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent"></div>
        <div class="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
            <span class="text-white font-medium text-sm drop-shadow">${isWalk ? 'Longest Walk' : 'Longest Drive'}</span>
            <span class="text-white font-bold text-lg drop-shadow">${value} ${unit}</span>
        </div>
        <div class="absolute top-0 left-0 right-0 h-1 ${barColor}"></div>
    `;

    return container;
}

// Share Card Functionality
function showShareToast(message, tone = 'info') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: ${tone === 'error' ? '#fee2e2' : tone === 'success' ? '#dcfce7' : '#f3f4f6'};
        color: ${tone === 'error' ? '#991b1b' : tone === 'success' ? '#166534' : '#111827'};
        padding: 10px 14px;
        border-radius: 10px;
        box-shadow: 0 10px 20px rgba(0,0,0,0.15);
        font-size: 12px;
        z-index: 9999;
        opacity: 1;
        transition: opacity 0.3s ease, transform 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(10px)';
    }, 2500);
    setTimeout(() => toast.remove(), 3000);
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openShareDialog() {
    const dialog = document.getElementById('share-dialog');
    if (dialog) dialog.classList.remove('hidden');
}

function closeShareDialog() {
    const dialog = document.getElementById('share-dialog');
    if (dialog) dialog.classList.add('hidden');
}

function buildShareDetails(mode) {
    const useOverall = mode === 'overall';
    const stats = useOverall ? lastAllTimeStats : lastYearStats;
    if (!stats) return null;

    const distanceKm = Math.round(stats.totalDistanceMeters / 1000).toLocaleString();
    const visits = stats.totalVisits.toLocaleString();
    const countries = stats.countries.size.toLocaleString();
    const yearLabel = selectedYear ? selectedYear : 'All Years';
    const title = useOverall ? 'Travel Recap — Overall' : `Travel Recap — ${yearLabel}`;

    return {
        title,
        lines: [
            `Distance: ${distanceKm} km`,
            `Visits: ${visits}`,
            `Countries: ${countries}`
        ]
    };
}

function drawShareOverlay(canvas, title, lines, pixelRatio) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const padding = 20 * pixelRatio;
    const titleSize = 20 * pixelRatio;
    const lineSize = 16 * pixelRatio;
    const lineHeight = 22 * pixelRatio;
    const titleHeight = titleSize + 6 * pixelRatio;
    const boxHeight = padding * 2 + titleHeight + (lines.length * lineHeight);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(0, 0, canvas.width, boxHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${titleSize}px Outfit, sans-serif`;
    ctx.fillText(title, padding, padding + titleSize);

    ctx.font = `400 ${lineSize}px Outfit, sans-serif`;
    lines.forEach((line, index) => {
        const y = padding + titleHeight + (index + 1) * lineHeight;
        ctx.fillText(line, padding, y);
    });
}

async function shareCurrentView(mode) {
    if (!lastAllTimeStats || !lastYearStats) {
        showShareToast('Load a timeline first to share.', 'error');
        return;
    }

    const details = buildShareDetails(mode);
    if (!details) {
        showShareToast('No share details available yet.', 'error');
        return;
    }

    closeShareDialog();
    showLoadingScreen('Preparing your share image…');

    try {
        const node = document.getElementById('globe-container');
        if (!node) {
            showShareToast('Globe is not available to capture.', 'error');
            return;
        }

        const fileImages = node.querySelectorAll('img[src^="file://"]');
        if (fileImages.length && window.location.protocol === 'file:') {
            showShareToast('Local images cannot be captured from file://. Run a local server for full capture.', 'info');
        }

        const pixelRatio = 2;
        const themeBackground = document.body.classList.contains('dark') ? '#0f172a' : '#f5f7fa';

        const canvas = await htmlToImage.toCanvas(node, {
            backgroundColor: themeBackground,
            pixelRatio,
            filter: (domNode) => {
                if (domNode.id === 'share-dialog') return false;
                if (domNode.tagName === 'IMG') {
                    const src = domNode.getAttribute('src') || '';
                    if (src.startsWith('file://')) {
                        return false;
                    }
                }
                return true;
            },
            style: {
                margin: '0',
                transform: 'none'
            }
        });

        drawShareOverlay(canvas, details.title, details.lines, pixelRatio);

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) {
            throw new Error('Image capture failed.');
        }

        const filename = `travel-recap-${mode}-${Date.now()}.png`;
        const file = new File([blob], filename, { type: blob.type || 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'Travel Recap',
                text: 'My travel recap stats.'
            });
            showShareToast('Shared. You can post it from the share sheet.', 'success');
        } else {
            triggerDownload(blob, filename);
            showShareToast('Downloaded. Upload to Instagram manually.', 'info');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            timelineUtils.Logger.warn('Share canceled by user');
            return;
        }
        timelineUtils.Logger.error('Error sharing image:', error);
        showShareToast('Could not share. Please try again.', 'error');
    } finally {
        hideLoadingScreen();
    }
}

function initShareControls() {
    const shareButton = document.getElementById('taskbar-share');
    const dialog = document.getElementById('share-dialog');
    const closeButton = document.getElementById('share-dialog-close');
    const overallButton = document.getElementById('share-overall');
    const yearButton = document.getElementById('share-year');

    if (shareButton) {
        shareButton.addEventListener('click', openShareDialog);
    }

    if (closeButton) {
        closeButton.addEventListener('click', closeShareDialog);
    }

    if (dialog) {
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) {
                closeShareDialog();
            }
        });
    }

    if (overallButton) {
        overallButton.addEventListener('click', () => shareCurrentView('overall'));
    }

    if (yearButton) {
        yearButton.addEventListener('click', () => shareCurrentView('year'));
    }
}

function renderTravelSummary(stats) {
    const worldTripsEl = document.getElementById('world-percentage');
    const worldTripsLabel = document.getElementById('world-percentage-label');
    const description = document.getElementById('travel-description');

    // Calculate trips around the world based on Earth's circumference
    const EARTH_CIRCUMFERENCE_KM = 40075; // Approximate Earth circumference in km
    const distanceKm = stats.totalDistanceMeters / 1000;

    const tripsAroundWorld = distanceKm > 0
        ? (distanceKm / EARTH_CIRCUMFERENCE_KM).toFixed(1)
        : '0';

    // Display as "X.X" trips
    worldTripsEl.textContent = tripsAroundWorld;
    if (worldTripsLabel) {
        const tripWord = parseFloat(tripsAroundWorld) === 1 ? 'Trip' : 'Trips';
        worldTripsLabel.textContent = `${tripWord} Around Earth`;
    }

    const countryCount = stats.countries.size;
    const uniquePlacesCount = Object.keys(stats.visits || {}).length;

    if (countryCount > 0 || uniquePlacesCount > 0) {
        description.innerHTML = `
            You've explored <strong>${countryCount} countries</strong> and <strong>${uniquePlacesCount} unique places</strong> this period.<br>
            That's <strong>${tripsAroundWorld} trips</strong> around the Earth, over <strong>${Math.round(distanceKm).toLocaleString()} km</strong>.
        `;
    } else {
        description.innerHTML = `
            You've travelled about <strong>${Math.round(distanceKm).toLocaleString()} km</strong> this period,<br>
            which is <strong>${tripsAroundWorld} trips</strong> around the Earth.
        `;
    }
}

function initSummaryGlobe() {
    const summaryContainer = document.getElementById('summary-globe-container');
    if (!summaryContainer || typeof Globe === 'undefined') return;

    if (!summaryGlobe) {
        const visitedCountries = window.visitedCountriesArray || [];
        summaryGlobe = new Globe('summary-globe-container', visitedCountries);
        summaryContainer.dataset.docked = 'true';
        summaryGlobe.stopRotation();
    }

    if (!isSummaryGlobeSyncing) {
        isSummaryGlobeSyncing = true;
        const sync = () => {
            if (globe && summaryGlobe) {
                summaryGlobe.setRotation(globe.getRotation());
            }
            requestAnimationFrame(sync);
        };
        requestAnimationFrame(sync);
    }
}

function renderTravelTrends(transportStats) {
    const grid = document.getElementById('travel-trends-grid');
    grid.innerHTML = '';

    const sortedTransport = Object.entries(transportStats)
        .sort(([, a], [, b]) => b.distanceMeters - a.distanceMeters)
        .slice(0, 6);

    sortedTransport.forEach(([type, data], index) => {
        const distanceKm = Math.round(data.distanceMeters / 1000);
        const durationHours = Math.round(data.durationMs / (1000 * 60 * 60));

        // Create animated transport scene card
        const card = createTransportSceneCard(type, distanceKm, durationHours);
        // Add staggered animation delay
        card.style.animationDelay = `${index * 100}ms`;
        grid.appendChild(card);
    });
}

function renderVisitTrends(visitStats) {
    const grid = document.getElementById('visit-trends-grid');
    grid.innerHTML = '';

    // Check if we have named visits
    const namedVisits = Object.values(visitStats).filter(p => p.name !== "Unknown Place");

    if (namedVisits.length === 0) {
        // Show specific message if no names
        grid.innerHTML = `
            <div class="col-span-2 text-center p-6 text-gray-500">
                <p>Visit types could not be determined from the loaded data.</p>
            </div>
         `;
        return;
    }

    const sortedVisits = namedVisits
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

    sortedVisits.forEach(place => {
        const card = document.createElement('div');
        card.className = 'bg-white/50 rounded-xl p-4 flex items-center justify-between hover:bg-white/80 transition-colors border border-white/40';

        card.innerHTML = `
            <div>
                <p class="font-semibold text-gray-900 truncate w-48" title="${place.name}">${place.name}</p>
            </div>
            <div class="flex flex-col items-end">
                <span class="text-xl font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md min-w-[30px] text-center">${place.count}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderHighlights(visitStats, segments) {
    // Note: In the new typography-first layout, places-grid and cities-grid are hidden
    // divs for backward compatibility. We just clear them; no section visibility toggling.
    
    // 1. Places Highlights (Top visited) - now handled by typography sections
    const placesGrid = document.getElementById('places-grid');
    if (placesGrid) {
        placesGrid.innerHTML = '';
        // Only try to toggle section visibility if it exists
        const placesSection = placesGrid.closest('section');
        if (placesSection) {
            const topPlaces = Object.values(visitStats)
                .sort((a, b) => b.count - a.count)
                .slice(0, 4);
            const hasNames = topPlaces.some(p => p.name !== "Unknown Place");
            placesSection.style.display = hasNames ? 'block' : 'none';
        }
    }

    // 2. Cities Highlights (disabled – city data removed)
    const citiesGrid = document.getElementById('cities-grid');
    if (citiesGrid) {
        citiesGrid.innerHTML = '';
        const citiesSection = citiesGrid.closest('section');
        if (citiesSection) {
            citiesSection.style.display = 'none';
        }
    }
}

function renderAllTimeStats(stats) {
    const container = document.getElementById('all-time-stats');
    if (!container) return;
    container.innerHTML = '';

    const statsData = [
        { label: 'Total Distance', value: Math.round(stats.totalDistanceMeters / 1000).toLocaleString() + ' km' },
        { label: 'Total Visits', value: stats.totalVisits.toLocaleString() },
        { label: 'Countries', value: stats.countries.size.toLocaleString() }
    ];

    statsData.forEach(stat => {
        const div = document.createElement('div');
        div.innerHTML = `
            <p class="text-4xl md:text-5xl font-black text-white mb-2">${stat.value}</p>
            <p class="text-sm text-gray-400 uppercase tracking-widest">${stat.label}</p>
        `;
        container.appendChild(div);
    });

    const distanceEl = document.getElementById('all-time-distance');
    const visitsEl = document.getElementById('all-time-visits');
    const countriesEl = document.getElementById('all-time-countries');
    if (distanceEl) distanceEl.textContent = statsData[0].value;
    if (visitsEl) visitsEl.textContent = statsData[1].value;
    if (countriesEl) countriesEl.textContent = statsData[2].value;
}

// Helper: Render map markers (from previous implementation, slightly adjusted)
function renderMarkers() {
    if (!map || !markers) return;
    // Clear existing markers
    markers.clearLayers();

    if (allLocations.length === 0) {
        return;
    }

    let filteredLocations = allLocations;

    // Apply year filter if selected
    if (selectedYear) {
        const yearInt = parseInt(selectedYear);
        filteredLocations = allLocations.filter(loc => {
            if (!loc.startTime) return false;
            const visitYear = new Date(loc.startTime).getFullYear();
            return visitYear === yearInt;
        });
    }

    if (filteredLocations.length === 0) {
        timelineUtils.Logger.warn('No locations found for selected year');
        return;
    }

    // Calculate bounds
    const bounds = L.latLngBounds([]);
    filteredLocations.forEach(loc => {
        bounds.extend([loc.lat, loc.lng]);
    });

    // Fit map to bounds, but avoid over-zoom on single points
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();
    const isSinglePoint = northEast.lat === southWest.lat && northEast.lng === southWest.lng;
    if (isSinglePoint) {
        map.setView([northEast.lat, northEast.lng], 8);
    } else {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
    lastMapView = { center: map.getCenter(), zoom: map.getZoom() };

    // Add markers as individual points with aesthetic styling
    filteredLocations.forEach(loc => {
        const popupContent = buildPopupContent(loc);
        // Create a custom aesthetic marker
        const pointIcon = L.divIcon({
            className: 'custom-point-marker',
            html: `<div class="map-marker-dot">
                <div class="map-marker-inner"></div>
                <div class="map-marker-pulse"></div>
            </div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
        const marker = L.marker([loc.lat, loc.lng], { icon: pointIcon })
            .bindPopup(popupContent);
        markers.addLayer(marker);
    });

    timelineUtils.Logger.info(`Rendered ${filteredLocations.length} markers`);
}

function restoreMapView() {
    if (!map) return;
    map.invalidateSize();
    if (lastMapView && lastMapView.center && typeof lastMapView.zoom === 'number') {
        map.setView(lastMapView.center, lastMapView.zoom, { animate: false });
    }
}

// Build popup content for marker
function buildPopupContent(location) {
    let content = '<div class="text-sm">';
    const hasName = location.name && location.name.trim().length > 0;
    const title = hasName
        ? location.name
        : (location.country || location.placeId || 'Location');
    content += `<strong>${title}</strong><br>`;

    if (location.startTime) {
        const date = new Date(location.startTime);
        content += `<span class="text-xs text-gray-500">${date.toLocaleDateString()}</span><br>`;
    }

    content += `<span class="text-xs text-gray-400">${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}</span>`;
    content += '</div>';
    return content;
}

// Switch map style
function switchMapStyle(style) {
    if (style === currentStyle) return;

    currentStyle = style;
    localStorage.setItem('mapStyle', style);

    // Remove current layer
    map.eachLayer(layer => {
        if (layer instanceof L.TileLayer) {
            map.removeLayer(layer);
        }
    });

    // Add new layer
    tileLayers[currentStyle].addTo(map);
    updateStyleButtons();
    updateMapTheme();
}

// Apply dark theme filter when using dark style
function updateMapTheme() {
    const mapDiv = document.getElementById('map');
    if (!mapDiv) return;

    if (currentStyle === 'dark') {
        mapDiv.classList.add('map-dark');
    } else {
        mapDiv.classList.remove('map-dark');
    }
}

// Update style button states (now handled by global theme system)
function updateStyleButtons() {
    // This is now handled by updateThemeButtons() in the global theme system
    // Kept for backwards compatibility
}

// Handle year filter change (now called from timeline selector)
function onYearFilterChange(event) {
    // Support both old dropdown event and new timeline event format
    if (event && event.target && event.target.value !== undefined) {
        selectedYear = event.target.value === '' ? null : event.target.value;
        localStorage.setItem('mapYear', event.target.value);
    }
    
    renderDashboard();
}

// Toggle fullscreen
function toggleFullscreen() {
    const mapSection = document.querySelector('#map-container-wrapper').closest('section');
    const mapOverlay = document.getElementById('map-overlay');

    // Prefer overlay-based "fullscreen" so taskbar stays visible
    if (mapOverlay) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/4d4efc66-24e5-4d09-bf3f-b903a435067a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1634',message:'toggleFullscreen overlay branch',data:{overlayHidden:mapOverlay.classList.contains('hidden')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
        // #endregion agent log
        const isOpen = !mapOverlay.classList.contains('hidden');
        if (isOpen) {
            mapOverlay.classList.add('hidden');
            isMapOverlayOpen = false;
        } else {
            mapOverlay.classList.remove('hidden');
            isMapOverlayOpen = true;
            setTimeout(() => {
                if (map) restoreMapView();
            }, 100);
        }
        return;
    }

    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        // Enter fullscreen
        if (mapSection.requestFullscreen) {
            mapSection.requestFullscreen();
        } else if (mapSection.webkitRequestFullscreen) {
            mapSection.webkitRequestFullscreen();
        } else if (mapSection.webkitRequestFullscreen) {
            mapSection.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        } else if (mapSection.msRequestFullscreen) {
            mapSection.msRequestFullscreen();
        }
    } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

// Handle fullscreen change
function handleFullscreenChange() {
    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    const fullscreenIcon = document.getElementById('fullscreen-icon');
    const fullscreenText = document.getElementById('fullscreen-text');
    const fullscreenBtn = document.getElementById('map-fullscreen');

    if (isFullscreen) {
        fullscreenIcon.textContent = 'fullscreen_exit';
        if (fullscreenText) fullscreenText.textContent = 'Exit';
        fullscreenBtn.setAttribute('title', 'Exit fullscreen');
        // Resize map after entering fullscreen
        setTimeout(() => {
            restoreMapView();
        }, 100);
    } else {
        fullscreenIcon.textContent = 'fullscreen';
        if (fullscreenText) fullscreenText.textContent = 'Fullscreen';
        fullscreenBtn.setAttribute('title', 'Toggle fullscreen');
        // Resize map after exiting fullscreen
        setTimeout(() => {
            restoreMapView();
        }, 100);
    }
}

// Setup fullscreen event listeners
function setupFullscreenListeners() {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
}

// Background globe instance
let bgGlobe = null;

// Initialize background globe for landing page
function initBackgroundGlobe() {
    const bgGlobeContainer = document.getElementById('bg-globe-container');
    if (bgGlobeContainer && typeof Globe !== 'undefined') {
        bgGlobe = new Globe('bg-globe-container', []); // Empty visited countries for now
    }
}

// Hide background globe when main content is shown
function hideBackgroundGlobe() {
    const bgGlobeContainer = document.getElementById('bg-globe-container');
    if (bgGlobeContainer) {
        bgGlobeContainer.style.opacity = '0';
        // Remove after transition
        setTimeout(() => {
            bgGlobeContainer.style.display = 'none';
        }, 1000);
    }
}

// Initialize map when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Initialize global theme first
        initGlobalTheme();
        
        // Initialize map
        // Defer map initialization until user opens the map overlay.
        
        // Initialize background globe
        initBackgroundGlobe();

        // Load offline country boundaries for reverse geocoding
        loadCountryGeoJSON();
        
        // Global theme toggle event listeners
        const themeLightBtn = document.getElementById('theme-light');
        const themeDarkBtn = document.getElementById('theme-dark');
        if (themeLightBtn) themeLightBtn.addEventListener('click', () => switchGlobalTheme('light'));
        if (themeDarkBtn) themeDarkBtn.addEventListener('click', () => switchGlobalTheme('dark'));
        
        // Fullscreen event listener
        const fullscreenBtn = document.getElementById('map-fullscreen');
        if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);

        const mapCloseBtn = document.getElementById('map-overlay-close');
        if (mapCloseBtn) {
            mapCloseBtn.addEventListener('click', () => {
                const mapOverlay = document.getElementById('map-overlay');
                if (mapOverlay) mapOverlay.classList.add('hidden');
                isMapOverlayOpen = false;
            });
        }

        // File input listener
        const fileInput = document.getElementById('timeline-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', handleFileUpload);
        }

        const demoButton = document.getElementById('demo-button');
        if (demoButton) {
            demoButton.addEventListener('click', loadDemoData);
        }

        initShareControls();
    });
} else {
    // Initialize global theme first
    initGlobalTheme();
    
    // Initialize map
    // Defer map initialization until user opens the map overlay.
    
    // Initialize background globe
    initBackgroundGlobe();

    // Load offline country boundaries for reverse geocoding
    loadCountryGeoJSON();
    
    // Global theme toggle event listeners
    const themeLightBtn = document.getElementById('theme-light');
    const themeDarkBtn = document.getElementById('theme-dark');
    if (themeLightBtn) themeLightBtn.addEventListener('click', () => switchGlobalTheme('light'));
    if (themeDarkBtn) themeDarkBtn.addEventListener('click', () => switchGlobalTheme('dark'));
    
    // Fullscreen event listener
    const fullscreenBtn = document.getElementById('map-fullscreen');
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);

    // File input listener
    const fileInput = document.getElementById('timeline-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }

    const demoButton = document.getElementById('demo-button');
    if (demoButton) {
        demoButton.addEventListener('click', loadDemoData);
    }

    initShareControls();
}

// Globe Scroll Animation
let isGlobeScrollInitialized = false;

function initGlobeScrollAnimation() {
    if (isGlobeScrollInitialized) return;

    const container = document.getElementById('globe-container');
    const summaryCard = document.getElementById('travel-summary-card');

    if (!container || !summaryCard) return;

    // Find the target image to dock onto
    const targetImg = summaryCard.querySelector('img[alt="Globe"]');
    if (!targetImg) return;

    // Apply smooth transition for the movement
    // We animate top/left/width/height/opacity
    container.style.transition = 'all 1s cubic-bezier(0.645, 0.045, 0.355, 1.000)';

    let isDocked = false;

    window.addEventListener('scroll', () => {
        const targetRect = targetImg.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // Calculate the absolute position of the target image in the document
        const targetAbsoluteTop = targetRect.top + scrollTop;
        const targetAbsoluteLeft = targetRect.left + (window.pageXOffset || document.body.scrollLeft);

        // Trigger when target is likely coming into view
        if (targetRect.top < viewportHeight * 0.85) {
            if (!isDocked) {
                isDocked = true;

                // Dock to the absolute position on page
                container.dataset.docked = 'true';
                container.style.position = 'absolute';
                container.style.top = `${targetAbsoluteTop}px`;
                container.style.left = `${targetAbsoluteLeft}px`;
                container.style.width = `${targetRect.width}px`;
                container.style.height = `${targetRect.height}px`;
                container.style.opacity = '1';
                container.style.zIndex = '50';

                targetImg.style.opacity = '0';
                targetImg.style.transition = 'opacity 0.3s';
            }
        } else {
            if (isDocked) {
                isDocked = false;

                // Reset to fixed background
                delete container.dataset.docked;
                container.style.position = 'fixed';
                container.style.top = '5rem';
                container.style.left = '0';
                container.style.width = '500px';
                container.style.height = '500px';
                container.style.opacity = '0.5';
                container.style.zIndex = '0';

                targetImg.style.opacity = '1';
            }
        }
    });

    isGlobeScrollInitialized = true;
}

/**
 * Initializes IntersectionObserver to trigger animations on scroll
 */
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px' // Trigger earlier for smoother scroll storytelling
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;

                // Add the animation class
                element.classList.add('animate-scene-emerge');

                // Remove opacity-0 so it becomes visible (animation handles opacity too, but this is a safe fallback)
                element.classList.remove('opacity-0');

                // Stop observing this element
                observer.unobserve(element);
            }
        });
    }, observerOptions);

    // Observe all elements with the scroll-trigger class
    // We use a timeout to ensure DOM is fully updated
    setTimeout(() => {
        const triggers = document.querySelectorAll('.scroll-trigger');
        
        // Immediately show the first few sections that are likely in viewport
        triggers.forEach((trigger, index) => {
            // Only observe if not already animated
            if (!trigger.classList.contains('animate-scene-emerge')) {
                // Add staggered animation delay for story sections
                if (trigger.classList.contains('story-section')) {
                    trigger.style.transitionDelay = `${index * 50}ms`;
                }
                
                // Immediately trigger first 3 sections to ensure something is visible
                if (index < 3) {
                    trigger.classList.add('animate-scene-emerge');
                    trigger.classList.remove('opacity-0');
                } else {
                    observer.observe(trigger);
                }
            }
        });
    }, 100);
}

/**
 * Initializes the globe scroll animation
 * Globe expands as user scrolls, then moves to center and fades out at the reveal section
 */
function initGlobeMapReveal() {
    const revealSection = document.getElementById('globe-map-reveal');
    const globeContainer = document.getElementById('globe-container');
    const hint = document.getElementById('globe-map-hint');
    const mapOverlay = document.getElementById('map-overlay');
    const allTimeText = document.getElementById('all-time-foreground-text');
    
    if (!revealSection || !globeContainer) return;
    
    let globeMapOpened = false;
    let clickHandlerAttached = false;
    let rotationStopped = false;
    
    // Original globe position values
    const originalTop = 80; // 5rem = 80px
    const originalLeft = 40;
    const originalSize = 500;
    const maxZoomSize = originalSize * 1.5;
    const maxExpandedSize = maxZoomSize; // Max size before centering
    const centeredSize = maxZoomSize; // Size when centered
    const originalOpacity = 0.5;
    
    // Remove any existing transitions for smooth scroll-linked animation
    globeContainer.style.transition = 'none';
    
    function updateRevealAnimation() {
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Get the reveal section position
        const revealRect = revealSection.getBoundingClientRect();
        const revealSectionHeight = revealSection.offsetHeight;
        
        // Calculate total scrollable height before reveal section
        const revealSectionTop = revealRect.top + scrollTop;
        const scrollableBeforeReveal = revealSectionTop - viewportHeight;
        
        // Calculate expansion progress (0 to 1) based on scroll through page content
        // Globe expands from originalSize to maxExpandedSize as user scrolls through content
        let expansionProgress = 0;
        if (scrollableBeforeReveal > 0) {
            expansionProgress = Math.min(1, Math.max(0, scrollTop / scrollableBeforeReveal));
        }
        
        // Calculate reveal progress (when user reaches the reveal section)
        const triggerPoint = viewportHeight * 0.7;
        const scrollRange = revealSectionHeight * 0.6;
        
        let revealProgress = 0;
        if (revealRect.top < triggerPoint) {
            revealProgress = Math.min(1, Math.max(0, (triggerPoint - revealRect.top) / scrollRange));
        }
        
        // Center of screen position
        const origCenterX = originalLeft + originalSize / 2;
        const origCenterY = originalTop + originalSize / 2;
        
        // Size that covers the whole screen (slightly oversized to fill edges)
        const fullScreenSize = Math.min(Math.max(viewportWidth, viewportHeight) * 1.15, maxZoomSize);

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/4d4efc66-24e5-4d09-bf3f-b903a435067a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1953',message:'reveal progress state',data:{revealProgress,globeMapOpened,clickHandlerAttached,hasMapOverlay:!!mapOverlay},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion agent log

        if (globeMapOpened || isMapOverlayOpen) {
            globeContainer.style.opacity = '0';
            globeContainer.style.zIndex = '0';
            if (hint) hint.style.opacity = '0';
            if (allTimeText) allTimeText.classList.remove('visible');
            return;
        }

        if (revealProgress <= 0) {
            // Not in reveal section yet - globe expands in place as user scrolls
            const expandedSize = originalSize + ((maxExpandedSize - originalSize) * expansionProgress);
            
            // Keep globe anchored at original position (top-left stays fixed)
            globeContainer.style.position = 'fixed';
            globeContainer.style.top = `${originalTop}px`;
            globeContainer.style.left = `${originalLeft}px`;
            globeContainer.style.width = `${expandedSize}px`;
            globeContainer.style.height = `${expandedSize}px`;
            globeContainer.style.opacity = originalOpacity;
            globeContainer.style.zIndex = '0';
            
            if (hint) hint.style.opacity = '0';
            if (allTimeText) allTimeText.classList.remove('visible');
            if (rotationStopped && globe && typeof globe.startRotation === 'function') {
                globe.autoRotateEnabled = true;
                globe.startRotation();
                rotationStopped = false;
            }
        } else if (revealProgress < 0.5) {
            // Globe moves from expanded position to center
            const moveProgress = revealProgress / 0.5; // 0 to 1
            const eased = easeOutCubic(moveProgress);
            
            // Start from current expanded size and position
            const startSize = maxExpandedSize;
            const startCenterX = originalLeft + startSize / 2;
            const startCenterY = originalTop + startSize / 2;
            
            // Interpolate to center
            const currentCenterX = startCenterX + ((window.innerWidth / 2) - startCenterX) * eased;
            const currentCenterY = startCenterY + ((viewportHeight / 2) - startCenterY) * eased;
            
            // Convert center to top-left position
            const currentLeft = currentCenterX - (centeredSize / 2);
            const currentTop = currentCenterY - (centeredSize / 2);
            
            // Opacity increases as it moves to center
            const currentOpacity = originalOpacity + (1 - originalOpacity) * eased;
            
            // Keep globe behind content; never bring to foreground
            const zIndex = '0';
            
            globeContainer.style.position = 'fixed';
            globeContainer.style.left = `${currentLeft}px`;
            globeContainer.style.top = `${currentTop}px`;
            globeContainer.style.width = `${centeredSize}px`;
            globeContainer.style.height = `${centeredSize}px`;
            globeContainer.style.opacity = currentOpacity;
            globeContainer.style.zIndex = zIndex;
            
            if (hint) hint.style.opacity = '0';
            if (allTimeText) allTimeText.classList.remove('visible');
        } else {
            // Globe is now centered - expand to full screen and stay interactive
            const fadeProgress = (revealProgress - 0.5) / 0.5; // 0 to 1
            const eased = easeOutCubic(fadeProgress);
            
            // Expand from centered size to full-screen size while staying centered
            const currentSize = centeredSize + ((fullScreenSize - centeredSize) * eased);
            const currentLeft = (viewportWidth - currentSize) / 2;
            const currentTop = (viewportHeight - currentSize) / 2;
            
            globeContainer.style.position = 'fixed';
            globeContainer.style.left = `${currentLeft}px`;
            globeContainer.style.top = `${currentTop}px`;
            globeContainer.style.width = `${currentSize}px`;
            globeContainer.style.height = `${currentSize}px`;
            globeContainer.style.opacity = '1';
            globeContainer.style.zIndex = '100';

            if (!rotationStopped && globe && typeof globe.stopRotation === 'function') {
                globe.autoRotateEnabled = false;
                globe.stopRotation();
                rotationStopped = true;
            }
            
            if (hint) hint.style.opacity = '1';
            if (allTimeText) allTimeText.classList.add('visible');
            
            if (!clickHandlerAttached) {
                clickHandlerAttached = true;
                globeContainer.addEventListener('click', () => {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/4d4efc66-24e5-4d09-bf3f-b903a435067a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:2078',message:'globe click handler fired',data:{globeMapOpened,hasMapOverlay:!!mapOverlay},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
                    // #endregion agent log
                    globeMapOpened = true;
                    globeContainer.style.opacity = '0';
                    if (hint) hint.style.opacity = '0';
                    if (mapOverlay) {
                        isMapOverlayOpen = true;
                        mapOverlay.classList.remove('hidden');
                    }
                    if (!isMapInitialized) {
                        initMap();
                    }
                    if (map) {
                        renderMarkers();
                        setTimeout(() => restoreMapView(), 100);
                    }
                }, { once: true });
            }
        }
    }
    
    // Easing function for smoother animation
    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    
    // Scroll handler using requestAnimationFrame for smooth updates
    let ticking = false;
    function onScroll() {
        if (!ticking) {
            requestAnimationFrame(() => {
                updateRevealAnimation();
                ticking = false;
            });
            ticking = true;
        }
    }
    
    window.addEventListener('scroll', onScroll, { passive: true });
    
    // Initial update
    updateRevealAnimation();
}
