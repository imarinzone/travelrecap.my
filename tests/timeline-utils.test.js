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

        test('should parse iOS format (root array, geo:lat,lng, placeID)', () => {
            const iosData = [
                {
                    startTime: '2026-01-29T08:25:47.861+05:30',
                    endTime: '2026-01-29T09:34:01.271+05:30',
                    visit: {
                        probability: '0.936220',
                        topCandidate: {
                            placeID: 'ChIJK0XLDMkTrjsRrKyP5_f_8fo',
                            placeLocation: 'geo:12.952684,77.693002'
                        }
                    }
                },
                {
                    startTime: '2026-01-29T09:34:01.271+05:30',
                    endTime: '2026-01-29T16:13:21.751+05:30',
                    activity: {
                        distanceMeters: '8454.921875',
                        topCandidate: { type: 'in bus' }
                    }
                }
            ];
            const processed = timelineUtils.processTimelineData(iosData);
            expect(processed.allSegments.length).toBe(2);
            expect(processed.allLocations.length).toBeGreaterThan(0);
            expect(processed.allLocations[0].lat).toBeCloseTo(12.952684);
            expect(processed.allLocations[0].lng).toBeCloseTo(77.693002);
            expect(processed.allLocations[0].placeId).toBe('ChIJK0XLDMkTrjsRrKyP5_f_8fo');
            const stats = timelineUtils.calculateStats(processed.allSegments);
            expect(stats.totalVisits).toBe(1);
            expect(stats.totalDistanceMeters).toBeCloseTo(8454.921875);
            expect(stats.transport['IN_BUS']).toBeDefined();
            expect(stats.transport['IN_BUS'].distanceMeters).toBeCloseTo(8454.921875);
        });

        test('should include all visits when probabilityThreshold is 0 or omitted', () => {
            const data = {
                semanticSegments: [
                    {
                        startTime: '2023-01-01T10:00:00Z',
                        visit: {
                            probability: 0.3,
                            topCandidate: {
                                placeLocation: { latLng: '10, 20' },
                                placeId: 'low'
                            }
                        }
                    },
                    {
                        startTime: '2023-01-02T10:00:00Z',
                        visit: {
                            probability: 0.9,
                            topCandidate: {
                                placeLocation: { latLng: '30, 40' },
                                placeId: 'high'
                            }
                        }
                    }
                ]
            };
            const processed = timelineUtils.processTimelineData(data);
            expect(processed.allSegments.length).toBe(2);
            expect(processed.allLocations.length).toBe(2);
        });

        test('should exclude visits below probabilityThreshold', () => {
            const data = {
                semanticSegments: [
                    {
                        startTime: '2023-01-01T10:00:00Z',
                        visit: {
                            probability: 0.3,
                            topCandidate: {
                                placeLocation: { latLng: '10, 20' },
                                placeId: 'low'
                            }
                        }
                    },
                    {
                        startTime: '2023-01-02T10:00:00Z',
                        visit: {
                            probability: 0.9,
                            topCandidate: {
                                placeLocation: { latLng: '30, 40' },
                                placeId: 'high'
                            }
                        }
                    }
                ]
            };
            const processed = timelineUtils.processTimelineData(data, { probabilityThreshold: 0.5 });
            expect(processed.allSegments.length).toBe(1);
            expect(processed.allLocations.length).toBe(1);
            expect(processed.allLocations[0].lat).toBe(30);
            expect(processed.allLocations[0].lng).toBe(40);
            const stats = timelineUtils.calculateStats(processed.allSegments);
            expect(stats.totalVisits).toBe(1);
        });

        test('should include visits with no probability when threshold is set', () => {
            const data = {
                semanticSegments: [
                    {
                        startTime: '2023-01-01T10:00:00Z',
                        visit: {
                            topCandidate: {
                                placeLocation: { latLng: '10, 20' },
                                placeId: 'no-prob'
                            }
                        }
                    }
                ]
            };
            const processed = timelineUtils.processTimelineData(data, { probabilityThreshold: 0.5 });
            expect(processed.allSegments.length).toBe(1);
            expect(processed.allLocations.length).toBe(1);
        });

        test('visitPassesProbabilityThreshold: respects numeric and string probability', () => {
            const pass = timelineUtils.visitPassesProbabilityThreshold;
            expect(pass({ probability: 0.9 }, 0.5)).toBe(true);
            expect(pass({ probability: 0.3 }, 0.5)).toBe(false);
            expect(pass({ probability: '0.936220' }, 0.5)).toBe(true);
            expect(pass({ probability: '0.2' }, 0.5)).toBe(false);
            expect(pass({}, 0.5)).toBe(true);
            expect(pass({ probability: null }, 0.5)).toBe(true);
            expect(pass(null, 0.5)).toBe(true);
            expect(pass({ probability: 0.5 }, 0)).toBe(true);
        });
    });

});
