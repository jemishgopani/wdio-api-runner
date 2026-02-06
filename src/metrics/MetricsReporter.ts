/**
 * Metrics Reporter
 *
 * Utilities for formatting and exporting metrics reports.
 */

import { writeFile } from 'node:fs/promises'
import type { MetricsReport } from './types.js'

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
    if (ms < 1000) {
        return `${ms}ms`
    }
    if (ms < 60000) {
        return `${(ms / 1000).toFixed(1)}s`
    }
    const minutes = Math.floor(ms / 60000)
    const seconds = ((ms % 60000) / 1000).toFixed(1)
    return `${minutes}m ${seconds}s`
}

/**
 * Format a number with thousands separators
 */
function formatNumber(n: number): string {
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/**
 * Pad a string to a specific width
 */
function pad(str: string, width: number, align: 'left' | 'right' = 'left'): string {
    const s = String(str)
    if (s.length >= width) return s
    const padding = ' '.repeat(width - s.length)
    return align === 'right' ? padding + s : s + padding
}

/**
 * Format a console report for the metrics
 *
 * @example
 * ```typescript
 * const report = metrics.getReport()
 * console.log(formatConsoleReport(report))
 * ```
 *
 * @param report - MetricsReport to format
 * @returns Formatted string for console output
 */
export function formatConsoleReport(report: MetricsReport): string {
    const lines: string[] = []
    const width = 60

    // Header
    lines.push('')
    lines.push('='.repeat(width))
    lines.push(pad('  Performance Metrics Report', width))
    lines.push('='.repeat(width))
    lines.push('')

    // Summary
    const duration = report.endTime - report.startTime
    const successCount = report.totalRequests - report.failedRequests.length
    const successRate = report.totalRequests > 0 ? ((successCount / report.totalRequests) * 100).toFixed(1) : '0.0'

    lines.push(`  Total Requests:  ${formatNumber(report.totalRequests)}`)
    lines.push(`  Test Duration:   ${formatDuration(duration)}`)
    lines.push(`  Success Rate:    ${successRate}%`)
    lines.push(`  Failed Requests: ${report.failedRequests.length}`)
    lines.push('')

    // Response Times
    if (report.totalRequests > 0) {
        lines.push('-'.repeat(width))
        lines.push('  Response Times (ms)')
        lines.push('-'.repeat(width))
        lines.push('')
        lines.push(`  Min:  ${formatNumber(report.overall.min)}`)
        lines.push(`  Max:  ${formatNumber(report.overall.max)}`)
        lines.push(`  Avg:  ${formatNumber(report.overall.avg)}`)
        lines.push(`  P50:  ${formatNumber(report.overall.p50)}`)
        lines.push(`  P95:  ${formatNumber(report.overall.p95)}`)
        lines.push(`  P99:  ${formatNumber(report.overall.p99)}`)
        lines.push('')
    }

    // By Endpoint (top 10)
    if (report.byEndpoint.length > 0) {
        lines.push('-'.repeat(width))
        lines.push('  By Endpoint (Top 10)')
        lines.push('-'.repeat(width))
        lines.push('')

        const topEndpoints = report.byEndpoint.slice(0, 10)
        for (const ep of topEndpoints) {
            const method = pad(ep.method, 6)
            const endpoint = pad(truncateEndpoint(ep.endpoint, 25), 25)
            const count = pad(String(ep.stats.count), 5, 'right')
            const p95 = pad(`p95:${formatNumber(ep.stats.p95)}ms`, 14, 'right')
            const rate = pad(`${ep.successRate.toFixed(0)}%`, 5, 'right')
            lines.push(`  ${method} ${endpoint} ${count}req ${p95} ${rate}`)
        }

        if (report.byEndpoint.length > 10) {
            lines.push(`  ... and ${report.byEndpoint.length - 10} more endpoints`)
        }
        lines.push('')
    }

    // By Method
    const methods = Object.keys(report.byMethod)
    if (methods.length > 0) {
        lines.push('-'.repeat(width))
        lines.push('  By HTTP Method')
        lines.push('-'.repeat(width))
        lines.push('')

        for (const method of methods) {
            const stats = report.byMethod[method]
            const m = pad(method, 8)
            const count = pad(String(stats.count), 5, 'right')
            const p95 = pad(`p95:${formatNumber(stats.p95)}ms`, 14, 'right')
            const avg = pad(`avg:${formatNumber(stats.avg)}ms`, 14, 'right')
            lines.push(`  ${m} ${count}req ${p95} ${avg}`)
        }
        lines.push('')
    }

    // Slowest Requests
    if (report.slowestRequests.length > 0) {
        lines.push('-'.repeat(width))
        lines.push('  Slowest Requests')
        lines.push('-'.repeat(width))
        lines.push('')

        for (const req of report.slowestRequests.slice(0, 5)) {
            const method = pad(req.method, 6)
            const endpoint = pad(truncateEndpoint(req.endpoint, 30), 30)
            const duration = pad(`${formatNumber(req.duration)}ms`, 10, 'right')
            lines.push(`  ${method} ${endpoint} ${duration}`)
        }
        lines.push('')
    }

    // Failed Requests
    if (report.failedRequests.length > 0) {
        lines.push('-'.repeat(width))
        lines.push('  Failed Requests')
        lines.push('-'.repeat(width))
        lines.push('')

        for (const req of report.failedRequests.slice(0, 5)) {
            const method = pad(req.method, 6)
            const endpoint = pad(truncateEndpoint(req.endpoint, 30), 30)
            const status = pad(String(req.status), 5, 'right')
            lines.push(`  ${method} ${endpoint} ${status}`)
        }

        if (report.failedRequests.length > 5) {
            lines.push(`  ... and ${report.failedRequests.length - 5} more failures`)
        }
        lines.push('')
    }

    lines.push('='.repeat(width))
    lines.push('')

    return lines.join('\n')
}

/**
 * Truncate endpoint path for display
 */
function truncateEndpoint(endpoint: string, maxLength: number): string {
    if (endpoint.length <= maxLength) {
        return endpoint
    }
    return '...' + endpoint.slice(-(maxLength - 3))
}

/**
 * Format metrics report as a compact summary line
 *
 * @example
 * ```typescript
 * const report = metrics.getReport()
 * console.log(formatSummaryLine(report))
 * // Output: "150 requests | p95: 456ms | p99: 892ms | 98.7% success"
 * ```
 */
export function formatSummaryLine(report: MetricsReport): string {
    const successCount = report.totalRequests - report.failedRequests.length
    const successRate = report.totalRequests > 0 ? ((successCount / report.totalRequests) * 100).toFixed(1) : '0.0'

    return [
        `${report.totalRequests} requests`,
        `p95: ${formatNumber(report.overall.p95)}ms`,
        `p99: ${formatNumber(report.overall.p99)}ms`,
        `${successRate}% success`,
    ].join(' | ')
}

/**
 * Export metrics report as JSON
 *
 * @example
 * ```typescript
 * const report = metrics.getReport()
 * await exportMetricsJson(report, './metrics-report.json')
 * ```
 *
 * @param report - MetricsReport to export
 * @param filePath - Path to write the JSON file
 */
export async function exportMetricsJson(report: MetricsReport, filePath: string): Promise<void> {
    const json = JSON.stringify(report, null, 2)
    await writeFile(filePath, json, 'utf-8')
}

/**
 * Create a JSON-serializable summary of the report
 *
 * Useful for CI integration and programmatic access.
 *
 * @example
 * ```typescript
 * const summary = createReportSummary(report)
 * console.log(JSON.stringify(summary))
 * ```
 */
export function createReportSummary(report: MetricsReport): {
    totalRequests: number
    successRate: number
    errorCount: number
    duration: number
    p50: number
    p95: number
    p99: number
    min: number
    max: number
    avg: number
} {
    const successCount = report.totalRequests - report.failedRequests.length
    const successRate = report.totalRequests > 0 ? Math.round((successCount / report.totalRequests) * 10000) / 100 : 0

    return {
        totalRequests: report.totalRequests,
        successRate,
        errorCount: report.failedRequests.length,
        duration: report.endTime - report.startTime,
        p50: report.overall.p50,
        p95: report.overall.p95,
        p99: report.overall.p99,
        min: report.overall.min,
        max: report.overall.max,
        avg: report.overall.avg,
    }
}

/**
 * Check if metrics meet performance thresholds
 *
 * @example
 * ```typescript
 * const result = checkThresholds(report, {
 *     p95: 500,    // p95 must be under 500ms
 *     p99: 1000,   // p99 must be under 1000ms
 *     errorRate: 1 // Error rate must be under 1%
 * })
 *
 * if (!result.passed) {
 *     console.error('Performance thresholds exceeded:', result.failures)
 *     process.exit(1)
 * }
 * ```
 */
export function checkThresholds(
    report: MetricsReport,
    thresholds: {
        p50?: number
        p95?: number
        p99?: number
        max?: number
        avg?: number
        errorRate?: number
    }
): { passed: boolean; failures: string[] } {
    const failures: string[] = []

    if (thresholds.p50 !== undefined && report.overall.p50 > thresholds.p50) {
        failures.push(`P50 (${report.overall.p50}ms) exceeds threshold (${thresholds.p50}ms)`)
    }

    if (thresholds.p95 !== undefined && report.overall.p95 > thresholds.p95) {
        failures.push(`P95 (${report.overall.p95}ms) exceeds threshold (${thresholds.p95}ms)`)
    }

    if (thresholds.p99 !== undefined && report.overall.p99 > thresholds.p99) {
        failures.push(`P99 (${report.overall.p99}ms) exceeds threshold (${thresholds.p99}ms)`)
    }

    if (thresholds.max !== undefined && report.overall.max > thresholds.max) {
        failures.push(`Max (${report.overall.max}ms) exceeds threshold (${thresholds.max}ms)`)
    }

    if (thresholds.avg !== undefined && report.overall.avg > thresholds.avg) {
        failures.push(`Avg (${report.overall.avg}ms) exceeds threshold (${thresholds.avg}ms)`)
    }

    if (thresholds.errorRate !== undefined && report.totalRequests > 0) {
        const errorRate = (report.failedRequests.length / report.totalRequests) * 100
        if (errorRate > thresholds.errorRate) {
            failures.push(`Error rate (${errorRate.toFixed(2)}%) exceeds threshold (${thresholds.errorRate}%)`)
        }
    }

    return {
        passed: failures.length === 0,
        failures,
    }
}
