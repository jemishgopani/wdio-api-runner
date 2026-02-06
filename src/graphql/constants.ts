/**
 * GraphQL Client Constants
 */

/**
 * Default timeout for GraphQL requests (30 seconds)
 */
export const DEFAULT_GRAPHQL_TIMEOUT = 30000

/**
 * Default headers for GraphQL requests
 */
export const DEFAULT_GRAPHQL_HEADERS: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRIES = 0
export const DEFAULT_RETRY_DELAY = 1000

/**
 * WebSocket subscription defaults
 */
export const DEFAULT_WS_CONNECTION_TIMEOUT = 10000
export const DEFAULT_WS_KEEP_ALIVE_INTERVAL = 30000
export const DEFAULT_WS_RECONNECT_DELAY = 1000
export const DEFAULT_WS_MAX_RETRIES = 5

/**
 * SSE subscription defaults
 */
export const DEFAULT_SSE_RECONNECT_DELAY = 1000
export const DEFAULT_SSE_MAX_RETRIES = 5

/**
 * graphql-ws protocol constants
 */
export const GRAPHQL_WS_PROTOCOL = 'graphql-transport-ws'

/**
 * Maximum body log length for verbose output
 */
export const MAX_BODY_LOG_LENGTH = 500
