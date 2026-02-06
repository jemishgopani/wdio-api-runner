import { describe, it, expect } from 'vitest'
import {
    calculatePercentile,
    calculateStats,
    calculateStatsFromEntries,
    groupByEndpoint,
    groupByMethod,
    calculateEndpointMetrics,
    calculateMethodStats,
    getSlowestRequests,
    getFailedRequests,
} from '../../src/metrics/index.js'
import type { MetricEntry } from '../../src/metrics/index.js'

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

describe('Metrics Calculator', () => {
    describe('calculatePercentile', () => {
        it('should return 0 for empty array', () => {
            expect(calculatePercentile([], 50)).toBe(0)
        })

        it('should return the value for single-element array', () => {
            expect(calculatePercentile([100], 50)).toBe(100)
            expect(calculatePercentile([100], 95)).toBe(100)
            expect(calculatePercentile([100], 99)).toBe(100)
        })

        it('should calculate p50 (median) correctly', () => {
            // Odd number of elements
            expect(calculatePercentile([1, 2, 3, 4, 5], 50)).toBe(3)

            // Even number of elements - interpolates
            const result = calculatePercentile([1, 2, 3, 4], 50)
            expect(result).toBeCloseTo(2.5, 1)
        })

        it('should calculate p95 correctly', () => {
            const values = Array.from({ length: 100 }, (_, i) => i + 1)
            const p95 = calculatePercentile(values, 95)
            expect(p95).toBeCloseTo(95.05, 1)
        })

        it('should calculate p99 correctly', () => {
            const values = Array.from({ length: 100 }, (_, i) => i + 1)
            const p99 = calculatePercentile(values, 99)
            expect(p99).toBeCloseTo(99.01, 1)
        })

        it('should handle unsorted values (expects sorted input)', () => {
            // Note: function expects sorted input
            const sorted = [10, 20, 30, 40, 50].sort((a, b) => a - b)
            expect(calculatePercentile(sorted, 50)).toBe(30)
        })

        it('should interpolate between values', () => {
            const values = [100, 200]
            // p50 should be midpoint
            expect(calculatePercentile(values, 50)).toBe(150)
        })
    })

    describe('calculateStats', () => {
        it('should return empty stats for empty array', () => {
            const stats = calculateStats([])
            expect(stats.count).toBe(0)
            expect(stats.sum).toBe(0)
            expect(stats.avg).toBe(0)
            expect(stats.min).toBe(0)
            expect(stats.max).toBe(0)
            expect(stats.p50).toBe(0)
            expect(stats.p95).toBe(0)
            expect(stats.p99).toBe(0)
        })

        it('should calculate all stats correctly', () => {
            const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
            const stats = calculateStats(durations)

            expect(stats.count).toBe(10)
            expect(stats.sum).toBe(550)
            expect(stats.avg).toBe(55)
            expect(stats.min).toBe(10)
            expect(stats.max).toBe(100)
            expect(stats.p50).toBeCloseTo(55, 0)
            expect(stats.p95).toBeGreaterThan(90)
            expect(stats.p99).toBeGreaterThan(95)
        })

        it('should handle single value', () => {
            const stats = calculateStats([42])
            expect(stats.count).toBe(1)
            expect(stats.sum).toBe(42)
            expect(stats.avg).toBe(42)
            expect(stats.min).toBe(42)
            expect(stats.max).toBe(42)
            expect(stats.p50).toBe(42)
            expect(stats.p95).toBe(42)
            expect(stats.p99).toBe(42)
        })

        it('should round values to 2 decimal places', () => {
            const stats = calculateStats([1, 2, 3])
            expect(String(stats.avg).split('.')[1]?.length || 0).toBeLessThanOrEqual(2)
        })
    })

    describe('calculateStatsFromEntries', () => {
        it('should calculate stats from metric entries', () => {
            const entries: MetricEntry[] = [
                createEntry({ duration: 100 }),
                createEntry({ duration: 200 }),
                createEntry({ duration: 300 }),
            ]

            const stats = calculateStatsFromEntries(entries)
            expect(stats.count).toBe(3)
            expect(stats.avg).toBe(200)
            expect(stats.min).toBe(100)
            expect(stats.max).toBe(300)
        })
    })

    describe('groupByEndpoint', () => {
        it('should group entries by method and endpoint', () => {
            const entries: MetricEntry[] = [
                createEntry({ method: 'GET', endpoint: '/users' }),
                createEntry({ method: 'GET', endpoint: '/users' }),
                createEntry({ method: 'POST', endpoint: '/users' }),
                createEntry({ method: 'GET', endpoint: '/posts' }),
            ]

            const groups = groupByEndpoint(entries)

            expect(groups.size).toBe(3)
            expect(groups.get('GET /users')?.length).toBe(2)
            expect(groups.get('POST /users')?.length).toBe(1)
            expect(groups.get('GET /posts')?.length).toBe(1)
        })

        it('should return empty map for empty array', () => {
            const groups = groupByEndpoint([])
            expect(groups.size).toBe(0)
        })
    })

    describe('groupByMethod', () => {
        it('should group entries by HTTP method', () => {
            const entries: MetricEntry[] = [
                createEntry({ method: 'GET' }),
                createEntry({ method: 'GET' }),
                createEntry({ method: 'POST' }),
                createEntry({ method: 'PUT' }),
            ]

            const groups = groupByMethod(entries)

            expect(groups.size).toBe(3)
            expect(groups.get('GET')?.length).toBe(2)
            expect(groups.get('POST')?.length).toBe(1)
            expect(groups.get('PUT')?.length).toBe(1)
        })
    })

    describe('calculateEndpointMetrics', () => {
        it('should calculate metrics for each endpoint', () => {
            const entries: MetricEntry[] = [
                createEntry({ method: 'GET', endpoint: '/users', duration: 100, success: true }),
                createEntry({ method: 'GET', endpoint: '/users', duration: 200, success: true }),
                createEntry({ method: 'GET', endpoint: '/users', duration: 300, success: false }),
                createEntry({ method: 'POST', endpoint: '/users', duration: 150, success: true }),
            ]

            const metrics = calculateEndpointMetrics(entries)

            expect(metrics.length).toBe(2)

            // Should be sorted by count (descending)
            const getUsersMetrics = metrics.find((m) => m.method === 'GET' && m.endpoint === '/users')
            expect(getUsersMetrics).toBeDefined()
            expect(getUsersMetrics!.stats.count).toBe(3)
            expect(getUsersMetrics!.successRate).toBeCloseTo(66.67, 1)
            expect(getUsersMetrics!.errorCount).toBe(1)
        })

        it('should sort by request count descending', () => {
            const entries: MetricEntry[] = [
                createEntry({ method: 'GET', endpoint: '/a' }),
                createEntry({ method: 'GET', endpoint: '/b' }),
                createEntry({ method: 'GET', endpoint: '/b' }),
                createEntry({ method: 'GET', endpoint: '/b' }),
            ]

            const metrics = calculateEndpointMetrics(entries)

            expect(metrics[0].endpoint).toBe('/b')
            expect(metrics[0].stats.count).toBe(3)
            expect(metrics[1].endpoint).toBe('/a')
            expect(metrics[1].stats.count).toBe(1)
        })
    })

    describe('calculateMethodStats', () => {
        it('should calculate stats for each HTTP method', () => {
            const entries: MetricEntry[] = [
                createEntry({ method: 'GET', duration: 100 }),
                createEntry({ method: 'GET', duration: 200 }),
                createEntry({ method: 'POST', duration: 300 }),
            ]

            const stats = calculateMethodStats(entries)

            expect(Object.keys(stats)).toContain('GET')
            expect(Object.keys(stats)).toContain('POST')
            expect(stats.GET.count).toBe(2)
            expect(stats.GET.avg).toBe(150)
            expect(stats.POST.count).toBe(1)
            expect(stats.POST.avg).toBe(300)
        })
    })

    describe('getSlowestRequests', () => {
        it('should return slowest requests sorted by duration', () => {
            const entries: MetricEntry[] = [
                createEntry({ duration: 100 }),
                createEntry({ duration: 500 }),
                createEntry({ duration: 200 }),
                createEntry({ duration: 1000 }),
                createEntry({ duration: 50 }),
            ]

            const slowest = getSlowestRequests(entries, 3)

            expect(slowest.length).toBe(3)
            expect(slowest[0].duration).toBe(1000)
            expect(slowest[1].duration).toBe(500)
            expect(slowest[2].duration).toBe(200)
        })

        it('should filter by threshold when provided', () => {
            const entries: MetricEntry[] = [
                createEntry({ duration: 100 }),
                createEntry({ duration: 500 }),
                createEntry({ duration: 1000 }),
                createEntry({ duration: 50 }),
            ]

            const slowest = getSlowestRequests(entries, 10, 500)

            expect(slowest.length).toBe(2)
            expect(slowest[0].duration).toBe(1000)
            expect(slowest[1].duration).toBe(500)
        })

        it('should limit results to count', () => {
            const entries: MetricEntry[] = [
                createEntry({ duration: 100 }),
                createEntry({ duration: 200 }),
                createEntry({ duration: 300 }),
            ]

            const slowest = getSlowestRequests(entries, 2)

            expect(slowest.length).toBe(2)
        })
    })

    describe('getFailedRequests', () => {
        it('should return only failed requests', () => {
            const entries: MetricEntry[] = [
                createEntry({ success: true }),
                createEntry({ success: false }),
                createEntry({ success: true }),
                createEntry({ success: false }),
            ]

            const failed = getFailedRequests(entries, 10)

            expect(failed.length).toBe(2)
            expect(failed.every((e) => !e.success)).toBe(true)
        })

        it('should sort by timestamp descending (most recent first)', () => {
            const now = Date.now()
            const entries: MetricEntry[] = [
                createEntry({ success: false, timestamp: now - 1000 }),
                createEntry({ success: false, timestamp: now }),
                createEntry({ success: false, timestamp: now - 500 }),
            ]

            const failed = getFailedRequests(entries, 10)

            expect(failed[0].timestamp).toBe(now)
            expect(failed[1].timestamp).toBe(now - 500)
            expect(failed[2].timestamp).toBe(now - 1000)
        })

        it('should limit results to count', () => {
            const entries: MetricEntry[] = Array.from({ length: 10 }, () => createEntry({ success: false }))

            const failed = getFailedRequests(entries, 5)

            expect(failed.length).toBe(5)
        })
    })
})
