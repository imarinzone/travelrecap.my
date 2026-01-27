// Leaflet Map Configuration
let map = null;
let markers = null;
let currentStyle = 'light';
let selectedYear = null;
let allLocations = []; // Store loaded locations for filtering
let allSegments = []; // Store all timeline segments (visits and activities)
let globe = null; // Globe instance

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

// Initialize map
function initMap() {
    // Load saved style preference
    const savedStyle = localStorage.getItem('mapStyle');
    if (savedStyle === 'dark' || savedStyle === 'light') {
        currentStyle = savedStyle;
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

    // Initialize year dropdown
    initializeYearFilter([]);

    // Load saved year preference
    const savedYear = localStorage.getItem('mapYear');
    if (savedYear) {
        selectedYear = savedYear === '' ? null : savedYear;
    }

    // Setup fullscreen listeners
    setupFullscreenListeners();
}

// Initialize year filter dropdown
function initializeYearFilter(availableYears) {
    const yearSelect = document.getElementById('map-year-filter');
    yearSelect.innerHTML = '<option value="">All Years</option>';

    // Sort years descending
    availableYears.sort((a, b) => b - a);

    availableYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (selectedYear && parseInt(selectedYear) === year) {
            option.selected = true;
        }
        yearSelect.appendChild(option);
    });

    // If we have years and no selected year (or invalid one), select the most recent one
    if (availableYears.length > 0 && (!selectedYear || !availableYears.includes(parseInt(selectedYear)))) {
        selectedYear = availableYears[0];
        yearSelect.value = selectedYear;
        localStorage.setItem('mapYear', selectedYear);

        // Update title to reflect year
        document.getElementById('header-title').textContent = `Im, here's your ${selectedYear} Timeline update`;
    }
}

// Handle file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const statusSpan = document.getElementById('upload-status');
    statusSpan.textContent = 'Parsing...';

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const json = JSON.parse(e.target.result);
            processAndRenderData(json);
            statusSpan.textContent = `Loaded data successfully`;
            statusSpan.className = 'text-sm font-medium text-green-600';
        } catch (error) {
            console.error('Error parsing JSON:', error);
            statusSpan.textContent = 'Error parsing JSON file';
            statusSpan.className = 'text-sm font-medium text-red-600';
        }
    };
    reader.readAsText(file);
}

// Process Google Timeline JSON & Update UI
function processAndRenderData(json) {
    // Use the utility to process raw JSON
    const processed = timelineUtils.processTimelineData(json);

    allSegments = processed.allSegments;
    allLocations = processed.allLocations;
    const years = processed.years;

    console.log(`Parsed ${allLocations.length} locations`);

    // Calculate initial stats to get countries for the globe
    const initialStats = timelineUtils.calculateStats(allSegments);

    // Initialize or update Globe
    const globeContainer = document.getElementById('globe-container');
    if (globeContainer) {
        globeContainer.innerHTML = ''; // Clear previous globe
        const visitedCountries = Array.from(initialStats.countries);
        globe = new Globe('globe-container', visitedCountries);

        // Fade in
        globeContainer.classList.remove('opacity-0');
        globeContainer.classList.add('opacity-100');
    }

    // Initialize UI with data
    initializeYearFilter(years);

    // Auto-select the latest year (first in the sorted list)
    if (years.length > 0) {
        selectedYear = years[0];
        localStorage.setItem('mapYear', selectedYear);
        const yearSelect = document.getElementById('map-year-filter');
        if (yearSelect) yearSelect.value = selectedYear;
    }

    renderDashboard();
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
        document.getElementById('header-title').textContent = `Im, here's your ${currentYear} Timeline update`;
    } else {
        document.getElementById('header-title').textContent = `Im, here's your Timeline update`;
    }

    // 3. Calculate Stats using Utility
    const stats = timelineUtils.calculateStats(statsSegments);

    const allTimeStats = timelineUtils.calculateStats(allSegments);
    const advancedStats = timelineUtils.calculateAdvancedStats(statsSegments);

    // 4. Update UI Sections
    renderStatistics(stats);
    renderTravelSummary(stats);
    renderTravelTrends(stats.transport);
    renderVisitTrends(stats.visits);
    renderHighlights(stats.visits, statsSegments);
    renderAllTimeStats(allTimeStats);

    // 5. Render New Metrics
    renderEcoImpact(advancedStats.eco);
    renderTimeDistribution(advancedStats.time);
    renderRecordBreakers(advancedStats.records);

    // 6. Reveal Dashboard
    const dashboard = document.getElementById('dashboard-content');
    if (dashboard) {
        dashboard.classList.remove('hidden');
    }
}

function renderEcoImpact(ecoStats) {
    const grid = document.getElementById('eco-impact-grid');
    grid.innerHTML = '';

    // Total CO2
    const totalKg = Math.round(ecoStats.totalCo2 / 1000);
    const treesNeeded = Math.ceil(totalKg / 25); // Approx 25kg CO2 per tree per year

    grid.appendChild(createStatCard('Est. Carbon Footprint', `${totalKg} kg CO₂`, 'co2'));
    grid.appendChild(createStatCard('Trees to Offset', `${treesNeeded} trees`, 'forest'));

    // Top Emitter
    let topEmitter = 'None';
    let maxVal = 0;
    for (const [type, val] of Object.entries(ecoStats.breakdown)) {
        if (val > maxVal) {
            maxVal = val;
            topEmitter = type.replace('IN_', '').replace('_', ' ');
        }
    }
    grid.appendChild(createStatCard('Primary Source', topEmitter, 'factory'));
}

function renderTimeDistribution(timeStats) {
    const container = document.getElementById('time-distribution-stats');
    container.innerHTML = '';

    const totalHours = timeStats.total / (1000 * 60 * 60);
    const movingHours = timeStats.moving / (1000 * 60 * 60);
    const stationaryHours = timeStats.stationary / (1000 * 60 * 60);

    const movingPct = Math.round((timeStats.moving / timeStats.total) * 100) || 0;
    const stationaryPct = Math.round((timeStats.stationary / timeStats.total) * 100) || 0;

    container.innerHTML = `
        <div class="flex items-center justify-between">
            <span class="text-gray-600">Stationary (Visits)</span>
            <span class="font-bold relative group cursor-help">
                ${stationaryPct}%
                <span class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    ${Math.round(stationaryHours)} hours
                </span>
            </span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2.5 mb-4">
            <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${stationaryPct}%"></div>
        </div>

        <div class="flex items-center justify-between">
            <span class="text-gray-600">On the Move (Travel)</span>
             <span class="font-bold relative group cursor-help">
                ${movingPct}%
                 <span class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    ${Math.round(movingHours)} hours
                </span>
            </span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2.5">
            <div class="bg-green-500 h-2.5 rounded-full" style="width: ${movingPct}%"></div>
        </div>
    `;
}

function renderRecordBreakers(records) {
    const container = document.getElementById('record-breakers-stats');
    container.innerHTML = '';

    const driveKm = (records.longestDrive / 1000).toFixed(1);
    const walkKm = (records.longestWalk / 1000).toFixed(1);

    container.innerHTML = `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-3">
                <span class="text-2xl">🚗</span>
                <div>
                    <p class="text-sm text-gray-500">Longest Drive</p>
                    <p class="font-bold text-gray-900">${driveKm} km</p>
                </div>
            </div>
        </div>
        
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-3">
                <span class="text-2xl">🚶</span>
                <div>
                    <p class="text-sm text-gray-500">Longest Walk</p>
                    <p class="font-bold text-gray-900">${walkKm} km</p>
                </div>
            </div>
        </div>
    `;
}

// Heuristic to extract city and country from address strings
function extractLocationDetails(address, citiesSet, countriesSet) {
    const parts = address.split(',').map(p => p.trim());
    if (parts.length > 0) {
        countriesSet.add(parts[parts.length - 1]); // Last format is usually country
    }
    if (parts.length > 2) {
        citiesSet.add(parts[parts.length - 3] || parts[parts.length - 2] || parts[0]);
    }
}

function renderStatistics(stats) {
    const grid = document.getElementById('statistics-grid');
    grid.innerHTML = '';

    // Total Distance
    const distanceKm = Math.round(stats.totalDistanceMeters / 1000);
    grid.appendChild(createStatCard('Total Distance', `${distanceKm.toLocaleString()} km`, 'commute'));

    // Total Visits
    grid.appendChild(createStatCard('Places Visited', stats.totalVisits.toLocaleString(), 'place'));

    // Top City (Most visited)
    // Always show Cities Visited even if 0, correctly reflecting data
    grid.appendChild(createStatCard('Cities Visited', stats.cities.size.toLocaleString(), 'location_city'));
}

function createStatCard(title, value, iconName) {
    const div = document.createElement('div');
    // Glass styling for stat cards
    div.className = 'glass rounded-2xl p-6 shadow-sm flex items-center transform hover:scale-105 transition-transform duration-300';
    div.innerHTML = `
        <div class="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 mr-4 shadow-inner">
            <span class="material-icons" style="font-size: 28px;">${iconName}</span> 
            ${iconName === 'commute' ? '🚗' : iconName === 'place' ? '📍' : '🏙️'}
        </div>
        <div>
            <p class="text-sm font-medium text-gray-500 uppercase tracking-wide">${title}</p>
            <p class="text-3xl font-bold text-gray-900">${value}</p>
        </div>
    `;
    return div;
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

window.shareCard = async function (elementId) {
    const node = document.getElementById(elementId);
    if (!node) return;

    const fileImages = node.querySelectorAll('img[src^="file://"]');
    const hasFileImages = fileImages.length > 0;
    const btn = node.querySelector('button[onclick^="shareCard"]');
    const originalContent = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = '<span>⏳ Generating...</span>';

    // Temporary style adjustments for better capture
    const originalTransform = node.style.transform;
    node.style.transform = 'none';

    try {
        if (hasFileImages && window.location.protocol === 'file:') {
            showShareToast('Local images cannot be captured from file://. Run a local server for full capture.', 'info');
        }

        const blob = await htmlToImage.toBlob(node, {
            backgroundColor: '#f5f7fa', // Light background for the image
            pixelRatio: 2, // High resolution
            filter: (domNode) => {
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

        if (!blob) {
            throw new Error('Image capture failed.');
        }

        const filename = `travel-recap-${new Date().getTime()}.png`;
        const file = new File([blob], filename, { type: blob.type || 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            if (btn) btn.innerHTML = '<span>📤 Sharing...</span>';
            await navigator.share({
                files: [file],
                title: 'Travel Recap',
                text: 'My travel recap stats.'
            });
            if (btn) btn.innerHTML = '<span>✅ Shared!</span>';
            showShareToast('Shared. You can post it to Instagram from the share sheet.', 'success');
        } else {
            triggerDownload(blob, filename);
            if (btn) btn.innerHTML = '<span>✅ Saved!</span>';
            showShareToast('Downloaded. Upload to Instagram manually.', 'info');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Share canceled by user');
            if (btn) btn.innerHTML = originalContent;
            return;
        }
        console.error('Error sharing image:', error);
        if (btn) btn.innerHTML = '<span>❌ Error</span>';
        showShareToast('Could not share. Please try again.', 'error');
    } finally {
        node.style.transform = originalTransform;
        setTimeout(() => { if (btn) btn.innerHTML = originalContent; }, 2000);
    }
};

function renderTravelSummary(stats) {
    const worldPercentage = document.getElementById('world-percentage');
    const description = document.getElementById('travel-description');

    if (stats.countries.size > 0) {
        const coverage = Math.min((stats.countries.size / 195) * 100 * 5, 100).toFixed(1);
        worldPercentage.textContent = `${coverage}%`;
        const count = stats.countries.size;
        const cityCount = stats.cities.size;
        description.innerHTML = `
            You've explored <strong>${count} countries</strong> and <strong>${cityCount} cities</strong>.<br>
            Covering a total of <strong>${Math.round(stats.totalDistanceMeters / 1000).toLocaleString()} km</strong>.
        `;
    } else {
        // Fallback when no country data
        worldPercentage.textContent = '--%';
        description.innerHTML = `
            Covering a total of <strong>${Math.round(stats.totalDistanceMeters / 1000).toLocaleString()} km</strong>.<br>
            <span class="text-xs text-gray-400">Location names missing from data source.</span>
        `;
    }
}

function renderTravelTrends(transportStats) {
    const grid = document.getElementById('travel-trends-grid');
    grid.innerHTML = '';

    const sortedTransport = Object.entries(transportStats)
        .sort(([, a], [, b]) => b.distanceMeters - a.distanceMeters)
        .slice(0, 6);

    sortedTransport.forEach(([type, data]) => {
        const distanceKm = Math.round(data.distanceMeters / 1000);
        const durationHours = Math.round(data.durationMs / (1000 * 60 * 60));

        const card = document.createElement('div');
        card.className = 'flex items-center justify-between p-4 bg-white/50 rounded-xl hover:bg-white/80 transition-colors border border-white/40';

        let icon = '❓';
        let label = type;

        if (type === 'IN_PASSENGER_VEHICLE') { icon = '🚗'; label = 'Car'; }
        else if (type === 'WALKING') { icon = '🚶'; label = 'Walking'; }
        else if (type === 'IN_TRAIN') { icon = '🚆'; label = 'Train'; }
        else if (type === 'IN_BUS') { icon = '🚌'; label = 'Bus'; }
        else if (type === 'FLYING') { icon = '✈️'; label = 'Flying'; }
        else if (type === 'CYCLING') { icon = '🚴'; label = 'Cycling'; }
        else if (type === 'MOTORCYCLING') { icon = '🏍️'; label = 'Motorbike'; }

        card.innerHTML = `
            <div class="flex items-center gap-4">
                <span class="text-2xl bg-white p-2 rounded-lg shadow-sm">${icon}</span>
                <span class="font-semibold text-gray-700">${label}</span>
            </div>
            <div class="text-right">
                <div class="text-base font-bold text-gray-900">${distanceKm.toLocaleString()} km</div>
                <div class="text-xs text-gray-500 font-medium">${durationHours} hrs</div>
            </div>
        `;
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
                <p class="text-xs text-gray-500 truncate w-48 font-medium">${place.address || ''}</p>
            </div>
            <div class="flex flex-col items-end">
                <span class="text-xl font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md min-w-[30px] text-center">${place.count}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderHighlights(visitStats, segments) {
    // 1. Places Highlights (Top visited)
    const placesGrid = document.getElementById('places-grid');
    placesGrid.innerHTML = '';

    const topPlaces = Object.values(visitStats)
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

    // If no places have names (heuristic: all names are "Unknown Place"), hide the section
    const hasNames = topPlaces.some(p => p.name !== "Unknown Place");

    if (hasNames) {
        topPlaces.forEach(place => {
            const card = document.createElement('div');
            card.className = 'glass rounded-xl p-5 shadow-sm hover:shadow-lg transition-all transform hover:-translate-y-1';
            card.innerHTML = `
                 <div class="w-full h-32 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg mb-4 flex items-center justify-center text-indigo-300">
                    <span class="text-5xl drop-shadow-sm">📍</span>
                </div>
                <h3 class="font-bold text-gray-900 mb-1 truncate text-lg" title="${place.name}">${place.name}</h3>
                <div class="flex justify-between items-center mt-3">
                    <span class="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md">${place.count} visits</span>
                    <p class="text-xs text-gray-400 font-mono">${place.latLng ? place.latLng : ''}</p>
                </div>
            `;
            placesGrid.appendChild(card);
        });
        placesGrid.closest('section').style.display = 'block';
    } else {
        placesGrid.closest('section').style.display = 'none';
    }

    // 2. Cities Highlights
    const citiesGrid = document.getElementById('cities-grid');
    citiesGrid.innerHTML = '';

    const cityCounts = {};
    Object.values(visitStats).forEach(place => {
        if (place.address) {
            const parts = place.address.split(',').map(p => p.trim());
            if (parts.length >= 3) {
                const city = parts[parts.length - 3] || parts[parts.length - 2];
                cityCounts[city] = (cityCounts[city] || 0) + place.count;
            }
        }
    });

    const topCities = Object.entries(cityCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

    if (topCities.length > 0) {
        topCities.forEach(([city, count]) => {
            const card = document.createElement('div');
            card.className = 'glass rounded-xl p-5 shadow-sm flex items-center gap-4 hover:shadow-lg transition-all';
            card.innerHTML = `
                <div class="p-3 bg-gradient-to-br from-purple-100 to-pink-100 text-purple-600 rounded-xl shadow-inner">
                    <span class="text-2xl">🏙️</span>
                </div>
                <div>
                    <h3 class="font-bold text-gray-900 text-lg leading-tight">${city}</h3>
                    <p class="text-sm text-gray-500 font-medium mt-1">${count} places visited</p>
                </div>
            `;
            citiesGrid.appendChild(card);
        });
        citiesGrid.closest('section').style.display = 'block';
    } else {
        citiesGrid.closest('section').style.display = 'none';
    }
}

function renderAllTimeStats(stats) {
    const container = document.getElementById('all-time-stats');
    container.innerHTML = '';

    const statsData = [
        { label: 'Total Distance', value: Math.round(stats.totalDistanceMeters / 1000).toLocaleString() + ' km' },
        { label: 'Total Visits', value: stats.totalVisits.toLocaleString() },
        { label: 'Countries', value: stats.countries.size.toLocaleString() }
    ];

    statsData.forEach(stat => {
        const div = document.createElement('div');
        div.innerHTML = `
            <p class="text-3xl font-bold text-gray-900 mb-1">${stat.value}</p>
            <p class="text-sm text-gray-600 uppercase tracking-wide">${stat.label}</p>
        `;
        container.appendChild(div);
    });
}

// Helper: Render map markers (from previous implementation, slightly adjusted)
function renderMarkers() {
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
        console.warn('No locations found for selected year');
        return;
    }

    // Calculate bounds
    const bounds = L.latLngBounds([]);
    filteredLocations.forEach(loc => {
        bounds.extend([loc.lat, loc.lng]);
    });

    // Fit map to bounds
    map.fitBounds(bounds, { padding: [50, 50] });

    // Add markers as individual points
    filteredLocations.forEach(loc => {
        const popupContent = buildPopupContent(loc);
        // Create a custom icon for a simple red point
        const pointIcon = L.divIcon({
            className: 'custom-point-marker',
            html: '<div style="width: 8px; height: 8px; background-color: #ef4444; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [8, 8],
            iconAnchor: [4, 4]
        });
        const marker = L.marker([loc.lat, loc.lng], { icon: pointIcon })
            .bindPopup(popupContent);
        markers.addLayer(marker);
    });

    console.log(`Rendered ${filteredLocations.length} markers`);
}

// Build popup content for marker
function buildPopupContent(location) {
    let content = '<div class="text-sm">';

    if (location.name) {
        content += `<strong>${location.name}</strong><br>`;
    }

    if (location.address) {
        content += `<span class="text-xs text-gray-600">${location.address}</span><br>`;
    } else {
        content += `<strong>Unknown Location</strong><br>`;
    }

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

// Update style button states
function updateStyleButtons() {
    const lightBtn = document.getElementById('map-style-light');
    const darkBtn = document.getElementById('map-style-dark');

    if (currentStyle === 'light') {
        lightBtn.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
        lightBtn.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
        darkBtn.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700');
        darkBtn.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
    } else {
        darkBtn.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
        darkBtn.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
        lightBtn.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700');
        lightBtn.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
    }
}

// Handle year filter change
function onYearFilterChange() {
    const yearSelect = document.getElementById('map-year-filter');
    selectedYear = yearSelect.value === '' ? null : yearSelect.value;
    localStorage.setItem('mapYear', yearSelect.value);

    renderDashboard();
}

// Toggle fullscreen
function toggleFullscreen() {
    const mapSection = document.querySelector('#map-container-wrapper').closest('section');

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
        fullscreenIcon.textContent = '⛶';
        if (fullscreenText) fullscreenText.textContent = 'Exit';
        fullscreenBtn.setAttribute('title', 'Exit fullscreen');
        // Resize map after entering fullscreen
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    } else {
        fullscreenIcon.textContent = '⛶';
        if (fullscreenText) fullscreenText.textContent = 'Fullscreen';
        fullscreenBtn.setAttribute('title', 'Toggle fullscreen');
        // Resize map after exiting fullscreen
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
}

// Setup fullscreen event listeners
function setupFullscreenListeners() {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
}

// Initialize map when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initMap();
        // Style switcher event listeners
        document.getElementById('map-style-light').addEventListener('click', () => switchMapStyle('light'));
        document.getElementById('map-style-dark').addEventListener('click', () => switchMapStyle('dark'));
        // Year filter event listener
        document.getElementById('map-year-filter').addEventListener('change', onYearFilterChange);
        // Fullscreen event listener
        document.getElementById('map-fullscreen').addEventListener('click', toggleFullscreen);

        // File input listener
        const fileInput = document.getElementById('timeline-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', handleFileUpload);
        }
    });
} else {
    initMap();
    // Style switcher event listeners
    document.getElementById('map-style-light').addEventListener('click', () => switchMapStyle('light'));
    document.getElementById('map-style-dark').addEventListener('click', () => switchMapStyle('dark'));
    // Year filter event listener
    document.getElementById('map-year-filter').addEventListener('change', onYearFilterChange);
    // Fullscreen event listener
    document.getElementById('map-fullscreen').addEventListener('click', toggleFullscreen);

    // File input listener
    const fileInput = document.getElementById('timeline-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }
}
