/**
 * Metrics Collector
 *
 * Core class for collecting and storing request metrics.
 * Follows the HarLogger pattern for consistency.
 */

import type { MetricEntry, MetricsConfig, MetricsCollector, MetricsReport } from './types.js'
import { DEFAULT_METRICS_CONFIG } from './constants.js'
import {
    calculateStatsFromEntries,
    calculateEndpointMetrics,
    calculateMethodStats,
    getSlowestRequests,
    getFailedRequests,
} from './MetricsCalculator.js'

/**
 * Creates a new metrics collector instance
 *
 * @example Basic usage
 * ```typescript
 * const metrics = createMetricsCollector()
 *
 * // Record metrics manually or via interceptors
 * metrics.record({
 *     timestamp: Date.now(),
 *     endpoint: '/api/users',
 *     method: 'GET',
 *     duration: 150,
 *     status: 200,
 *     success: true
 * })
 *
 * // Get the report
 * const report = metrics.getReport()
 * console.log(`P95: ${report.overall.p95}ms`)
 * ```
 *
 * @example With configuration
 * ```typescript
 * const metrics = createMetricsCollector({
 *     slowThreshold: 500,   // Flag requests over 500ms as slow
 *     maxEntries: 5000,     // Limit memory usage
 *     percentiles: [50, 90, 95, 99]  // Calculate additional percentiles
 * })
 * ```
 *
 * @param config - Optional configuration
 * @returns MetricsCollector instance
 */
export function createMetricsCollector(config: MetricsConfig = {}): MetricsCollector {
    const resolvedConfig: Required<MetricsConfig> = {
        ...DEFAULT_METRICS_CONFIG,
        ...config,
    }

    let entries: MetricEntry[] = []
    let enabled = resolvedConfig.enabled
    let startTime: number | null = null

    /**
     * Record a metric entry
     */
    function record(entry: MetricEntry): void {
        if (!enabled) {
            return
        }

        // Set start time on first entry
        if (startTime === null) {
            startTime = entry.timestamp
        }

        // Enforce maxEntries limit (FIFO)
        if (entries.length >= resolvedConfig.maxEntries) {
            entries.shift()
        }

        entries.push(entry)
    }

    /**
     * Get all recorded metrics
     */
    function getMetrics(): MetricEntry[] {
        return [...entries]
    }

    /**
     * Get metrics for a specific endpoint
     */
    function getByEndpoint(endpoint: string): MetricEntry[] {
        return entries.filter((e) => e.endpoint === endpoint)
    }

    /**
     * Get metrics for a specific HTTP method
     */
    function getByMethod(method: string): MetricEntry[] {
        return entries.filter((e) => e.method === method)
    }

    /**
     * Generate a complete metrics report
     */
    function getReport(): MetricsReport {
        const now = Date.now()
        const { percentiles, slowThreshold, slowestCount, failedCount } = resolvedConfig

        return {
            startTime: startTime ?? now,
            endTime: now,
            totalRequests: entries.length,
            totalDuration: entries.reduce((sum, e) => sum + e.duration, 0),
            overall: calculateStatsFromEntries(entries, percentiles),
            byEndpoint: resolvedConfig.trackByEndpoint ? calculateEndpointMetrics(entries, percentiles) : [],
            byMethod: resolvedConfig.trackByMethod ? calculateMethodStats(entries, percentiles) : {},
            slowestRequests: getSlowestRequests(entries, slowestCount, slowThreshold),
            failedRequests: getFailedRequests(entries, failedCount),
        }
    }

    /**
     * Clear all recorded metrics
     */
    function clear(): void {
        entries = []
        startTime = null
    }

    /**
     * Check if metrics collection is enabled
     */
    function isEnabled(): boolean {
        return enabled
    }

    /**
     * Enable metrics collection
     */
    function enable(): void {
        enabled = true
    }

    /**
     * Disable metrics collection
     */
    function disable(): void {
        enabled = false
    }

    /**
     * Get the current configuration
     */
    function getConfig(): Required<MetricsConfig> {
        return { ...resolvedConfig }
    }

    return {
        record,
        getMetrics,
        getByEndpoint,
        getByMethod,
        getReport,
        clear,
        isEnabled,
        enable,
        disable,
        getConfig,
    }
}
