import type { ApiResponse } from '../shared/types.js'
import type { JsonSchema } from './types.js'
import { validateSchema, formatSchemaErrors } from './schema.js'

/**
 * Helper to get nested property using dot notation
 */
function getNestedProperty(obj: unknown, path: string): unknown {
    if (obj === null || obj === undefined) return undefined

    const parts = path.split('.')
    let current: unknown = obj

    for (const part of parts) {
        if (current === null || current === undefined) return undefined
        if (typeof current !== 'object') return undefined
        current = (current as Record<string, unknown>)[part]
    }

    return current
}

/**
 * Helper to check if nested property exists
 */
function hasNestedProperty(obj: unknown, path: string): boolean {
    if (obj === null || obj === undefined) return false

    const parts = path.split('.')
    let current: unknown = obj

    for (const part of parts) {
        if (current === null || current === undefined) return false
        if (typeof current !== 'object') return false
        if (!(part in (current as object))) return false
        current = (current as Record<string, unknown>)[part]
    }

    return true
}

/**
 * Type guard to check if received is an ApiResponse
 */
function isApiResponse(received: unknown): received is ApiResponse {
    return (
        received !== null &&
        typeof received === 'object' &&
        'status' in received &&
        'headers' in received &&
        'data' in received
    )
}

/**
 * Custom matchers for Vitest/Jest to assert on API responses
 *
 * @example
 * ```typescript
 * import { apiMatchers } from 'wdio-api-runner'
 *
 * // In setup file or test
 * expect.extend(apiMatchers)
 *
 * // In tests
 * const response = await api.get('/users/1')
 * expect(response).toHaveStatus(200)
 * expect(response).toMatchSchema(userSchema)
 * ```
 */
export const apiMatchers = {
    /**
     * Asserts that the response has the specified status code
     */
    toHaveStatus(received: unknown, expected: number) {
        if (!isApiResponse(received)) {
            return {
                pass: false,
                message: () => 'Expected value to be an ApiResponse object',
            }
        }

        const pass = received.status === expected

        return {
            pass,
            message: () =>
                pass
                    ? `Expected response not to have status ${expected}`
                    : `Expected status ${expected}, but received ${received.status}`,
            actual: received.status,
            expected,
        }
    },

    /**
     * Asserts that the response has the specified status text
     */
    toHaveStatusText(received: unknown, expected: string) {
        if (!isApiResponse(received)) {
            return {
                pass: false,
                message: () => 'Expected value to be an ApiResponse object',
            }
        }

        const pass = received.statusText === expected

        return {
            pass,
            message: () =>
                pass
                    ? `Expected response not to have status text "${expected}"`
                    : `Expected status text "${expected}", but received "${received.statusText}"`,
            actual: received.statusText,
            expected,
        }
    },

    /**
     * Asserts that the response has a success status (2xx)
     */
    toBeSuccess(received: unknown) {
        if (!isApiResponse(received)) {
            return {
                pass: false,
                message: () => 'Expected value to be an ApiResponse object',
            }
        }

        const pass = received.status >= 200 && received.status < 300

        return {
            pass,
            message: () =>
                pass
                    ? `Expected response not to have success status (2xx), but received ${received.status}`
                    : `Expected success status (2xx), but received ${received.status}`,
            actual: received.status,
            expected: '2xx',
        }
    },

    /**
     * Asserts that the response has a client error status (4xx)
     */
    toBeClientError(received: unknown) {
        if (!isApiResponse(received)) {
            return {
                pass: false,
                message: () => 'Expected value to be an ApiResponse object',
            }
        }

        const pass = received.status >= 400 && received.status < 500

        return {
            pass,
            message: () =>
                pass
                    ? `Expected response not to have client error status (4xx), but received ${received.status}`
                    : `Expected client error status (4xx), but received ${received.status}`,
            actual: received.status,
            expected: '4xx',
        }
    },

    /**
     * Asserts that the response has a server error status (5xx)
     */
    toBeServerError(received: unknown) {
        if (!isApiResponse(received)) {
            return {
                pass: false,
                message: () => 'Expected value to be an ApiResponse object',
            }
        }

        const pass = received.status >= 500 && received.status < 600

        return {
            pass,
            message: () =>
                pass
                    ? `Expected response not to have server error status (5xx), but received ${received.status}`
                    : `Expected server error status (5xx), but received ${received.status}`,
            actual: received.status,
            expected: '5xx',
        }
    },

    /**
     * Asserts that the response has the specified header
     */
    toHaveHeader(received: unknown, name: string, value?: string | RegExp) {
        if (!isApiResponse(received)) {
            return {
                pass: false,
                message: () => 'Expected value to be an ApiResponse object',
            }
        }

        const headerValue = received.headers.get(name)
        const hasHeader = headerValue !== null

        if (value === undefined) {
            return {
                pass: hasHeader,
                message: () =>
                    hasHeader
                        ? `Expected response not to have header "${name}"`
                        : `Expected response to have header "${name}"`,
                actual: headerValue,
                expected: 'present',
            }
        }

        let matches: boolean
        if (value instanceof RegExp) {
            matches = hasHeader && value.test(headerValue)
        } else {
            matches = headerValue === value
        }

        return {
            pass: matches,
            message: () =>
                matches
                    ? `Expected header "${name}" not to ${value instanceof RegExp ? 'match' : 'equal'} ${value}`
                    : `Expected header "${name}" to ${value instanceof RegExp ? 'match' : 'equal'} ${value}, but got "${headerValue}"`,
            actual: headerValue,
            expected: value,
        }
    },

    /**
     * Asserts that the response has a non-empty body
     */
    toHaveBody(received: unknown) {
        if (!isApiResponse(received)) {
            return {
                pass: false,
                message: () => 'Expected value to be an ApiResponse object',
            }
        }

        const hasBody = received.data !== null && received.data !== undefined && received.data !== ''

        return {
            pass: hasBody,
            message: () => (hasBody ? 'Expected response not to have a body' : 'Expected response to have a body'),
            actual: received.data,
            expected: 'non-empty body',
        }
    },

    /**
     * Asserts that the response body has the specified property
     */
    toHaveBodyProperty(received: unknown, path: string, value?: unknown) {
        if (!isApiResponse(received)) {
            return {
                pass: false,
                message: () => 'Expected value to be an ApiResponse object',
            }
        }

        const hasProperty = hasNestedProperty(received.data, path)

        if (value === undefined) {
            return {
                pass: hasProperty,
                message: () =>
                    hasProperty
                        ? `Expected body not to have property "${path}"`
                        : `Expected body to have property "${path}"`,
                actual: hasProperty,
                expected: 'property exists',
            }
        }

        const actualValue = getNestedProperty(received.data, path)
        const matches = JSON.stringify(actualValue) === JSON.stringify(value)

        return {
            pass: matches,
            message: () =>
                matches
                    ? `Expected body.${path} not to equal ${JSON.stringify(value)}`
                    : `Expected body.${path} to equal ${JSON.stringify(value)}, but got ${JSON.stringify(actualValue)}`,
            actual: actualValue,
            expected: value,
        }
    },

    /**
     * Asserts that the response body matches the JSON Schema
     */
    toMatchSchema(received: unknown, schema: JsonSchema) {
        if (!isApiResponse(received)) {
            return {
                pass: false,
                message: () => 'Expected value to be an ApiResponse object',
            }
        }

        const result = validateSchema(received.data, schema)

        return {
            pass: result.valid,
            message: () =>
                result.valid
                    ? 'Expected body not to match schema, but it did'
                    : `Schema validation failed: ${formatSchemaErrors(result.errors)}`,
            actual: received.data,
            expected: schema,
        }
    },

    /**
     * Asserts that the response was received within the specified time
     */
    toRespondWithin(received: unknown, ms: number) {
        if (!isApiResponse(received)) {
            return {
                pass: false,
                message: () => 'Expected value to be an ApiResponse object',
            }
        }

        const pass = received.duration <= ms

        return {
            pass,
            message: () =>
                pass
                    ? `Expected response not to be within ${ms}ms, but it was (${received.duration}ms)`
                    : `Expected response within ${ms}ms, but took ${received.duration}ms`,
            actual: received.duration,
            expected: ms,
        }
    },

    /**
     * Asserts that the response has status 200 (OK)
     */
    toBeOk(received: unknown) {
        if (!isApiResponse(received)) {
            return {
                pass: false,
                message: () => 'Expected value to be an ApiResponse object',
            }
        }

        const pass = received.status === 200

        return {
            pass,
            message: () =>
                pass
                    ? `Expected response not to have status 200 (OK)`
                    : `Expected status 200 (OK), but received ${received.status}`,
            actual: received.status,
            expected: 200,
        }
    },

    /**
     * Asserts that the response has an empty body
     */
    toHaveEmptyBody(received: unknown) {
        if (!isApiResponse(received)) {
            return {
                pass: false,
                message: () => 'Expected value to be an ApiResponse object',
            }
        }

        const data = received.data
        const isEmpty =
            data === null ||
            data === undefined ||
            data === '' ||
            (Array.isArray(data) && data.length === 0) ||
            (typeof data === 'object' && data !== null && Object.keys(data).length === 0)

        return {
            pass: isEmpty,
            message: () =>
                isEmpty ? 'Expected response not to have an empty body' : 'Expected response to have an empty body',
            actual: data,
            expected: 'empty body',
        }
    },

    /**
     * Asserts that the response body has the specified length
     * Works with arrays and strings
     */
    toHaveBodyLength(received: unknown, length: number) {
        if (!isApiResponse(received)) {
            return {
                pass: false,
                message: () => 'Expected value to be an ApiResponse object',
            }
        }

        let actualLength: number | undefined

        if (Array.isArray(received.data)) {
            actualLength = received.data.length
        } else if (typeof received.data === 'string') {
            actualLength = received.data.length
        }

        const pass = actualLength === length

        return {
            pass,
            message: () =>
                pass
                    ? `Expected body length not to be ${length}`
                    : `Expected body length ${length}, but got ${actualLength}`,
            actual: actualLength,
            expected: length,
        }
    },

    /**
     * Asserts that the response has the specified content-type
     */
    toHaveContentType(received: unknown, type: string | RegExp) {
        if (!isApiResponse(received)) {
            return {
                pass: false,
                message: () => 'Expected value to be an ApiResponse object',
            }
        }

        const contentType = received.headers.get('content-type')
        const hasHeader = contentType !== null

        let matches: boolean
        if (type instanceof RegExp) {
            matches = hasHeader && type.test(contentType)
        } else {
            matches = contentType === type || (hasHeader && contentType.includes(type))
        }

        return {
            pass: matches,
            message: () =>
                matches
                    ? `Expected content-type not to ${type instanceof RegExp ? 'match' : 'contain'} ${type}`
                    : `Expected content-type to ${type instanceof RegExp ? 'match' : 'contain'} ${type}, but got "${contentType}"`,
            actual: contentType,
            expected: type,
        }
    },
}

/**
 * Custom matcher interface for type-safe usage
 */
export interface ApiResponseMatchers<R = unknown> {
    toHaveStatus(status: number): R
    toHaveStatusText(text: string): R
    toBeOk(): R
    toBeSuccess(): R
    toBeClientError(): R
    toBeServerError(): R
    toHaveHeader(name: string, value?: string | RegExp): R
    toHaveContentType(type: string | RegExp): R
    toHaveBody(): R
    toHaveEmptyBody(): R
    toHaveBodyLength(length: number): R
    toHaveBodyProperty(path: string, value?: unknown): R
    toMatchSchema(schema: JsonSchema): R
    toRespondWithin(ms: number): R
}
