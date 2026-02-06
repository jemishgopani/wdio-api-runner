/**
 * Logging interceptors for capturing HTTP request/response data
 */

import type { RequestInterceptor, ResponseInterceptor, ApiResponse } from '../shared/types.js'
import type { HarLogger } from './HarLogger.js'
import type { PendingRequest } from './types.js'
import { createHarEntry, truncateBody } from './HarBuilder.js'

/**
 * Map to store pending requests for matching with responses
 * Uses a WeakMap-like approach with request tracking
 */
const pendingRequests = new Map<string, PendingRequest>()

/**
 * Generate a unique request ID based on URL and timestamp
 */
function generateRequestId(url: string): string {
    return `${url}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Header name used to track request IDs internally
 */
const REQUEST_ID_HEADER = 'x-har-request-id'

/**
 * Create logging interceptors for HAR recording
 *
 * @param logger - HarLogger instance to record entries to
 * @returns Object containing request and response interceptors
 *
 * @example
 * ```typescript
 * const logger = new HarLogger()
 * const { requestInterceptor, responseInterceptor } = createLoggingInterceptors(logger)
 *
 * api.addRequestInterceptor(requestInterceptor)
 * api.addResponseInterceptor(responseInterceptor)
 *
 * logger.startRecording('my-session')
 * await api.get('/users')
 * const filePath = await logger.stopRecording()
 * ```
 */
export function createLoggingInterceptors(logger: HarLogger): {
    requestInterceptor: RequestInterceptor
    responseInterceptor: ResponseInterceptor
} {
    /**
     * Request interceptor - captures request data before sending
     */
    const requestInterceptor: RequestInterceptor = (url: string, options: RequestInit): RequestInit => {
        // Only log if recording is active
        if (!logger.isRecording()) {
            return options
        }

        const config = logger.getConfig()

        // Generate unique request ID
        const requestId = generateRequestId(url)

        // Extract body for logging
        let body: string | undefined
        if (options.body && config.includeRequestBody) {
            if (typeof options.body === 'string') {
                body = truncateBody(options.body, config.maxBodySize)
            } else if (options.body instanceof URLSearchParams) {
                body = truncateBody(options.body.toString(), config.maxBodySize)
            } else if (options.body instanceof FormData) {
                // FormData can't be easily converted to string, note it
                body = '[FormData]'
            } else {
                body = '[Binary data]'
            }
        }

        // Convert headers to Headers object
        let headers: Headers
        if (options.headers instanceof Headers) {
            headers = new Headers(options.headers)
        } else if (Array.isArray(options.headers)) {
            headers = new Headers(options.headers)
        } else if (options.headers) {
            headers = new Headers(options.headers as Record<string, string>)
        } else {
            headers = new Headers()
        }

        // Store pending request
        pendingRequests.set(requestId, {
            url,
            method: options.method || 'GET',
            headers,
            body,
            startTime: Date.now(),
        })

        // Add request ID to headers for tracking (will be removed by response interceptor)
        headers.set(REQUEST_ID_HEADER, requestId)

        return {
            ...options,
            headers,
        }
    }

    /**
     * Response interceptor - captures response data and creates HAR entry
     */
    const responseInterceptor: ResponseInterceptor = <T>(response: ApiResponse<T>): ApiResponse<T> => {
        // Only log if recording is active
        if (!logger.isRecording()) {
            return response
        }

        const config = logger.getConfig()

        // Try to find the matching pending request
        const requestId = response.headers.get(REQUEST_ID_HEADER)

        let pendingRequest: PendingRequest | undefined

        if (requestId) {
            pendingRequest = pendingRequests.get(requestId)
            pendingRequests.delete(requestId)
        }

        // If no pending request found, create a minimal one
        if (!pendingRequest) {
            pendingRequest = {
                url: 'unknown',
                method: 'GET',
                headers: new Headers(),
                startTime: Date.now() - response.duration,
            }
        }

        // Extract response body
        let responseBody: string | undefined
        if (config.includeResponseBody && response.data !== null && response.data !== undefined) {
            if (typeof response.data === 'string') {
                responseBody = truncateBody(response.data, config.maxBodySize)
            } else {
                try {
                    const jsonStr = JSON.stringify(response.data)
                    responseBody = truncateBody(jsonStr, config.maxBodySize)
                } catch {
                    responseBody = '[Unable to serialize response]'
                }
            }
        }

        // Create and add HAR entry
        const entry = createHarEntry(
            {
                url: pendingRequest.url,
                method: pendingRequest.method,
                headers: pendingRequest.headers,
                body: pendingRequest.body,
            },
            {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                body: responseBody,
            },
            {
                start: pendingRequest.startTime,
                end: Date.now(),
            }
        )

        logger.addEntry(entry)

        return response
    }

    return {
        requestInterceptor,
        responseInterceptor,
    }
}

/**
 * Clean up any stale pending requests (older than 5 minutes)
 * Call this periodically to prevent memory leaks
 */
export function cleanupStaleRequests(): void {
    const staleThreshold = 5 * 60 * 1000 // 5 minutes
    const now = Date.now()

    for (const [id, request] of pendingRequests) {
        if (now - request.startTime > staleThreshold) {
            pendingRequests.delete(id)
        }
    }
}

/**
 * Get the number of pending requests (for debugging)
 */
export function getPendingRequestCount(): number {
    return pendingRequests.size
}
