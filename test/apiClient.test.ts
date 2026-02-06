import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApiClient } from '../src/client/ApiClient.js'
import type { ApiClient } from '../src/shared/types.js'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock logger
vi.mock('@wdio/logger', () => ({
    default: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}))

describe('apiClient', () => {
    let client: ApiClient
    const mockConfig: WebdriverIO.Config = {
        baseUrl: 'https://api.example.com',
    }

    beforeEach(() => {
        vi.clearAllMocks()
        delete process.env.WDIO_API_OPTIONS
        client = createApiClient(mockConfig)
    })

    afterEach(() => {
        vi.resetAllMocks()
    })

    describe('createApiClient', () => {
        it('should create client with baseUrl from config', () => {
            expect(client.getBaseUrl()).toBe('https://api.example.com')
        })

        it('should create client with baseUrl from environment', () => {
            process.env.WDIO_API_OPTIONS = JSON.stringify({ baseUrl: 'https://env.api.com' })
            const envClient = createApiClient(mockConfig)
            expect(envClient.getBaseUrl()).toBe('https://env.api.com')
        })

        it('should create client with apiRunner config', () => {
            const configWithApiRunner: WebdriverIO.Config = {
                baseUrl: 'https://api.example.com',
                apiRunner: {
                    baseUrl: 'https://apirunner.example.com',
                    headers: { 'X-Custom': 'header' },
                },
            }
            const customClient = createApiClient(configWithApiRunner)
            expect(customClient.getBaseUrl()).toBe('https://apirunner.example.com')
            expect(customClient.getHeaders()['X-Custom']).toBe('header')
        })

        it('should have default Accept header', () => {
            const headers = client.getHeaders()
            expect(headers['Accept']).toBe('application/json')
        })
    })

    describe('HTTP methods', () => {
        const mockResponse = (data: unknown, status = 200, statusText = 'OK') => {
            return Promise.resolve({
                ok: status >= 200 && status < 300,
                status,
                statusText,
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () => Promise.resolve(JSON.stringify(data)),
            })
        }

        describe('get', () => {
            it('should make GET request', async () => {
                mockFetch.mockImplementation(() => mockResponse({ id: 1, name: 'Test' }))

                const response = await client.get('/users/1')

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/users/1',
                    expect.objectContaining({
                        method: 'GET',
                        headers: expect.objectContaining({ Accept: 'application/json' }),
                    })
                )
                expect(response.status).toBe(200)
                expect(response.data).toEqual({ id: 1, name: 'Test' })
                expect(response.ok).toBe(true)
            })

            it('should make GET request with absolute URL', async () => {
                mockFetch.mockImplementation(() => mockResponse({ success: true }))

                await client.get('https://other.api.com/endpoint')

                expect(mockFetch).toHaveBeenCalledWith('https://other.api.com/endpoint', expect.any(Object))
            })

            it('should include custom headers', async () => {
                mockFetch.mockImplementation(() => mockResponse({}))

                await client.get('/test', { headers: { Authorization: 'Bearer token123' } })

                expect(mockFetch).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        headers: expect.objectContaining({ Authorization: 'Bearer token123' }),
                    })
                )
            })
        })

        describe('post', () => {
            it('should make POST request with JSON body', async () => {
                mockFetch.mockImplementation(() => mockResponse({ id: 1 }, 201, 'Created'))

                const response = await client.post('/users', { name: 'John' })

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/users',
                    expect.objectContaining({
                        method: 'POST',
                        body: JSON.stringify({ name: 'John' }),
                        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
                    })
                )
                expect(response.status).toBe(201)
            })

            it('should handle FormData body', async () => {
                mockFetch.mockImplementation(() => mockResponse({ uploaded: true }))

                const formData = new FormData()
                formData.append('file', 'test')

                await client.post('/upload', formData)

                expect(mockFetch).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        method: 'POST',
                        body: formData,
                    })
                )
            })

            it('should handle URLSearchParams body', async () => {
                mockFetch.mockImplementation(() => mockResponse({}))

                const params = new URLSearchParams()
                params.append('key', 'value')

                await client.post('/form', params)

                expect(mockFetch).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        body: params,
                    })
                )
            })
        })

        describe('put', () => {
            it('should make PUT request', async () => {
                mockFetch.mockImplementation(() => mockResponse({ updated: true }))

                await client.put('/users/1', { name: 'Jane' })

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/users/1',
                    expect.objectContaining({
                        method: 'PUT',
                        body: JSON.stringify({ name: 'Jane' }),
                    })
                )
            })
        })

        describe('patch', () => {
            it('should make PATCH request', async () => {
                mockFetch.mockImplementation(() => mockResponse({ patched: true }))

                await client.patch('/users/1', { status: 'active' })

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/users/1',
                    expect.objectContaining({
                        method: 'PATCH',
                        body: JSON.stringify({ status: 'active' }),
                    })
                )
            })
        })

        describe('delete', () => {
            it('should make DELETE request', async () => {
                mockFetch.mockImplementation(() => mockResponse(null, 204, 'No Content'))

                const response = await client.delete('/users/1')

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/users/1',
                    expect.objectContaining({ method: 'DELETE' })
                )
                expect(response.status).toBe(204)
            })
        })

        describe('head', () => {
            it('should make HEAD request', async () => {
                mockFetch.mockImplementation(() => mockResponse(null))

                await client.head('/users/1')

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/users/1',
                    expect.objectContaining({ method: 'HEAD' })
                )
            })
        })

        describe('options', () => {
            it('should make OPTIONS request', async () => {
                mockFetch.mockImplementation(() => mockResponse(null))

                await client.options('/users')

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/users',
                    expect.objectContaining({ method: 'OPTIONS' })
                )
            })
        })
    })

    describe('response handling', () => {
        it('should parse JSON response', async () => {
            mockFetch.mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    text: () => Promise.resolve('{"data": "test"}'),
                })
            )

            const response = await client.get('/test')
            expect(response.data).toEqual({ data: 'test' })
        })

        it('should handle text response', async () => {
            mockFetch.mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers({ 'content-type': 'text/plain' }),
                    text: () => Promise.resolve('Hello World'),
                })
            )

            const response = await client.get('/test')
            expect(response.data).toBe('Hello World')
        })

        it('should include duration in response', async () => {
            mockFetch.mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    text: () => Promise.resolve('{}'),
                })
            )

            const response = await client.get('/test')
            expect(response.duration).toBeGreaterThanOrEqual(0)
        })

        it('should handle non-OK response', async () => {
            mockFetch.mockImplementation(() =>
                Promise.resolve({
                    ok: false,
                    status: 404,
                    statusText: 'Not Found',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    text: () => Promise.resolve('{"error": "Not found"}'),
                })
            )

            const response = await client.get('/notfound')
            expect(response.ok).toBe(false)
            expect(response.status).toBe(404)
        })
    })

    describe('configuration methods', () => {
        describe('setBaseUrl / getBaseUrl', () => {
            it('should update base URL', () => {
                client.setBaseUrl('https://new.api.com')
                expect(client.getBaseUrl()).toBe('https://new.api.com')
            })
        })

        describe('setHeader / setHeaders / removeHeader / getHeaders', () => {
            it('should set a single header', () => {
                client.setHeader('X-Custom', 'value')
                expect(client.getHeaders()['X-Custom']).toBe('value')
            })

            it('should set multiple headers', () => {
                client.setHeaders({ 'X-One': '1', 'X-Two': '2' })
                const headers = client.getHeaders()
                expect(headers['X-One']).toBe('1')
                expect(headers['X-Two']).toBe('2')
            })

            it('should remove a header', () => {
                client.setHeader('X-Remove', 'value')
                expect(client.getHeaders()['X-Remove']).toBe('value')
                client.removeHeader('X-Remove')
                expect(client.getHeaders()['X-Remove']).toBeUndefined()
            })
        })
    })

    describe('interceptors', () => {
        it('should apply request interceptor', async () => {
            mockFetch.mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    text: () => Promise.resolve('{}'),
                })
            )

            client.addRequestInterceptor(async (_url, options) => {
                return {
                    ...options,
                    headers: { ...(options.headers as Record<string, string>), 'X-Intercepted': 'true' },
                }
            })

            await client.get('/test')

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({ 'X-Intercepted': 'true' }),
                })
            )
        })

        it('should apply response interceptor', async () => {
            mockFetch.mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    text: () => Promise.resolve('{"original": true}'),
                })
            )

            client.addResponseInterceptor(async (response) => {
                return {
                    ...response,
                    data: { ...(response.data as object), modified: true },
                }
            })

            const response = await client.get('/test')
            expect(response.data).toEqual({ original: true, modified: true })
        })

        it('should clear all interceptors', async () => {
            mockFetch.mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    text: () => Promise.resolve('{}'),
                })
            )

            client.addRequestInterceptor(async (_url, options) => {
                return {
                    ...options,
                    headers: { ...(options.headers as Record<string, string>), 'X-Should-Not-Exist': 'true' },
                }
            })

            client.clearInterceptors()
            await client.get('/test')

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.not.objectContaining({
                    headers: expect.objectContaining({ 'X-Should-Not-Exist': 'true' }),
                })
            )
        })
    })

    describe('retry logic', () => {
        it('should retry on server error (5xx)', async () => {
            let callCount = 0
            mockFetch.mockImplementation(() => {
                callCount++
                if (callCount < 3) {
                    return Promise.resolve({
                        ok: false,
                        status: 502,
                        statusText: 'Bad Gateway',
                        headers: new Headers({ 'content-type': 'application/json' }),
                        text: () => Promise.resolve('{}'),
                    })
                }
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    text: () => Promise.resolve('{"success": true}'),
                })
            })

            const response = await client.get('/test', { retries: 3, retryDelay: 10 })
            expect(response.ok).toBe(true)
            expect(callCount).toBe(3)
        })

        it('should not retry on client error (4xx)', async () => {
            let callCount = 0
            mockFetch.mockImplementation(() => {
                callCount++
                return Promise.resolve({
                    ok: false,
                    status: 400,
                    statusText: 'Bad Request',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    text: () => Promise.resolve('{}'),
                })
            })

            const response = await client.get('/test', { retries: 3 })
            expect(response.status).toBe(400)
            expect(callCount).toBe(1) // No retries for 4xx
        })
    })

    describe('timeout handling', () => {
        it('should throw on timeout', async () => {
            mockFetch.mockImplementation(
                () =>
                    new Promise((_, reject) => {
                        const error = new Error('Aborted')
                        error.name = 'AbortError'
                        setTimeout(() => reject(error), 50)
                    })
            )

            await expect(client.get('/slow', { timeout: 10 })).rejects.toThrow()
        })
    })

    describe('error handling', () => {
        it('should throw on network error', async () => {
            mockFetch.mockImplementation(() => Promise.reject(new Error('Network error')))

            await expect(client.get('/error')).rejects.toThrow('Network error')
        })
    })
})
