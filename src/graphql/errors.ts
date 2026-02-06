/**
 * GraphQL Client Error Classes
 */

import type { GraphQLError } from './types.js'

/**
 * Base error class for GraphQL client errors
 */
export class GraphQLClientError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'GraphQLClientError'
        // Maintains proper stack trace for where error was thrown (V8 only)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, GraphQLClientError)
        }
    }
}

/**
 * Network-level error (connection failed, timeout, invalid response, etc.)
 */
export class GraphQLNetworkError extends GraphQLClientError {
    constructor(
        message: string,
        public readonly cause?: Error
    ) {
        super(message)
        this.name = 'GraphQLNetworkError'
    }
}

/**
 * GraphQL execution errors (returned in response.errors)
 *
 * This error is thrown when the GraphQL server returns errors in the response.
 * Note: By default, the client returns errors in the response without throwing.
 * Use this class when explicitly throwing on errors is desired.
 */
export class GraphQLExecutionError extends GraphQLClientError {
    constructor(
        message: string,
        public readonly errors: GraphQLError[],
        public readonly data?: unknown
    ) {
        super(message)
        this.name = 'GraphQLExecutionError'
    }

    /**
     * Check if any error has a specific code
     */
    hasErrorCode(code: string): boolean {
        return this.errors.some((e) => e.extensions?.code === code)
    }

    /**
     * Get all error codes from the errors array
     */
    getErrorCodes(): string[] {
        return this.errors.map((e) => e.extensions?.code).filter((code): code is string => typeof code === 'string')
    }

    /**
     * Check if this was a partial success (data present with errors)
     */
    isPartialSuccess(): boolean {
        return this.data !== null && this.data !== undefined
    }

    /**
     * Get error messages as a single string
     */
    getMessages(): string {
        return this.errors.map((e) => e.message).join('; ')
    }

    /**
     * Get the first error (convenience method)
     */
    getFirstError(): GraphQLError | undefined {
        return this.errors[0]
    }

    /**
     * Check if any error is at a specific path
     */
    hasErrorAtPath(path: Array<string | number>): boolean {
        return this.errors.some((e) => {
            if (!e.path) return false
            if (e.path.length !== path.length) return false
            return e.path.every((segment, i) => segment === path[i])
        })
    }
}

/**
 * Subscription-specific error
 */
export class GraphQLSubscriptionError extends GraphQLClientError {
    constructor(
        message: string,
        public readonly subscriptionId?: string,
        public readonly code?: string
    ) {
        super(message)
        this.name = 'GraphQLSubscriptionError'
    }
}

/**
 * Query builder error (invalid query construction)
 */
export class GraphQLQueryBuilderError extends GraphQLClientError {
    constructor(message: string) {
        super(message)
        this.name = 'GraphQLQueryBuilderError'
    }
}

/**
 * Create an execution error from a response with errors
 */
export function createExecutionError(errors: GraphQLError[], data?: unknown): GraphQLExecutionError {
    const message =
        errors.length === 1
            ? errors[0].message
            : `${errors.length} GraphQL errors: ${errors.map((e) => e.message).join('; ')}`

    return new GraphQLExecutionError(message, errors, data)
}
