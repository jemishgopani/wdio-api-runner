import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
    HarLogger,
    createLoggingInterceptors,
    createHar,
    createHarEntry,
    headersToHarHeaders,
    parseQueryString,
    parseCookies,
    createPostData,
    truncateBody,
    maskSensitiveHeaders,
    cleanupStaleRequests,
    getPendingRequestCount,
    type Har,
    type HarEntry,
    type LoggingConfig,
} from '../src/logging/index.js'
import type { ApiResponse } from '../src/shared/types.js'

// Mock fs module
vi.mock('fs', async () => {
    const actual = await vi.importActual('fs')
    return {
        ...actual,
        promises: {
            writeFile: vi.fn().mockResolvedValue(undefined),
            access: vi.fn().mockRejectedValue(new Error('ENOENT')),
            mkdir: vi.fn().mockResolvedValue(undefined),
        },
    }
})

describe('logging module', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('HarBuilder utilities', () => {
        describe('createHar', () => {
            it('should create valid HAR 1.2 structure', () => {
                const entries: HarEntry[] = []
                const har = createHar(entries)

                expect(har.log.version).toBe('1.2')
                expect(har.log.creator.name).toBe('wdio-api-runner')
                expect(har.log.creator.version).toBeDefined()
                expect(har.log.entries).toEqual([])
            })

            it('should include provided entries', () => {
                const mockEntry: HarEntry = {
                    startedDateTime: '2024-01-15T10:00:00.000Z',
                    time: 100,
                    request: {
                        method: 'GET',
                        url: 'https://api.example.com/users',
                        httpVersion: 'HTTP/1.1',
                        cookies: [],
                        headers: [],
                        queryString: [],
                        headersSize: 0,
                        bodySize: 0,
                    },
                    response: {
                        status: 200,
                        statusText: 'OK',
                        httpVersion: 'HTTP/1.1',
                        cookies: [],
                        headers: [],
                        content: { size: 0, mimeType: 'application/json' },
                        redirectURL: '',
                        headersSize: 0,
                        bodySize: 0,
                    },
                    cache: {},
                    timings: { send: 0, wait: 90, receive: 10 },
                }

                const har = createHar([mockEntry])

                expect(har.log.entries).toHaveLength(1)
                expect(har.log.entries[0]).toEqual(mockEntry)
            })
        })

        describe('createHarEntry', () => {
            it('should create entry with request and response data', () => {
                const headers = new Headers({
                    'content-type': 'application/json',
                })

                const entry = createHarEntry(
                    {
                        url: 'https://api.example.com/users',
                        method: 'GET',
                        headers,
                    },
                    {
                        status: 200,
                        statusText: 'OK',
                        headers,
                        body: '{"users":[]}',
                    },
                    { start: 1000, end: 1150 }
                )

                expect(entry.time).toBe(150)
                expect(entry.request.method).toBe('GET')
                expect(entry.request.url).toBe('https://api.example.com/users')
                expect(entry.response.status).toBe(200)
                expect(entry.response.content.text).toBe('{"users":[]}')
            })

            it('should include POST data for POST requests', () => {
                const headers = new Headers({
                    'content-type': 'application/json',
                })

                const entry = createHarEntry(
                    {
                        url: 'https://api.example.com/users',
                        method: 'POST',
                        headers,
                        body: '{"name":"John"}',
                    },
                    {
                        status: 201,
                        statusText: 'Created',
                        headers,
                    },
                    { start: 1000, end: 1100 }
                )

                expect(entry.request.postData).toBeDefined()
                expect(entry.request.postData?.text).toBe('{"name":"John"}')
                expect(entry.request.postData?.mimeType).toBe('application/json')
            })

            it('should parse query string from URL', () => {
                const headers = new Headers()

                const entry = createHarEntry(
                    {
                        url: 'https://api.example.com/users?page=1&limit=10',
                        method: 'GET',
                        headers,
                    },
                    {
                        status: 200,
                        statusText: 'OK',
                        headers,
                    },
                    { start: 1000, end: 1050 }
                )

                expect(entry.request.queryString).toHaveLength(2)
                expect(entry.request.queryString).toContainEqual({ name: 'page', value: '1' })
                expect(entry.request.queryString).toContainEqual({ name: 'limit', value: '10' })
            })

            it('should calculate timing correctly', () => {
                const headers = new Headers()

                const entry = createHarEntry(
                    { url: 'https://api.example.com', method: 'GET', headers },
                    { status: 200, statusText: 'OK', headers },
                    { start: 1000, end: 1200 }
                )

                expect(entry.time).toBe(200)
                expect(entry.timings.wait + entry.timings.receive).toBe(200)
            })
        })

        describe('headersToHarHeaders', () => {
            it('should convert Headers object to HAR format', () => {
                const headers = new Headers({
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer token123',
                })

                const harHeaders = headersToHarHeaders(headers)

                expect(harHeaders).toHaveLength(2)
                expect(harHeaders).toContainEqual({ name: 'content-type', value: 'application/json' })
                expect(harHeaders).toContainEqual({ name: 'authorization', value: 'Bearer token123' })
            })

            it('should handle empty headers', () => {
                const headers = new Headers()
                const harHeaders = headersToHarHeaders(headers)

                expect(harHeaders).toEqual([])
            })
        })

        describe('parseQueryString', () => {
            it('should parse query parameters from URL', () => {
                const params = parseQueryString('https://api.example.com?foo=bar&baz=qux')

                expect(params).toHaveLength(2)
                expect(params).toContainEqual({ name: 'foo', value: 'bar' })
                expect(params).toContainEqual({ name: 'baz', value: 'qux' })
            })

            it('should handle URL-encoded values', () => {
                const params = parseQueryString('https://api.example.com?name=John%20Doe&email=test%40example.com')

                expect(params).toContainEqual({ name: 'name', value: 'John Doe' })
                expect(params).toContainEqual({ name: 'email', value: 'test@example.com' })
            })

            it('should return empty array for URL without query string', () => {
                const params = parseQueryString('https://api.example.com/users')

                expect(params).toEqual([])
            })

            it('should return empty array for invalid URL', () => {
                const params = parseQueryString('not-a-valid-url')

                expect(params).toEqual([])
            })
        })

        describe('parseCookies', () => {
            it('should parse simple cookie header', () => {
                const cookies = parseCookies('session=abc123; user=john')

                expect(cookies).toHaveLength(2)
                expect(cookies).toContainEqual({ name: 'session', value: 'abc123' })
                expect(cookies).toContainEqual({ name: 'user', value: 'john' })
            })

            it('should handle cookies with equals in value', () => {
                const cookies = parseCookies('data=base64==; token=abc')

                expect(cookies).toHaveLength(2)
                expect(cookies).toContainEqual({ name: 'data', value: 'base64==' })
            })

            it('should return empty array for empty string', () => {
                expect(parseCookies('')).toEqual([])
            })

            it('should handle whitespace', () => {
                const cookies = parseCookies('  session = abc123 ;  user = john  ')

                expect(cookies).toHaveLength(2)
                expect(cookies[0].name).toBe('session')
                expect(cookies[1].name).toBe('user')
            })
        })

        describe('createPostData', () => {
            it('should create JSON post data', () => {
                const postData = createPostData('{"name":"John"}', 'application/json')

                expect(postData.mimeType).toBe('application/json')
                expect(postData.text).toBe('{"name":"John"}')
                expect(postData.params).toBeUndefined()
            })

            it('should create form data with params', () => {
                const postData = createPostData('name=John&age=30', 'application/x-www-form-urlencoded')

                expect(postData.mimeType).toBe('application/x-www-form-urlencoded')
                expect(postData.text).toBe('name=John&age=30')
                expect(postData.params).toBeDefined()
                expect(postData.params).toContainEqual({ name: 'name', value: 'John' })
                expect(postData.params).toContainEqual({ name: 'age', value: '30' })
            })

            it('should handle content-type with charset', () => {
                const postData = createPostData('{"data":true}', 'application/json; charset=utf-8')

                expect(postData.mimeType).toBe('application/json')
            })
        })

        describe('truncateBody', () => {
            it('should not truncate small bodies', () => {
                const body = 'Hello, World!'
                const result = truncateBody(body, 100)

                expect(result).toBe(body)
            })

            it('should truncate large bodies', () => {
                const body = 'x'.repeat(200)
                const result = truncateBody(body, 100)

                expect(result.length).toBeLessThan(body.length)
                expect(result).toContain('[...truncated]')
            })

            it('should handle multi-byte characters', () => {
                const body = '\u{1F600}'.repeat(50) // 50 emoji (each is 4 bytes)
                const result = truncateBody(body, 100)

                // Should truncate based on bytes, not characters
                expect(result).toContain('[...truncated]')
            })
        })

        describe('maskSensitiveHeaders', () => {
            it('should mask authorization header', () => {
                const headers = [
                    { name: 'Authorization', value: 'Bearer secret-token' },
                    { name: 'Content-Type', value: 'application/json' },
                ]

                const masked = maskSensitiveHeaders(headers)

                expect(masked).toContainEqual({ name: 'Authorization', value: '***' })
                expect(masked).toContainEqual({ name: 'Content-Type', value: 'application/json' })
            })

            it('should mask cookie header', () => {
                const headers = [{ name: 'Cookie', value: 'session=secret-session-id' }]

                const masked = maskSensitiveHeaders(headers)

                expect(masked[0].value).toBe('***')
            })

            it('should mask x-api-key header', () => {
                const headers = [{ name: 'X-API-Key', value: 'my-secret-key' }]

                const masked = maskSensitiveHeaders(headers)

                expect(masked[0].value).toBe('***')
            })

            it('should be case-insensitive', () => {
                const headers = [
                    { name: 'AUTHORIZATION', value: 'secret' },
                    { name: 'authorization', value: 'secret' },
                ]

                const masked = maskSensitiveHeaders(headers)

                expect(masked.every((h) => h.value === '***')).toBe(true)
            })
        })
    })

    describe('HarLogger', () => {
        let logger: HarLogger

        beforeEach(() => {
            logger = new HarLogger()
        })

        describe('constructor', () => {
            it('should use default config when none provided', () => {
                const config = logger.getConfig()

                expect(config.enabled).toBe(false)
                expect(config.outputPath).toBe('./har-logs')
                expect(config.includeRequestBody).toBe(true)
                expect(config.includeResponseBody).toBe(true)
                expect(config.maxBodySize).toBe(1048576)
            })

            it('should merge provided config with defaults', () => {
                const customLogger = new HarLogger({
                    outputPath: './custom-logs',
                    maxBodySize: 500000,
                })

                const config = customLogger.getConfig()

                expect(config.outputPath).toBe('./custom-logs')
                expect(config.maxBodySize).toBe(500000)
                expect(config.includeRequestBody).toBe(true) // Default preserved
            })

            it('should auto-start recording when enabled is true', () => {
                const autoLogger = new HarLogger({ enabled: true })

                expect(autoLogger.isRecording()).toBe(true)
            })
        })

        describe('startRecording', () => {
            it('should start recording', () => {
                expect(logger.isRecording()).toBe(false)

                logger.startRecording()

                expect(logger.isRecording()).toBe(true)
            })

            it('should accept custom filename', () => {
                logger.startRecording('my-test')

                expect(logger.isRecording()).toBe(true)
            })

            it('should clear entries when starting fresh recording after stop', async () => {
                logger.startRecording('first')
                logger.addEntry(createMockEntry())

                expect(logger.getEntryCount()).toBe(1)

                await logger.stopRecording()
                logger.startRecording('new-session')

                expect(logger.getEntryCount()).toBe(0)
            })

            it('should not restart if already recording but update filename', () => {
                logger.startRecording('first')
                logger.addEntry(createMockEntry())

                logger.startRecording('second')

                // Should still have the entry (didn't clear)
                expect(logger.getEntryCount()).toBe(1)
            })
        })

        describe('stopRecording', () => {
            it('should stop recording and return file path', async () => {
                logger.startRecording('test-session')
                logger.addEntry(createMockEntry())

                const filePath = await logger.stopRecording()

                expect(filePath).toContain('test-session.har')
                expect(logger.isRecording()).toBe(false)
            })

            it('should throw if not recording', async () => {
                await expect(logger.stopRecording()).rejects.toThrow('Not currently recording')
            })

            it('should clear entries after stopping', async () => {
                logger.startRecording()
                logger.addEntry(createMockEntry())

                await logger.stopRecording()

                expect(logger.getEntryCount()).toBe(0)
            })

            it('should write HAR file to disk', async () => {
                logger.startRecording('my-test')
                logger.addEntry(createMockEntry())

                await logger.stopRecording()

                expect(fs.promises.writeFile).toHaveBeenCalledWith(
                    expect.stringContaining('my-test.har'),
                    expect.any(String),
                    'utf-8'
                )
            })

            it('should create output directory if needed', async () => {
                logger.startRecording()

                await logger.stopRecording()

                expect(fs.promises.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true })
            })
        })

        describe('addEntry', () => {
            it('should add entry when recording', () => {
                logger.startRecording()
                logger.addEntry(createMockEntry())

                expect(logger.getEntryCount()).toBe(1)
            })

            it('should not add entry when not recording', () => {
                logger.addEntry(createMockEntry())

                expect(logger.getEntryCount()).toBe(0)
            })

            it('should add entry when enabled (always-on mode)', () => {
                const alwaysOnLogger = new HarLogger({ enabled: true })

                // Even without explicit startRecording, should record
                alwaysOnLogger.addEntry(createMockEntry())

                expect(alwaysOnLogger.getEntryCount()).toBe(1)
            })
        })

        describe('getHar', () => {
            it('should return valid HAR structure', () => {
                logger.startRecording()
                logger.addEntry(createMockEntry())

                const har = logger.getHar()

                expect(har.log.version).toBe('1.2')
                expect(har.log.entries).toHaveLength(1)
            })

            it('should return copy of entries (immutable)', () => {
                logger.startRecording()
                logger.addEntry(createMockEntry())

                const har1 = logger.getHar()
                const har2 = logger.getHar()

                expect(har1.log.entries).not.toBe(har2.log.entries)
            })
        })

        describe('clear', () => {
            it('should clear all entries', () => {
                logger.startRecording()
                logger.addEntry(createMockEntry())
                logger.addEntry(createMockEntry())

                expect(logger.getEntryCount()).toBe(2)

                logger.clear()

                expect(logger.getEntryCount()).toBe(0)
            })
        })

        describe('setConfig', () => {
            it('should update configuration', () => {
                logger.setConfig({ maxBodySize: 2000 })

                expect(logger.getConfig().maxBodySize).toBe(2000)
            })

            it('should preserve other config values', () => {
                logger.setConfig({ maxBodySize: 2000 })

                expect(logger.getConfig().outputPath).toBe('./har-logs')
            })
        })

        describe('setFilename', () => {
            it('should set the filename for current recording', async () => {
                logger.startRecording()
                logger.setFilename('custom-name')

                await logger.stopRecording()

                expect(fs.promises.writeFile).toHaveBeenCalledWith(
                    expect.stringContaining('custom-name.har'),
                    expect.any(String),
                    'utf-8'
                )
            })
        })
    })

    describe('LoggingInterceptors', () => {
        let logger: HarLogger

        beforeEach(() => {
            logger = new HarLogger()
        })

        describe('createLoggingInterceptors', () => {
            it('should return request and response interceptors', () => {
                const interceptors = createLoggingInterceptors(logger)

                expect(interceptors.requestInterceptor).toBeInstanceOf(Function)
                expect(interceptors.responseInterceptor).toBeInstanceOf(Function)
            })
        })

        describe('requestInterceptor', () => {
            it('should pass through when not recording', () => {
                const { requestInterceptor } = createLoggingInterceptors(logger)
                const options: RequestInit = {
                    method: 'GET',
                    headers: { 'X-Custom': 'value' },
                }

                const result = requestInterceptor('https://api.example.com', options)

                expect(result).toEqual(options)
            })

            it('should add request ID header when recording', () => {
                logger.startRecording()
                const { requestInterceptor } = createLoggingInterceptors(logger)
                const options: RequestInit = {
                    method: 'GET',
                    headers: {},
                }

                const result = requestInterceptor('https://api.example.com', options)

                expect(result.headers).toBeInstanceOf(Headers)
                const headers = result.headers as Headers
                expect(headers.has('x-har-request-id')).toBe(true)
            })

            it('should preserve existing headers', () => {
                logger.startRecording()
                const { requestInterceptor } = createLoggingInterceptors(logger)
                const options: RequestInit = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{"test":true}',
                }

                const result = requestInterceptor('https://api.example.com', options)

                const headers = result.headers as Headers
                expect(headers.get('content-type')).toBe('application/json')
            })
        })

        describe('responseInterceptor', () => {
            it('should pass through when not recording', () => {
                const { responseInterceptor } = createLoggingInterceptors(logger)
                const response = createMockApiResponse()

                const result = responseInterceptor(response)

                expect(result).toEqual(response)
                expect(logger.getEntryCount()).toBe(0)
            })

            it('should add HAR entry when recording', () => {
                logger.startRecording()
                const { requestInterceptor, responseInterceptor } = createLoggingInterceptors(logger)

                // Simulate request/response cycle
                const options: RequestInit = { method: 'GET' }
                const processedOptions = requestInterceptor('https://api.example.com/users', options)

                // Create response with the request ID header
                const requestId = (processedOptions.headers as Headers).get('x-har-request-id')
                const responseHeaders = new Headers()
                if (requestId) {
                    responseHeaders.set('x-har-request-id', requestId)
                }

                const response = createMockApiResponse({ headers: responseHeaders })
                responseInterceptor(response)

                expect(logger.getEntryCount()).toBe(1)
            })

            it('should capture response data', () => {
                logger.startRecording()
                const { requestInterceptor, responseInterceptor } = createLoggingInterceptors(logger)

                const options: RequestInit = { method: 'GET' }
                const processedOptions = requestInterceptor('https://api.example.com/users', options)

                const requestId = (processedOptions.headers as Headers).get('x-har-request-id')
                const responseHeaders = new Headers({ 'content-type': 'application/json' })
                if (requestId) {
                    responseHeaders.set('x-har-request-id', requestId)
                }

                const response = createMockApiResponse({
                    status: 200,
                    statusText: 'OK',
                    headers: responseHeaders,
                    data: { users: [] },
                })

                responseInterceptor(response)

                const har = logger.getHar()
                expect(har.log.entries[0].response.status).toBe(200)
            })

            it('should return response unchanged', () => {
                logger.startRecording()
                const { responseInterceptor } = createLoggingInterceptors(logger)
                const response = createMockApiResponse()

                const result = responseInterceptor(response)

                expect(result).toEqual(response)
            })
        })

        describe('cleanupStaleRequests', () => {
            it('should be callable without errors', () => {
                expect(() => cleanupStaleRequests()).not.toThrow()
            })
        })

        describe('getPendingRequestCount', () => {
            it('should return pending request count', () => {
                const count = getPendingRequestCount()

                expect(typeof count).toBe('number')
                expect(count).toBeGreaterThanOrEqual(0)
            })
        })
    })

    describe('integration', () => {
        it('should capture full request/response cycle', () => {
            const logger = new HarLogger()
            const { requestInterceptor, responseInterceptor } = createLoggingInterceptors(logger)

            logger.startRecording('integration-test')

            // Simulate POST request
            const requestOptions: RequestInit = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer token123',
                },
                body: JSON.stringify({ name: 'John', email: 'john@example.com' }),
            }

            const processedOptions = requestInterceptor('https://api.example.com/users?source=test', requestOptions)

            // Simulate response
            const requestId = (processedOptions.headers as Headers).get('x-har-request-id')
            const responseHeaders = new Headers({
                'content-type': 'application/json',
                'x-request-id': 'req-12345',
            })
            if (requestId) {
                responseHeaders.set('x-har-request-id', requestId)
            }

            const response = createMockApiResponse({
                status: 201,
                statusText: 'Created',
                headers: responseHeaders,
                data: { id: 1, name: 'John', email: 'john@example.com' },
                duration: 150,
            })

            responseInterceptor(response)

            // Verify HAR structure
            const har = logger.getHar()

            expect(har.log.version).toBe('1.2')
            expect(har.log.entries).toHaveLength(1)

            const entry = har.log.entries[0]
            expect(entry.request.method).toBe('POST')
            expect(entry.request.url).toBe('https://api.example.com/users?source=test')
            expect(entry.response.status).toBe(201)
        })

        it('should handle multiple requests', () => {
            const logger = new HarLogger()
            const { requestInterceptor, responseInterceptor } = createLoggingInterceptors(logger)

            logger.startRecording('multi-request-test')

            // Request 1
            const options1 = requestInterceptor('https://api.example.com/users', { method: 'GET' })
            const headers1 = new Headers()
            const reqId1 = (options1.headers as Headers).get('x-har-request-id')
            if (reqId1) headers1.set('x-har-request-id', reqId1)
            responseInterceptor(createMockApiResponse({ status: 200, headers: headers1 }))

            // Request 2
            const options2 = requestInterceptor('https://api.example.com/posts', { method: 'GET' })
            const headers2 = new Headers()
            const reqId2 = (options2.headers as Headers).get('x-har-request-id')
            if (reqId2) headers2.set('x-har-request-id', reqId2)
            responseInterceptor(createMockApiResponse({ status: 200, headers: headers2 }))

            const har = logger.getHar()

            expect(har.log.entries).toHaveLength(2)
            expect(har.log.entries[0].request.url).toBe('https://api.example.com/users')
            expect(har.log.entries[1].request.url).toBe('https://api.example.com/posts')
        })

        it('should respect body size limits', () => {
            const logger = new HarLogger({
                maxBodySize: 50,
                includeResponseBody: true,
            })
            const { requestInterceptor, responseInterceptor } = createLoggingInterceptors(logger)

            logger.startRecording()

            const options = requestInterceptor('https://api.example.com/data', { method: 'GET' })
            const headers = new Headers()
            const reqId = (options.headers as Headers).get('x-har-request-id')
            if (reqId) headers.set('x-har-request-id', reqId)

            const largeData = { content: 'x'.repeat(1000) }
            responseInterceptor(
                createMockApiResponse({
                    headers,
                    data: largeData,
                })
            )

            const har = logger.getHar()
            const responseBody = har.log.entries[0].response.content.text

            // Body should be truncated
            expect(responseBody).toContain('[...truncated]')
            expect(responseBody!.length).toBeLessThan(JSON.stringify(largeData).length)
        })
    })
})

// Helper functions
function createMockEntry(): HarEntry {
    return {
        startedDateTime: new Date().toISOString(),
        time: 100,
        request: {
            method: 'GET',
            url: 'https://api.example.com/test',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: 0,
            bodySize: 0,
        },
        response: {
            status: 200,
            statusText: 'OK',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            content: { size: 0, mimeType: 'application/json' },
            redirectURL: '',
            headersSize: 0,
            bodySize: 0,
        },
        cache: {},
        timings: { send: 0, wait: 90, receive: 10 },
    }
}

function createMockApiResponse<T = unknown>(overrides?: Partial<ApiResponse<T>>): ApiResponse<T> {
    return {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        data: {} as T,
        ok: true,
        duration: 100,
        ...overrides,
    }
}
