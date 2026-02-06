import type { ApiResponse } from '../shared/types.js'

/**
 * Result of an assertion check
 */
export interface AssertionResult {
    pass: boolean
    message: string
    actual?: unknown
    expected?: unknown
}

/**
 * JSON Schema definition for validation
 */
export interface JsonSchema {
    type?: string | string[]
    properties?: Record<string, JsonSchema>
    required?: string[]
    items?: JsonSchema | JsonSchema[]
    enum?: unknown[]
    const?: unknown
    minimum?: number
    maximum?: number
    minLength?: number
    maxLength?: number
    pattern?: string
    format?: string
    additionalProperties?: boolean | JsonSchema
    oneOf?: JsonSchema[]
    anyOf?: JsonSchema[]
    allOf?: JsonSchema[]
    not?: JsonSchema
    if?: JsonSchema
    then?: JsonSchema
    else?: JsonSchema
    $ref?: string
    $defs?: Record<string, JsonSchema>
    [key: string]: unknown
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
    valid: boolean
    errors: string[]
}

/**
 * Fluent API for asserting on API responses
 */
export interface ApiAssertions<T = unknown> {
    // Negation
    readonly not: ApiAssertions<T>

    // Chainability
    readonly and: ApiAssertions<T>

    // Status assertions
    toHaveStatus(status: number): ApiAssertions<T>
    toHaveStatusText(text: string): ApiAssertions<T>
    toBeOk(): ApiAssertions<T>
    toBeSuccess(): ApiAssertions<T>
    toBeRedirect(): ApiAssertions<T>
    toBeClientError(): ApiAssertions<T>
    toBeServerError(): ApiAssertions<T>

    // Header assertions
    toHaveHeader(name: string, value?: string | RegExp): ApiAssertions<T>
    toHaveContentType(type: string | RegExp): ApiAssertions<T>

    // Body assertions
    toHaveBody(): ApiAssertions<T>
    toHaveEmptyBody(): ApiAssertions<T>
    toHaveBodyProperty(path: string, value?: unknown): ApiAssertions<T>
    toHaveBodyLength(length: number): ApiAssertions<T>
    toMatchSchema(schema: JsonSchema): ApiAssertions<T>

    // Performance assertions
    toRespondWithin(ms: number): ApiAssertions<T>

    // Utility
    getResponse(): ApiResponse<T>
}

/**
 * Custom error for assertion failures
 */
export class AssertionError extends Error {
    constructor(
        message: string,
        public readonly actual?: unknown,
        public readonly expected?: unknown
    ) {
        super(message)
        this.name = 'AssertionError'
    }
}
