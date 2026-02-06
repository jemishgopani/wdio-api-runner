import { createApiClient, basicAuth, assertResponse } from 'wdio-api-runner'
import { expect } from 'chai'

describe('Authentication - Basic Auth', () => {
    describe('Basic Authentication', () => {
        it('should authenticate with valid credentials', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            // Add basic auth interceptor
            const auth = basicAuth({
                username: 'testuser',
                password: 'testpass',
            })
            api.addRequestInterceptor(auth.interceptor)

            // HTTPBin /basic-auth endpoint validates credentials
            const response = await api.get<{ authenticated: boolean; user: string }>('/basic-auth/testuser/testpass')

            assertResponse(response)
                .toBeOk()
                .toHaveBodyProperty('authenticated', true)
                .toHaveBodyProperty('user', 'testuser')
        })

        it('should fail with invalid credentials', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            // Add basic auth with wrong password
            const auth = basicAuth({
                username: 'testuser',
                password: 'wrongpass',
            })
            api.addRequestInterceptor(auth.interceptor)

            const response = await api.get('/basic-auth/testuser/testpass')

            assertResponse(response).toHaveStatus(401).toBeClientError()
        })

        it('should add Authorization header correctly', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = basicAuth({
                username: 'myuser',
                password: 'mypass',
            })
            api.addRequestInterceptor(auth.interceptor)

            // Check the headers endpoint to verify auth header
            const response = await api.get<{ headers: Record<string, string> }>('/headers')

            assertResponse(response).toBeOk()

            // Basic auth header should be: Basic base64(username:password)
            const expectedAuth = 'Basic ' + Buffer.from('myuser:mypass').toString('base64')
            expect(response.data.headers['Authorization']).to.equal(expectedAuth)
        })
    })

    describe('Excluding Paths', () => {
        it('should exclude specified paths from authentication', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = basicAuth({
                username: 'testuser',
                password: 'testpass',
                excludePaths: ['/get', '/headers'],
            })
            api.addRequestInterceptor(auth.interceptor)

            // Request to excluded path should NOT have auth header
            const response = await api.get<{ headers: Record<string, string> }>('/headers')

            assertResponse(response).toBeOk()
            expect(response.data.headers['Authorization']).to.be.undefined
        })

        it('should include auth on non-excluded paths', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = basicAuth({
                username: 'testuser',
                password: 'testpass',
                excludePaths: ['/public'],
            })
            api.addRequestInterceptor(auth.interceptor)

            // Request to /basic-auth should have auth header
            const response = await api.get<{ authenticated: boolean }>('/basic-auth/testuser/testpass')

            assertResponse(response).toBeOk().toHaveBodyProperty('authenticated', true)
        })

        it('should support wildcard path exclusion', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = basicAuth({
                username: 'testuser',
                password: 'testpass',
                excludePaths: ['/status/*'],
            })
            api.addRequestInterceptor(auth.interceptor)

            // Request to /status/200 (matches /status/*) should NOT have auth
            const response = await api.get('/status/200')
            assertResponse(response).toBeOk()
        })
    })

    describe('Multiple Requests', () => {
        it('should maintain auth across multiple requests', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = basicAuth({
                username: 'testuser',
                password: 'testpass',
            })
            api.addRequestInterceptor(auth.interceptor)

            // First request
            const response1 = await api.get<{ authenticated: boolean }>('/basic-auth/testuser/testpass')
            assertResponse(response1).toBeOk().toHaveBodyProperty('authenticated', true)

            // Second request
            const response2 = await api.get<{ authenticated: boolean }>('/basic-auth/testuser/testpass')
            assertResponse(response2).toBeOk().toHaveBodyProperty('authenticated', true)
        })
    })
})
