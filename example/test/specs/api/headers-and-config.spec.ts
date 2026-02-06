import { createApiClient, assertResponse } from 'wdio-api-runner'
import { expect } from 'chai'

describe('API Client - Headers and Configuration', () => {
    describe('Custom Headers', () => {
        it('should send custom headers with request', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const response = await api.get<{ headers: Record<string, string> }>('/headers', {
                headers: {
                    'X-Custom': 'test-value',
                    'X-Reqid': '12345',
                },
            })

            assertResponse(response).toBeOk()
            expect(response.data.headers['X-Custom']).to.equal('test-value')
            expect(response.data.headers['X-Reqid']).to.equal('12345')
        })

        it('should manage headers dynamically', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            // Set a header
            api.setHeader('Authorization', 'Bearer token123')

            // Set multiple headers
            api.setHeaders({
                'X-Client': 'client-abc',
                'X-Source': 'test',
            })

            const response = await api.get<{ headers: Record<string, string> }>('/headers')

            assertResponse(response).toBeOk()
            expect(response.data.headers['Authorization']).to.equal('Bearer token123')
            expect(response.data.headers['X-Client']).to.equal('client-abc')

            // Remove a header
            api.removeHeader('Authorization')

            const response2 = await api.get<{ headers: Record<string, string> }>('/headers')
            expect(response2.data.headers['Authorization']).to.be.undefined
        })

        it('should get headers set via setHeader', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            api.setHeader('X-Test', 'value')
            api.setHeader('X-Another', 'another-value')

            const headers = api.getHeaders()
            const headerKeys = Object.keys(headers).map((k) => k.toLowerCase())
            expect(headerKeys).to.include('x-test')
            expect(headerKeys).to.include('x-another')
        })
    })

    describe('Base URL Management', () => {
        it('should use configured base URL', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const response = await api.get('/users/1')
            assertResponse(response).toBeOk()
        })

        it('should change base URL dynamically', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            // Get initial base URL
            expect(api.getBaseUrl()).to.equal('https://jsonplaceholder.typicode.com')

            // Change base URL
            api.setBaseUrl('https://httpbin.org')
            expect(api.getBaseUrl()).to.equal('https://httpbin.org')

            // Make request to new base URL
            const response = await api.get('/get')
            assertResponse(response).toBeOk()
        })

        it('should handle absolute URLs ignoring base URL', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            // Absolute URL should work regardless of base URL
            const response = await api.get('https://httpbin.org/get')
            assertResponse(response).toBeOk()
        })
    })

    describe('Timeout Configuration', () => {
        it('should use custom timeout', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
                timeout: 5000, // 5 seconds
            })

            // This endpoint delays response by 1 second (should succeed)
            const response = await api.get('/delay/1')
            assertResponse(response).toBeOk()
        })

        it('should timeout on slow requests', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
                timeout: 1000, // 1 second
            })

            // This endpoint delays response by 3 seconds (should timeout)
            try {
                await api.get('/delay/3')
                expect.fail('Should have timed out')
            } catch (error) {
                expect(error).to.exist
            }
        })
    })

    describe('Request Options', () => {
        it('should send query parameters via URL', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const response = await api.get<{ args: Record<string, string> }>('/get?foo=bar&baz=123')

            assertResponse(response).toBeOk()
            expect(response.data.args.foo).to.equal('bar')
            expect(response.data.args.baz).to.equal('123')
        })

        it('should override headers per request', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            // Set a default header
            api.setHeader('X-Default', 'default-value')

            // Override it in the request
            const response = await api.get<{ headers: Record<string, string> }>('/headers', {
                headers: {
                    'X-Default': 'overridden-value',
                },
            })

            assertResponse(response).toBeOk()
            expect(response.data.headers['X-Default']).to.equal('overridden-value')
        })
    })
})
