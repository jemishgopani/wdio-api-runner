/**
 * Type augmentation for Vitest
 *
 * To use these types, add this to your vitest.setup.ts or test file:
 *
 * @example
 * ```typescript
 * import { apiMatchers } from 'wdio-api-runner'
 * import 'wdio-api-runner/assertions/vitest'
 *
 * expect.extend(apiMatchers)
 * ```
 */

import type { JsonSchema } from './types.js'

declare module 'vitest' {
    interface Assertion<T = unknown> {
        /**
         * Asserts that the response has the specified status code
         */
        toHaveStatus(status: number): T

        /**
         * Asserts that the response has the specified status text
         */
        toHaveStatusText(text: string): T

        /**
         * Asserts that the response has status 200 (OK)
         */
        toBeOk(): T

        /**
         * Asserts that the response has a success status (2xx)
         */
        toBeSuccess(): T

        /**
         * Asserts that the response has a client error status (4xx)
         */
        toBeClientError(): T

        /**
         * Asserts that the response has a server error status (5xx)
         */
        toBeServerError(): T

        /**
         * Asserts that the response has the specified header
         */
        toHaveHeader(name: string, value?: string | RegExp): T

        /**
         * Asserts that the response has the specified content-type
         */
        toHaveContentType(type: string | RegExp): T

        /**
         * Asserts that the response has a non-empty body
         */
        toHaveBody(): T

        /**
         * Asserts that the response has an empty body
         */
        toHaveEmptyBody(): T

        /**
         * Asserts that the response body has the specified length (for arrays/strings)
         */
        toHaveBodyLength(length: number): T

        /**
         * Asserts that the response body has the specified property
         */
        toHaveBodyProperty(path: string, value?: unknown): T

        /**
         * Asserts that the response body matches the JSON Schema
         */
        toMatchSchema(schema: JsonSchema): T

        /**
         * Asserts that the response was received within the specified time
         */
        toRespondWithin(ms: number): T
    }

    interface AsymmetricMatchersContaining {
        toHaveStatus(status: number): unknown
        toHaveStatusText(text: string): unknown
        toBeOk(): unknown
        toBeSuccess(): unknown
        toBeClientError(): unknown
        toBeServerError(): unknown
        toHaveHeader(name: string, value?: string | RegExp): unknown
        toHaveContentType(type: string | RegExp): unknown
        toHaveBody(): unknown
        toHaveEmptyBody(): unknown
        toHaveBodyLength(length: number): unknown
        toHaveBodyProperty(path: string, value?: unknown): unknown
        toMatchSchema(schema: JsonSchema): unknown
        toRespondWithin(ms: number): unknown
    }
}
