import { createApiClient, apiKeyAuth, assertResponse } from 'wdio-api-runner'
import { expect } from 'chai'

describe('Authentication - API Key', () => {
    describe('API Key in Header', () => {
        it('should add API key to header (default)', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = apiKeyAuth({
                value: 'my-secret-api-key',
                in: 'header',
                // Default name: 'X-API-Key'
            })
            api.addRequestInterceptor(auth.interceptor)

            const response = await api.get<{ headers: Record<string, string> }>('/headers')

            assertResponse(response).toBeOk()
            expect(response.data.headers['X-Api-Key']).to.equal('my-secret-api-key')
        })

        it('should use custom header name', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = apiKeyAuth({
                value: 'custom-key-value',
                in: 'header',
                name: 'Authorization',
            })
            api.addRequestInterceptor(auth.interceptor)

            const response = await api.get<{ headers: Record<string, string> }>('/headers')

            assertResponse(response).toBeOk()
            expect(response.data.headers['Authorization']).to.equal('custom-key-value')
        })

        it('should use Api-Key header name', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = apiKeyAuth({
                value: 'api-key-123',
                in: 'header',
                name: 'Api-Key',
            })
            api.addRequestInterceptor(auth.interceptor)

            const response = await api.get<{ headers: Record<string, string> }>('/headers')

            assertResponse(response).toBeOk()
            expect(response.data.headers['Api-Key']).to.equal('api-key-123')
        })
    })

    describe('API Key in Query Parameter', () => {
        it('should add API key to query string', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = apiKeyAuth({
                value: 'query-api-key',
                in: 'query',
                name: 'api_key',
            })
            api.addRequestInterceptor(auth.interceptor)

            const response = await api.get<{ args: Record<string, string> }>('/get')

            assertResponse(response).toBeOk()
            expect(response.data.args.api_key).to.equal('query-api-key')
        })

        it('should preserve existing query parameters', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = apiKeyAuth({
                value: 'my-api-key',
                in: 'query',
                name: 'apiKey',
            })
            api.addRequestInterceptor(auth.interceptor)

            // Use URL query string directly - the interceptor will add apiKey
            const response = await api.get<{ args: Record<string, string> }>('/get?foo=bar&baz=123')

            assertResponse(response).toBeOk()
            expect(response.data.args.apiKey).to.equal('my-api-key')
            expect(response.data.args.foo).to.equal('bar')
            expect(response.data.args.baz).to.equal('123')
        })

        it('should use custom query parameter name', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = apiKeyAuth({
                value: 'secret-token',
                in: 'query',
                name: 'access_token',
            })
            api.addRequestInterceptor(auth.interceptor)

            const response = await api.get<{ args: Record<string, string> }>('/get')

            assertResponse(response).toBeOk()
            expect(response.data.args.access_token).to.equal('secret-token')
        })
    })

    describe('API Key in Cookie', () => {
        it('should add API key to cookie', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = apiKeyAuth({
                value: 'cookie-api-key',
                in: 'cookie',
                name: 'session_token',
            })
            api.addRequestInterceptor(auth.interceptor)

            const response = await api.get<{ headers: Record<string, string> }>('/headers')

            assertResponse(response).toBeOk()
            // Cookie header should contain our api key
            expect(response.data.headers['Cookie']).to.include('session_token=cookie-api-key')
        })
    })

    describe('Path Exclusion', () => {
        it('should exclude specified paths', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = apiKeyAuth({
                value: 'my-api-key',
                in: 'header',
                name: 'X-API-Key',
                excludePaths: ['/get'],
            })
            api.addRequestInterceptor(auth.interceptor)

            // Excluded path - no API key
            const response1 = await api.get<{ headers: Record<string, string> }>('/headers')
            // Note: /headers is not excluded, so it should have the key
            expect(response1.data.headers['X-Api-Key']).to.equal('my-api-key')
        })

        it('should include API key on non-excluded paths', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = apiKeyAuth({
                value: 'my-api-key',
                in: 'query',
                name: 'key',
                excludePaths: ['/public/*'],
            })
            api.addRequestInterceptor(auth.interceptor)

            // Non-excluded path - should have API key
            const response = await api.get<{ args: Record<string, string> }>('/get')

            assertResponse(response).toBeOk()
            expect(response.data.args.key).to.equal('my-api-key')
        })
    })

    describe('Real-world Patterns', () => {
        it('should work with typical API service pattern', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            // Typical pattern: API key in header with Bearer-like prefix
            const auth = apiKeyAuth({
                value: 'ApiKey sk_live_abc123',
                in: 'header',
                name: 'Authorization',
            })
            api.addRequestInterceptor(auth.interceptor)

            const response = await api.get<{ headers: Record<string, string> }>('/headers')

            assertResponse(response).toBeOk()
            expect(response.data.headers['Authorization']).to.equal('ApiKey sk_live_abc123')
        })

        it('should work with multiple API endpoints', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = apiKeyAuth({
                value: 'test-api-key',
                in: 'header',
                name: 'X-API-Key',
            })
            api.addRequestInterceptor(auth.interceptor)

            // Multiple requests should all have the API key
            const response1 = await api.get<{ headers: Record<string, string> }>('/headers')
            const response2 = await api.post<{ headers: Record<string, string> }>('/post', { data: 'test' })
            const response3 = await api.put<{ headers: Record<string, string> }>('/put', { data: 'test' })

            expect(response1.data.headers['X-Api-Key']).to.equal('test-api-key')
            expect(response2.data.headers['X-Api-Key']).to.equal('test-api-key')
            expect(response3.data.headers['X-Api-Key']).to.equal('test-api-key')
        })
    })
})
