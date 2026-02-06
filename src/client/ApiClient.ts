import logger from '@wdio/logger'

import { DEFAULT_API_TIMEOUT, DEFAULT_HEADERS } from '../shared/constants.js'
import type {
    ApiClient,
    ApiClientOptions,
    ApiResponse,
    RequestOptions,
    RequestInterceptor,
    ResponseInterceptor,
} from '../shared/types.js'
import type { Har, LoggingConfig } from '../logging/types.js'
import { HarLogger } from '../logging/HarLogger.js'
import { createLoggingInterceptors } from '../logging/LoggingInterceptors.js'

const log = logger('wdio-api-runner:client')

// Maximum length of body to log (to avoid huge payloads in logs)
const MAX_BODY_LOG_LENGTH = 500

/**
 * Truncate a string for logging purposes
 */
function truncateForLog(str: string, maxLength: number = MAX_BODY_LOG_LENGTH): string {
    if (str.length <= maxLength) {
        return str
    }
    return `${str.substring(0, maxLength)}... [truncated, ${str.length} total chars]`
}

/**
 * Creates an API client for making HTTP requests in tests.
 * Provides a simple, chainable interface for REST API testing.
 *
 * @param config - Optional config: either WebdriverIO config (partial) or ApiClientOptions
 * @example
 * // Standalone usage
 * const api = createApiClient({ baseUrl: 'https://api.example.com', timeout: 5000 })
 *
 * // With full config (from runner)
 * const api = createApiClient(config)
 */
export function createApiClient(config: Partial<WebdriverIO.Config> | ApiClientOptions = {}): ApiClient {
    // Get API options from config or environment
    const envOptions: ApiClientOptions = process.env.WDIO_API_OPTIONS ? JSON.parse(process.env.WDIO_API_OPTIONS) : {}

    // Support both WebdriverIO.Config (with apiRunner) and direct ApiClientOptions
    const wdioConfig = config as Partial<WebdriverIO.Config>
    const directOptions = config as ApiClientOptions
    const configOptions = wdioConfig.apiRunner || {}

    // Merge options: env > apiRunner config > direct options > wdio baseUrl
    let baseUrl = envOptions.baseUrl || configOptions.baseUrl || directOptions.baseUrl || wdioConfig.baseUrl || ''
    let defaultHeaders: Record<string, string> = {
        ...DEFAULT_HEADERS,
        ...directOptions.headers,
        ...configOptions.headers,
        ...envOptions.headers,
    }
    const defaultTimeout = envOptions.timeout || configOptions.timeout || directOptions.timeout || DEFAULT_API_TIMEOUT
    const verbose = envOptions.verbose || configOptions.verbose || directOptions.verbose || false
    const defaultRetries = envOptions.retries || configOptions.retries || directOptions.retries || 0
    const defaultRetryDelay = envOptions.retryDelay || configOptions.retryDelay || directOptions.retryDelay || 1000

    const requestInterceptors: RequestInterceptor[] = []
    const responseInterceptors: ResponseInterceptor[] = []

    // Initialize HAR logging
    const loggingConfig: LoggingConfig = configOptions.logging || {}
    const harLogger = new HarLogger(loggingConfig)
    const { requestInterceptor: logReqInterceptor, responseInterceptor: logResInterceptor } =
        createLoggingInterceptors(harLogger)

    // Add logging interceptors (they only record when logger.isRecording() is true)
    requestInterceptors.push(logReqInterceptor)
    responseInterceptors.push(logResInterceptor)

    log.debug(`API Client initialized with baseUrl: ${baseUrl || '(none)'}`)

    /**
     * Determines the Content-Type and body to send
     */
    function prepareBody(body: unknown): { contentType: string | null; preparedBody: BodyInit | undefined } {
        if (body === undefined || body === null) {
            return { contentType: null, preparedBody: undefined }
        }

        // FormData - let browser set Content-Type (includes boundary)
        if (body instanceof FormData) {
            return { contentType: null, preparedBody: body }
        }

        // URLSearchParams
        if (body instanceof URLSearchParams) {
            return { contentType: 'application/x-www-form-urlencoded', preparedBody: body }
        }

        // Blob/File
        if (body instanceof Blob) {
            return { contentType: body.type || 'application/octet-stream', preparedBody: body }
        }

        // ArrayBuffer/TypedArray
        if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
            return { contentType: 'application/octet-stream', preparedBody: body as BodyInit }
        }

        // String - could be JSON or plain text
        if (typeof body === 'string') {
            try {
                JSON.parse(body)
                return { contentType: 'application/json', preparedBody: body }
            } catch {
                return { contentType: 'text/plain', preparedBody: body }
            }
        }

        // Object/Array - serialize as JSON
        return { contentType: 'application/json', preparedBody: JSON.stringify(body) }
    }

    /**
     * Sleep for retry delay
     */
    async function sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /**
     * Core request function with retry support
     */
    async function request<T>(url: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
        const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`
        const method = options.method || 'GET'
        const timeout = options.timeout || defaultTimeout
        const retries = options.retries ?? defaultRetries
        const retryDelay = options.retryDelay ?? defaultRetryDelay

        let lastError: Error | null = null

        // Log the request
        log.info(`${method} ${fullUrl}`)

        for (let attempt = 0; attempt <= retries; attempt++) {
            if (attempt > 0) {
                log.info(`Retrying request (attempt ${attempt + 1}/${retries + 1}): ${method} ${fullUrl}`)
                await sleep(retryDelay)
            }

            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), timeout)
            const startTime = Date.now()

            try {
                // Apply request interceptors
                let finalOptions: RequestInit = {
                    ...options,
                    headers: { ...defaultHeaders, ...options.headers },
                    signal: controller.signal,
                }
                let finalUrl = fullUrl

                for (const interceptor of requestInterceptors) {
                    const result = await interceptor(finalUrl, finalOptions)
                    // Extract URL if returned by interceptor
                    if (result.url) {
                        finalUrl = result.url
                    }
                    // Remove url from options to keep RequestInit clean
                    const { url: _, ...restOptions } = result
                    finalOptions = restOptions
                }

                // Log request body in verbose/debug mode
                if (verbose && finalOptions.body) {
                    const bodyStr = typeof finalOptions.body === 'string' ? finalOptions.body : '[non-string body]'
                    log.debug(`Request body: ${truncateForLog(bodyStr)}`)
                }

                const response = await fetch(finalUrl, finalOptions)
                clearTimeout(timeoutId)

                const duration = Date.now() - startTime

                // Parse response body
                let data: T
                let rawBody = ''
                const contentType = response.headers.get('content-type')

                if (contentType?.includes('application/json')) {
                    rawBody = await response.text()
                    data = rawBody ? JSON.parse(rawBody) : null
                } else if (contentType?.includes('text/')) {
                    rawBody = await response.text()
                    data = rawBody as unknown as T
                } else {
                    // For binary/other content, return as text
                    try {
                        rawBody = await response.text()
                        data = rawBody as unknown as T
                    } catch {
                        data = null as unknown as T
                    }
                }

                let result: ApiResponse<T> = {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    data,
                    ok: response.ok,
                    duration,
                }

                // Apply response interceptors
                for (const interceptor of responseInterceptors) {
                    result = await interceptor(result)
                }

                // Log response
                const statusIcon = response.ok ? '✓' : '✗'
                log.info(
                    `${statusIcon} ${method} ${fullUrl} - ${response.status} ${response.statusText} (${duration}ms)`
                )

                // Log response body in verbose/debug mode
                if (verbose && rawBody) {
                    log.debug(`Response body: ${truncateForLog(rawBody)}`)
                }

                // Warn on non-OK responses
                if (!response.ok) {
                    log.warn(`Request failed: ${response.status} ${response.statusText}`)
                }

                // Don't retry on successful responses or client errors (4xx)
                if (response.ok || (response.status >= 400 && response.status < 500)) {
                    return result
                }

                // Server error - retry if attempts remaining
                if (attempt < retries) {
                    log.warn(`Server error ${response.status}, will retry...`)
                    lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
                    continue
                }

                return result
            } catch (error: unknown) {
                clearTimeout(timeoutId)
                const duration = Date.now() - startTime

                if (error instanceof Error && error.name === 'AbortError') {
                    lastError = new Error(`Request timeout after ${timeout}ms: ${fullUrl}`)
                    log.error(`Request timeout after ${timeout}ms (${duration}ms elapsed)`)
                } else {
                    lastError = error instanceof Error ? error : new Error(String(error))
                    log.error(`Request error: ${lastError.message}`)
                }

                if (attempt < retries) {
                    log.warn(`Request failed, will retry: ${lastError.message}`)
                    continue
                }

                // No more retries - throw the error
                log.error(`Request failed after ${retries + 1} attempt(s): ${lastError.message}`)
                throw lastError
            }
        }

        // Should never reach here, but TypeScript needs this
        throw lastError || new Error('Request failed')
    }

    /**
     * Make a request with body
     */
    async function requestWithBody<T>(
        method: string,
        url: string,
        body?: unknown,
        options?: RequestOptions
    ): Promise<ApiResponse<T>> {
        const { contentType, preparedBody } = prepareBody(body)

        // Convert headers to plain object if needed
        let headers: Record<string, string> = {}
        if (options?.headers) {
            if (options.headers instanceof Headers) {
                options.headers.forEach((value, key) => {
                    headers[key] = value
                })
            } else if (Array.isArray(options.headers)) {
                for (const [key, value] of options.headers) {
                    headers[key] = value
                }
            } else {
                headers = { ...(options.headers as Record<string, string>) }
            }
        }

        if (contentType && !headers['Content-Type'] && !headers['content-type']) {
            headers['Content-Type'] = contentType
        }

        return request<T>(url, {
            ...options,
            method,
            headers,
            body: preparedBody,
        })
    }

    return {
        get: <T>(url: string, options?: RequestOptions) => request<T>(url, { ...options, method: 'GET' }),

        post: <T>(url: string, body?: unknown, options?: RequestOptions) =>
            requestWithBody<T>('POST', url, body, options),

        put: <T>(url: string, body?: unknown, options?: RequestOptions) =>
            requestWithBody<T>('PUT', url, body, options),

        patch: <T>(url: string, body?: unknown, options?: RequestOptions) =>
            requestWithBody<T>('PATCH', url, body, options),

        delete: <T>(url: string, options?: RequestOptions) => request<T>(url, { ...options, method: 'DELETE' }),

        head: <T>(url: string, options?: RequestOptions) => request<T>(url, { ...options, method: 'HEAD' }),

        options: <T>(url: string, options?: RequestOptions) => request<T>(url, { ...options, method: 'OPTIONS' }),

        request,

        setBaseUrl: (url: string) => {
            baseUrl = url
            log.info(`Base URL set to: ${url}`)
        },

        getBaseUrl: () => baseUrl,

        setHeader: (key: string, value: string) => {
            defaultHeaders[key] = value
            log.debug(`Header set: ${key}`)
        },

        setHeaders: (headers: Record<string, string>) => {
            defaultHeaders = { ...defaultHeaders, ...headers }
            log.debug(`Headers updated: ${Object.keys(headers).join(', ')}`)
        },

        removeHeader: (key: string) => {
            delete defaultHeaders[key]
            log.debug(`Header removed: ${key}`)
        },

        getHeaders: (): Record<string, string> => ({ ...defaultHeaders }),

        addRequestInterceptor: (interceptor: RequestInterceptor) => {
            requestInterceptors.push(interceptor)
            log.debug('Request interceptor added')
        },

        addResponseInterceptor: (interceptor: ResponseInterceptor) => {
            responseInterceptors.push(interceptor)
            log.debug('Response interceptor added')
        },

        clearInterceptors: () => {
            requestInterceptors.length = 0
            responseInterceptors.length = 0
            log.debug('All interceptors cleared')
        },

        // Logging methods
        startRecording: (filename?: string): void => {
            harLogger.startRecording(filename)
            log.info(`HAR recording started${filename ? `: ${filename}` : ''}`)
        },

        stopRecording: async (): Promise<string> => {
            const filePath = await harLogger.stopRecording()
            log.info(`HAR recording saved to: ${filePath}`)
            return filePath
        },

        getHar: (): Har => {
            return harLogger.getHar()
        },

        isRecording: (): boolean => {
            return harLogger.isRecording()
        },
    }
}
