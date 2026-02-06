import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApiClient } from '../../src/client/ApiClient.js'
import {
    createMetricsCollector,
    createMetricsInterceptors,
    formatConsoleReport,
    checkThresholds,
} from '../../src/metrics/index.js'
import type { ApiClient } from '../../src/shared/types.js'
import type { MetricsCollector } from '../../src/metrics/index.js'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Metrics Integration', () => {
    let api: ApiClient
    let metrics: MetricsCollector

    beforeEach(() => {
        vi.clearAllMocks()

        // Create fresh instances
        metrics = createMetricsCollector()
        api = createApiClient({
            baseUrl: 'https://api.example.com',
            timeout: 5000,
        })

        // Add metrics interceptors
        const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)
        api.addRequestInterceptor(requestInterceptor)
        api.addResponseInterceptor(responseInterceptor)
    })

    afterEach(() => {
        metrics.clear()
    })

    describe('with ApiClient', () => {
        it('should collect metrics from successful requests', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({
                    'content-type': 'application/json',
                    'content-length': '100',
                }),
                text: () => Promise.resolve(JSON.stringify({ id: 1, name: 'Test' })),
            })

            await api.get('/users/1')

            const report = metrics.getReport()
            expect(report.totalRequests).toBe(1)
            expect(report.overall.count).toBe(1)
            expect(report.byEndpoint.length).toBe(1)
            expect(report.byEndpoint[0].endpoint).toBe('/users/1')
            expect(report.byEndpoint[0].method).toBe('GET')
            expect(report.byEndpoint[0].successRate).toBe(100)
        })

        it('should collect metrics from failed requests', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () => Promise.resolve(JSON.stringify({ error: 'Server error' })),
            })

            await api.get('/users/1')

            const report = metrics.getReport()
            expect(report.totalRequests).toBe(1)
            expect(report.failedRequests.length).toBe(1)
            expect(report.byEndpoint[0].successRate).toBe(0)
            expect(report.byEndpoint[0].errorCount).toBe(1)
        })

        it('should track multiple requests', async () => {
            // Setup mock responses
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    text: () => Promise.resolve('{"id":1}'),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 201,
                    statusText: 'Created',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    text: () => Promise.resolve('{"id":2}'),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    text: () => Promise.resolve('{"id":1}'),
                })

            await api.get('/users/1')
            await api.post('/users', { name: 'New User' })
            await api.get('/users/1')

            const report = metrics.getReport()
            expect(report.totalRequests).toBe(3)
            expect(report.byMethod['GET'].count).toBe(2)
            expect(report.byMethod['POST'].count).toBe(1)
        })

        it('should track response sizes from Content-Length header', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({
                    'content-type': 'application/json',
                    'content-length': '1234',
                }),
                text: () => Promise.resolve('{"data":"test"}'),
            })

            await api.get('/large-response')

            const entries = metrics.getMetrics()
            expect(entries[0].size).toBe(1234)
        })

        it('should handle missing Content-Length gracefully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () => Promise.resolve('{}'),
            })

            await api.get('/no-content-length')

            const entries = metrics.getMetrics()
            expect(entries[0].size).toBeUndefined()
        })

        it('should not pollute request headers', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () => Promise.resolve('{}'),
            })

            await api.get('/test')

            // Verify no X-Metrics headers were sent
            const callArgs = mockFetch.mock.calls[0]
            const requestHeaders = callArgs[1].headers as Record<string, string>
            expect(requestHeaders['X-Metrics-Context-ID']).toBeUndefined()
        })
    })

    describe('enable/disable', () => {
        it('should not collect metrics when disabled', async () => {
            metrics.disable()

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () => Promise.resolve('{}'),
            })

            await api.get('/test')

            expect(metrics.getMetrics().length).toBe(0)
        })

        it('should resume collection when re-enabled', async () => {
            metrics.disable()

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () => Promise.resolve('{}'),
            })

            await api.get('/test-disabled')

            metrics.enable()

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () => Promise.resolve('{}'),
            })

            await api.get('/test-enabled')

            const entries = metrics.getMetrics()
            expect(entries.length).toBe(1)
            expect(entries[0].endpoint).toBe('/test-enabled')
        })
    })

    describe('reporting', () => {
        it('should generate console report', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    text: () => Promise.resolve('{}'),
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    statusText: 'Error',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    text: () => Promise.resolve('{}'),
                })

            await api.get('/success')
            await api.get('/failure')

            const report = metrics.getReport()
            const consoleOutput = formatConsoleReport(report)

            expect(consoleOutput).toContain('Performance Metrics Report')
            expect(consoleOutput).toContain('Total Requests:')
            expect(consoleOutput).toContain('2')
        })

        it('should check thresholds', async () => {
            // Create multiple requests with varying response times
            for (let i = 0; i < 10; i++) {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    text: () => Promise.resolve('{}'),
                })
                await api.get(`/test-${i}`)
            }

            const report = metrics.getReport()

            // These thresholds should pass (responses are very fast in tests)
            const result = checkThresholds(report, {
                p95: 10000, // 10 seconds - very generous for fast mock responses
                errorRate: 1,
            })

            expect(result.passed).toBe(true)
        })
    })

    describe('different HTTP methods', () => {
        it('should track all HTTP methods', async () => {
            const createMockResponse = () => ({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () => Promise.resolve('{}'),
            })

            mockFetch
                .mockResolvedValueOnce(createMockResponse())
                .mockResolvedValueOnce({ ...createMockResponse(), status: 201, statusText: 'Created' })
                .mockResolvedValueOnce(createMockResponse())
                .mockResolvedValueOnce(createMockResponse())
                .mockResolvedValueOnce({ ...createMockResponse(), status: 204, statusText: 'No Content' })

            await api.get('/resource')
            await api.post('/resource', { data: 'test' })
            await api.put('/resource/1', { data: 'updated' })
            await api.patch('/resource/1', { partial: 'update' })
            await api.delete('/resource/1')

            const report = metrics.getReport()

            expect(report.byMethod['GET']).toBeDefined()
            expect(report.byMethod['POST']).toBeDefined()
            expect(report.byMethod['PUT']).toBeDefined()
            expect(report.byMethod['PATCH']).toBeDefined()
            expect(report.byMethod['DELETE']).toBeDefined()
            expect(report.totalRequests).toBe(5)
        })
    })

    describe('endpoint grouping', () => {
        it('should group metrics by endpoint', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () => Promise.resolve('{}'),
            })

            // Multiple requests to same endpoint
            await api.get('/users')
            await api.get('/users')
            await api.get('/users')

            // Different endpoint
            await api.get('/posts')

            const report = metrics.getReport()

            const usersEndpoint = report.byEndpoint.find((e) => e.endpoint === '/users')
            const postsEndpoint = report.byEndpoint.find((e) => e.endpoint === '/posts')

            expect(usersEndpoint?.stats.count).toBe(3)
            expect(postsEndpoint?.stats.count).toBe(1)
        })
    })
})
