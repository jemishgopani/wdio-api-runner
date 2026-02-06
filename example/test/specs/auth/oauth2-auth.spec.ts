import { createApiClient, oauth2ClientCredentials, assertResponse } from 'wdio-api-runner'
import { expect } from 'chai'

/**
 * OAuth2 Client Credentials Authentication Examples
 *
 * These tests demonstrate how to use the oauth2ClientCredentials auth helper
 * for machine-to-machine authentication flows.
 *
 * Note: For real-world testing, you would need an OAuth2 authorization server.
 * These examples show the API patterns and test scenarios.
 */
describe('Authentication - OAuth2 Client Credentials', () => {
    describe('Configuration Patterns', () => {
        it('should demonstrate basic OAuth2 configuration', async () => {
            // Example configuration for OAuth2 client credentials flow
            // In a real scenario, you would use actual OAuth2 server credentials
            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://httpbin.org/post', // Mock endpoint (would be real OAuth2 server)
                clientId: 'my-client-id',
                clientSecret: 'my-client-secret',
            })

            // The auth object provides these methods:
            expect(auth.interceptor).to.be.a('function')
            expect(auth.forceRefresh).to.be.a('function')
            expect(auth.clearTokens).to.be.a('function')
            expect(auth.setToken).to.be.a('function')
            expect(auth.getToken).to.be.a('function')
        })

        it('should demonstrate OAuth2 configuration with scopes', async () => {
            // Configuration with scopes for fine-grained access control
            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'my-client-id',
                clientSecret: 'my-client-secret',
                scope: 'read:users write:users admin',
            })

            expect(auth.interceptor).to.be.a('function')
        })

        it('should demonstrate OAuth2 configuration with audience', async () => {
            // Configuration with audience (common with Auth0, etc.)
            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'my-client-id',
                clientSecret: 'my-client-secret',
                scope: 'read:api',
                audience: 'https://api.example.com',
            })

            expect(auth.interceptor).to.be.a('function')
        })

        it('should demonstrate OAuth2 configuration with custom refresh buffer', async () => {
            // Refresh token 5 minutes before expiry (default is 60 seconds)
            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'my-client-id',
                clientSecret: 'my-client-secret',
                refreshBuffer: 300, // 5 minutes in seconds
            })

            expect(auth.interceptor).to.be.a('function')
        })

        it('should demonstrate OAuth2 configuration with token refresh callback', async () => {
            let refreshCallCount = 0
            let lastToken: unknown = null

            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'my-client-id',
                clientSecret: 'my-client-secret',
                onTokenRefresh: (token) => {
                    refreshCallCount++
                    lastToken = token
                    // You could log, store in external cache, etc.
                },
            })

            expect(auth.interceptor).to.be.a('function')
        })

        it('should demonstrate OAuth2 configuration with extra parameters', async () => {
            // Some OAuth2 servers require additional parameters
            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'my-client-id',
                clientSecret: 'my-client-secret',
                extraParams: {
                    resource: 'https://api.example.com',
                    tenant: 'my-tenant-id',
                },
            })

            expect(auth.interceptor).to.be.a('function')
        })

        it('should demonstrate OAuth2 configuration with path exclusion', async () => {
            // Don't add auth to certain paths (e.g., health checks)
            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'my-client-id',
                clientSecret: 'my-client-secret',
                excludePaths: ['/health', '/ready', '/public/*'],
            })

            expect(auth.interceptor).to.be.a('function')
        })

        it('should demonstrate OAuth2 configuration with auto-refresh disabled', async () => {
            // Disable auto-refresh for testing expired token scenarios
            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'my-client-id',
                clientSecret: 'my-client-secret',
                disableAutoRefresh: true,
            })

            expect(auth.interceptor).to.be.a('function')
        })
    })

    describe('Token Management', () => {
        it('should set and get token manually', async () => {
            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'my-client-id',
                clientSecret: 'my-client-secret',
                disableAutoRefresh: true,
            })

            // Initially no token
            expect(auth.getToken()).to.be.null

            // Set a token manually (useful for testing)
            auth.setToken('my-manual-access-token')

            // Token is now set
            expect(auth.getToken()).to.equal('my-manual-access-token')
        })

        it('should clear tokens', async () => {
            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'my-client-id',
                clientSecret: 'my-client-secret',
                disableAutoRefresh: true,
            })

            // Set a token
            auth.setToken('my-access-token')
            expect(auth.getToken()).to.equal('my-access-token')

            // Clear tokens
            await auth.clearTokens()
            expect(auth.getToken()).to.be.null
        })
    })

    describe('Integration with API Client', () => {
        it('should demonstrate adding OAuth2 interceptor to API client', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            // Create OAuth2 auth with a pre-set token (simulating already authenticated)
            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'my-client-id',
                clientSecret: 'my-client-secret',
                disableAutoRefresh: true, // Don't try to refresh
            })

            // Pre-set a token to avoid calling the mock token URL
            auth.setToken('simulated-access-token-12345')

            // Add the interceptor
            api.addRequestInterceptor(auth.interceptor)

            // Make a request - the Authorization header should be added
            const response = await api.get<{ headers: Record<string, string> }>('/headers')

            assertResponse(response).toBeOk()

            // Verify the Bearer token was added
            expect(response.data.headers['Authorization']).to.equal('Bearer simulated-access-token-12345')
        })

        it('should exclude specified paths from authentication', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'my-client-id',
                clientSecret: 'my-client-secret',
                disableAutoRefresh: true,
                excludePaths: ['/get'], // Exclude /get from auth
            })

            auth.setToken('my-access-token')
            api.addRequestInterceptor(auth.interceptor)

            // Request to excluded path - should NOT have auth header
            const excludedResponse = await api.get<{ headers: Record<string, string> }>('/get')
            assertResponse(excludedResponse).toBeOk()
            expect(excludedResponse.data.headers['Authorization']).to.be.undefined

            // Request to non-excluded path - should have auth header
            const includedResponse = await api.get<{ headers: Record<string, string> }>('/headers')
            assertResponse(includedResponse).toBeOk()
            expect(includedResponse.data.headers['Authorization']).to.equal('Bearer my-access-token')
        })
    })

    describe('Testing Patterns', () => {
        it('should demonstrate testing with manually set tokens', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'client',
                clientSecret: 'secret',
                disableAutoRefresh: true,
            })

            api.addRequestInterceptor(auth.interceptor)

            // Test 1: Set a valid token
            auth.setToken('valid-token-for-testing')
            const response1 = await api.get<{ headers: Record<string, string> }>('/headers')
            expect(response1.data.headers['Authorization']).to.equal('Bearer valid-token-for-testing')

            // Test 2: Update the token (simulating token refresh)
            auth.setToken('refreshed-token')
            const response2 = await api.get<{ headers: Record<string, string> }>('/headers')
            expect(response2.data.headers['Authorization']).to.equal('Bearer refreshed-token')

            // Test 3: Clear token and set a new one
            await auth.clearTokens()
            auth.setToken('another-token')
            const response3 = await api.get<{ headers: Record<string, string> }>('/headers')
            expect(response3.data.headers['Authorization']).to.equal('Bearer another-token')
        })

        it('should demonstrate simulating expired token scenario', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'client',
                clientSecret: 'secret',
                disableAutoRefresh: true, // Important: don't auto-refresh
            })

            api.addRequestInterceptor(auth.interceptor)

            // Simulate having a valid token initially
            auth.setToken('valid-token')
            let response = await api.get<{ headers: Record<string, string> }>('/headers')
            expect(response.data.headers['Authorization']).to.equal('Bearer valid-token')

            // Now simulate token becoming "expired" by setting an expired token
            // In a real scenario with a protected API, this would return 401
            auth.setToken('expired-token-xyz')
            response = await api.get<{ headers: Record<string, string> }>('/headers')
            expect(response.data.headers['Authorization']).to.equal('Bearer expired-token-xyz')
        })
    })

    describe('Real-world OAuth2 Flow Example', () => {
        it('should demonstrate complete OAuth2 flow pattern', async () => {
            /**
             * This example shows the recommended pattern for using OAuth2 in tests.
             *
             * In a real scenario:
             * 1. The auth interceptor automatically fetches a token on first request
             * 2. It caches the token and reuses it for subsequent requests
             * 3. It automatically refreshes before expiry (unless disabled)
             */

            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            // For testing, we use disableAutoRefresh and setToken
            // In production, you'd use actual credentials
            const auth = oauth2ClientCredentials({
                // Production config would look like:
                // tokenUrl: process.env.OAUTH_TOKEN_URL!,
                // clientId: process.env.OAUTH_CLIENT_ID!,
                // clientSecret: process.env.OAUTH_CLIENT_SECRET!,
                // scope: 'read:api write:api',

                // Test config:
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'test-client',
                clientSecret: 'test-secret',
                disableAutoRefresh: true,
            })

            api.addRequestInterceptor(auth.interceptor)

            // Simulate the token that would be returned by OAuth2 server
            auth.setToken('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test-payload')

            // All requests now include the Bearer token
            const users = await api.get<{ headers: Record<string, string> }>('/headers')
            assertResponse(users).toBeOk()
            expect(users.data.headers['Authorization']).to.include('Bearer')

            // Multiple requests reuse the same token
            const posts = await api.get<{ headers: Record<string, string> }>('/headers')
            assertResponse(posts).toBeOk()
            expect(posts.data.headers['Authorization']).to.include('Bearer')
        })
    })
})
