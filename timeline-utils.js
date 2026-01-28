(function (exports) {

    // structured Logger utility
    class Logger {
        static formatMessage(level, message) {
            const timestamp = new Date().toLocaleTimeString();
            return `[${timestamp}] [${level}] ${message}`;
        }

        static info(message, data) {
            const msg = this.formatMessage('INFO', message);
            if (data) {
                console.log(msg, data);
            } else {
                console.log(msg);
            }
        }

        static warn(message, data) {
            const msg = this.formatMessage('WARN', message);
            if (data) {
                console.warn(msg, data);
            } else {
                console.warn(msg);
            }
        }

        static error(message, error) {
            const msg = this.formatMessage('ERROR', message);
            if (error) {
                console.error(msg, error);
            } else {
                console.error(msg);
            }
        }

        static time(label) {
            console.time(label);
        }

        static timeEnd(label) {
            console.timeEnd(label);
        }
    }

    // ===== OFFLINE COUNTRY LOOKUP (GEOJSON + POINT-IN-POLYGON) =====

    // Simple ray‑casting point-in-polygon implementation
    // NOTE: GeoJSON coordinates are [lng, lat]. This function expects:
    //  - lat, lng as numbers
    //  - polygon as an array of [lng, lat] coordinate pairs
    function pointInPolygon(lat, lng, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i][0]; // lng
            const yi = polygon[i][1]; // lat
            const xj = polygon[j][0]; // lng
            const yj = polygon[j][1]; // lat

            const intersect =
                ((yi > lat) !== (yj > lat)) &&
                (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    class CountryLookup {
        constructor(geojson) {
            this.features = Array.isArray(geojson?.features) ? geojson.features : [];
        }

        getCountry(lat, lng) {
            for (const f of this.features) {
                const props = f.properties || {};
                const name = props.ADMIN || props.name || props.NAME || null;
                const geom = f.geometry;
                if (!geom || !geom.type || !geom.coordinates) continue;

                if (geom.type === 'Polygon') {
                    if (geom.coordinates.some(ring => pointInPolygon(lat, lng, ring))) {
                        return name;
                    }
                } else if (geom.type === 'MultiPolygon') {
                    if (geom.coordinates.some(poly =>
                        poly.some(ring => pointInPolygon(lat, lng, ring))
                    )) {
                        return name;
                    }
                }
            }
            return null;
        }
    }

    let countryLookupInstance = null;

    /**
     * Configure the offline country lookup with a GeoJSON of country borders.
     * Call this from the browser (e.g. after fetching data/countries.geojson).
     */
    function setCountryGeoJSON(geojson) {
        try {
            countryLookupInstance = new CountryLookup(geojson);
            Logger.info('Country boundaries loaded for offline geocoding', {
                featureCount: countryLookupInstance.features.length
            });
        } catch (e) {
            Logger.warn('Failed to initialize CountryLookup', e);
            countryLookupInstance = null;
        }
    }

    function getCountryFromLatLng(lat, lng) {
        if (!countryLookupInstance) return null;
        return countryLookupInstance.getCountry(lat, lng);
    }

    function parseLatLngString(latLngStr) {
        if (!latLngStr) return null;
        const parts = latLngStr.replace(/°/g, '').split(',');
        if (parts.length !== 2) return null;
        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());
        if (isNaN(lat) || isNaN(lng)) return null;
        return { lat, lng };
    }

    // Process Google Timeline JSON
    function processTimelineData(data) {
        const allSegments = data.semanticSegments || [];
        const allLocations = [];
        const years = new Set();

        // 1. Extract Locations and Years
        allSegments.forEach(segment => {
            // Collect Years
            if (segment.startTime) {
                const year = new Date(segment.startTime).getFullYear();
                years.add(year);
            }

            // Collect Locations for Map
            if (segment.visit) {
                const visit = segment.visit;
                const placeLocation = visit.topCandidate && visit.topCandidate.placeLocation;
                const latLngStr = placeLocation && placeLocation.latLng;
                const parsed = parseLatLngString(latLngStr);

                if (parsed) {
                    const { lat, lng } = parsed;

                    // Offline country lookup (if GeoJSON configured)
                    const country = getCountryFromLatLng(lat, lng);
                    if (country) {
                        // Attach to segment for later stats aggregation
                        segment.country = country;
                    }

                    allLocations.push({
                        lat: lat,
                        lng: lng,
                        startTime: segment.startTime,
                        endTime: segment.endTime,
                        name: placeLocation && placeLocation.name,
                        probability: visit.probability,
                        placeId: visit.topCandidate.placeId,
                        country: country || null
                    });
                }
            }
        });

        return {
            allSegments,
            allLocations,
            years: Array.from(years)
        };
    }

    // Calculate comprehensive statistics from segments
    function calculateStats(segments) {
        const stats = {
            totalDistanceMeters: 0,
            totalVisits: 0,
            countries: new Set(),
            transport: {}, // { type: { count, distanceMeters, durationMs } }
            visits: {},    // { placeId: { name, count, location, country } }
            visitTypes: {} // { type: count } e.g. "Restaurant": 10
        };

        segments.forEach(segment => {
            // Activity Stats
            if (segment.activity) {
                const activity = segment.activity;
                if (activity.distanceMeters) {
                    stats.totalDistanceMeters += activity.distanceMeters;
                }

                if (activity.topCandidate && activity.topCandidate.type) {
                    const type = activity.topCandidate.type;
                    if (!stats.transport[type]) {
                        stats.transport[type] = { count: 0, distanceMeters: 0, durationMs: 0 };
                    }
                    stats.transport[type].count++;
                    if (activity.distanceMeters) stats.transport[type].distanceMeters += activity.distanceMeters;

                    const duration = new Date(segment.endTime) - new Date(segment.startTime);
                    stats.transport[type].durationMs += duration;
                }
            }

            // Visit Stats
            if (segment.visit) {
                stats.totalVisits++;
                const visit = segment.visit;

                if (visit.topCandidate) {
                    const placeLocation = visit.topCandidate.placeLocation || {};
                    const placeId = visit.topCandidate.placeId;
                    const name = placeLocation.name || "Unknown Place";
                    let country = segment.country || null;

                    // If we don't already have a country on the segment, try offline lookup from lat/lng
                    if (!country && placeLocation.latLng) {
                        const parsed = parseLatLngString(placeLocation.latLng);
                        if (parsed) {
                            country = getCountryFromLatLng(parsed.lat, parsed.lng);
                        }
                    }

                    // Track Unique Countries
                    if (country) {
                        stats.countries.add(country);
                    }

                    if (!stats.visits[placeId]) {
                        stats.visits[placeId] = {
                            name: name,
                            count: 0,
                            latLng: placeLocation.latLng,
                            country: country || null
                        };
                    }
                    stats.visits[placeId].count++;
                }
            }
        });

        return stats;
    }

    function calculateAdvancedStats(segments) {
        const stats = {
            eco: { totalCo2: 0, breakdown: {} },
            time: { moving: 0, stationary: 0, total: 0 },
            records: { longestDrive: 0, longestWalk: 0, maxVelocity: 0 }
        };

        // CO2 Emission Factors (approx g/km)
        const emissionFactors = {
            'IN_PASSENGER_VEHICLE': 150,
            'IN_VEHICLE': 150,
            'IN_TAXI': 150,
            'FLYING': 115,
            'IN_BUS': 80,
            'IN_TRAIN': 40,
            'IN_SUBWAY': 40,
            'WALKING': 0,
            'RUNNING': 0,
            'CYCLING': 0,
            'MOTORCYCLING': 100
        };

        segments.forEach(segment => {
            const duration = new Date(segment.endTime) - new Date(segment.startTime);
            stats.time.total += duration;

            if (segment.activity) {
                stats.time.moving += duration;

                const type = segment.activity.topCandidate?.type || 'UNKNOWN';
                const distanceKm = (segment.activity.distanceMeters || 0) / 1000;

                // Eco Calc
                const factor = emissionFactors[type] || 0;
                const co2 = distanceKm * factor;
                stats.eco.totalCo2 += co2;
                stats.eco.breakdown[type] = (stats.eco.breakdown[type] || 0) + co2;

                // Records
                if (segment.activity.distanceMeters) {
                    if ((type === 'IN_PASSENGER_VEHICLE' || type === 'IN_VEHICLE') && segment.activity.distanceMeters > stats.records.longestDrive) {
                        stats.records.longestDrive = segment.activity.distanceMeters;
                    }
                    if ((type === 'WALKING' || type === 'RUNNING') && segment.activity.distanceMeters > stats.records.longestWalk) {
                        stats.records.longestWalk = segment.activity.distanceMeters;
                    }
                }
            }
            else if (segment.visit) {
                stats.time.stationary += duration;
            }
        });

        return stats;
    }

    exports.processTimelineData = processTimelineData;
    exports.calculateStats = calculateStats;
    exports.calculateAdvancedStats = calculateAdvancedStats;
    exports.setCountryGeoJSON = setCountryGeoJSON;
    exports.Logger = Logger;

})(typeof exports === 'undefined' ? (this.timelineUtils = {}) : exports);
