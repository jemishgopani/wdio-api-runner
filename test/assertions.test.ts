import { describe, it, expect, beforeEach } from 'vitest'
import {
    assertResponse,
    ApiResponseAssertions,
    apiMatchers,
    validateSchema,
    formatSchemaErrors,
    AssertionError,
} from '../src/assertions/index.js'
import type { ApiResponse } from '../src/shared/types.js'
import type { JsonSchema } from '../src/assertions/types.js'

// Extend Vitest expect with our custom matchers
expect.extend(apiMatchers)

/**
 * Helper to create mock ApiResponse
 */
function createMockResponse<T>(overrides: Partial<ApiResponse<T>> = {}): ApiResponse<T> {
    return {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        data: { id: 1, name: 'Test' } as T,
        ok: true,
        duration: 50,
        ...overrides,
    }
}

describe('assertions', () => {
    describe('assertResponse', () => {
        it('should create ApiResponseAssertions instance', () => {
            const response = createMockResponse()
            const assertions = assertResponse(response)

            expect(assertions).toBeInstanceOf(ApiResponseAssertions)
        })

        it('should return response via getResponse()', () => {
            const response = createMockResponse()
            const assertions = assertResponse(response)

            expect(assertions.getResponse()).toBe(response)
        })
    })

    describe('status assertions', () => {
        describe('toHaveStatus', () => {
            it('should pass when status matches', () => {
                const response = createMockResponse({ status: 200 })

                expect(() => assertResponse(response).toHaveStatus(200)).not.toThrow()
            })

            it('should fail when status does not match', () => {
                const response = createMockResponse({ status: 404 })

                expect(() => assertResponse(response).toHaveStatus(200)).toThrow(AssertionError)
                expect(() => assertResponse(response).toHaveStatus(200)).toThrow(
                    'Expected status 200, but received 404'
                )
            })

            it('should support negation', () => {
                const response = createMockResponse({ status: 404 })

                expect(() => assertResponse(response).not.toHaveStatus(200)).not.toThrow()
            })

            it('should fail negation when status matches', () => {
                const response = createMockResponse({ status: 200 })

                expect(() => assertResponse(response).not.toHaveStatus(200)).toThrow('Expected status not to be 200')
            })
        })

        describe('toHaveStatusText', () => {
            it('should pass when status text matches', () => {
                const response = createMockResponse({ statusText: 'OK' })

                expect(() => assertResponse(response).toHaveStatusText('OK')).not.toThrow()
            })

            it('should fail when status text does not match', () => {
                const response = createMockResponse({ statusText: 'Not Found' })

                expect(() => assertResponse(response).toHaveStatusText('OK')).toThrow(AssertionError)
            })
        })

        describe('toBeOk', () => {
            it('should pass when status is 200', () => {
                const response = createMockResponse({ status: 200 })

                expect(() => assertResponse(response).toBeOk()).not.toThrow()
            })

            it('should fail when status is not 200', () => {
                const response = createMockResponse({ status: 201 })

                expect(() => assertResponse(response).toBeOk()).toThrow(AssertionError)
            })
        })

        describe('toBeSuccess', () => {
            it('should pass for 2xx status codes', () => {
                for (const status of [200, 201, 202, 204, 299]) {
                    const response = createMockResponse({ status })
                    expect(() => assertResponse(response).toBeSuccess()).not.toThrow()
                }
            })

            it('should fail for non-2xx status codes', () => {
                for (const status of [199, 300, 400, 500]) {
                    const response = createMockResponse({ status })
                    expect(() => assertResponse(response).toBeSuccess()).toThrow(AssertionError)
                }
            })
        })

        describe('toBeRedirect', () => {
            it('should pass for 3xx status codes', () => {
                for (const status of [301, 302, 303, 307, 308]) {
                    const response = createMockResponse({ status })
                    expect(() => assertResponse(response).toBeRedirect()).not.toThrow()
                }
            })

            it('should fail for non-3xx status codes', () => {
                const response = createMockResponse({ status: 200 })
                expect(() => assertResponse(response).toBeRedirect()).toThrow(AssertionError)
            })
        })

        describe('toBeClientError', () => {
            it('should pass for 4xx status codes', () => {
                for (const status of [400, 401, 403, 404, 422, 429]) {
                    const response = createMockResponse({ status })
                    expect(() => assertResponse(response).toBeClientError()).not.toThrow()
                }
            })

            it('should fail for non-4xx status codes', () => {
                const response = createMockResponse({ status: 500 })
                expect(() => assertResponse(response).toBeClientError()).toThrow(AssertionError)
            })
        })

        describe('toBeServerError', () => {
            it('should pass for 5xx status codes', () => {
                for (const status of [500, 501, 502, 503, 504]) {
                    const response = createMockResponse({ status })
                    expect(() => assertResponse(response).toBeServerError()).not.toThrow()
                }
            })

            it('should fail for non-5xx status codes', () => {
                const response = createMockResponse({ status: 400 })
                expect(() => assertResponse(response).toBeServerError()).toThrow(AssertionError)
            })
        })
    })

    describe('header assertions', () => {
        describe('toHaveHeader', () => {
            it('should pass when header exists', () => {
                const response = createMockResponse({
                    headers: new Headers({ 'content-type': 'application/json' }),
                })

                expect(() => assertResponse(response).toHaveHeader('content-type')).not.toThrow()
            })

            it('should fail when header does not exist', () => {
                const response = createMockResponse({
                    headers: new Headers({}),
                })

                expect(() => assertResponse(response).toHaveHeader('x-custom')).toThrow(AssertionError)
            })

            it('should check header value when provided', () => {
                const response = createMockResponse({
                    headers: new Headers({ 'content-type': 'application/json' }),
                })

                expect(() => assertResponse(response).toHaveHeader('content-type', 'application/json')).not.toThrow()
                expect(() => assertResponse(response).toHaveHeader('content-type', 'text/html')).toThrow(AssertionError)
            })

            it('should support RegExp for header value', () => {
                const response = createMockResponse({
                    headers: new Headers({ 'content-type': 'application/json; charset=utf-8' }),
                })

                expect(() => assertResponse(response).toHaveHeader('content-type', /json/)).not.toThrow()
                expect(() => assertResponse(response).toHaveHeader('content-type', /xml/)).toThrow(AssertionError)
            })
        })

        describe('toHaveContentType', () => {
            it('should check content-type header', () => {
                const response = createMockResponse({
                    headers: new Headers({ 'content-type': 'application/json' }),
                })

                expect(() => assertResponse(response).toHaveContentType('application/json')).not.toThrow()
                expect(() => assertResponse(response).toHaveContentType(/json/)).not.toThrow()
            })
        })
    })

    describe('body assertions', () => {
        describe('toHaveBody', () => {
            it('should pass when response has body', () => {
                const response = createMockResponse({ data: { id: 1 } })

                expect(() => assertResponse(response).toHaveBody()).not.toThrow()
            })

            it('should fail when response has no body', () => {
                const response = createMockResponse({ data: null })

                expect(() => assertResponse(response).toHaveBody()).toThrow(AssertionError)
            })

            it('should fail when response body is empty string', () => {
                const response = createMockResponse({ data: '' })

                expect(() => assertResponse(response).toHaveBody()).toThrow(AssertionError)
            })
        })

        describe('toHaveEmptyBody', () => {
            it('should pass when response has no body', () => {
                const response = createMockResponse({ data: null })

                expect(() => assertResponse(response).toHaveEmptyBody()).not.toThrow()
            })

            it('should pass when response body is empty object', () => {
                const response = createMockResponse({ data: {} })

                expect(() => assertResponse(response).toHaveEmptyBody()).not.toThrow()
            })

            it('should pass when response body is empty array', () => {
                const response = createMockResponse({ data: [] })

                expect(() => assertResponse(response).toHaveEmptyBody()).not.toThrow()
            })

            it('should fail when response has body content', () => {
                const response = createMockResponse({ data: { id: 1 } })

                expect(() => assertResponse(response).toHaveEmptyBody()).toThrow(AssertionError)
            })
        })

        describe('toHaveBodyProperty', () => {
            it('should pass when property exists', () => {
                const response = createMockResponse({ data: { user: { name: 'John' } } })

                expect(() => assertResponse(response).toHaveBodyProperty('user')).not.toThrow()
                expect(() => assertResponse(response).toHaveBodyProperty('user.name')).not.toThrow()
            })

            it('should fail when property does not exist', () => {
                const response = createMockResponse({ data: { user: { name: 'John' } } })

                expect(() => assertResponse(response).toHaveBodyProperty('user.email')).toThrow(AssertionError)
            })

            it('should check property value when provided', () => {
                const response = createMockResponse({ data: { user: { name: 'John', age: 30 } } })

                expect(() => assertResponse(response).toHaveBodyProperty('user.name', 'John')).not.toThrow()
                expect(() => assertResponse(response).toHaveBodyProperty('user.age', 30)).not.toThrow()
                expect(() => assertResponse(response).toHaveBodyProperty('user.name', 'Jane')).toThrow(AssertionError)
            })

            it('should support deep nested properties', () => {
                const response = createMockResponse({
                    data: { a: { b: { c: { d: 'value' } } } },
                })

                expect(() => assertResponse(response).toHaveBodyProperty('a.b.c.d', 'value')).not.toThrow()
            })
        })

        describe('toHaveBodyLength', () => {
            it('should check array length', () => {
                const response = createMockResponse({ data: [1, 2, 3] })

                expect(() => assertResponse(response).toHaveBodyLength(3)).not.toThrow()
                expect(() => assertResponse(response).toHaveBodyLength(2)).toThrow(AssertionError)
            })

            it('should check string length', () => {
                const response = createMockResponse({ data: 'hello' })

                expect(() => assertResponse(response).toHaveBodyLength(5)).not.toThrow()
                expect(() => assertResponse(response).toHaveBodyLength(4)).toThrow(AssertionError)
            })
        })
    })

    describe('schema validation', () => {
        describe('toMatchSchema', () => {
            const userSchema: JsonSchema = {
                type: 'object',
                required: ['id', 'email'],
                properties: {
                    id: { type: 'number' },
                    email: { type: 'string', format: 'email' },
                    name: { type: 'string' },
                },
            }

            it('should pass when data matches schema', () => {
                const response = createMockResponse({
                    data: { id: 1, email: 'test@example.com', name: 'John' },
                })

                expect(() => assertResponse(response).toMatchSchema(userSchema)).not.toThrow()
            })

            it('should fail when data does not match schema', () => {
                const response = createMockResponse({
                    data: { id: 'not-a-number', email: 'invalid-email' },
                })

                expect(() => assertResponse(response).toMatchSchema(userSchema)).toThrow(AssertionError)
            })

            it('should fail when required property is missing', () => {
                const response = createMockResponse({
                    data: { id: 1 },
                })

                expect(() => assertResponse(response).toMatchSchema(userSchema)).toThrow(AssertionError)
            })
        })
    })

    describe('performance assertions', () => {
        describe('toRespondWithin', () => {
            it('should pass when response is fast enough', () => {
                const response = createMockResponse({ duration: 50 })

                expect(() => assertResponse(response).toRespondWithin(100)).not.toThrow()
            })

            it('should fail when response is too slow', () => {
                const response = createMockResponse({ duration: 150 })

                expect(() => assertResponse(response).toRespondWithin(100)).toThrow(AssertionError)
            })

            it('should pass when duration equals limit', () => {
                const response = createMockResponse({ duration: 100 })

                expect(() => assertResponse(response).toRespondWithin(100)).not.toThrow()
            })
        })
    })

    describe('chaining', () => {
        it('should support method chaining', () => {
            const response = createMockResponse({
                status: 200,
                headers: new Headers({ 'content-type': 'application/json' }),
                data: { id: 1, name: 'Test' },
                duration: 50,
            })

            expect(() =>
                assertResponse(response)
                    .toHaveStatus(200)
                    .toHaveHeader('content-type', /json/)
                    .toHaveBody()
                    .toHaveBodyProperty('id', 1)
                    .toRespondWithin(100)
            ).not.toThrow()
        })

        it('should support .and for readability', () => {
            const response = createMockResponse({ status: 200, data: { id: 1 } })

            expect(() =>
                assertResponse(response).toHaveStatus(200).and.toHaveBody().and.toHaveBodyProperty('id')
            ).not.toThrow()
        })

        it('should fail on first assertion failure', () => {
            const response = createMockResponse({ status: 404 })

            expect(
                () =>
                    assertResponse(response)
                        .toHaveStatus(200) // This should fail
                        .toHaveBody() // This should not be reached
            ).toThrow('Expected status 200')
        })
    })

    describe('negation', () => {
        it('should negate single assertion', () => {
            const response = createMockResponse({ status: 404 })

            expect(() => assertResponse(response).not.toHaveStatus(200)).not.toThrow()
            expect(() => assertResponse(response).not.toBeSuccess()).not.toThrow()
        })

        it('should not carry negation to next assertion', () => {
            const response = createMockResponse({ status: 200, data: { id: 1 } })

            // not applies only to first assertion
            const assertions = assertResponse(response).not
            expect(() => assertions.toHaveStatus(404)).not.toThrow()

            // Need to create new for next assertion
            expect(() => assertResponse(response).toHaveBody()).not.toThrow()
        })
    })
})

describe('validateSchema', () => {
    it('should return valid for matching data', () => {
        const schema: JsonSchema = {
            type: 'object',
            properties: {
                name: { type: 'string' },
            },
        }

        const result = validateSchema({ name: 'John' }, schema)

        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
    })

    it('should return errors for non-matching data', () => {
        const schema: JsonSchema = {
            type: 'object',
            required: ['id'],
            properties: {
                id: { type: 'number' },
            },
        }

        const result = validateSchema({ id: 'not-a-number' }, schema)

        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should validate email format', () => {
        const schema: JsonSchema = {
            type: 'object',
            properties: {
                email: { type: 'string', format: 'email' },
            },
        }

        expect(validateSchema({ email: 'test@example.com' }, schema).valid).toBe(true)
        expect(validateSchema({ email: 'invalid' }, schema).valid).toBe(false)
    })
})

describe('formatSchemaErrors', () => {
    it('should return "No errors" for empty array', () => {
        expect(formatSchemaErrors([])).toBe('No errors')
    })

    it('should return single error as-is', () => {
        expect(formatSchemaErrors(['data/id must be number'])).toBe('data/id must be number')
    })

    it('should format multiple errors', () => {
        const errors = ['error 1', 'error 2', 'error 3']
        const formatted = formatSchemaErrors(errors)

        expect(formatted).toContain('3 validation errors')
        expect(formatted).toContain('error 1')
        expect(formatted).toContain('error 2')
        expect(formatted).toContain('error 3')
    })
})

describe('apiMatchers (Vitest integration)', () => {
    it('toHaveStatus should work with expect()', () => {
        const response = createMockResponse({ status: 200 })

        expect(response).toHaveStatus(200)
    })

    it('toBeSuccess should work with expect()', () => {
        const response = createMockResponse({ status: 201 })

        expect(response).toBeSuccess()
    })

    it('toHaveHeader should work with expect()', () => {
        const response = createMockResponse({
            headers: new Headers({ 'content-type': 'application/json' }),
        })

        expect(response).toHaveHeader('content-type')
        expect(response).toHaveHeader('content-type', /json/)
    })

    it('toHaveBody should work with expect()', () => {
        const response = createMockResponse({ data: { id: 1 } })

        expect(response).toHaveBody()
    })

    it('toHaveBodyProperty should work with expect()', () => {
        const response = createMockResponse({ data: { user: { name: 'John' } } })

        expect(response).toHaveBodyProperty('user.name')
        expect(response).toHaveBodyProperty('user.name', 'John')
    })

    it('toMatchSchema should work with expect()', () => {
        const schema: JsonSchema = {
            type: 'object',
            properties: {
                id: { type: 'number' },
            },
        }
        const response = createMockResponse({ data: { id: 1 } })

        expect(response).toMatchSchema(schema)
    })

    it('toRespondWithin should work with expect()', () => {
        const response = createMockResponse({ duration: 50 })

        expect(response).toRespondWithin(100)
    })

    it('should work with .not modifier', () => {
        const response = createMockResponse({ status: 404 })

        expect(response).not.toHaveStatus(200)
        expect(response).not.toBeSuccess()
    })

    it('should fail with non-ApiResponse objects', () => {
        expect(() => {
            expect({ notAnApiResponse: true }).toHaveStatus(200)
        }).toThrow('Expected value to be an ApiResponse object')
    })

    it('toBeOk should work with expect()', () => {
        const response = createMockResponse({ status: 200 })

        expect(response).toBeOk()
    })

    it('toBeOk should fail for non-200 status', () => {
        const response = createMockResponse({ status: 201 })

        expect(() => {
            expect(response).toBeOk()
        }).toThrow()
    })

    it('toHaveEmptyBody should work with expect()', () => {
        const response = createMockResponse({ data: {} })

        expect(response).toHaveEmptyBody()
    })

    it('toHaveEmptyBody should work with null/empty values', () => {
        expect(createMockResponse({ data: null })).toHaveEmptyBody()
        expect(createMockResponse({ data: '' })).toHaveEmptyBody()
        expect(createMockResponse({ data: [] })).toHaveEmptyBody()
    })

    it('toHaveEmptyBody should fail for non-empty body', () => {
        const response = createMockResponse({ data: { id: 1 } })

        expect(() => {
            expect(response).toHaveEmptyBody()
        }).toThrow()
    })

    it('toHaveBodyLength should work with arrays', () => {
        const response = createMockResponse({ data: [1, 2, 3] })

        expect(response).toHaveBodyLength(3)
    })

    it('toHaveBodyLength should work with strings', () => {
        const response = createMockResponse({ data: 'hello' })

        expect(response).toHaveBodyLength(5)
    })

    it('toHaveBodyLength should fail for incorrect length', () => {
        const response = createMockResponse({ data: [1, 2] })

        expect(() => {
            expect(response).toHaveBodyLength(3)
        }).toThrow()
    })

    it('toHaveContentType should work with expect()', () => {
        const response = createMockResponse({
            headers: new Headers({ 'content-type': 'application/json' }),
        })

        expect(response).toHaveContentType('application/json')
        expect(response).toHaveContentType(/json/)
    })

    it('toHaveContentType should match partial content types', () => {
        const response = createMockResponse({
            headers: new Headers({ 'content-type': 'application/json; charset=utf-8' }),
        })

        expect(response).toHaveContentType('application/json')
    })

    it('toHaveContentType should fail for mismatched type', () => {
        const response = createMockResponse({
            headers: new Headers({ 'content-type': 'text/html' }),
        })

        expect(() => {
            expect(response).toHaveContentType('application/json')
        }).toThrow()
    })
})

describe('AssertionError', () => {
    it('should have correct name', () => {
        const error = new AssertionError('test message')

        expect(error.name).toBe('AssertionError')
    })

    it('should store actual and expected values', () => {
        const error = new AssertionError('test message', 'actual', 'expected')

        expect(error.actual).toBe('actual')
        expect(error.expected).toBe('expected')
    })
})
