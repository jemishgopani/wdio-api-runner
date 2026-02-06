/**
 * Performance Metrics Types
 *
 * Type definitions for request duration tracking and percentile statistics.
 */

import type { ResponseInterceptor } from '../shared/types.js'

/**
 * A single metric entry recorded for a request
 */
export interface MetricEntry {
    /** Timestamp when the request was made */
    timestamp: number
    /** The endpoint URL or path */
    endpoint: string
    /** HTTP method (GET, POST, etc.) */
    method: string
    /** Request duration in milliseconds */
    duration: number
    /** HTTP status code */
    status: number
    /** Whether the request was successful (2xx status) */
    success: boolean
    /** Response size in bytes (if available) */
    size?: number
    /** GraphQL operation name (if applicable) */
    operationName?: string
    /** Custom tags for grouping/filtering */
    tags?: Record<string, string>
}

/**
 * Statistical summary including percentiles
 */
export interface PercentileStats {
    /** 50th percentile (median) */
    p50: number
    /** 95th percentile */
    p95: number
    /** 99th percentile */
    p99: number
    /** Minimum value */
    min: number
    /** Maximum value */
    max: number
    /** Average (mean) value */
    avg: number
    /** Total count of entries */
    count: number
    /** Sum of all values */
    sum: number
}

/**
 * Metrics grouped by endpoint
 */
export interface EndpointMetrics {
    /** The endpoint URL or path */
    endpoint: string
    /** HTTP method */
    method: string
    /** Statistical summary for this endpoint */
    stats: PercentileStats
    /** Percentage of successful requests (0-100) */
    successRate: number
    /** Number of failed requests */
    errorCount: number
}

/**
 * Complete metrics report
 */
export interface MetricsReport {
    /** Start time of the metrics collection period */
    startTime: number
    /** End time of the metrics collection period */
    endTime: number
    /** Total number of requests recorded */
    totalRequests: number
    /** Total duration of all requests (sum) */
    totalDuration: number
    /** Overall statistics across all requests */
    overall: PercentileStats
    /** Statistics grouped by endpoint */
    byEndpoint: EndpointMetrics[]
    /** Statistics grouped by HTTP method */
    byMethod: Record<string, PercentileStats>
    /** Slowest requests (above threshold or top N) */
    slowestRequests: MetricEntry[]
    /** Failed requests */
    failedRequests: MetricEntry[]
}

/**
 * Configuration for the metrics collector
 */
export interface MetricsConfig {
    /** Whether metrics collection is enabled (default: true) */
    enabled?: boolean
    /** Percentiles to calculate (default: [50, 95, 99]) */
    percentiles?: number[]
    /** Track metrics by endpoint (default: true) */
    trackByEndpoint?: boolean
    /** Track metrics by HTTP method (default: true) */
    trackByMethod?: boolean
    /** Duration threshold in ms for slow request tracking (default: 1000) */
    slowThreshold?: number
    /** Maximum number of entries to store (default: 10000) */
    maxEntries?: number
    /** Number of slowest requests to include in report (default: 10) */
    slowestCount?: number
    /** Number of failed requests to include in report (default: 10) */
    failedCount?: number
}

/**
 * Metrics collector interface
 */
export interface MetricsCollector {
    /** Record a metric entry */
    record(entry: MetricEntry): void

    /** Get all recorded metrics */
    getMetrics(): MetricEntry[]

    /** Get metrics for a specific endpoint */
    getByEndpoint(endpoint: string): MetricEntry[]

    /** Get metrics for a specific HTTP method */
    getByMethod(method: string): MetricEntry[]

    /** Generate a complete metrics report */
    getReport(): MetricsReport

    /** Clear all recorded metrics */
    clear(): void

    /** Check if metrics collection is enabled */
    isEnabled(): boolean

    /** Enable metrics collection */
    enable(): void

    /** Disable metrics collection */
    disable(): void

    /** Get the current configuration */
    getConfig(): Required<MetricsConfig>
}

/**
 * Context passed through interceptors for timing
 */
export interface MetricsContext {
    /** Start time of the request */
    startTime: number
    /** The endpoint URL */
    endpoint: string
    /** HTTP method */
    method: string
    /** GraphQL operation name (if applicable) */
    operationName?: string
    /** Custom tags */
    tags?: Record<string, string>
}

/**
 * Interceptors for metrics collection
 */
export interface MetricsInterceptors {
    /** Request interceptor to start timing */
    requestInterceptor: (url: string, options: RequestInit) => RequestInit | Promise<RequestInit>
    /** Response interceptor to record metrics */
    responseInterceptor: ResponseInterceptor
}
