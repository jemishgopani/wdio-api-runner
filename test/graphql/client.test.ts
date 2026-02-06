import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGraphQLClient, GraphQLNetworkError } from '../../src/graphql/index.js'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('GraphQL Client', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('createGraphQLClient', () => {
        it('should create a client with required endpoint', () => {
            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
            })

            expect(client).toBeDefined()
            expect(client.query).toBeInstanceOf(Function)
            expect(client.mutate).toBeInstanceOf(Function)
            expect(client.request).toBeInstanceOf(Function)
            expect(client.getEndpoint()).toBe('https://api.example.com/graphql')
        })

        it('should accept custom headers', () => {
            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
                headers: { 'X-Custom-Header': 'value' },
            })

            const headers = client.getHeaders()
            expect(headers['X-Custom-Header']).toBe('value')
            expect(headers['Content-Type']).toBe('application/json')
        })
    })

    describe('query', () => {
        it('should execute a simple query', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () =>
                    Promise.resolve(
                        JSON.stringify({
                            data: { user: { id: '1', name: 'John' } },
                        })
                    ),
            })

            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
            })

            const response = await client.query(
                `
                query GetUser($id: ID!) {
                    user(id: $id) { id name }
                }
            `,
                { id: '1' }
            )

            expect(response.isSuccess).toBe(true)
            expect(response.hasData).toBe(true)
            expect(response.hasErrors).toBe(false)
            expect(response.data.data?.user).toEqual({ id: '1', name: 'John' })
        })

        it('should handle GraphQL errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () =>
                    Promise.resolve(
                        JSON.stringify({
                            data: null,
                            errors: [{ message: 'User not found', path: ['user'] }],
                        })
                    ),
            })

            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
            })

            const response = await client.query('query { user { id } }')

            expect(response.isSuccess).toBe(false)
            expect(response.hasErrors).toBe(true)
            expect(response.data.errors?.[0].message).toBe('User not found')
        })

        it('should handle partial success (data + errors)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () =>
                    Promise.resolve(
                        JSON.stringify({
                            data: { user: { id: '1', name: null } },
                            errors: [{ message: 'Field name is null', path: ['user', 'name'] }],
                        })
                    ),
            })

            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
            })

            const response = await client.query('query { user { id name } }')

            expect(response.isSuccess).toBe(false)
            expect(response.hasData).toBe(true)
            expect(response.hasErrors).toBe(true)
        })

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'))

            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
            })

            await expect(client.query('query { user { id } }')).rejects.toThrow(GraphQLNetworkError)
        })

        it('should handle timeout', async () => {
            mockFetch.mockImplementationOnce(
                () =>
                    new Promise((_, reject) => {
                        const error = new Error('Aborted')
                        error.name = 'AbortError'
                        setTimeout(() => reject(error), 10)
                    })
            )

            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
                timeout: 5,
            })

            await expect(client.query('query { user { id } }')).rejects.toThrow('timeout')
        })
    })

    describe('mutate', () => {
        it('should execute a mutation', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () =>
                    Promise.resolve(
                        JSON.stringify({
                            data: { createUser: { id: '1', name: 'John' } },
                        })
                    ),
            })

            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
            })

            const response = await client.mutate(
                `
                mutation CreateUser($name: String!) {
                    createUser(name: $name) { id name }
                }
            `,
                { name: 'John' }
            )

            expect(response.isSuccess).toBe(true)
            expect(response.data.data?.createUser.name).toBe('John')
        })
    })

    describe('request', () => {
        it('should execute a raw request', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () =>
                    Promise.resolve(
                        JSON.stringify({
                            data: { users: [] },
                        })
                    ),
            })

            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
            })

            const response = await client.request({
                query: 'query { users { id } }',
                operationName: 'GetUsers',
            })

            expect(response.isSuccess).toBe(true)
        })
    })

    describe('configuration', () => {
        it('should allow setting endpoint', () => {
            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
            })

            client.setEndpoint('https://api2.example.com/graphql')

            expect(client.getEndpoint()).toBe('https://api2.example.com/graphql')
        })

        it('should allow setting headers', () => {
            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
            })

            client.setHeader('Authorization', 'Bearer token')

            expect(client.getHeaders()['Authorization']).toBe('Bearer token')
        })

        it('should allow setting multiple headers', () => {
            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
            })

            client.setHeaders({
                Authorization: 'Bearer token',
                'X-Custom': 'value',
            })

            const headers = client.getHeaders()
            expect(headers['Authorization']).toBe('Bearer token')
            expect(headers['X-Custom']).toBe('value')
        })

        it('should allow removing headers', () => {
            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
                headers: { 'X-Custom': 'value' },
            })

            client.removeHeader('X-Custom')

            expect(client.getHeaders()['X-Custom']).toBeUndefined()
        })
    })

    describe('interceptors', () => {
        it('should apply request interceptors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () => Promise.resolve(JSON.stringify({ data: {} })),
            })

            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
            })

            const interceptor = vi.fn((url, options) => ({
                ...options,
                headers: { ...(options.headers as object), 'X-Intercepted': 'true' },
            }))

            client.addRequestInterceptor(interceptor)

            await client.query('query { users { id } }')

            expect(interceptor).toHaveBeenCalled()
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.example.com/graphql',
                expect.objectContaining({
                    headers: expect.objectContaining({ 'X-Intercepted': 'true' }),
                })
            )
        })

        it('should apply response interceptors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () => Promise.resolve(JSON.stringify({ data: { value: 1 } })),
            })

            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
            })

            const interceptor = vi.fn((response) => ({
                ...response,
                data: { ...response.data, intercepted: true },
            }))

            client.addResponseInterceptor(interceptor)

            const response = await client.query('query { value }')

            expect(interceptor).toHaveBeenCalled()
            expect((response.data as any).intercepted).toBe(true)
        })

        it('should clear custom interceptors', async () => {
            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
            })

            const interceptor = vi.fn((url, options) => options)
            client.addRequestInterceptor(interceptor)

            client.clearInterceptors()

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () => Promise.resolve(JSON.stringify({ data: {} })),
            })

            await client.query('query { value }')

            // Interceptor should not be called after clearing
            expect(interceptor).not.toHaveBeenCalled()
        })
    })

    describe('HAR logging', () => {
        it('should support recording', () => {
            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
            })

            expect(client.isRecording()).toBe(false)

            client.startRecording('test')

            expect(client.isRecording()).toBe(true)
        })

        it('should provide subscription manager', () => {
            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
            })

            expect(client.subscriptions).toBeDefined()
            expect(client.subscriptions.configure).toBeInstanceOf(Function)
            expect(client.subscriptions.subscribe).toBeInstanceOf(Function)
        })
    })

    describe('retries', () => {
        it('should retry on server errors', async () => {
            // First call fails, second succeeds
            mockFetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    statusText: 'Internal Server Error',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    text: () => Promise.resolve(JSON.stringify({ errors: [{ message: 'Server error' }] })),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    text: () => Promise.resolve(JSON.stringify({ data: { value: 1 } })),
                })

            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
                retries: 1,
                retryDelay: 10,
            })

            const response = await client.query('query { value }')

            expect(mockFetch).toHaveBeenCalledTimes(2)
            expect(response.isSuccess).toBe(true)
        })

        it('should not retry on client errors (4xx)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () => Promise.resolve(JSON.stringify({ errors: [{ message: 'Bad request' }] })),
            })

            const client = createGraphQLClient({
                endpoint: 'https://api.example.com/graphql',
                retries: 2,
            })

            const response = await client.query('query { value }')

            expect(mockFetch).toHaveBeenCalledTimes(1)
            expect(response.ok).toBe(false)
        })
    })
})
