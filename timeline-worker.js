/**
 * Web Worker: parse timeline JSON and run processTimelineData + calculateStats off the main thread.
 * Loads rbush (for spatial index) and timeline-utils via importScripts.
 */
importScripts('https://cdn.jsdelivr.net/npm/rbush@3.0.1/rbush.min.js', 'timeline-utils.js');

self.onmessage = function (e) {
    const { jsonText, countryGeoJSON, probabilityThreshold } = e.data || {};
    try {
        if (countryGeoJSON && typeof timelineUtils !== 'undefined' && timelineUtils.setCountryGeoJSON) {
            timelineUtils.setCountryGeoJSON(countryGeoJSON);
        }
        const json = JSON.parse(jsonText);
        const segments = timelineUtils.getSegmentsFromData(json);
        if (!segments.length) {
            const hint = Array.isArray(json) ? ' (root array was empty)' : ` (expected semanticSegments or root array; got keys: ${Object.keys(json).slice(0, 5).join(', ')})`;
            throw new Error('Invalid JSON structure. No timeline segments found' + hint);
        }
        const options = probabilityThreshold != null ? { probabilityThreshold } : {};
        const processed = timelineUtils.processTimelineData(json, options);
        const initialStats = timelineUtils.calculateStats(processed.allSegments);
        const payload = {
            allSegments: processed.allSegments,
            allLocations: processed.allLocations,
            years: processed.years,
            initialStats: {
                totalDistanceMeters: initialStats.totalDistanceMeters,
                totalVisits: initialStats.totalVisits,
                countries: Array.from(initialStats.countries),
                transport: initialStats.transport,
                visits: initialStats.visits,
                visitTypes: initialStats.visitTypes
            }
        };
        self.postMessage(payload);
    } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        if (typeof console !== 'undefined' && console.error) {
            console.error('[timeline-worker] Parse/process error:', msg, err);
        }
        self.postMessage({ error: msg });
    }
};
