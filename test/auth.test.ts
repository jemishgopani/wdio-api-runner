import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    basicAuth,
    apiKeyAuth,
    bearerAuth,
    oauth2ClientCredentials,
    MemoryStorage,
    parseJwtExpiry,
    shouldExclude,
    encodeBasicAuth,
    isTokenExpired,
    mergeHeaders,
} from '../src/auth/index.js'

describe('auth helpers', () => {
    describe('utilities', () => {
        describe('parseJwtExpiry', () => {
            it('should parse expiry from valid JWT', () => {
                // JWT with exp: 1700000000 (Nov 14, 2023)
                const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64')
                const payload = Buffer.from(JSON.stringify({ sub: '123', exp: 1700000000 })).toString('base64')
                const signature = 'test-signature'
                const token = `${header}.${payload}.${signature}`

                const expiry = parseJwtExpiry(token)

                expect(expiry).toBe(1700000000 * 1000) // In milliseconds
            })

            it('should return null for JWT without exp claim', () => {
                const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64')
                const payload = Buffer.from(JSON.stringify({ sub: '123' })).toString('base64')
                const token = `${header}.${payload}.signature`

                expect(parseJwtExpiry(token)).toBeNull()
            })

            it('should return null for invalid JWT format', () => {
                expect(parseJwtExpiry('not-a-jwt')).toBeNull()
                expect(parseJwtExpiry('only.two')).toBeNull()
                expect(parseJwtExpiry('')).toBeNull()
            })

            it('should return null for invalid base64 payload', () => {
                expect(parseJwtExpiry('header.!!!invalid!!!.signature')).toBeNull()
            })

            it('should handle URL-safe base64 encoding', () => {
                // Use URL-safe characters
                const payload = Buffer.from(JSON.stringify({ exp: 1700000000 }))
                    .toString('base64')
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                const token = `header.${payload}.signature`

                expect(parseJwtExpiry(token)).toBe(1700000000 * 1000)
            })
        })

        describe('shouldExclude', () => {
            it('should return false when no exclude paths', () => {
                expect(shouldExclude('/api/users', undefined)).toBe(false)
                expect(shouldExclude('/api/users', [])).toBe(false)
            })

            it('should match string patterns', () => {
                const excludePaths = ['/health', '/public']

                expect(shouldExclude('/api/health', excludePaths)).toBe(true)
                expect(shouldExclude('/public/assets', excludePaths)).toBe(true)
                expect(shouldExclude('/api/users', excludePaths)).toBe(false)
            })

            it('should match regex patterns', () => {
                const excludePaths = [/^\/api\/v1\/docs/, /\.json$/]

                expect(shouldExclude('/api/v1/docs/swagger', excludePaths)).toBe(true)
                expect(shouldExclude('/config.json', excludePaths)).toBe(true)
                expect(shouldExclude('/api/users', excludePaths)).toBe(false)
            })

            it('should match mixed string and regex patterns', () => {
                const excludePaths = ['/health', /^\/public/]

                expect(shouldExclude('/health', excludePaths)).toBe(true)
                expect(shouldExclude('/public/images', excludePaths)).toBe(true)
                expect(shouldExclude('/api/users', excludePaths)).toBe(false)
            })
        })

        describe('encodeBasicAuth', () => {
            it('should encode credentials correctly', () => {
                expect(encodeBasicAuth('user', 'pass')).toBe(Buffer.from('user:pass').toString('base64'))
                expect(encodeBasicAuth('admin', 'secret123')).toBe(Buffer.from('admin:secret123').toString('base64'))
            })

            it('should handle special characters', () => {
                expect(encodeBasicAuth('user@domain.com', 'p@ss:word!')).toBe(
                    Buffer.from('user@domain.com:p@ss:word!').toString('base64')
                )
            })
        })

        describe('isTokenExpired', () => {
            it('should return false when expiry is null', () => {
                expect(isTokenExpired(null)).toBe(false)
            })

            it('should return true when token is expired', () => {
                const pastExpiry = Date.now() - 60000 // 1 minute ago
                expect(isTokenExpired(pastExpiry)).toBe(true)
            })

            it('should return false when token is not expired', () => {
                const futureExpiry = Date.now() + 3600000 // 1 hour from now
                expect(isTokenExpired(futureExpiry)).toBe(false)
            })

            it('should respect buffer time', () => {
                const expiryIn30Seconds = Date.now() + 30000

                // With 60 second buffer, should be considered expired
                expect(isTokenExpired(expiryIn30Seconds, 60)).toBe(true)

                // With 10 second buffer, should not be expired
                expect(isTokenExpired(expiryIn30Seconds, 10)).toBe(false)
            })
        })

        describe('mergeHeaders', () => {
            it('should merge plain object headers', () => {
                const existing = { 'Content-Type': 'application/json' }
                const newHeaders = { Authorization: 'Bearer token' }

                const result = mergeHeaders(existing, newHeaders)

                expect(result).toEqual({
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer token',
                })
            })

            it('should merge Headers instance', () => {
                const existing = new Headers({ 'Content-Type': 'application/json' })
                const newHeaders = { Authorization: 'Bearer token' }

                const result = mergeHeaders(existing, newHeaders)

                expect(result['content-type']).toBe('application/json')
                expect(result['Authorization']).toBe('Bearer token')
            })

            it('should merge array headers', () => {
                const existing: [string, string][] = [['Content-Type', 'application/json']]
                const newHeaders = { Authorization: 'Bearer token' }

                const result = mergeHeaders(existing, newHeaders)

                expect(result).toEqual({
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer token',
                })
            })

            it('should handle undefined existing headers', () => {
                const result = mergeHeaders(undefined, { Authorization: 'Bearer token' })

                expect(result).toEqual({ Authorization: 'Bearer token' })
            })

            it('should override existing headers with new ones', () => {
                const existing = { Authorization: 'old-token' }
                const newHeaders = { Authorization: 'new-token' }

                const result = mergeHeaders(existing, newHeaders)

                expect(result['Authorization']).toBe('new-token')
            })
        })
    })

    describe('MemoryStorage', () => {
        let storage: MemoryStorage

        beforeEach(() => {
            storage = new MemoryStorage()
        })

        it('should store and retrieve values', async () => {
            await storage.set('key1', 'value1')
            expect(await storage.get('key1')).toBe('value1')
        })

        it('should return null for non-existent keys', async () => {
            expect(await storage.get('nonexistent')).toBeNull()
        })

        it('should remove values', async () => {
            await storage.set('key1', 'value1')
            await storage.remove('key1')
            expect(await storage.get('key1')).toBeNull()
        })

        it('should clear all values', async () => {
            await storage.set('key1', 'value1')
            await storage.set('key2', 'value2')
            await storage.clear()

            expect(await storage.get('key1')).toBeNull()
            expect(await storage.get('key2')).toBeNull()
            expect(storage.size).toBe(0)
        })

        it('should return null for expired values', async () => {
            const pastExpiry = Date.now() - 1000
            await storage.set('key1', 'value1', pastExpiry)

            expect(await storage.get('key1')).toBeNull()
        })

        it('should return values that have not expired', async () => {
            const futureExpiry = Date.now() + 60000
            await storage.set('key1', 'value1', futureExpiry)

            expect(await storage.get('key1')).toBe('value1')
        })

        it('should track size correctly', async () => {
            expect(storage.size).toBe(0)

            await storage.set('key1', 'value1')
            expect(storage.size).toBe(1)

            await storage.set('key2', 'value2')
            expect(storage.size).toBe(2)

            await storage.remove('key1')
            expect(storage.size).toBe(1)
        })

        it('should check if key exists', async () => {
            await storage.set('key1', 'value1')

            expect(storage.has('key1')).toBe(true)
            expect(storage.has('nonexistent')).toBe(false)
        })
    })

    describe('basicAuth', () => {
        it('should add Authorization header', () => {
            const auth = basicAuth({
                username: 'testuser',
                password: 'testpass',
            })

            const result = auth.interceptor('https://api.example.com/users', {})

            expect(result.headers).toEqual({
                Authorization: `Basic ${Buffer.from('testuser:testpass').toString('base64')}`,
            })
        })

        it('should merge with existing headers', () => {
            const auth = basicAuth({
                username: 'user',
                password: 'pass',
            })

            const result = auth.interceptor('https://api.example.com/users', {
                headers: { 'Content-Type': 'application/json' },
            })

            expect(result.headers).toEqual({
                'Content-Type': 'application/json',
                Authorization: expect.stringMatching(/^Basic /),
            })
        })

        it('should skip auth for excluded paths', () => {
            const auth = basicAuth({
                username: 'user',
                password: 'pass',
                excludePaths: ['/health', '/public'],
            })

            const result = auth.interceptor('https://api.example.com/health', {})

            expect(result.headers).toBeUndefined()
        })

        it('should preserve other request options', () => {
            const auth = basicAuth({
                username: 'user',
                password: 'pass',
            })

            const result = auth.interceptor('https://api.example.com/users', {
                method: 'POST',
                body: JSON.stringify({ name: 'test' }),
            })

            expect(result.method).toBe('POST')
            expect(result.body).toBe(JSON.stringify({ name: 'test' }))
        })
    })

    describe('apiKeyAuth', () => {
        describe('header placement', () => {
            it('should add API key to header with default name', () => {
                const auth = apiKeyAuth({
                    value: 'my-api-key',
                    in: 'header',
                })

                const result = auth.interceptor('https://api.example.com/users', {})

                expect(result.headers).toEqual({
                    'X-API-Key': 'my-api-key',
                })
            })

            it('should add API key to header with custom name', () => {
                const auth = apiKeyAuth({
                    value: 'my-api-key',
                    in: 'header',
                    name: 'X-Custom-Key',
                })

                const result = auth.interceptor('https://api.example.com/users', {})

                expect(result.headers).toEqual({
                    'X-Custom-Key': 'my-api-key',
                })
            })
        })

        describe('query placement', () => {
            it('should add API key as query parameter to URL', () => {
                const auth = apiKeyAuth({
                    value: 'my-api-key',
                    in: 'query',
                    name: 'api_key',
                })

                const result = auth.interceptor('https://api.example.com/users', {})

                // Query placement modifies the URL
                expect(result.url).toBe('https://api.example.com/users?api_key=my-api-key')
            })

            it('should append to existing query parameters', () => {
                const auth = apiKeyAuth({
                    value: 'my-api-key',
                    in: 'query',
                    name: 'api_key',
                })

                const result = auth.interceptor('https://api.example.com/users?page=1', {})

                expect(result.url).toBe('https://api.example.com/users?page=1&api_key=my-api-key')
            })

            it('should handle relative URLs', () => {
                const auth = apiKeyAuth({
                    value: 'my-api-key',
                    in: 'query',
                    name: 'api_key',
                })

                const result = auth.interceptor('/api/users', {})

                expect(result.url).toBe('/api/users?api_key=my-api-key')
            })

            it('should use default param name', () => {
                const auth = apiKeyAuth({
                    value: 'my-api-key',
                    in: 'query',
                })

                const result = auth.interceptor('https://api.example.com/users', {})

                expect(result.url).toBe('https://api.example.com/users?api_key=my-api-key')
            })
        })

        describe('cookie placement', () => {
            it('should add API key as cookie', () => {
                const auth = apiKeyAuth({
                    value: 'my-api-key',
                    in: 'cookie',
                    name: 'session_token',
                })

                const result = auth.interceptor('https://api.example.com/users', {})

                expect(result.headers).toEqual({
                    Cookie: 'session_token=my-api-key',
                })
            })

            it('should append to existing cookies', () => {
                const auth = apiKeyAuth({
                    value: 'my-api-key',
                    in: 'cookie',
                    name: 'api_key',
                })

                const result = auth.interceptor('https://api.example.com/users', {
                    headers: { Cookie: 'existing=value' },
                })

                expect(result.headers).toEqual({
                    Cookie: 'existing=value; api_key=my-api-key',
                })
            })
        })

        it('should skip auth for excluded paths', () => {
            const auth = apiKeyAuth({
                value: 'key',
                in: 'header',
                excludePaths: ['/public'],
            })

            const result = auth.interceptor('https://api.example.com/public/docs', {})

            expect(result.headers).toBeUndefined()
        })
    })

    describe('bearerAuth', () => {
        it('should add Bearer token with static token', async () => {
            const auth = bearerAuth({
                token: 'my-jwt-token',
            })

            const result = await auth.interceptor('https://api.example.com/users', {})

            expect(result.headers).toEqual({
                Authorization: 'Bearer my-jwt-token',
            })
        })

        it('should support dynamic token function', async () => {
            let tokenValue = 'initial-token'
            const auth = bearerAuth({
                token: () => tokenValue,
            })

            let result = await auth.interceptor('https://api.example.com/users', {})
            expect(result.headers).toEqual({
                Authorization: 'Bearer initial-token',
            })

            // Change the token
            tokenValue = 'updated-token'
            auth.clearTokens?.()

            result = await auth.interceptor('https://api.example.com/users', {})
            expect(result.headers).toEqual({
                Authorization: 'Bearer updated-token',
            })
        })

        it('should support async token function', async () => {
            const auth = bearerAuth({
                token: async () => {
                    await new Promise((resolve) => setTimeout(resolve, 10))
                    return 'async-token'
                },
            })

            const result = await auth.interceptor('https://api.example.com/users', {})

            expect(result.headers).toEqual({
                Authorization: 'Bearer async-token',
            })
        })

        it('should use custom header name and prefix', async () => {
            const auth = bearerAuth({
                token: 'my-token',
                headerName: 'X-Auth-Token',
                prefix: 'Token',
            })

            const result = await auth.interceptor('https://api.example.com/users', {})

            expect(result.headers).toEqual({
                'X-Auth-Token': 'Token my-token',
            })
        })

        it('should skip auth for excluded paths', async () => {
            const auth = bearerAuth({
                token: 'my-token',
                excludePaths: ['/health'],
            })

            const result = await auth.interceptor('https://api.example.com/health', {})

            expect(result.headers).toBeUndefined()
        })

        describe('token management', () => {
            it('should allow setting token manually', async () => {
                const auth = bearerAuth({
                    token: 'original-token',
                })

                // Get initial token
                await auth.interceptor('https://api.example.com/users', {})
                expect(auth.getToken?.()).toBe('original-token')

                // Set new token
                auth.setToken?.('new-token')
                expect(auth.getToken?.()).toBe('new-token')

                const result = await auth.interceptor('https://api.example.com/users', {})
                expect(result.headers).toEqual({
                    Authorization: 'Bearer new-token',
                })
            })

            it('should allow clearing tokens', async () => {
                const auth = bearerAuth({
                    token: 'my-token',
                })

                await auth.interceptor('https://api.example.com/users', {})
                expect(auth.getToken?.()).toBe('my-token')

                await auth.clearTokens?.()
                expect(auth.getToken?.()).toBeNull()
            })
        })

        describe('auto-refresh', () => {
            it('should auto-refresh when token is about to expire', async () => {
                const refreshFn = vi.fn().mockResolvedValue('refreshed-token')

                // Create token that expires in 30 seconds
                const exp = Math.floor(Date.now() / 1000) + 30
                const payload = Buffer.from(JSON.stringify({ exp })).toString('base64')
                const expiringToken = `header.${payload}.signature`

                const auth = bearerAuth({
                    token: expiringToken,
                    refresh: refreshFn,
                    refreshBuffer: 60, // 60 seconds buffer
                })

                // First request should trigger refresh because token expires in 30s < 60s buffer
                await auth.interceptor('https://api.example.com/users', {})

                expect(refreshFn).toHaveBeenCalledTimes(1)
                expect(auth.getToken?.()).toBe('refreshed-token')
            })

            it('should not auto-refresh when disableAutoRefresh is true', async () => {
                const refreshFn = vi.fn().mockResolvedValue('refreshed-token')

                // Create token that expires in 30 seconds
                const exp = Math.floor(Date.now() / 1000) + 30
                const payload = Buffer.from(JSON.stringify({ exp })).toString('base64')
                const expiringToken = `header.${payload}.signature`

                const auth = bearerAuth({
                    token: expiringToken,
                    refresh: refreshFn,
                    refreshBuffer: 60,
                    disableAutoRefresh: true,
                })

                await auth.interceptor('https://api.example.com/users', {})

                expect(refreshFn).not.toHaveBeenCalled()
                expect(auth.getToken?.()).toBe(expiringToken)
            })

            it('should call onRefresh callback when token is refreshed', async () => {
                const onRefresh = vi.fn()
                const refreshFn = vi.fn().mockResolvedValue('new-token')

                const exp = Math.floor(Date.now() / 1000) + 10
                const payload = Buffer.from(JSON.stringify({ exp })).toString('base64')
                const expiringToken = `header.${payload}.signature`

                const auth = bearerAuth({
                    token: expiringToken,
                    refresh: refreshFn,
                    refreshBuffer: 60,
                    onRefresh,
                })

                await auth.interceptor('https://api.example.com/users', {})

                expect(onRefresh).toHaveBeenCalledWith('new-token')
            })

            it('should force refresh when forceRefresh is called', async () => {
                const refreshFn = vi.fn().mockResolvedValue('force-refreshed')

                const auth = bearerAuth({
                    token: 'original-token',
                    refresh: refreshFn,
                })

                // Initialize token
                await auth.interceptor('https://api.example.com/users', {})
                expect(auth.getToken?.()).toBe('original-token')

                // Force refresh
                await auth.forceRefresh?.()

                expect(refreshFn).toHaveBeenCalledTimes(1)
                expect(auth.getToken?.()).toBe('force-refreshed')
            })

            it('should throw error when forceRefresh is called without refresh function', async () => {
                const auth = bearerAuth({
                    token: 'my-token',
                })

                await expect(auth.forceRefresh?.()).rejects.toThrow('No refresh function configured')
            })
        })

        describe('negative testing scenarios', () => {
            it('should allow testing with expired token', async () => {
                // Create an expired token
                const exp = Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
                const payload = Buffer.from(JSON.stringify({ exp })).toString('base64')
                const expiredToken = `header.${payload}.signature`

                const auth = bearerAuth({
                    token: 'valid-token',
                    disableAutoRefresh: true,
                })

                // Initialize
                await auth.interceptor('https://api.example.com/users', {})

                // Inject expired token for testing
                auth.setToken?.(expiredToken)

                const result = await auth.interceptor('https://api.example.com/users', {})

                // The expired token should be used (for negative testing)
                expect(result.headers).toEqual({
                    Authorization: `Bearer ${expiredToken}`,
                })
            })

            it('should allow testing with invalid/malformed token', async () => {
                const auth = bearerAuth({
                    token: 'valid-token',
                    disableAutoRefresh: true,
                })

                await auth.interceptor('https://api.example.com/users', {})

                // Inject malformed token
                auth.setToken?.('not-a-valid-jwt')

                const result = await auth.interceptor('https://api.example.com/users', {})

                expect(result.headers).toEqual({
                    Authorization: 'Bearer not-a-valid-jwt',
                })
            })
        })
    })

    describe('oauth2ClientCredentials', () => {
        let fetchSpy: ReturnType<typeof vi.spyOn>

        beforeEach(() => {
            fetchSpy = vi.spyOn(global, 'fetch')
        })

        afterEach(() => {
            fetchSpy.mockRestore()
        })

        it('should fetch token from token URL', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        access_token: 'oauth-access-token',
                        token_type: 'Bearer',
                        expires_in: 3600,
                    }),
            } as Response)

            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'my-client',
                clientSecret: 'my-secret',
            })

            const result = await auth.interceptor('https://api.example.com/users', {})

            expect(fetchSpy).toHaveBeenCalledWith(
                'https://auth.example.com/oauth/token',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                })
            )

            expect(result.headers).toEqual({
                Authorization: 'Bearer oauth-access-token',
            })
        })

        it('should include scope and audience in token request', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        access_token: 'token',
                        token_type: 'Bearer',
                    }),
            } as Response)

            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'client',
                clientSecret: 'secret',
                scope: 'read write',
                audience: 'https://api.example.com',
            })

            await auth.interceptor('https://api.example.com/users', {})

            const callBody = fetchSpy.mock.calls[0][1]?.body as string
            expect(callBody).toContain('scope=read+write')
            expect(callBody).toContain('audience=https')
        })

        it('should include extra params in token request', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        access_token: 'token',
                        token_type: 'Bearer',
                    }),
            } as Response)

            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'client',
                clientSecret: 'secret',
                extraParams: {
                    custom_param: 'custom_value',
                },
            })

            await auth.interceptor('https://api.example.com/users', {})

            const callBody = fetchSpy.mock.calls[0][1]?.body as string
            expect(callBody).toContain('custom_param=custom_value')
        })

        it('should throw error on token fetch failure', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                text: () => Promise.resolve('Invalid credentials'),
            } as Response)

            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'bad-client',
                clientSecret: 'bad-secret',
            })

            await expect(auth.interceptor('https://api.example.com/users', {})).rejects.toThrow(
                'OAuth2 token request failed: 401 Unauthorized'
            )
        })

        it('should skip auth for excluded paths', async () => {
            const auth = oauth2ClientCredentials({
                tokenUrl: 'https://auth.example.com/oauth/token',
                clientId: 'client',
                clientSecret: 'secret',
                excludePaths: ['/health'],
            })

            const result = await auth.interceptor('https://api.example.com/health', {})

            expect(fetchSpy).not.toHaveBeenCalled()
            expect(result.headers).toBeUndefined()
        })

        describe('token management', () => {
            it('should allow setting token manually', async () => {
                fetchSpy.mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            access_token: 'original',
                            token_type: 'Bearer',
                        }),
                } as Response)

                const auth = oauth2ClientCredentials({
                    tokenUrl: 'https://auth.example.com/oauth/token',
                    clientId: 'client',
                    clientSecret: 'secret',
                })

                // Get initial token
                await auth.interceptor('https://api.example.com/users', {})
                expect(auth.getToken?.()).toBe('original')

                // Set custom token
                auth.setToken?.('custom-token')
                expect(auth.getToken?.()).toBe('custom-token')
            })

            it('should allow clearing tokens', async () => {
                fetchSpy.mockResolvedValue({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            access_token: 'token',
                            token_type: 'Bearer',
                        }),
                } as Response)

                const auth = oauth2ClientCredentials({
                    tokenUrl: 'https://auth.example.com/oauth/token',
                    clientId: 'client',
                    clientSecret: 'secret',
                })

                await auth.interceptor('https://api.example.com/users', {})
                expect(auth.getToken?.()).toBe('token')

                await auth.clearTokens?.()
                expect(auth.getToken?.()).toBeNull()

                // Next request should fetch a new token
                await auth.interceptor('https://api.example.com/users', {})
                expect(fetchSpy).toHaveBeenCalledTimes(2)
            })

            it('should force refresh when forceRefresh is called', async () => {
                fetchSpy.mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            access_token: 'first-token',
                            token_type: 'Bearer',
                        }),
                } as Response)
                fetchSpy.mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            access_token: 'second-token',
                            token_type: 'Bearer',
                        }),
                } as Response)

                const auth = oauth2ClientCredentials({
                    tokenUrl: 'https://auth.example.com/oauth/token',
                    clientId: 'client',
                    clientSecret: 'secret',
                })

                await auth.interceptor('https://api.example.com/users', {})
                expect(auth.getToken?.()).toBe('first-token')

                await auth.forceRefresh?.()
                expect(auth.getToken?.()).toBe('second-token')
                expect(fetchSpy).toHaveBeenCalledTimes(2)
            })
        })

        describe('auto-refresh', () => {
            it('should auto-refresh when token is about to expire', async () => {
                fetchSpy.mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            access_token: 'first-token',
                            token_type: 'Bearer',
                            expires_in: 30, // 30 seconds
                        }),
                } as Response)
                fetchSpy.mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            access_token: 'refreshed-token',
                            token_type: 'Bearer',
                            expires_in: 3600,
                        }),
                } as Response)

                const auth = oauth2ClientCredentials({
                    tokenUrl: 'https://auth.example.com/oauth/token',
                    clientId: 'client',
                    clientSecret: 'secret',
                    refreshBuffer: 60, // 60 second buffer
                })

                // First request gets token that expires in 30s
                await auth.interceptor('https://api.example.com/users', {})
                expect(auth.getToken?.()).toBe('first-token')

                // Second request should trigger refresh because 30s < 60s buffer
                await auth.interceptor('https://api.example.com/users', {})
                expect(auth.getToken?.()).toBe('refreshed-token')
                expect(fetchSpy).toHaveBeenCalledTimes(2)
            })

            it('should not auto-refresh when disableAutoRefresh is true', async () => {
                fetchSpy.mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            access_token: 'first-token',
                            token_type: 'Bearer',
                            expires_in: 30,
                        }),
                } as Response)

                const auth = oauth2ClientCredentials({
                    tokenUrl: 'https://auth.example.com/oauth/token',
                    clientId: 'client',
                    clientSecret: 'secret',
                    refreshBuffer: 60,
                    disableAutoRefresh: true,
                })

                await auth.interceptor('https://api.example.com/users', {})
                await auth.interceptor('https://api.example.com/users', {})

                // Should still be first token, no refresh
                expect(auth.getToken?.()).toBe('first-token')
                expect(fetchSpy).toHaveBeenCalledTimes(1)
            })

            it('should call onTokenRefresh callback', async () => {
                const onTokenRefresh = vi.fn()

                fetchSpy.mockResolvedValue({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            access_token: 'token',
                            token_type: 'Bearer',
                            expires_in: 3600,
                        }),
                } as Response)

                const auth = oauth2ClientCredentials({
                    tokenUrl: 'https://auth.example.com/oauth/token',
                    clientId: 'client',
                    clientSecret: 'secret',
                    onTokenRefresh,
                })

                await auth.interceptor('https://api.example.com/users', {})

                expect(onTokenRefresh).toHaveBeenCalledWith(
                    expect.objectContaining({
                        access_token: 'token',
                        token_type: 'Bearer',
                    })
                )
            })
        })

        describe('negative testing scenarios', () => {
            it('should allow testing with invalid token', async () => {
                fetchSpy.mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            access_token: 'valid-token',
                            token_type: 'Bearer',
                        }),
                } as Response)

                const auth = oauth2ClientCredentials({
                    tokenUrl: 'https://auth.example.com/oauth/token',
                    clientId: 'client',
                    clientSecret: 'secret',
                    disableAutoRefresh: true,
                })

                await auth.interceptor('https://api.example.com/users', {})

                // Inject invalid token for negative testing
                auth.setToken?.('invalid-or-revoked-token')

                const result = await auth.interceptor('https://api.example.com/users', {})

                expect(result.headers).toEqual({
                    Authorization: 'Bearer invalid-or-revoked-token',
                })
            })
        })
    })
})
