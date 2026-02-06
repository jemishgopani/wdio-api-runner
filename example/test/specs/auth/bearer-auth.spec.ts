import { createApiClient, bearerAuth, assertResponse } from 'wdio-api-runner'
import { expect } from 'chai'

describe('Authentication - Bearer/JWT', () => {
    describe('Static Token', () => {
        it('should add Bearer token to Authorization header', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = bearerAuth({
                token: 'my-jwt-token-here',
            })
            api.addRequestInterceptor(auth.interceptor)

            const response = await api.get<{ headers: Record<string, string> }>('/headers')

            assertResponse(response).toBeOk()
            expect(response.data.headers['Authorization']).to.equal('Bearer my-jwt-token-here')
        })

        it('should authenticate with HTTPBin bearer endpoint', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = bearerAuth({
                token: 'test-token-123',
            })
            api.addRequestInterceptor(auth.interceptor)

            // HTTPBin /bearer validates any Bearer token
            const response = await api.get<{ authenticated: boolean; token: string }>('/bearer')

            assertResponse(response)
                .toBeOk()
                .toHaveBodyProperty('authenticated', true)
                .toHaveBodyProperty('token', 'test-token-123')
        })
    })

    describe('Dynamic Token', () => {
        it('should support dynamic token function', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            let tokenCalled = false

            const auth = bearerAuth({
                token: () => {
                    tokenCalled = true
                    return 'dynamically-generated-token'
                },
            })
            api.addRequestInterceptor(auth.interceptor)

            // Make request - token function should be called
            const response = await api.get<{ headers: Record<string, string> }>('/headers')

            expect(tokenCalled).to.equal(true)
            expect(response.data.headers['Authorization']).to.equal('Bearer dynamically-generated-token')
        })

        it('should support async token function', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = bearerAuth({
                token: async () => {
                    // Simulate fetching token from storage or API
                    await new Promise((resolve) => setTimeout(resolve, 10))
                    return 'async-fetched-token'
                },
            })
            api.addRequestInterceptor(auth.interceptor)

            const response = await api.get<{ headers: Record<string, string> }>('/headers')

            assertResponse(response).toBeOk()
            expect(response.data.headers['Authorization']).to.equal('Bearer async-fetched-token')
        })
    })

    describe('Custom Header Configuration', () => {
        it('should use custom header name', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = bearerAuth({
                token: 'my-token',
                headerName: 'X-Auth-Token',
            })
            api.addRequestInterceptor(auth.interceptor)

            const response = await api.get<{ headers: Record<string, string> }>('/headers')

            assertResponse(response).toBeOk()
            expect(response.data.headers['X-Auth-Token']).to.equal('Bearer my-token')
        })

        it('should use custom prefix', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = bearerAuth({
                token: 'my-token',
                prefix: 'Token',
            })
            api.addRequestInterceptor(auth.interceptor)

            const response = await api.get<{ headers: Record<string, string> }>('/headers')

            assertResponse(response).toBeOk()
            expect(response.data.headers['Authorization']).to.equal('Token my-token')
        })

        it('should work without prefix', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = bearerAuth({
                token: 'raw-token-value',
                prefix: '',
            })
            api.addRequestInterceptor(auth.interceptor)

            const response = await api.get<{ headers: Record<string, string> }>('/headers')

            assertResponse(response).toBeOk()
            expect(response.data.headers['Authorization']).to.equal('raw-token-value')
        })
    })

    describe('Path Exclusion', () => {
        it('should exclude specified paths', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = bearerAuth({
                token: 'my-token',
                excludePaths: ['/get', '/status/*'],
            })
            api.addRequestInterceptor(auth.interceptor)

            // Excluded path - no auth header
            const response1 = await api.get<{ headers: Record<string, string> }>('/get')
            expect(response1.data.headers['Authorization']).to.be.undefined

            // Non-excluded path - should have auth header
            const response2 = await api.get<{ headers: Record<string, string> }>('/headers')
            expect(response2.data.headers['Authorization']).to.equal('Bearer my-token')
        })
    })

    describe('Token Management', () => {
        it('should update token with setToken()', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = bearerAuth({
                token: 'initial-token',
            })
            api.addRequestInterceptor(auth.interceptor)

            // First request with initial token
            const response1 = await api.get<{ headers: Record<string, string> }>('/headers')
            expect(response1.data.headers['Authorization']).to.equal('Bearer initial-token')

            // Update token
            auth.setToken('updated-token')

            // Second request with updated token
            const response2 = await api.get<{ headers: Record<string, string> }>('/headers')
            expect(response2.data.headers['Authorization']).to.equal('Bearer updated-token')
        })
    })

    describe('Real-world JWT Pattern', () => {
        it('should work with JWT-like token', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            // Simulated JWT token (not a real JWT, just the format)
            const jwtToken =
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

            const auth = bearerAuth({
                token: jwtToken,
            })
            api.addRequestInterceptor(auth.interceptor)

            const response = await api.get<{ authenticated: boolean; token: string }>('/bearer')

            assertResponse(response).toBeOk().toHaveBodyProperty('authenticated', true)
        })

        it('should handle multiple authenticated endpoints', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = bearerAuth({
                token: 'session-token-abc',
            })
            api.addRequestInterceptor(auth.interceptor)

            // Multiple requests with same token
            const responses = await Promise.all([
                api.get<{ headers: Record<string, string> }>('/headers'),
                api.post<{ headers: Record<string, string> }>('/post', { data: 'test' }),
                api.get<{ authenticated: boolean }>('/bearer'),
            ])

            responses.forEach((response) => {
                assertResponse(response).toBeOk()
            })

            expect(responses[2].data.authenticated).to.equal(true)
        })
    })
})
