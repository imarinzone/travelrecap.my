const timelineUtils = require('../timeline-utils');

describe('Timeline Utilities', () => {

    describe('calculateStats', () => {
        test('should correctly calculate total distance', () => {
            const segments = [
                { activity: { distanceMeters: 1000 } },
                { activity: { distanceMeters: 500 } },
                { visit: {} } // Should ignore visits for distance
            ];
            const stats = timelineUtils.calculateStats(segments);
            expect(stats.totalDistanceMeters).toBe(1500);
        });

        test('should count visits correctly', () => {
            const segments = [
                { visit: { topCandidate: { placeId: 'A' } } },
                { visit: { topCandidate: { placeId: 'B' } } },
                { activity: {} }
            ];
            const stats = timelineUtils.calculateStats(segments);
            expect(stats.totalVisits).toBe(2);
            expect(Object.keys(stats.visits).length).toBe(2);
        });

        test('should aggregate transport stats', () => {
            const startTime = new Date('2024-01-01T10:00:00Z');
            const endTime = new Date('2024-01-01T11:00:00Z'); // 1 hour
            const segments = [
                {
                    activity: {
                        distanceMeters: 10000,
                        topCandidate: { type: 'IN_PASSENGER_VEHICLE' }
                    },
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString()
                }
            ];
            const stats = timelineUtils.calculateStats(segments);
            expect(stats.transport['IN_PASSENGER_VEHICLE']).toBeDefined();
            expect(stats.transport['IN_PASSENGER_VEHICLE'].count).toBe(1);
            expect(stats.transport['IN_PASSENGER_VEHICLE'].distanceMeters).toBe(10000);
            expect(stats.transport['IN_PASSENGER_VEHICLE'].durationMs).toBe(3600000);
        });

    });

    describe('calculateAdvancedStats', () => {
        test('should calculate eco impact', () => {
            // IN_PASSENGER_VEHICLE = 150g/km
            // 10km = 1500g CO2
            const segments = [
                {
                    activity: {
                        distanceMeters: 10000,
                        topCandidate: { type: 'IN_PASSENGER_VEHICLE' }
                    },
                    startTime: new Date().toISOString(),
                    endTime: new Date().toISOString()
                }
            ];
            const stats = timelineUtils.calculateAdvancedStats(segments);
            expect(stats.eco.totalCo2).toBeCloseTo(1500);
            expect(stats.eco.breakdown['IN_PASSENGER_VEHICLE']).toBeCloseTo(1500);
        });

        test('should track record breakers', () => {
            const segments = [
                {
                    activity: {
                        distanceMeters: 5000,
                        topCandidate: { type: 'WALKING' }
                    },
                    startTime: '2024-01-01T10:00:00Z',
                    endTime: '2024-01-01T11:00:00Z'
                },
                {
                    activity: {
                        distanceMeters: 2000,
                        topCandidate: { type: 'WALKING' }
                    },
                    startTime: '2024-01-02T10:00:00Z',
                    endTime: '2024-01-02T11:00:00Z'
                }
            ];
            const stats = timelineUtils.calculateAdvancedStats(segments);
            expect(stats.records.longestWalk).toBe(5000);
        });
    });

    describe('processTimelineData', () => {
        test('should extract locations and years', () => {
            const data = {
                semanticSegments: [
                    {
                        startTime: '2023-05-10T12:00:00Z',
                        visit: {
                            topCandidate: {
                                placeLocation: {
                                    latLng: '10.5, 20.5',
                                    name: 'Place A'
                                },
                                placeId: 'A'
                            }
                        }
                    },
                    {
                        startTime: '2024-01-01T12:00:00Z',
                        visit: { /* valid visit */ }
                    }
                ]
            };
            // Mock limited data to avoid complex optional chaining errors in test setup if not perfect
            // But let's assume the function handles it. 
            // Actually, let's make sure the second visit is malformed to check robustness? 
            // The code checks: visit.topCandidate.placeLocation.latLng

            const processed = timelineUtils.processTimelineData(data);
            expect(processed.years).toContain(2023);
            expect(processed.years).toContain(2024);
            expect(processed.allLocations.length).toBeGreaterThan(0);
            expect(processed.allLocations[0].lat).toBe(10.5);
        });
    });

});
