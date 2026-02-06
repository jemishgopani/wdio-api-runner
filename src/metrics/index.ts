/**
 * Performance Metrics Module
 *
 * Track request durations, calculate percentile statistics (p50/p95/p99),
 * and generate reports for performance analysis.
 *
 * @example Basic usage
 * ```typescript
 * import { createMetricsCollector, createMetricsInterceptors } from 'wdio-api-runner'
 *
 * // Create collector and interceptors
 * const metrics = createMetricsCollector()
 * const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)
 *
 * // Add to API client
 * api.addRequestInterceptor(requestInterceptor)
 * api.addResponseInterceptor(responseInterceptor)
 *
 * // Make requests...
 *
 * // Get report
 * const report = metrics.getReport()
 * console.log(`P95: ${report.overall.p95}ms`)
 * ```
 *
 * @example With threshold checking
 * ```typescript
 * import { checkThresholds } from 'wdio-api-runner'
 *
 * const result = checkThresholds(report, {
 *     p95: 500,     // p95 must be under 500ms
 *     p99: 1000,    // p99 must be under 1000ms
 *     errorRate: 1  // Error rate must be under 1%
 * })
 *
 * if (!result.passed) {
 *     console.error('Thresholds exceeded:', result.failures)
 * }
 * ```
 */

// Core collector
export { createMetricsCollector } from './MetricsCollector.js'

// Interceptors
export { createMetricsInterceptors, createMetricEntry } from './MetricsInterceptors.js'

// Calculator functions
export {
    calculatePercentile,
    calculateStats,
    calculateStatsFromEntries,
    groupByEndpoint,
    groupByMethod,
    calculateEndpointMetrics,
    calculateMethodStats,
    getSlowestRequests,
    getFailedRequests,
} from './MetricsCalculator.js'

// Reporter utilities
export {
    formatConsoleReport,
    formatSummaryLine,
    exportMetricsJson,
    createReportSummary,
    checkThresholds,
} from './MetricsReporter.js'

// Constants
export {
    DEFAULT_PERCENTILES,
    DEFAULT_SLOW_THRESHOLD,
    DEFAULT_MAX_ENTRIES,
    DEFAULT_METRICS_CONFIG,
    EMPTY_PERCENTILE_STATS,
} from './constants.js'

// Types
export type {
    MetricEntry,
    PercentileStats,
    EndpointMetrics,
    MetricsReport,
    MetricsConfig,
    MetricsCollector,
    MetricsContext,
    MetricsInterceptors,
} from './types.js'
