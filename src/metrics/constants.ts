/**
 * Performance Metrics Constants
 *
 * Default configuration values for metrics collection.
 */

import type { MetricsConfig } from './types.js'

/**
 * Default percentiles to calculate
 */
export const DEFAULT_PERCENTILES = [50, 95, 99] as const

/**
 * Default threshold for slow requests (ms)
 */
export const DEFAULT_SLOW_THRESHOLD = 1000

/**
 * Default maximum number of entries to store
 */
export const DEFAULT_MAX_ENTRIES = 10000

/**
 * Default number of slowest requests to include in report
 */
export const DEFAULT_SLOWEST_COUNT = 10

/**
 * Default number of failed requests to include in report
 */
export const DEFAULT_FAILED_COUNT = 10

/**
 * Default metrics configuration
 */
export const DEFAULT_METRICS_CONFIG: Required<MetricsConfig> = {
    enabled: true,
    percentiles: [...DEFAULT_PERCENTILES],
    trackByEndpoint: true,
    trackByMethod: true,
    slowThreshold: DEFAULT_SLOW_THRESHOLD,
    maxEntries: DEFAULT_MAX_ENTRIES,
    slowestCount: DEFAULT_SLOWEST_COUNT,
    failedCount: DEFAULT_FAILED_COUNT,
}

/**
 * Empty percentile stats (for when there's no data)
 */
export const EMPTY_PERCENTILE_STATS = {
    p50: 0,
    p95: 0,
    p99: 0,
    min: 0,
    max: 0,
    avg: 0,
    count: 0,
    sum: 0,
} as const
