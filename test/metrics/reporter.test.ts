import { describe, it, expect, vi, afterEach } from 'vitest'
import { writeFile } from 'node:fs/promises'
import {
    formatConsoleReport,
    formatSummaryLine,
    exportMetricsJson,
    createReportSummary,
    checkThresholds,
} from '../../src/metrics/index.js'
import type { MetricsReport, MetricEntry, PercentileStats } from '../../src/metrics/index.js'

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
    writeFile: vi.fn().mockResolvedValue(undefined),
}))

// Helper to create test report
function createTestReport(overrides: Partial<MetricsReport> = {}): MetricsReport {
    const defaultStats: PercentileStats = {
        p50: 100,
        p95: 200,
        p99: 300,
        min: 50,
        max: 500,
        avg: 150,
        count: 100,
        sum: 15000,
    }

    const defaultEntry: MetricEntry = {
        timestamp: Date.now(),
        endpoint: '/api/users',
        method: 'GET',
        duration: 100,
        status: 200,
        success: true,
    }

    return {
        startTime: Date.now() - 60000,
        endTime: Date.now(),
        totalRequests: 100,
        totalDuration: 15000,
        overall: { ...defaultStats },
        byEndpoint: [
            {
                endpoint: '/api/users',
                method: 'GET',
                stats: { ...defaultStats, count: 50 },
                successRate: 98,
                errorCount: 1,
            },
            {
                endpoint: '/api/posts',
                method: 'GET',
                stats: { ...defaultStats, count: 30 },
                successRate: 100,
                errorCount: 0,
            },
        ],
        byMethod: {
            GET: { ...defaultStats, count: 80 },
            POST: { ...defaultStats, count: 20 },
        },
        slowestRequests: [
            { ...defaultEntry, duration: 500 },
            { ...defaultEntry, duration: 400 },
        ],
        failedRequests: [{ ...defaultEntry, success: false, status: 500 }],
        ...overrides,
    }
}

describe('Metrics Reporter', () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('formatConsoleReport', () => {
        it('should format a complete report', () => {
            const report = createTestReport()
            const output = formatConsoleReport(report)

            expect(output).toContain('Performance Metrics Report')
            expect(output).toContain('Total Requests:')
            expect(output).toContain('100')
            expect(output).toContain('Success Rate:')
            expect(output).toContain('Response Times')
            expect(output).toContain('P50:')
            expect(output).toContain('P95:')
            expect(output).toContain('P99:')
        })

        it('should include endpoint statistics', () => {
            const report = createTestReport()
            const output = formatConsoleReport(report)

            expect(output).toContain('By Endpoint')
            expect(output).toContain('/api/users')
            expect(output).toContain('/api/posts')
        })

        it('should include method statistics', () => {
            const report = createTestReport()
            const output = formatConsoleReport(report)

            expect(output).toContain('By HTTP Method')
            expect(output).toContain('GET')
            expect(output).toContain('POST')
        })

        it('should include slowest requests', () => {
            const report = createTestReport()
            const output = formatConsoleReport(report)

            expect(output).toContain('Slowest Requests')
            expect(output).toContain('500')
        })

        it('should include failed requests', () => {
            const report = createTestReport()
            const output = formatConsoleReport(report)

            expect(output).toContain('Failed Requests')
        })

        it('should handle empty report', () => {
            const emptyReport = createTestReport({
                totalRequests: 0,
                overall: {
                    p50: 0,
                    p95: 0,
                    p99: 0,
                    min: 0,
                    max: 0,
                    avg: 0,
                    count: 0,
                    sum: 0,
                },
                byEndpoint: [],
                byMethod: {},
                slowestRequests: [],
                failedRequests: [],
            })

            const output = formatConsoleReport(emptyReport)

            expect(output).toContain('Total Requests:')
            expect(output).toContain('0')
            // Should not show sections with no data
            expect(output).not.toContain('By Endpoint')
        })

        it('should truncate long endpoint names', () => {
            const report = createTestReport({
                byEndpoint: [
                    {
                        endpoint: '/api/very/long/path/that/should/be/truncated/users',
                        method: 'GET',
                        stats: createTestReport().overall,
                        successRate: 100,
                        errorCount: 0,
                    },
                ],
            })

            const output = formatConsoleReport(report)
            // Should contain truncated version with ...
            expect(output).toContain('...')
        })
    })

    describe('formatSummaryLine', () => {
        it('should format a compact summary', () => {
            const report = createTestReport()
            const summary = formatSummaryLine(report)

            expect(summary).toContain('100 requests')
            expect(summary).toContain('p95:')
            expect(summary).toContain('p99:')
            expect(summary).toContain('% success')
        })

        it('should calculate correct success rate', () => {
            const report = createTestReport({
                totalRequests: 100,
                failedRequests: Array(5).fill(createTestReport().failedRequests[0]),
            })

            const summary = formatSummaryLine(report)

            expect(summary).toContain('95')
        })

        it('should handle zero requests', () => {
            const report = createTestReport({
                totalRequests: 0,
                failedRequests: [],
            })

            const summary = formatSummaryLine(report)

            expect(summary).toContain('0 requests')
            expect(summary).toContain('0.0% success')
        })
    })

    describe('exportMetricsJson', () => {
        it('should write report as JSON to file', async () => {
            const report = createTestReport()

            await exportMetricsJson(report, '/path/to/metrics.json')

            expect(writeFile).toHaveBeenCalledWith('/path/to/metrics.json', expect.any(String), 'utf-8')

            // Verify JSON is valid
            const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string
            const parsed = JSON.parse(writtenContent)
            expect(parsed.totalRequests).toBe(100)
        })

        it('should format JSON with indentation', async () => {
            const report = createTestReport()

            await exportMetricsJson(report, '/path/to/metrics.json')

            const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string
            expect(writtenContent).toContain('\n')
            expect(writtenContent).toContain('  ')
        })
    })

    describe('createReportSummary', () => {
        it('should create a simplified summary object', () => {
            const report = createTestReport()
            const summary = createReportSummary(report)

            expect(summary.totalRequests).toBe(100)
            expect(summary.p50).toBe(100)
            expect(summary.p95).toBe(200)
            expect(summary.p99).toBe(300)
            expect(summary.min).toBe(50)
            expect(summary.max).toBe(500)
            expect(summary.avg).toBe(150)
        })

        it('should calculate correct success rate', () => {
            const report = createTestReport({
                totalRequests: 100,
                failedRequests: Array(3).fill(createTestReport().failedRequests[0]),
            })

            const summary = createReportSummary(report)

            expect(summary.successRate).toBe(97)
            expect(summary.errorCount).toBe(3)
        })

        it('should calculate duration', () => {
            const now = Date.now()
            const report = createTestReport({
                startTime: now - 5000,
                endTime: now,
            })

            const summary = createReportSummary(report)

            expect(summary.duration).toBe(5000)
        })
    })

    describe('checkThresholds', () => {
        it('should pass when all thresholds are met', () => {
            const report = createTestReport({
                overall: {
                    p50: 100,
                    p95: 200,
                    p99: 300,
                    min: 50,
                    max: 400,
                    avg: 150,
                    count: 100,
                    sum: 15000,
                },
            })

            const result = checkThresholds(report, {
                p95: 500,
                p99: 1000,
            })

            expect(result.passed).toBe(true)
            expect(result.failures).toHaveLength(0)
        })

        it('should fail when p95 threshold is exceeded', () => {
            const report = createTestReport({
                overall: {
                    p50: 100,
                    p95: 600,
                    p99: 800,
                    min: 50,
                    max: 1000,
                    avg: 300,
                    count: 100,
                    sum: 30000,
                },
            })

            const result = checkThresholds(report, {
                p95: 500,
            })

            expect(result.passed).toBe(false)
            expect(result.failures.length).toBe(1)
            expect(result.failures[0]).toContain('P95')
            expect(result.failures[0]).toContain('600')
            expect(result.failures[0]).toContain('500')
        })

        it('should fail when p99 threshold is exceeded', () => {
            const report = createTestReport({
                overall: {
                    p50: 100,
                    p95: 400,
                    p99: 1200,
                    min: 50,
                    max: 1500,
                    avg: 300,
                    count: 100,
                    sum: 30000,
                },
            })

            const result = checkThresholds(report, {
                p99: 1000,
            })

            expect(result.passed).toBe(false)
            expect(result.failures[0]).toContain('P99')
        })

        it('should fail when error rate threshold is exceeded', () => {
            const report = createTestReport({
                totalRequests: 100,
                failedRequests: Array(10).fill(createTestReport().failedRequests[0]),
            })

            const result = checkThresholds(report, {
                errorRate: 5,
            })

            expect(result.passed).toBe(false)
            expect(result.failures[0]).toContain('Error rate')
            expect(result.failures[0]).toContain('10')
        })

        it('should check multiple thresholds', () => {
            const report = createTestReport({
                totalRequests: 100,
                overall: {
                    p50: 200,
                    p95: 600,
                    p99: 1200,
                    min: 50,
                    max: 1500,
                    avg: 400,
                    count: 100,
                    sum: 40000,
                },
                failedRequests: Array(10).fill(createTestReport().failedRequests[0]),
            })

            const result = checkThresholds(report, {
                p50: 100,
                p95: 500,
                p99: 1000,
                avg: 300,
                max: 1000,
                errorRate: 5,
            })

            expect(result.passed).toBe(false)
            expect(result.failures.length).toBe(6)
        })

        it('should handle zero requests for error rate', () => {
            const report = createTestReport({
                totalRequests: 0,
                failedRequests: [],
            })

            const result = checkThresholds(report, {
                errorRate: 1,
            })

            // Should pass - no requests means no errors
            expect(result.passed).toBe(true)
        })

        it('should check max threshold', () => {
            const report = createTestReport({
                overall: {
                    p50: 100,
                    p95: 200,
                    p99: 300,
                    min: 50,
                    max: 2000,
                    avg: 150,
                    count: 100,
                    sum: 15000,
                },
            })

            const result = checkThresholds(report, {
                max: 1000,
            })

            expect(result.passed).toBe(false)
            expect(result.failures[0]).toContain('Max')
        })

        it('should check avg threshold', () => {
            const report = createTestReport({
                overall: {
                    p50: 100,
                    p95: 200,
                    p99: 300,
                    min: 50,
                    max: 500,
                    avg: 350,
                    count: 100,
                    sum: 35000,
                },
            })

            const result = checkThresholds(report, {
                avg: 300,
            })

            expect(result.passed).toBe(false)
            expect(result.failures[0]).toContain('Avg')
        })
    })
})
