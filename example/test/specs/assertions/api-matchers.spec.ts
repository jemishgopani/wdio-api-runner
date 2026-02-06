import { createApiClient, apiMatchers, assertResponse } from 'wdio-api-runner'
import { expect } from 'chai'

/**
 * API Matchers Examples (Jest/Vitest Integration)
 *
 * The apiMatchers object provides custom matchers for Jest and Vitest that
 * make API response assertions more readable and provide better error messages.
 *
 * To use in Jest/Vitest:
 *
 * ```typescript
 * // In your test setup file (e.g., setupTests.ts)
 * import { apiMatchers } from 'wdio-api-runner';
 *
 * expect.extend(apiMatchers);
 *
 * // For TypeScript, add type declarations:
 * declare module 'vitest' {
 *     interface Assertion<T = any> extends ApiResponseMatchers<T> {}
 *     interface AsymmetricMatchersContaining extends ApiResponseMatchers {}
 * }
 * ```
 *
 * Note: This example project uses Mocha/Chai, so we demonstrate the matcher
 * behavior manually. In Jest/Vitest, you would use expect(response).toBeOk()
 */
describe('Assertions - API Matchers (Jest/Vitest)', () => {
    const api = createApiClient({
        baseUrl: 'https://jsonplaceholder.typicode.com',
    })

    describe('Available Matchers', () => {
        it('should export all expected matchers', () => {
            // Verify all matchers are available
            expect(apiMatchers.toHaveStatus).to.be.a('function')
            expect(apiMatchers.toHaveStatusText).to.be.a('function')
            expect(apiMatchers.toBeOk).to.be.a('function')
            expect(apiMatchers.toBeSuccess).to.be.a('function')
            expect(apiMatchers.toBeClientError).to.be.a('function')
            expect(apiMatchers.toBeServerError).to.be.a('function')
            expect(apiMatchers.toHaveHeader).to.be.a('function')
            expect(apiMatchers.toHaveContentType).to.be.a('function')
            expect(apiMatchers.toHaveBody).to.be.a('function')
            expect(apiMatchers.toHaveEmptyBody).to.be.a('function')
            expect(apiMatchers.toHaveBodyLength).to.be.a('function')
            expect(apiMatchers.toHaveBodyProperty).to.be.a('function')
            expect(apiMatchers.toMatchSchema).to.be.a('function')
            expect(apiMatchers.toRespondWithin).to.be.a('function')
        })
    })

    describe('Status Code Matchers', () => {
        it('should match exact status with toHaveStatus', async () => {
            const response = await api.get('/users/1')

            // Using apiMatchers directly (how it works internally)
            const result = apiMatchers.toHaveStatus(response, 200)

            expect(result.pass).to.equal(true)
            expect(result.actual).to.equal(200)
            expect(result.expected).to.equal(200)

            // In Jest/Vitest you would write:
            // expect(response).toHaveStatus(200);

            // Equivalent with assertResponse:
            assertResponse(response).toHaveStatus(200)
        })

        it('should fail for wrong status with helpful message', async () => {
            const response = await api.get('/users/1')

            const result = apiMatchers.toHaveStatus(response, 404)

            expect(result.pass).to.equal(false)
            expect(result.message()).to.include('Expected status 404')
            expect(result.message()).to.include('received 200')
        })

        it('should match 200 OK with toBeOk', async () => {
            const response = await api.get('/users/1')

            const result = apiMatchers.toBeOk(response)

            expect(result.pass).to.equal(true)

            // Equivalent with assertResponse:
            assertResponse(response).toBeOk()
        })

        it('should match 2xx with toBeSuccess', async () => {
            const response = await api.get('/users/1')

            const result = apiMatchers.toBeSuccess(response)

            expect(result.pass).to.equal(true)

            // Equivalent with assertResponse:
            assertResponse(response).toBeSuccess()
        })

        it('should match 4xx with toBeClientError', async () => {
            const response = await api.get('/users/9999')

            const result = apiMatchers.toBeClientError(response)

            expect(result.pass).to.equal(true)

            // Equivalent with assertResponse:
            assertResponse(response).toBeClientError()
        })
    })

    describe('Header Matchers', () => {
        it('should check header existence with toHaveHeader', async () => {
            const response = await api.get('/users/1')

            const result = apiMatchers.toHaveHeader(response, 'content-type')

            expect(result.pass).to.equal(true)

            // In Jest/Vitest:
            // expect(response).toHaveHeader('content-type');
        })

        it('should check header value with toHaveHeader', async () => {
            const response = await api.get('/users/1')

            const result = apiMatchers.toHaveHeader(response, 'content-type', 'application/json; charset=utf-8')

            expect(result.pass).to.equal(true)

            // In Jest/Vitest:
            // expect(response).toHaveHeader('content-type', 'application/json; charset=utf-8');
        })

        it('should match header with regex', async () => {
            const response = await api.get('/users/1')

            const result = apiMatchers.toHaveHeader(response, 'content-type', /application\/json/)

            expect(result.pass).to.equal(true)

            // In Jest/Vitest:
            // expect(response).toHaveHeader('content-type', /application\/json/);
        })

        it('should check content-type with toHaveContentType', async () => {
            const response = await api.get('/users/1')

            const result = apiMatchers.toHaveContentType(response, 'application/json')

            expect(result.pass).to.equal(true)

            // Equivalent with assertResponse:
            assertResponse(response).toHaveContentType('application/json; charset=utf-8')
        })
    })

    describe('Body Matchers', () => {
        it('should check body exists with toHaveBody', async () => {
            const response = await api.get('/users/1')

            const result = apiMatchers.toHaveBody(response)

            expect(result.pass).to.equal(true)

            // Equivalent with assertResponse:
            assertResponse(response).toHaveBody()
        })

        it('should check body property with toHaveBodyProperty', async () => {
            const response = await api.get('/users/1')

            const result = apiMatchers.toHaveBodyProperty(response, 'id')

            expect(result.pass).to.equal(true)

            // In Jest/Vitest:
            // expect(response).toHaveBodyProperty('id');

            // Equivalent with assertResponse:
            assertResponse(response).toHaveBodyProperty('id')
        })

        it('should check body property value with toHaveBodyProperty', async () => {
            const response = await api.get('/users/1')

            const result = apiMatchers.toHaveBodyProperty(response, 'id', 1)

            expect(result.pass).to.equal(true)

            // In Jest/Vitest:
            // expect(response).toHaveBodyProperty('id', 1);

            // Equivalent with assertResponse:
            assertResponse(response).toHaveBodyProperty('id', 1)
        })

        it('should check nested property with dot notation', async () => {
            const response = await api.get('/users/1')

            const result = apiMatchers.toHaveBodyProperty(response, 'address.city')

            expect(result.pass).to.equal(true)

            // In Jest/Vitest:
            // expect(response).toHaveBodyProperty('address.city');

            // Equivalent with assertResponse:
            assertResponse(response).toHaveBodyProperty('address.city')
        })

        it('should check array length with toHaveBodyLength', async () => {
            const response = await api.get('/users')

            const result = apiMatchers.toHaveBodyLength(response, 10)

            expect(result.pass).to.equal(true)

            // In Jest/Vitest:
            // expect(response).toHaveBodyLength(10);
        })
    })

    describe('Schema Validation Matcher', () => {
        it('should validate against JSON schema with toMatchSchema', async () => {
            const response = await api.get('/users/1')

            const userSchema = {
                type: 'object',
                required: ['id', 'name', 'email'],
                properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                    email: { type: 'string' },
                },
            }

            const result = apiMatchers.toMatchSchema(response, userSchema)

            expect(result.pass).to.equal(true)

            // In Jest/Vitest:
            // expect(response).toMatchSchema(userSchema);

            // Equivalent with assertResponse:
            assertResponse(response).toMatchSchema(userSchema)
        })

        it('should fail schema validation with helpful errors', async () => {
            const response = await api.get('/users/1')

            const wrongSchema = {
                type: 'object',
                required: ['nonExistentField'],
            }

            const result = apiMatchers.toMatchSchema(response, wrongSchema)

            expect(result.pass).to.equal(false)
            expect(result.message()).to.include('Schema validation failed')
        })
    })

    describe('Performance Matcher', () => {
        it('should check response time with toRespondWithin', async () => {
            const response = await api.get('/users/1')

            // Check that response was received within 10 seconds
            const result = apiMatchers.toRespondWithin(response, 10000)

            expect(result.pass).to.equal(true)

            // In Jest/Vitest:
            // expect(response).toRespondWithin(10000);
        })

        it('should fail when response is too slow', async () => {
            const response = await api.get('/users/1')

            // Impossible threshold (1ms)
            const result = apiMatchers.toRespondWithin(response, 1)

            expect(result.pass).to.equal(false)
            expect(result.message()).to.include('Expected response within 1ms')
        })
    })

    describe('Error Handling', () => {
        it('should handle non-ApiResponse objects', () => {
            const notAResponse = { foo: 'bar' }

            const result = apiMatchers.toBeOk(notAResponse)

            expect(result.pass).to.equal(false)
            expect(result.message()).to.include('Expected value to be an ApiResponse object')
        })

        it('should handle null input', () => {
            const result = apiMatchers.toBeOk(null)

            expect(result.pass).to.equal(false)
            expect(result.message()).to.include('Expected value to be an ApiResponse object')
        })
    })

    describe('Jest/Vitest Setup Example', () => {
        it('should demonstrate setup file pattern', () => {
            /**
             * Example: setupTests.ts for Vitest
             *
             * ```typescript
             * import { apiMatchers, type ApiResponseMatchers } from 'wdio-api-runner';
             *
             * // Extend Vitest's expect with API matchers
             * expect.extend(apiMatchers);
             *
             * // TypeScript declaration
             * declare module 'vitest' {
             *     interface Assertion<T = any> extends ApiResponseMatchers<T> {}
             *     interface AsymmetricMatchersContaining extends ApiResponseMatchers {}
             * }
             * ```
             *
             * Example: setupTests.ts for Jest
             *
             * ```typescript
             * import { apiMatchers, type ApiResponseMatchers } from 'wdio-api-runner';
             *
             * expect.extend(apiMatchers);
             *
             * // TypeScript declaration
             * declare global {
             *     namespace jest {
             *         interface Matchers<R> extends ApiResponseMatchers<R> {}
             *     }
             * }
             * ```
             */
            expect(true).to.equal(true)
        })

        it('should demonstrate test usage pattern', () => {
            /**
             * Example test using matchers in Jest/Vitest:
             *
             * ```typescript
             * import { createApiClient } from 'wdio-api-runner';
             * import { describe, it, expect } from 'vitest';
             *
             * describe('User API', () => {
             *     const api = createApiClient({ baseUrl: 'https://api.example.com' });
             *
             *     it('should get user by ID', async () => {
             *         const response = await api.get('/users/1');
             *
             *         expect(response).toBeOk();
             *         expect(response).toHaveBodyProperty('id', 1);
             *         expect(response).toHaveBodyProperty('email');
             *         expect(response).toRespondWithin(2000);
             *     });
             *
             *     it('should validate user schema', async () => {
             *         const response = await api.get('/users/1');
             *
             *         expect(response).toMatchSchema({
             *             type: 'object',
             *             required: ['id', 'name', 'email'],
             *         });
             *     });
             *
             *     it('should return 404 for non-existent user', async () => {
             *         const response = await api.get('/users/99999');
             *
             *         expect(response).toBeClientError();
             *         expect(response).toHaveStatus(404);
             *     });
             * });
             * ```
             */
            expect(true).to.equal(true)
        })
    })

    describe('Comparing Matchers vs assertResponse', () => {
        it('should show equivalent assertions', async () => {
            const response = await api.get('/users/1')

            // Using apiMatchers (for Jest/Vitest)
            // expect(response).toBeOk();
            // expect(response).toHaveBodyProperty('id', 1);
            // expect(response).toHaveContentType('application/json');

            // Using assertResponse (works everywhere, chainable)
            assertResponse(response)
                .toBeOk()
                .toHaveBodyProperty('id', 1)
                .toHaveContentType('application/json; charset=utf-8')

            // Verify with matchers
            expect(apiMatchers.toBeOk(response).pass).to.equal(true)
            expect(apiMatchers.toHaveBodyProperty(response, 'id', 1).pass).to.equal(true)
        })

        it('should show when to use each approach', () => {
            /**
             * Use apiMatchers when:
             * - You're using Jest or Vitest as your test framework
             * - You prefer native expect() syntax
             * - You want integration with test framework reporters
             *
             * Use assertResponse when:
             * - You're using Mocha, Jasmine, or other frameworks
             * - You want chainable, fluent assertions
             * - You want consistent API across frameworks
             *
             * Both approaches provide:
             * - Clear error messages
             * - Type-safe assertions
             * - Same assertion capabilities
             */
            expect(true).to.equal(true)
        })
    })
})
