/**
 * GraphQL Client - Core client factory for making GraphQL requests
 *
 * Follows the same factory pattern as createApiClient for consistency.
 */

import logger from '@wdio/logger'

import type {
    GraphQLClient,
    GraphQLClientConfig,
    GraphQLOperation,
    GraphQLVariables,
    GraphQLResponse,
    GraphQLRequestOptions,
    GraphQLResponseData,
} from './types.js'
import type { RequestInterceptor, ResponseInterceptor } from '../shared/types.js'
import type { LoggingConfig } from '../logging/types.js'

import { HarLogger } from '../logging/HarLogger.js'
import { createLoggingInterceptors } from '../logging/LoggingInterceptors.js'
import { createSubscriptionManager } from './subscriptions/SubscriptionManager.js'
import { GraphQLNetworkError } from './errors.js'
import {
    DEFAULT_GRAPHQL_TIMEOUT,
    DEFAULT_GRAPHQL_HEADERS,
    DEFAULT_RETRIES,
    DEFAULT_RETRY_DELAY,
    MAX_BODY_LOG_LENGTH,
} from './constants.js'
import {
    normalizeOperation,
    truncateForLog,
    formatVariablesForLog,
    sleep,
    buildRequestBody,
    isRetryableStatus,
} from './utils.js'

const log = logger('wdio-api-runner:graphql')

/**
 * Creates a GraphQL client for making GraphQL requests in tests.
 * Provides a simple interface for query, mutation, and subscription operations.
 *
 * @example Basic usage
 * ```typescript
 * const graphql = createGraphQLClient({
 *     endpoint: 'https://api.example.com/graphql'
 * })
 *
 * const response = await graphql.query(`
 *     query GetUser($id: ID!) {
 *         user(id: $id) { id name email }
 *     }
 * `, { id: '123' })
 *
 * if (response.isSuccess) {
 *     console.log(response.data.data.user)
 * }
 * ```
 *
 * @example With authentication
 * ```typescript
 * import { bearerAuth } from 'wdio-api-runner'
 *
 * const auth = bearerAuth({ token: 'my-token' })
 * graphql.addRequestInterceptor(auth.interceptor)
 * ```
 */
export function createGraphQLClient(config: GraphQLClientConfig): GraphQLClient {
    let endpoint = config.endpoint
    let defaultHeaders: Record<string, string> = {
        ...DEFAULT_GRAPHQL_HEADERS,
        ...config.headers,
    }
    const defaultTimeout = config.timeout ?? DEFAULT_GRAPHQL_TIMEOUT
    const defaultRetries = config.retries ?? DEFAULT_RETRIES
    const defaultRetryDelay = config.retryDelay ?? DEFAULT_RETRY_DELAY
    const verbose = config.verbose ?? false
    const customFetch = config.type !== 'graphql-request' ? config.fetch : undefined

    const requestInterceptors: RequestInterceptor[] = []
    const responseInterceptors: ResponseInterceptor[] = []

    // Initialize HAR logging (reuse from logging module)
    const loggingConfig: LoggingConfig = {}
    const harLogger = new HarLogger(loggingConfig)
    const { requestInterceptor: logReqInterceptor, responseInterceptor: logResInterceptor } =
        createLoggingInterceptors(harLogger)

    // Add logging interceptors (they only record when logger.isRecording() is true)
    requestInterceptors.push(logReqInterceptor)
    responseInterceptors.push(logResInterceptor)

    // Initialize subscription manager
    const subscriptionManager = createSubscriptionManager()

    log.debug(`GraphQL Client initialized with endpoint: ${endpoint}`)

    /**
     * Execute a GraphQL operation with retry support
     */
    async function executeOperation<TData, TVariables extends GraphQLVariables>(
        operation: GraphQLOperation<TVariables>,
        options: GraphQLRequestOptions = {}
    ): Promise<GraphQLResponse<TData>> {
        const timeout = options.timeout ?? defaultTimeout
        const retries = options.retries ?? defaultRetries
        const retryDelay = options.retryDelay ?? defaultRetryDelay
        const fetchFn = options.fetch ?? customFetch ?? fetch

        let lastError: Error | null = null

        // Log the operation
        const opName = operation.operationName || 'anonymous'
        log.info(`GraphQL ${opName} -> ${endpoint}`)

        if (verbose && operation.variables) {
            log.debug(`Variables: ${formatVariablesForLog(operation.variables)}`)
        }

        for (let attempt = 0; attempt <= retries; attempt++) {
            if (attempt > 0) {
                log.info(`Retrying GraphQL operation (attempt ${attempt + 1}/${retries + 1}): ${opName}`)
                await sleep(retryDelay)
            }

            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), timeout)
            const startTime = Date.now()

            try {
                // Prepare request
                const body = buildRequestBody(operation)

                let requestInit: RequestInit = {
                    method: 'POST',
                    headers: {
                        ...defaultHeaders,
                        ...options.headers,
                    },
                    body,
                    signal: options.signal ?? controller.signal,
                }

                // Apply request interceptors
                for (const interceptor of requestInterceptors) {
                    requestInit = await interceptor(endpoint, requestInit)
                }

                // Log request body in verbose mode
                if (verbose) {
                    log.debug(`Request body: ${truncateForLog(body, MAX_BODY_LOG_LENGTH)}`)
                }

                const response = await fetchFn(endpoint, requestInit)
                clearTimeout(timeoutId)

                const duration = Date.now() - startTime

                // Parse response
                const contentType = response.headers.get('content-type')
                let responseData: GraphQLResponseData<TData>
                let rawBody = ''

                if (contentType?.includes('application/json')) {
                    rawBody = await response.text()
                    responseData = rawBody ? JSON.parse(rawBody) : { data: null }
                } else {
                    rawBody = await response.text()
                    throw new GraphQLNetworkError(
                        `Unexpected content-type: ${contentType}. Body: ${truncateForLog(rawBody, 200)}`
                    )
                }

                // Build GraphQL response with convenience properties
                let result: GraphQLResponse<TData> = {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    data: responseData,
                    ok: response.ok,
                    duration,
                    hasErrors: !!(responseData.errors && responseData.errors.length > 0),
                    hasData: responseData.data !== null && responseData.data !== undefined,
                    isSuccess:
                        response.ok &&
                        !responseData.errors?.length &&
                        responseData.data !== null &&
                        responseData.data !== undefined,
                }

                // Apply response interceptors
                for (const interceptor of responseInterceptors) {
                    result = (await interceptor(result)) as GraphQLResponse<TData>
                }

                // Log result
                const statusIcon = result.isSuccess ? '✓' : result.hasErrors ? '⚠' : '✗'
                log.info(`${statusIcon} GraphQL ${opName} - ${response.status} (${duration}ms)`)

                // Log response body in verbose mode
                if (verbose && rawBody) {
                    log.debug(`Response body: ${truncateForLog(rawBody, MAX_BODY_LOG_LENGTH)}`)
                }

                // Log GraphQL errors if present
                if (result.hasErrors) {
                    const errorMessages = result.data.errors?.map((e) => e.message).join(', ')
                    log.warn(`GraphQL errors: ${errorMessages}`)
                }

                // Don't retry on successful responses or client errors (4xx)
                if (response.ok || (response.status >= 400 && response.status < 500)) {
                    return result
                }

                // Server error - retry if attempts remaining
                if (isRetryableStatus(response.status) && attempt < retries) {
                    log.warn(`Server error ${response.status}, will retry...`)
                    lastError = new GraphQLNetworkError(`HTTP ${response.status}: ${response.statusText}`)
                    continue
                }

                return result
            } catch (error: unknown) {
                clearTimeout(timeoutId)
                const duration = Date.now() - startTime

                if (error instanceof Error && error.name === 'AbortError') {
                    lastError = new GraphQLNetworkError(`Request timeout after ${timeout}ms: ${endpoint}`)
                    log.error(`Request timeout after ${timeout}ms (${duration}ms elapsed)`)
                } else {
                    lastError =
                        error instanceof GraphQLNetworkError
                            ? error
                            : new GraphQLNetworkError(
                                  error instanceof Error ? error.message : String(error),
                                  error instanceof Error ? error : undefined
                              )
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
        throw lastError ?? new GraphQLNetworkError('Request failed')
    }

    // Return the GraphQL client interface
    return {
        query: <TData, TVariables extends GraphQLVariables>(
            operation: string | GraphQLOperation<TVariables>,
            variables?: TVariables,
            options?: GraphQLRequestOptions
        ) => executeOperation<TData, TVariables>(normalizeOperation(operation, variables), options),

        mutate: <TData, TVariables extends GraphQLVariables>(
            operation: string | GraphQLOperation<TVariables>,
            variables?: TVariables,
            options?: GraphQLRequestOptions
        ) => executeOperation<TData, TVariables>(normalizeOperation(operation, variables), options),

        request: <TData, TVariables extends GraphQLVariables>(
            operation: GraphQLOperation<TVariables>,
            options?: GraphQLRequestOptions
        ) => executeOperation<TData, TVariables>(operation, options),

        setEndpoint: (url: string) => {
            endpoint = url
            log.info(`GraphQL endpoint set to: ${url}`)
        },

        getEndpoint: () => endpoint,

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

        getHeaders: () => ({ ...defaultHeaders }),

        addRequestInterceptor: (interceptor: RequestInterceptor) => {
            requestInterceptors.push(interceptor)
            log.debug('Request interceptor added')
        },

        addResponseInterceptor: (interceptor: ResponseInterceptor) => {
            responseInterceptors.push(interceptor)
            log.debug('Response interceptor added')
        },

        clearInterceptors: () => {
            // Keep logging interceptors (first ones)
            requestInterceptors.length = 1
            responseInterceptors.length = 1
            log.debug('Custom interceptors cleared')
        },

        startRecording: (filename?: string) => {
            harLogger.startRecording(filename)
            log.info(`HAR recording started${filename ? `: ${filename}` : ''}`)
        },

        stopRecording: async () => {
            const filePath = await harLogger.stopRecording()
            log.info(`HAR recording saved to: ${filePath}`)
            return filePath
        },

        getHar: () => harLogger.getHar(),

        isRecording: () => harLogger.isRecording(),

        subscriptions: subscriptionManager,
    }
}
