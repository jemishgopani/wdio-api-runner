import type { Workers, Capabilities } from '@wdio/types'
import type { LoggingConfig, Har } from '../logging/types.js'
import type { GraphQLClient, GraphQLRunnerOptions } from '../graphql/types.js'

/**
 * Custom API client that can be provided instead of the built-in fetch client.
 * This allows integration with existing API clients like axios-based ones.
 */
export type CustomApiClient = unknown

/**
 * Factory function to create a custom API client.
 * Receives the WebdriverIO config and should return the client instance.
 */
export type ApiClientFactory = (config: WebdriverIO.Config) => CustomApiClient | Promise<CustomApiClient>

export interface ApiRunnerOptions {
    /**
     * Base URL for API requests
     */
    baseUrl?: string

    /**
     * Default timeout for API requests (ms)
     * @default 30000
     */
    timeout?: number

    /**
     * Default headers for API requests
     */
    headers?: Record<string, string>

    /**
     * Enable request/response logging
     * @default false
     */
    verbose?: boolean

    /**
     * Number of retries for failed requests
     * @default 0
     */
    retries?: number

    /**
     * Delay between retries (ms)
     * @default 1000
     */
    retryDelay?: number

    /**
     * Custom API client instance to use instead of the built-in fetch client.
     * Use this to integrate existing API clients (e.g., from wdio-openapi-service).
     *
     * @example
     * ```typescript
     * import ApiClient from './helpers/api.helper.js'
     *
     * apiRunner: {
     *     client: ApiClient
     * }
     * ```
     */
    client?: CustomApiClient

    /**
     * Factory function to create a custom API client.
     * Called with the WebdriverIO config, allowing dynamic client creation.
     *
     * @example
     * ```typescript
     * apiRunner: {
     *     clientFactory: (config) => {
     *         const client = new MyApiClient()
     *         client.setBaseUrl(config.baseUrl)
     *         return client
     *     }
     * }
     * ```
     */
    clientFactory?: ApiClientFactory

    /**
     * Global variable name for the API client.
     * @default 'api'
     *
     * @example
     * ```typescript
     * apiRunner: {
     *     globalName: 'apiClient'  // Access via `apiClient.get(...)` instead of `api.get(...)`
     * }
     * ```
     */
    globalName?: string

    /**
     * Request logging configuration for HAR file export
     *
     * @example
     * ```typescript
     * apiRunner: {
     *     logging: {
     *         enabled: true,
     *         outputPath: './har-logs'
     *     }
     * }
     * ```
     */
    logging?: LoggingConfig
}

export interface RunArgs extends Workers.WorkerRunPayload {
    command: string
    args: Workers.WorkerMessageArgs
}

export interface RunParams {
    cid: string
    args: Record<string, unknown>
    specs: string[]
    caps: Capabilities.RequestedStandaloneCapabilities
    configFile: string
    retries: number
}

export interface TestFramework {
    init: (
        cid: string,
        config: WebdriverIO.Config,
        specs: string[],
        capabilities: Capabilities.RequestedStandaloneCapabilities,
        reporter: unknown
    ) => Promise<TestFramework>
    hasTests: () => boolean
    run: () => Promise<number>
}

export interface ApiResponse<T = unknown> {
    status: number
    statusText: string
    headers: Headers
    data: T
    ok: boolean
    duration: number
}

export interface ApiClientOptions {
    baseUrl?: string
    timeout?: number
    headers?: Record<string, string>
    verbose?: boolean
    retries?: number
    retryDelay?: number
}

export interface RequestOptions extends RequestInit {
    timeout?: number
    retries?: number
    retryDelay?: number
}

/**
 * Result from a request interceptor, optionally including a modified URL
 */
export type RequestInterceptorResult = RequestInit & { url?: string }

/**
 * Request interceptor function
 * Can modify request options and optionally the URL
 */
export type RequestInterceptor = (
    url: string,
    options: RequestInit
) => RequestInterceptorResult | Promise<RequestInterceptorResult>
export type ResponseInterceptor = <T>(response: ApiResponse<T>) => ApiResponse<T> | Promise<ApiResponse<T>>

export interface ApiClient {
    get: <T = unknown>(url: string, options?: RequestOptions) => Promise<ApiResponse<T>>
    post: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) => Promise<ApiResponse<T>>
    put: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) => Promise<ApiResponse<T>>
    patch: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) => Promise<ApiResponse<T>>
    delete: <T = unknown>(url: string, options?: RequestOptions) => Promise<ApiResponse<T>>
    head: <T = unknown>(url: string, options?: RequestOptions) => Promise<ApiResponse<T>>
    options: <T = unknown>(url: string, options?: RequestOptions) => Promise<ApiResponse<T>>
    request: <T = unknown>(url: string, options?: RequestOptions) => Promise<ApiResponse<T>>
    setBaseUrl: (url: string) => void
    getBaseUrl: () => string
    setHeader: (key: string, value: string) => void
    setHeaders: (headers: Record<string, string>) => void
    removeHeader: (key: string) => void
    getHeaders: () => Record<string, string>
    addRequestInterceptor: (interceptor: RequestInterceptor) => void
    addResponseInterceptor: (interceptor: ResponseInterceptor) => void
    clearInterceptors: () => void

    // Logging methods
    /** Start recording HTTP requests to HAR file */
    startRecording: (filename?: string) => void
    /** Stop recording and save HAR file, returns file path */
    stopRecording: () => Promise<string>
    /** Get current HAR data without stopping recording */
    getHar: () => Har
    /** Check if recording is currently active */
    isRecording: () => boolean
}

// Extend WebdriverIO namespace
declare global {
    namespace WebdriverIO {
        interface Config {
            /**
             * API Runner specific options
             */
            apiRunner?: ApiRunnerOptions

            /**
             * GraphQL Runner specific options
             */
            graphqlRunner?: GraphQLRunnerOptions
        }
    }

    /**
     * Global API client available in tests
     */
    var api: ApiClient

    /**
     * Global GraphQL client available in tests (when configured)
     */
    var graphql: GraphQLClient | undefined
}

export {}
