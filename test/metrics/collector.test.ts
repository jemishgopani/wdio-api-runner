import { describe, it, expect, beforeEach } from 'vitest'
import { createMetricsCollector, DEFAULT_METRICS_CONFIG } from '../../src/metrics/index.js'
import type { MetricEntry, MetricsCollector } from '../../src/metrics/index.js'

// Helper to create test entries
function createEntry(overrides: Partial<MetricEntry> = {}): MetricEntry {
    return {
        timestamp: Date.now(),
        endpoint: '/api/users',
        method: 'GET',
        duration: 100,
        status: 200,
        success: true,
        ...overrides,
    }
}

describe('Metrics Collector', () => {
    let collector: MetricsCollector

    beforeEach(() => {
        collector = createMetricsCollector()
    })

    describe('createMetricsCollector', () => {
        it('should create a collector with default config', () => {
            expect(collector).toBeDefined()
            expect(collector.isEnabled()).toBe(true)

            const config = collector.getConfig()
            expect(config.enabled).toBe(DEFAULT_METRICS_CONFIG.enabled)
            expect(config.percentiles).toEqual(DEFAULT_METRICS_CONFIG.percentiles)
            expect(config.maxEntries).toBe(DEFAULT_METRICS_CONFIG.maxEntries)
        })

        it('should accept custom configuration', () => {
            const customCollector = createMetricsCollector({
                enabled: false,
                maxEntries: 100,
                slowThreshold: 500,
            })

            const config = customCollector.getConfig()
            expect(config.enabled).toBe(false)
            expect(config.maxEntries).toBe(100)
            expect(config.slowThreshold).toBe(500)
        })
    })

    describe('record', () => {
        it('should record metric entries', () => {
            const entry = createEntry()
            collector.record(entry)

            const metrics = collector.getMetrics()
            expect(metrics.length).toBe(1)
            expect(metrics[0]).toEqual(entry)
        })

        it('should not record when disabled', () => {
            collector.disable()
            collector.record(createEntry())

            expect(collector.getMetrics().length).toBe(0)
        })

        it('should enforce maxEntries limit (FIFO)', () => {
            const smallCollector = createMetricsCollector({ maxEntries: 3 })

            smallCollector.record(createEntry({ endpoint: '/1' }))
            smallCollector.record(createEntry({ endpoint: '/2' }))
            smallCollector.record(createEntry({ endpoint: '/3' }))
            smallCollector.record(createEntry({ endpoint: '/4' }))

            const metrics = smallCollector.getMetrics()
            expect(metrics.length).toBe(3)
            expect(metrics[0].endpoint).toBe('/2')
            expect(metrics[2].endpoint).toBe('/4')
        })
    })

    describe('getMetrics', () => {
        it('should return a copy of the entries', () => {
            collector.record(createEntry())

            const metrics1 = collector.getMetrics()
            const metrics2 = collector.getMetrics()

            expect(metrics1).not.toBe(metrics2)
            expect(metrics1).toEqual(metrics2)
        })
    })

    describe('getByEndpoint', () => {
        it('should filter entries by endpoint', () => {
            collector.record(createEntry({ endpoint: '/users' }))
            collector.record(createEntry({ endpoint: '/posts' }))
            collector.record(createEntry({ endpoint: '/users' }))

            const usersMetrics = collector.getByEndpoint('/users')
            expect(usersMetrics.length).toBe(2)
            expect(usersMetrics.every((m) => m.endpoint === '/users')).toBe(true)
        })

        it('should return empty array for non-existent endpoint', () => {
            collector.record(createEntry({ endpoint: '/users' }))

            const metrics = collector.getByEndpoint('/nonexistent')
            expect(metrics.length).toBe(0)
        })
    })

    describe('getByMethod', () => {
        it('should filter entries by HTTP method', () => {
            collector.record(createEntry({ method: 'GET' }))
            collector.record(createEntry({ method: 'POST' }))
            collector.record(createEntry({ method: 'GET' }))

            const getMetrics = collector.getByMethod('GET')
            expect(getMetrics.length).toBe(2)
            expect(getMetrics.every((m) => m.method === 'GET')).toBe(true)
        })
    })

    describe('getReport', () => {
        it('should generate a complete report', () => {
            const now = Date.now()
            collector.record(createEntry({ timestamp: now, duration: 100, success: true }))
            collector.record(createEntry({ timestamp: now + 100, duration: 200, success: true }))
            collector.record(createEntry({ timestamp: now + 200, duration: 300, success: false }))

            const report = collector.getReport()

            expect(report.totalRequests).toBe(3)
            expect(report.totalDuration).toBe(600)
            expect(report.startTime).toBe(now)
            expect(report.endTime).toBeGreaterThanOrEqual(now)
            expect(report.overall.count).toBe(3)
            expect(report.overall.avg).toBe(200)
            expect(report.failedRequests.length).toBe(1)
        })

        it('should include byEndpoint metrics when enabled', () => {
            collector.record(createEntry({ method: 'GET', endpoint: '/users' }))
            collector.record(createEntry({ method: 'POST', endpoint: '/users' }))

            const report = collector.getReport()

            expect(report.byEndpoint.length).toBe(2)
        })

        it('should include byMethod stats when enabled', () => {
            collector.record(createEntry({ method: 'GET' }))
            collector.record(createEntry({ method: 'POST' }))

            const report = collector.getReport()

            expect(Object.keys(report.byMethod)).toContain('GET')
            expect(Object.keys(report.byMethod)).toContain('POST')
        })

        it('should exclude byEndpoint when disabled', () => {
            const noEndpointCollector = createMetricsCollector({ trackByEndpoint: false })
            noEndpointCollector.record(createEntry())

            const report = noEndpointCollector.getReport()

            expect(report.byEndpoint.length).toBe(0)
        })

        it('should exclude byMethod when disabled', () => {
            const noMethodCollector = createMetricsCollector({ trackByMethod: false })
            noMethodCollector.record(createEntry())

            const report = noMethodCollector.getReport()

            expect(Object.keys(report.byMethod).length).toBe(0)
        })

        it('should include slowest requests', () => {
            collector.record(createEntry({ duration: 100 }))
            collector.record(createEntry({ duration: 2000 })) // Slow
            collector.record(createEntry({ duration: 500 }))

            const report = collector.getReport()

            expect(report.slowestRequests.length).toBeGreaterThan(0)
            expect(report.slowestRequests[0].duration).toBe(2000)
        })

        it('should handle empty metrics', () => {
            const report = collector.getReport()

            expect(report.totalRequests).toBe(0)
            expect(report.overall.count).toBe(0)
            expect(report.byEndpoint.length).toBe(0)
            expect(report.slowestRequests.length).toBe(0)
            expect(report.failedRequests.length).toBe(0)
        })
    })

    describe('clear', () => {
        it('should remove all recorded metrics', () => {
            collector.record(createEntry())
            collector.record(createEntry())
            expect(collector.getMetrics().length).toBe(2)

            collector.clear()

            expect(collector.getMetrics().length).toBe(0)
        })

        it('should reset start time', () => {
            const now = Date.now()
            collector.record(createEntry({ timestamp: now }))

            const reportBefore = collector.getReport()
            expect(reportBefore.startTime).toBe(now)

            collector.clear()

            // Record new entry
            const later = Date.now()
            collector.record(createEntry({ timestamp: later }))

            const reportAfter = collector.getReport()
            expect(reportAfter.startTime).toBe(later)
        })
    })

    describe('enable/disable', () => {
        it('should toggle metrics collection', () => {
            expect(collector.isEnabled()).toBe(true)

            collector.disable()
            expect(collector.isEnabled()).toBe(false)

            collector.enable()
            expect(collector.isEnabled()).toBe(true)
        })

        it('should not record when disabled', () => {
            collector.disable()
            collector.record(createEntry())
            collector.record(createEntry())

            expect(collector.getMetrics().length).toBe(0)
        })

        it('should resume recording when re-enabled', () => {
            collector.disable()
            collector.record(createEntry())

            collector.enable()
            collector.record(createEntry())

            expect(collector.getMetrics().length).toBe(1)
        })
    })

    describe('getConfig', () => {
        it('should return a copy of the configuration', () => {
            const config1 = collector.getConfig()
            const config2 = collector.getConfig()

            expect(config1).not.toBe(config2)
            expect(config1).toEqual(config2)
        })

        it('should reflect custom configuration', () => {
            const customCollector = createMetricsCollector({
                percentiles: [50, 90, 95, 99],
                slowThreshold: 2000,
                maxEntries: 5000,
            })

            const config = customCollector.getConfig()

            expect(config.percentiles).toEqual([50, 90, 95, 99])
            expect(config.slowThreshold).toBe(2000)
            expect(config.maxEntries).toBe(5000)
        })
    })
})
