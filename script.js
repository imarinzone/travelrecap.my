// Leaflet Map Configuration
let map = null;
let markers = null;
let currentStyle = 'light';
let selectedYear = null;

// CartoDB Tile Layer URLs
const tileLayers = {
    light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 19
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
    initializeYearFilter();

    // Load saved year preference
    const savedYear = localStorage.getItem('mapYear');
    if (savedYear) {
        document.getElementById('map-year-filter').value = savedYear;
        selectedYear = savedYear === '' ? null : savedYear;
    }

    // Setup fullscreen listeners
    setupFullscreenListeners();

    // Load place locations
    loadPlaceLocations();
}

// Initialize year filter dropdown
function initializeYearFilter() {
    const yearSelect = document.getElementById('map-year-filter');
    const currentYear = new Date().getFullYear();
    const startYear = 2020; // Adjust as needed
    
    // Generate year options (from startYear to currentYear, descending)
    for (let year = currentYear; year >= startYear; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
}

// Load place locations from API
async function loadPlaceLocations() {
    try {
        // Clear existing markers
        markers.clearLayers();
        
        // Build API URL with optional year filter
        let apiUrl = 'http://localhost:8080/api/place-locations';
        if (selectedYear) {
            apiUrl += `?year=${selectedYear}`;
        }
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const locations = await response.json();

        if (locations.length === 0) {
            console.warn('No place locations found');
            return;
        }

        // Calculate bounds
        const bounds = L.latLngBounds([]);
        locations.forEach(loc => {
            bounds.extend([loc.lat, loc.lng]);
        });

        // Fit map to bounds
        map.fitBounds(bounds, { padding: [50, 50] });

        // Add markers as individual points
        locations.forEach(loc => {
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

        console.log(`Loaded ${locations.length} place locations`);
    } catch (error) {
        console.error('Error loading place locations:', error);
        // Show error message in map container
        const mapDiv = document.getElementById('map');
        mapDiv.innerHTML = `
            <div class="flex items-center justify-center h-full bg-gray-100">
                <div class="text-center p-4">
                    <p class="text-gray-600 mb-2">Unable to load map data</p>
                    <p class="text-sm text-gray-500">Please ensure the backend API is running</p>
                </div>
            </div>
        `;
    }
}

// Build popup content for marker
function buildPopupContent(location) {
    let content = '<div class="text-sm">';
    if (location.city) {
        content += `<strong>${location.city}</strong>`;
    }
    if (location.country) {
        if (location.city) {
            content += `, ${location.country}`;
        } else {
            content += `<strong>${location.country}</strong>`;
        }
    }
    content += `<br><span class="text-gray-500">${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}</span>`;
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
    loadPlaceLocations();
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
}

