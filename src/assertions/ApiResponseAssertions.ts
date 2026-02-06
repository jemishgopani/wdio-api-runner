import type { ApiResponse } from '../shared/types.js'
import type { ApiAssertions, JsonSchema } from './types.js'
import { AssertionError } from './types.js'
import { validateSchema, formatSchemaErrors } from './schema.js'

/**
 * Gets a nested property from an object using dot notation
 *
 * @param obj - The object to get the property from
 * @param path - Dot-notation path (e.g., 'user.address.city')
 * @returns The value at the path, or undefined if not found
 */
function getNestedProperty(obj: unknown, path: string): unknown {
    if (obj === null || obj === undefined) {
        return undefined
    }

    const parts = path.split('.')
    let current: unknown = obj

    for (const part of parts) {
        if (current === null || current === undefined) {
            return undefined
        }

        if (typeof current !== 'object') {
            return undefined
        }

        current = (current as Record<string, unknown>)[part]
    }

    return current
}

/**
 * Checks if a nested property exists in an object
 */
function hasNestedProperty(obj: unknown, path: string): boolean {
    if (obj === null || obj === undefined) {
        return false
    }

    const parts = path.split('.')
    let current: unknown = obj

    for (const part of parts) {
        if (current === null || current === undefined) {
            return false
        }

        if (typeof current !== 'object') {
            return false
        }

        if (!(part in (current as object))) {
            return false
        }

        current = (current as Record<string, unknown>)[part]
    }

    return true
}

/**
 * Fluent assertion class for API responses
 *
 * @example
 * ```typescript
 * const response = await api.get('/users/1')
 *
 * assertResponse(response)
 *   .toHaveStatus(200)
 *   .toHaveHeader('content-type', /json/)
 *   .toHaveBodyProperty('user.email')
 *   .toRespondWithin(1000)
 * ```
 */
export class ApiResponseAssertions<T = unknown> implements ApiAssertions<T> {
    constructor(
        private readonly response: ApiResponse<T>,
        private readonly negated: boolean = false
    ) {}

    /**
     * Negates the next assertion
     *
     * @example
     * ```typescript
     * assertResponse(response).not.toHaveStatus(404)
     * ```
     */
    get not(): ApiResponseAssertions<T> {
        return new ApiResponseAssertions(this.response, !this.negated)
    }

    /**
     * Chainability helper for readability
     *
     * @example
     * ```typescript
     * assertResponse(response)
     *   .toHaveStatus(200)
     *   .and.toHaveHeader('content-type')
     * ```
     */
    get and(): ApiResponseAssertions<T> {
        return this
    }

    /**
     * Returns the underlying response object
     */
    getResponse(): ApiResponse<T> {
        return this.response
    }

    /**
     * Helper to evaluate assertions with negation support
     */
    private assert(pass: boolean, message: string, negatedMessage: string, actual?: unknown, expected?: unknown): this {
        const shouldPass = this.negated ? !pass : pass

        if (!shouldPass) {
            const errorMessage = this.negated ? negatedMessage : message
            throw new AssertionError(errorMessage, actual, expected)
        }

        return this
    }

    // ========== Status Assertions ==========

    /**
     * Asserts that the response has the specified status code
     *
     * @param status - Expected HTTP status code
     */
    toHaveStatus(status: number): this {
        return this.assert(
            this.response.status === status,
            `Expected status ${status}, but received ${this.response.status}`,
            `Expected status not to be ${status}`,
            this.response.status,
            status
        )
    }

    /**
     * Asserts that the response has the specified status text
     *
     * @param text - Expected status text (e.g., 'OK', 'Not Found')
     */
    toHaveStatusText(text: string): this {
        return this.assert(
            this.response.statusText === text,
            `Expected status text "${text}", but received "${this.response.statusText}"`,
            `Expected status text not to be "${text}"`,
            this.response.statusText,
            text
        )
    }

    /**
     * Asserts that the response has status 200 (OK)
     */
    toBeOk(): this {
        return this.assert(
            this.response.status === 200,
            `Expected status 200 (OK), but received ${this.response.status}`,
            `Expected status not to be 200 (OK)`,
            this.response.status,
            200
        )
    }

    /**
     * Asserts that the response has a success status (2xx)
     */
    toBeSuccess(): this {
        const isSuccess = this.response.status >= 200 && this.response.status < 300

        return this.assert(
            isSuccess,
            `Expected success status (2xx), but received ${this.response.status}`,
            `Expected status not to be success (2xx), but received ${this.response.status}`,
            this.response.status,
            '2xx'
        )
    }

    /**
     * Asserts that the response has a redirect status (3xx)
     */
    toBeRedirect(): this {
        const isRedirect = this.response.status >= 300 && this.response.status < 400

        return this.assert(
            isRedirect,
            `Expected redirect status (3xx), but received ${this.response.status}`,
            `Expected status not to be redirect (3xx), but received ${this.response.status}`,
            this.response.status,
            '3xx'
        )
    }

    /**
     * Asserts that the response has a client error status (4xx)
     */
    toBeClientError(): this {
        const isClientError = this.response.status >= 400 && this.response.status < 500

        return this.assert(
            isClientError,
            `Expected client error status (4xx), but received ${this.response.status}`,
            `Expected status not to be client error (4xx), but received ${this.response.status}`,
            this.response.status,
            '4xx'
        )
    }

    /**
     * Asserts that the response has a server error status (5xx)
     */
    toBeServerError(): this {
        const isServerError = this.response.status >= 500 && this.response.status < 600

        return this.assert(
            isServerError,
            `Expected server error status (5xx), but received ${this.response.status}`,
            `Expected status not to be server error (5xx), but received ${this.response.status}`,
            this.response.status,
            '5xx'
        )
    }

    // ========== Header Assertions ==========

    /**
     * Asserts that the response has the specified header
     *
     * @param name - Header name (case-insensitive)
     * @param value - Optional expected value (string or RegExp)
     */
    toHaveHeader(name: string, value?: string | RegExp): this {
        const headerValue = this.response.headers.get(name)
        const hasHeader = headerValue !== null

        if (value === undefined) {
            // Just check if header exists
            return this.assert(
                hasHeader,
                `Expected header "${name}" to be present`,
                `Expected header "${name}" not to be present`,
                headerValue,
                'present'
            )
        }

        // Check header value
        let matches: boolean
        if (value instanceof RegExp) {
            matches = hasHeader && value.test(headerValue)
        } else {
            matches = headerValue === value
        }

        return this.assert(
            matches,
            `Expected header "${name}" to ${value instanceof RegExp ? 'match' : 'equal'} ${value}, but got "${headerValue}"`,
            `Expected header "${name}" not to ${value instanceof RegExp ? 'match' : 'equal'} ${value}`,
            headerValue,
            value
        )
    }

    /**
     * Asserts that the response has the specified content-type
     *
     * @param type - Expected content type (string or RegExp)
     */
    toHaveContentType(type: string | RegExp): this {
        return this.toHaveHeader('content-type', type)
    }

    // ========== Body Assertions ==========

    /**
     * Asserts that the response has a non-empty body
     */
    toHaveBody(): this {
        const hasBody = this.response.data !== null && this.response.data !== undefined && this.response.data !== ''

        return this.assert(
            hasBody,
            'Expected response to have a body',
            'Expected response not to have a body',
            this.response.data,
            'non-empty body'
        )
    }

    /**
     * Asserts that the response has an empty body
     */
    toHaveEmptyBody(): this {
        const isEmpty =
            this.response.data === null ||
            this.response.data === undefined ||
            this.response.data === '' ||
            (Array.isArray(this.response.data) && this.response.data.length === 0) ||
            (typeof this.response.data === 'object' && Object.keys(this.response.data as object).length === 0)

        return this.assert(
            isEmpty,
            'Expected response to have an empty body',
            'Expected response not to have an empty body',
            this.response.data,
            'empty body'
        )
    }

    /**
     * Asserts that the response body has the specified property
     *
     * @param path - Dot-notation path to the property (e.g., 'user.address.city')
     * @param value - Optional expected value
     */
    toHaveBodyProperty(path: string, value?: unknown): this {
        const hasProperty = hasNestedProperty(this.response.data, path)

        if (value === undefined) {
            // Just check if property exists
            return this.assert(
                hasProperty,
                `Expected body to have property "${path}"`,
                `Expected body not to have property "${path}"`,
                hasProperty,
                'property exists'
            )
        }

        // Check property value
        const actualValue = getNestedProperty(this.response.data, path)
        const matches = JSON.stringify(actualValue) === JSON.stringify(value)

        return this.assert(
            matches,
            `Expected body.${path} to equal ${JSON.stringify(value)}, but got ${JSON.stringify(actualValue)}`,
            `Expected body.${path} not to equal ${JSON.stringify(value)}`,
            actualValue,
            value
        )
    }

    /**
     * Asserts that the response body has the specified length
     * Works with arrays and strings
     *
     * @param length - Expected length
     */
    toHaveBodyLength(length: number): this {
        let actualLength: number | undefined

        if (Array.isArray(this.response.data)) {
            actualLength = this.response.data.length
        } else if (typeof this.response.data === 'string') {
            actualLength = this.response.data.length
        }

        return this.assert(
            actualLength === length,
            `Expected body length ${length}, but got ${actualLength}`,
            `Expected body length not to be ${length}`,
            actualLength,
            length
        )
    }

    /**
     * Asserts that the response body matches the specified JSON Schema
     *
     * @param schema - JSON Schema to validate against
     */
    toMatchSchema(schema: JsonSchema): this {
        const result = validateSchema(this.response.data, schema)

        return this.assert(
            result.valid,
            `Schema validation failed: ${formatSchemaErrors(result.errors)}`,
            'Expected body not to match schema, but it did',
            this.response.data,
            schema
        )
    }

    // ========== Performance Assertions ==========

    /**
     * Asserts that the response was received within the specified time
     *
     * @param ms - Maximum response time in milliseconds
     */
    toRespondWithin(ms: number): this {
        return this.assert(
            this.response.duration <= ms,
            `Expected response within ${ms}ms, but took ${this.response.duration}ms`,
            `Expected response not to be within ${ms}ms, but it was (${this.response.duration}ms)`,
            this.response.duration,
            ms
        )
    }
}

/**
 * Creates a fluent assertion wrapper for an API response
 *
 * @param response - The API response to assert on
 * @returns Fluent assertion object
 *
 * @example
 * ```typescript
 * const response = await api.get('/users/1')
 *
 * assertResponse(response)
 *   .toHaveStatus(200)
 *   .toHaveHeader('content-type', /json/)
 *   .toHaveBodyProperty('user.email')
 *   .toRespondWithin(1000)
 * ```
 */
export function assertResponse<T = unknown>(response: ApiResponse<T>): ApiResponseAssertions<T> {
    return new ApiResponseAssertions(response)
}
