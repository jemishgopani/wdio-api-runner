/**
 * GraphQL Client Utility Functions
 */

import type { GraphQLOperation, GraphQLVariables, GraphQLOperationType } from './types.js'

/**
 * Normalize operation input (string or object) to GraphQLOperation
 * Handles various input formats including:
 * - Plain query string
 * - GraphQLOperation object
 * - GraphQLTagResult (from gql``)
 * - Nested { query: GraphQLTagResult } (common mistake)
 */
export function normalizeOperation<TVariables extends GraphQLVariables>(
    operation: string | GraphQLOperation<TVariables>,
    variables?: TVariables
): GraphQLOperation<TVariables> {
    if (typeof operation === 'string') {
        return {
            query: operation,
            operationName: extractOperationName(operation),
            variables,
        }
    }

    // Handle nested case: { query: GraphQLTagResult } where query is an object with .query property
    // This happens when users do: client.query({ query: gql`...` }) instead of client.query(gql`...`)
    if (typeof operation.query === 'object' && operation.query !== null && 'query' in operation.query) {
        const nested = operation.query as GraphQLOperation<TVariables>
        return {
            query: nested.query,
            operationName: nested.operationName ?? operation.operationName,
            variables: variables ?? nested.variables ?? operation.variables,
            extensions: nested.extensions ?? operation.extensions,
        }
    }

    return {
        ...operation,
        variables: variables ?? operation.variables,
    }
}

/**
 * Extract operation name from a GraphQL query string
 */
export function extractOperationName(query: string): string | undefined {
    // Match: query/mutation/subscription OperationName
    const match = query.match(/(?:query|mutation|subscription)\s+(\w+)/)
    return match ? match[1] : undefined
}

/**
 * Detect operation type from a GraphQL query string
 */
export function parseOperationType(query: string): GraphQLOperationType {
    const trimmed = query.trim()

    // Check for explicit operation type
    if (trimmed.startsWith('mutation')) {
        return 'mutation'
    }
    if (trimmed.startsWith('subscription')) {
        return 'subscription'
    }
    if (trimmed.startsWith('query')) {
        return 'query'
    }

    // Shorthand query (no operation keyword, just selection set)
    // e.g., { user { name } }
    if (trimmed.startsWith('{')) {
        return 'query'
    }

    // Default to query
    return 'query'
}

/**
 * Check if a query is a subscription
 */
export function isSubscription(query: string): boolean {
    return parseOperationType(query) === 'subscription'
}

/**
 * Truncate a string for logging purposes
 */
export function truncateForLog(str: string, maxLength: number = 500): string {
    if (str.length <= maxLength) {
        return str
    }
    return `${str.substring(0, maxLength)}... [truncated, ${str.length} total chars]`
}

/**
 * Format GraphQL variables for logging (mask sensitive values)
 */
export function formatVariablesForLog(
    variables: GraphQLVariables | undefined,
    sensitiveKeys: string[] = ['password', 'token', 'secret', 'apiKey', 'authorization']
): string {
    if (!variables || Object.keys(variables).length === 0) {
        return '{}'
    }

    const masked: Record<string, unknown> = {}
    const lowerSensitiveKeys = sensitiveKeys.map((k) => k.toLowerCase())

    for (const [key, value] of Object.entries(variables)) {
        if (lowerSensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
            masked[key] = '***'
        } else if (typeof value === 'string' && value.length > 100) {
            masked[key] = value.substring(0, 100) + '...'
        } else {
            masked[key] = value
        }
    }

    return JSON.stringify(masked)
}

/**
 * Sleep utility for retry delays
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Generate a unique ID for subscriptions/requests
 */
export function generateId(prefix: string = 'gql'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Merge headers objects, handling different input types
 */
export function mergeHeaders(
    existing: HeadersInit | undefined,
    newHeaders: Record<string, string>
): Record<string, string> {
    const result: Record<string, string> = { ...newHeaders }

    if (!existing) {
        return result
    }

    if (existing instanceof Headers) {
        existing.forEach((value, key) => {
            if (
                !(key.toLowerCase() in Object.fromEntries(Object.entries(result).map(([k, v]) => [k.toLowerCase(), v])))
            ) {
                result[key] = value
            }
        })
    } else if (Array.isArray(existing)) {
        for (const [key, value] of existing) {
            const lowerKey = key.toLowerCase()
            const hasKey = Object.keys(result).some((k) => k.toLowerCase() === lowerKey)
            if (!hasKey) {
                result[key] = value
            }
        }
    } else {
        for (const [key, value] of Object.entries(existing)) {
            const lowerKey = key.toLowerCase()
            const hasKey = Object.keys(result).some((k) => k.toLowerCase() === lowerKey)
            if (!hasKey) {
                result[key] = value
            }
        }
    }

    return result
}

/**
 * Check if an error is retryable (network errors, 5xx status)
 */
export function isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
        // Network errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return true
        }
        // Timeout/abort errors - not retryable (already timed out)
        if (error.name === 'AbortError') {
            return false
        }
    }

    return false
}

/**
 * Check if a status code indicates a retryable error
 */
export function isRetryableStatus(status: number): boolean {
    // Retry on server errors (5xx) but not client errors (4xx)
    return status >= 500 && status < 600
}

/**
 * Build a GraphQL request body
 */
export function buildRequestBody<TVariables extends GraphQLVariables>(operation: GraphQLOperation<TVariables>): string {
    const body: Record<string, unknown> = {
        query: operation.query,
    }

    if (operation.operationName) {
        body.operationName = operation.operationName
    }

    if (operation.variables && Object.keys(operation.variables).length > 0) {
        body.variables = operation.variables
    }

    if (operation.extensions && Object.keys(operation.extensions).length > 0) {
        body.extensions = operation.extensions
    }

    return JSON.stringify(body)
}
