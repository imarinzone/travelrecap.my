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
                if (visit.topCandidate && visit.topCandidate.placeLocation && visit.topCandidate.placeLocation.latLng) {
                    const latLngStr = visit.topCandidate.placeLocation.latLng;
                    const parts = latLngStr.replace(/°/g, '').split(',');
                    if (parts.length === 2) {
                        const lat = parseFloat(parts[0].trim());
                        const lng = parseFloat(parts[1].trim());

                        if (!isNaN(lat) && !isNaN(lng)) {
                            allLocations.push({
                                lat: lat,
                                lng: lng,
                                startTime: segment.startTime,
                                endTime: segment.endTime,
                                address: visit.topCandidate.placeLocation.address,
                                name: visit.topCandidate.placeLocation.name,
                                probability: visit.probability,
                                placeId: visit.topCandidate.placeId
                            });
                        }
                    }
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
            cities: new Set(),
            transport: {}, // { type: { count, distanceMeters, durationMs } }
            visits: {},    // { placeId: { name, count, location, address } }
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
                    const placeId = visit.topCandidate.placeId;
                    const name = visit.topCandidate.placeLocation?.name || "Unknown Place";
                    const address = visit.topCandidate.placeLocation?.address;

                    // Track Unique Cities/Countries (Heuristic based on address)
                    if (address) {
                        extractLocationDetails(address, stats.cities, stats.countries);
                    }

                    if (!stats.visits[placeId]) {
                        stats.visits[placeId] = {
                            name: name,
                            count: 0,
                            address: address,
                            latLng: visit.topCandidate.placeLocation?.latLng
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

    exports.processTimelineData = processTimelineData;
    exports.calculateStats = calculateStats;
    exports.calculateAdvancedStats = calculateAdvancedStats;
    exports.extractLocationDetails = extractLocationDetails;
    exports.Logger = Logger;

})(typeof exports === 'undefined' ? (this.timelineUtils = {}) : exports);
