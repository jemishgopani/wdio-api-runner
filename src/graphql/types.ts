/**
 * GraphQL Client Type Definitions
 */

import type { RequestInterceptor, ResponseInterceptor, ApiResponse } from '../shared/types.js'
import type { Har } from '../logging/types.js'
import type { SubscriptionManager } from './subscriptions/types.js'

// ========== GraphQL Operation Types ==========

/**
 * GraphQL operation type
 */
export type GraphQLOperationType = 'query' | 'mutation' | 'subscription'

/**
 * GraphQL operation variables
 */
export type GraphQLVariables = Record<string, unknown>

/**
 * GraphQL operation definition
 */
export interface GraphQLOperation<TVariables = GraphQLVariables> {
    /** The GraphQL query/mutation/subscription string */
    query: string
    /** Optional operation name for multi-operation documents */
    operationName?: string
    /** Variables for the operation */
    variables?: TVariables
    /** Extensions (vendor-specific) */
    extensions?: Record<string, unknown>
}

/**
 * Flexible input type for GraphQL operations
 * Allows query to be a string, GraphQLOperation, or nested GraphQLTagResult
 */
export interface GraphQLOperationInput<TVariables = GraphQLVariables> {
    /** The GraphQL query - can be string or result from gql`` template */
    query: string | GraphQLOperation<TVariables>
    /** Optional operation name for multi-operation documents */
    operationName?: string
    /** Variables for the operation */
    variables?: TVariables
    /** Extensions (vendor-specific) */
    extensions?: Record<string, unknown>
}

// ========== GraphQL Response Types ==========

/**
 * Location in a GraphQL document where an error occurred
 */
export interface GraphQLErrorLocation {
    line: number
    column: number
}

/**
 * Single GraphQL error from the server
 */
export interface GraphQLError {
    /** Error message */
    message: string
    /** Locations in the query where the error occurred */
    locations?: GraphQLErrorLocation[]
    /** Path to the field that caused the error */
    path?: Array<string | number>
    /** Additional error information */
    extensions?: {
        code?: string
        [key: string]: unknown
    }
}

/**
 * GraphQL response data structure (per spec)
 */
export interface GraphQLResponseData<TData = unknown> {
    /** The data returned by the query/mutation */
    data?: TData | null
    /** Errors that occurred during execution */
    errors?: GraphQLError[]
    /** Extensions (vendor-specific) */
    extensions?: Record<string, unknown>
}

/**
 * Full GraphQL response including HTTP metadata and convenience properties
 */
export interface GraphQLResponse<TData = unknown> extends ApiResponse<GraphQLResponseData<TData>> {
    /** true if errors array is non-empty */
    hasErrors: boolean
    /** true if data is present (even with errors - partial success) */
    hasData: boolean
    /** true if data is present AND no errors */
    isSuccess: boolean
}

// ========== Client Configuration ==========

/**
 * Base GraphQL client configuration
 */
export interface BaseGraphQLConfig {
    /**
     * GraphQL endpoint URL
     */
    endpoint: string

    /**
     * Default headers for requests
     */
    headers?: Record<string, string>

    /**
     * Request timeout in milliseconds
     * @default 30000
     */
    timeout?: number

    /**
     * Number of retries for failed requests
     * @default 0
     */
    retries?: number

    /**
     * Delay between retries in milliseconds
     * @default 1000
     */
    retryDelay?: number

    /**
     * Enable verbose logging
     * @default false
     */
    verbose?: boolean
}

/**
 * Lightweight fetch-based client configuration
 */
export interface FetchGraphQLConfig extends BaseGraphQLConfig {
    /**
     * Client implementation type
     * @default 'fetch'
     */
    type?: 'fetch'

    /**
     * Custom fetch function (for testing or custom implementations)
     */
    fetch?: typeof fetch
}

/**
 * graphql-request library configuration
 */
export interface GraphQLRequestConfig extends BaseGraphQLConfig {
    /**
     * Client implementation type - requires graphql-request package
     */
    type: 'graphql-request'

    /**
     * Additional graphql-request specific options
     */
    requestOptions?: {
        /** Error policy: 'none' throws on errors, 'all' returns errors in response */
        errorPolicy?: 'none' | 'all' | 'ignore'
        /** Credentials mode */
        credentials?: RequestCredentials
    }
}

/**
 * Combined GraphQL client configuration
 */
export type GraphQLClientConfig = FetchGraphQLConfig | GraphQLRequestConfig

// ========== Request Options ==========

/**
 * Per-request options for GraphQL operations
 */
export interface GraphQLRequestOptions {
    /** Override default headers for this request */
    headers?: Record<string, string>
    /** Override timeout for this request */
    timeout?: number
    /** Override fetch function for this request */
    fetch?: typeof fetch
    /** Request signal for cancellation */
    signal?: AbortSignal
    /** Override retries for this request */
    retries?: number
    /** Override retry delay for this request */
    retryDelay?: number
}

// ========== GraphQL Client Interface ==========

/**
 * GraphQL Client interface
 */
export interface GraphQLClient {
    /**
     * Execute a GraphQL query
     */
    query<TData = unknown, TVariables extends GraphQLVariables = GraphQLVariables>(
        operation: string | GraphQLOperation<TVariables> | GraphQLOperationInput<TVariables>,
        variables?: TVariables,
        options?: GraphQLRequestOptions
    ): Promise<GraphQLResponse<TData>>

    /**
     * Execute a GraphQL mutation
     */
    mutate<TData = unknown, TVariables extends GraphQLVariables = GraphQLVariables>(
        operation: string | GraphQLOperation<TVariables> | GraphQLOperationInput<TVariables>,
        variables?: TVariables,
        options?: GraphQLRequestOptions
    ): Promise<GraphQLResponse<TData>>

    /**
     * Execute a raw GraphQL request (for operations where type is determined dynamically)
     */
    request<TData = unknown, TVariables extends GraphQLVariables = GraphQLVariables>(
        operation: GraphQLOperation<TVariables> | GraphQLOperationInput<TVariables>,
        options?: GraphQLRequestOptions
    ): Promise<GraphQLResponse<TData>>

    // Configuration methods
    /** Set the GraphQL endpoint */
    setEndpoint(endpoint: string): void
    /** Get the current GraphQL endpoint */
    getEndpoint(): string
    /** Set a single header */
    setHeader(key: string, value: string): void
    /** Set multiple headers */
    setHeaders(headers: Record<string, string>): void
    /** Remove a header */
    removeHeader(key: string): void
    /** Get all current headers */
    getHeaders(): Record<string, string>

    // Interceptors (reuse from ApiClient pattern)
    /** Add a request interceptor */
    addRequestInterceptor(interceptor: RequestInterceptor): void
    /** Add a response interceptor */
    addResponseInterceptor(interceptor: ResponseInterceptor): void
    /** Clear all custom interceptors */
    clearInterceptors(): void

    // HAR logging integration
    /** Start recording HTTP requests to HAR file */
    startRecording(filename?: string): void
    /** Stop recording and save HAR file, returns file path */
    stopRecording(): Promise<string>
    /** Get current HAR data without stopping recording */
    getHar(): Har
    /** Check if recording is currently active */
    isRecording(): boolean

    // Subscription manager
    /** Access the subscription manager for WebSocket/SSE subscriptions */
    subscriptions: SubscriptionManager
}

// ========== Query Builder Types ==========

/**
 * Variable definition for query builder
 */
export interface VariableDefinition {
    name: string
    type: string
    defaultValue?: unknown
}

/**
 * Field selection in the query builder
 */
export interface FieldSelection {
    /** Field name */
    name: string
    /** Field alias */
    alias?: string
    /** Arguments for the field */
    args?: Record<string, unknown>
    /** Nested fields */
    fields?: FieldSelection[]
    /** Directive (e.g., @include, @skip) */
    directive?: {
        name: string
        args?: Record<string, unknown>
    }
}

/**
 * Fragment definition for query builder
 */
export interface FragmentDefinition {
    name: string
    onType: string
    fields: FieldSelection[]
}

/**
 * Query builder interface for fluent query construction
 */
export interface QueryBuilder<TVariables extends GraphQLVariables = GraphQLVariables> {
    // Operation type
    /** Start building a query operation */
    query(name?: string): QueryBuilder<TVariables>
    /** Start building a mutation operation */
    mutation(name?: string): QueryBuilder<TVariables>
    /** Start building a subscription operation */
    subscription(name?: string): QueryBuilder<TVariables>

    // Variable definitions
    /** Add a variable definition */
    variable<K extends string, V>(name: K, type: string, defaultValue?: V): QueryBuilder<TVariables & Record<K, V>>

    // Field selection (chainable)
    /** Add a simple field */
    field(name: string, alias?: string): QueryBuilder<TVariables>
    /** Add a field with arguments */
    fieldWithArgs(name: string, args: Record<string, unknown>, alias?: string): QueryBuilder<TVariables>
    /** Add arguments to the current parent field (used inside selectWith callback) */
    args(args: Record<string, unknown>): QueryBuilder<TVariables>

    // Nested selection
    /** Select multiple simple fields */
    select(...fields: string[]): QueryBuilder<TVariables>
    /** Select a field with nested fields using a sub-builder */
    selectWith(field: string, subBuilder: (builder: QueryBuilder) => QueryBuilder | void): QueryBuilder<TVariables>

    // Fragments
    /** Define a fragment */
    fragment(name: string, onType: string, builder: (b: QueryBuilder) => QueryBuilder | void): QueryBuilder<TVariables>
    /** Use a named fragment spread */
    useFragment(name: string): QueryBuilder<TVariables>
    /** Add an inline fragment */
    inlineFragment(onType: string, builder: (b: QueryBuilder) => QueryBuilder | void): QueryBuilder<TVariables>

    // Directives
    /** Add @include directive to last field */
    include(condition: string): QueryBuilder<TVariables>
    /** Add @skip directive to last field */
    skip(condition: string): QueryBuilder<TVariables>

    // Build
    /** Build the GraphQL operation object */
    build(): GraphQLOperation<TVariables>
    /** Build and return the query string */
    toString(): string
}

/**
 * Tagged template literal result
 */
export interface GraphQLTagResult<
    TVariables extends GraphQLVariables = GraphQLVariables,
> extends GraphQLOperation<TVariables> {
    /** Original template source */
    source: string
}

// ========== GraphQL Runner Options ==========

/**
 * GraphQL runner configuration for wdio.conf
 */
export interface GraphQLRunnerOptions extends BaseGraphQLConfig {
    /**
     * Subscription configuration
     */
    subscriptions?: {
        /** Default protocol to use */
        defaultProtocol?: 'websocket' | 'sse'
        /** WebSocket endpoint (if different from HTTP endpoint) */
        webSocketUrl?: string
        /** SSE endpoint (if different from HTTP endpoint) */
        sseUrl?: string
    }
}
