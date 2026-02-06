/**
 * Assertions module for wdio-api-runner
 *
 * Provides fluent assertions and Vitest/Jest matchers for API response testing.
 *
 * @example Standalone usage
 * ```typescript
 * import { assertResponse } from 'wdio-api-runner'
 *
 * const response = await api.get('/users/1')
 *
 * assertResponse(response)
 *   .toHaveStatus(200)
 *   .toHaveHeader('content-type', /json/)
 *   .toHaveBodyProperty('user.email')
 *   .toRespondWithin(1000)
 * ```
 *
 * @example With Vitest/Jest matchers
 * ```typescript
 * import { apiMatchers } from 'wdio-api-runner'
 *
 * // Setup
 * expect.extend(apiMatchers)
 *
 * // Tests
 * const response = await api.get('/users/1')
 * expect(response).toHaveStatus(200)
 * expect(response).toMatchSchema(userSchema)
 * ```
 */

// Core assertions
export { ApiResponseAssertions, assertResponse } from './ApiResponseAssertions.js'

// Vitest/Jest matchers
export { apiMatchers, type ApiResponseMatchers } from './matchers.js'

// Schema validation
export { validateSchema, formatSchemaErrors } from './schema.js'

// Types
export type { ApiAssertions, AssertionResult, JsonSchema, SchemaValidationResult } from './types.js'

export { AssertionError } from './types.js'
