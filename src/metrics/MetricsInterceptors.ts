/**
 * Metrics Interceptors
 *
 * Request/Response interceptors for automatic metrics collection.
 * Works with both ApiClient and GraphQLClient.
 *
 * **Important**: For concurrent requests, metrics are matched using a FIFO queue.
 * This means if responses arrive out of order, endpoint attribution may be imprecise.
 * However, aggregate statistics (p50, p95, p99, etc.) will remain accurate since
 * durations are taken from the response object which tracks timing precisely.
 */

import type { MetricEntry, MetricsCollector, MetricsContext, MetricsInterceptors } from './types.js'
import type { ApiResponse, RequestInterceptor, ResponseInterceptor } from '../shared/types.js'

/**
 * Maximum age for a context before it's considered stale (60 seconds)
 */
const MAX_CONTEXT_AGE_MS = 60000

/**
 * Creates metrics interceptors for collecting request performance data
 *
 * @example With ApiClient
 * ```typescript
 * const metrics = createMetricsCollector()
 * const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)
 *
 * api.addRequestInterceptor(requestInterceptor)
 * api.addResponseInterceptor(responseInterceptor)
 *
 * // After making requests
 * const report = metrics.getReport()
 * console.log(`P95 response time: ${report.overall.p95}ms`)
 * ```
 *
 * @example With GraphQL client
 * ```typescript
 * const metrics = createMetricsCollector()
 * const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)
 *
 * graphql.addRequestInterceptor(requestInterceptor)
 * graphql.addResponseInterceptor(responseInterceptor)
 * ```
 *
 * @param collector - MetricsCollector instance to record metrics to
 * @returns Object containing request and response interceptors
 */
export function createMetricsInterceptors(collector: MetricsCollector): MetricsInterceptors {
    // Use a FIFO queue for context tracking
    // Contexts are added in request order and consumed in response order
    const contextQueue: MetricsContext[] = []

    /**
     * Request interceptor - captures start time and request metadata
     */
    const requestInterceptor: RequestInterceptor = (url: string, options: RequestInit): RequestInit => {
        if (!collector.isEnabled()) {
            return options
        }

        // Parse URL for endpoint
        let endpoint: string
        try {
            const parsed = new URL(url)
            endpoint = parsed.pathname + parsed.search
        } catch {
            // If URL is relative or invalid, use as-is
            endpoint = url
        }

        // Extract method
        const method = (options.method || 'GET').toUpperCase()

        // Try to extract GraphQL operation name from body
        let operationName: string | undefined
        if (options.body && typeof options.body === 'string') {
            try {
                const parsed = JSON.parse(options.body)
                if (parsed.operationName) {
                    operationName = parsed.operationName
                }
            } catch {
                // Not JSON, ignore
            }
        }

        // Store context in queue for response interceptor
        const context: MetricsContext = {
            startTime: Date.now(),
            endpoint,
            method,
            operationName,
        }

        contextQueue.push(context)

        // Clean up stale contexts (older than MAX_CONTEXT_AGE_MS)
        // This prevents memory leaks from unmatched requests
        const now = Date.now()
        while (contextQueue.length > 0 && now - contextQueue[0].startTime > MAX_CONTEXT_AGE_MS) {
            contextQueue.shift()
        }

        // Return options unchanged - no header pollution
        return options
    }

    /**
     * Response interceptor - records metrics using FIFO context matching
     */
    const responseInterceptor: ResponseInterceptor = <T>(response: ApiResponse<T>): ApiResponse<T> => {
        if (!collector.isEnabled()) {
            return response
        }

        // Get the oldest context from the queue (FIFO)
        const context = contextQueue.shift()

        if (context) {
            // Use the response's duration (already calculated by ApiClient/GraphQLClient)
            // Fall back to calculating from context start time if not available
            const now = Date.now()
            const duration = response.duration || now - context.startTime

            // Create metric entry
            const entry: MetricEntry = {
                timestamp: context.startTime,
                endpoint: context.endpoint,
                method: context.method,
                duration,
                status: response.status,
                success: response.ok,
                operationName: context.operationName,
            }

            // Try to get response size from Content-Length header
            if (response.headers?.get) {
                const contentLength = response.headers.get('content-length')
                if (contentLength) {
                    const size = parseInt(contentLength, 10)
                    // Only set if valid number
                    if (!isNaN(size) && size >= 0) {
                        entry.size = size
                    }
                }
            }

            // Record the metric
            collector.record(entry)
        }

        return response
    }

    return {
        requestInterceptor,
        responseInterceptor,
    }
}

/**
 * Creates a simple metrics entry manually
 *
 * Use this when you need to record metrics without using interceptors.
 * This is the recommended approach for precise metrics in concurrent scenarios.
 *
 * @example
 * ```typescript
 * const entry = createMetricEntry({
 *     endpoint: '/api/users',
 *     method: 'GET',
 *     duration: 150,
 *     status: 200
 * })
 * metrics.record(entry)
 * ```
 */
export function createMetricEntry(params: {
    endpoint: string
    method: string
    duration: number
    status: number
    success?: boolean
    size?: number
    operationName?: string
    tags?: Record<string, string>
}): MetricEntry {
    return {
        timestamp: Date.now(),
        endpoint: params.endpoint,
        method: params.method,
        duration: params.duration,
        status: params.status,
        success: params.success ?? (params.status >= 200 && params.status < 300),
        size: params.size,
        operationName: params.operationName,
        tags: params.tags,
    }
}
