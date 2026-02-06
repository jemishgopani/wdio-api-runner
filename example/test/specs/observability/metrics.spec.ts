import {
    createApiClient,
    createMetricsCollector,
    createMetricsInterceptors,
    formatConsoleReport,
    checkThresholds,
    assertResponse,
} from 'wdio-api-runner'
import { expect } from 'chai'

describe('Observability - Performance Metrics', () => {
    describe('Basic Metrics Collection', () => {
        it('should collect metrics from API requests', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const metrics = createMetricsCollector()
            const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)

            api.addRequestInterceptor(requestInterceptor)
            api.addResponseInterceptor(responseInterceptor)

            // Make some requests
            await api.get('/users/1')
            await api.get('/users/2')
            await api.get('/posts/1')

            // Get report
            const report = metrics.getReport()

            expect(report.totalRequests).to.equal(3)
            expect(report.totalDuration).to.be.above(0)
            expect(report.failedRequests).to.be.an('array')
            expect(report.failedRequests.length).to.equal(0)
        })

        it('should calculate percentile statistics', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const metrics = createMetricsCollector({
                percentiles: [50, 75, 90, 95, 99],
            })
            const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)

            api.addRequestInterceptor(requestInterceptor)
            api.addResponseInterceptor(responseInterceptor)

            // Make multiple requests to get meaningful percentiles
            for (let i = 1; i <= 5; i++) {
                await api.get(`/users/${i}`)
            }

            const report = metrics.getReport()

            // Check overall percentile stats
            expect(report.overall.p50).to.be.above(0)
            expect(report.overall.p95).to.be.at.least(report.overall.p50)
            expect(report.overall.p99).to.be.at.least(report.overall.p95)
        })
    })

    describe('Metrics by Endpoint', () => {
        it('should group metrics by endpoint', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const metrics = createMetricsCollector()
            const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)

            api.addRequestInterceptor(requestInterceptor)
            api.addResponseInterceptor(responseInterceptor)

            // Different endpoints
            await api.get('/users/1')
            await api.get('/users/2')
            await api.get('/posts/1')
            await api.get('/comments/1')

            const report = metrics.getReport()

            expect(report.byEndpoint).to.exist
            expect(Object.keys(report.byEndpoint).length).to.be.above(0)
        })
    })

    describe('Metrics by HTTP Method', () => {
        it('should group metrics by method', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const metrics = createMetricsCollector()
            const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)

            api.addRequestInterceptor(requestInterceptor)
            api.addResponseInterceptor(responseInterceptor)

            // Different methods
            await api.get('/users/1')
            await api.post('/users', { name: 'Test' })
            await api.put('/users/1', { name: 'Updated' })
            await api.delete('/users/1')

            const report = metrics.getReport()

            expect(report.byMethod).to.exist
            expect(report.byMethod['GET']).to.exist
            expect(report.byMethod['POST']).to.exist
            expect(report.byMethod['PUT']).to.exist
            expect(report.byMethod['DELETE']).to.exist
        })
    })

    describe('Failed Request Tracking', () => {
        it('should track failed requests', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const metrics = createMetricsCollector()
            const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)

            api.addRequestInterceptor(requestInterceptor)
            api.addResponseInterceptor(responseInterceptor)

            // Successful requests
            await api.get('/status/200')
            await api.get('/status/200')

            // Failed requests
            await api.get('/status/404')
            await api.get('/status/500')

            const report = metrics.getReport()

            expect(report.totalRequests).to.equal(4)
            expect(report.failedRequests).to.be.an('array')
            expect(report.failedRequests.length).to.equal(2)
        })

        it('should list failed requests', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const metrics = createMetricsCollector()
            const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)

            api.addRequestInterceptor(requestInterceptor)
            api.addResponseInterceptor(responseInterceptor)

            await api.get('/status/200')
            await api.get('/status/404')
            await api.get('/status/500')

            const report = metrics.getReport()

            expect(report.failedRequests).to.be.an('array')
            expect(report.failedRequests.length).to.equal(2)
        })
    })

    describe('Slow Request Detection', () => {
        it('should identify slow requests', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const metrics = createMetricsCollector({
                slowThreshold: 100, // 100ms threshold
            })
            const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)

            api.addRequestInterceptor(requestInterceptor)
            api.addResponseInterceptor(responseInterceptor)

            // Fast request
            await api.get('/status/200')

            // Slow request (1 second delay)
            await api.get('/delay/1')

            const report = metrics.getReport()

            expect(report.slowestRequests).to.be.an('array')
            expect(report.slowestRequests.length).to.be.above(0)
        })
    })

    describe('Console Reporting', () => {
        it('should format report for console', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const metrics = createMetricsCollector()
            const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)

            api.addRequestInterceptor(requestInterceptor)
            api.addResponseInterceptor(responseInterceptor)

            await api.get('/users/1')
            await api.get('/posts/1')
            await api.get('/comments/1')

            const report = metrics.getReport()
            const consoleOutput = formatConsoleReport(report)

            expect(consoleOutput).to.exist
            expect(typeof consoleOutput).to.equal('string')
            expect(consoleOutput).to.include('Total Requests')
            expect(consoleOutput).to.include('3')
        })
    })

    describe('Threshold Checking', () => {
        it('should pass when within thresholds', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const metrics = createMetricsCollector()
            const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)

            api.addRequestInterceptor(requestInterceptor)
            api.addResponseInterceptor(responseInterceptor)

            await api.get('/users/1')
            await api.get('/users/2')

            const report = metrics.getReport()

            const thresholdResult = checkThresholds(report, {
                p95: 10000, // 10 seconds - should pass
                errorRate: 5, // 5% - should pass (0% actual)
            })

            expect(thresholdResult.passed).to.equal(true)
            expect(thresholdResult.failures.length).to.equal(0)
        })

        it('should fail when exceeding thresholds', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const metrics = createMetricsCollector()
            const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)

            api.addRequestInterceptor(requestInterceptor)
            api.addResponseInterceptor(responseInterceptor)

            // Create some failures
            await api.get('/status/200')
            await api.get('/status/500')

            const report = metrics.getReport()

            const thresholdResult = checkThresholds(report, {
                errorRate: 10, // 10% threshold - will be exceeded (50% actual)
            })

            expect(thresholdResult.passed).to.equal(false)
            expect(thresholdResult.failures.length).to.be.above(0)
        })

        it('should check p95 response time threshold', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const metrics = createMetricsCollector()
            const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)

            api.addRequestInterceptor(requestInterceptor)
            api.addResponseInterceptor(responseInterceptor)

            // Fast requests
            await api.get('/users/1')
            await api.get('/users/2')
            await api.get('/users/3')

            const report = metrics.getReport()

            // Very tight threshold - likely to fail
            const strictResult = checkThresholds(report, {
                p95: 1, // 1ms - impossible
            })

            expect(strictResult.passed).to.equal(false)

            // Relaxed threshold - should pass
            const relaxedResult = checkThresholds(report, {
                p95: 30000, // 30 seconds
            })

            expect(relaxedResult.passed).to.equal(true)
        })
    })

    describe('Metrics Management', () => {
        it('should clear metrics', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const metrics = createMetricsCollector()
            const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)

            api.addRequestInterceptor(requestInterceptor)
            api.addResponseInterceptor(responseInterceptor)

            await api.get('/users/1')
            await api.get('/users/2')

            let report = metrics.getReport()
            expect(report.totalRequests).to.equal(2)

            // Clear metrics
            metrics.clear()

            report = metrics.getReport()
            expect(report.totalRequests).to.equal(0)
        })

        it('should enable/disable collection', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const metrics = createMetricsCollector()
            const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)

            api.addRequestInterceptor(requestInterceptor)
            api.addResponseInterceptor(responseInterceptor)

            // Collect first request
            await api.get('/users/1')

            // Disable collection
            metrics.disable()

            // This request won't be collected
            await api.get('/users/2')

            // Re-enable
            metrics.enable()

            // This one will be collected
            await api.get('/users/3')

            const report = metrics.getReport()
            expect(report.totalRequests).to.equal(2) // Only 2, not 3
        })
    })

    describe('Integration with Assertions', () => {
        it('should work alongside assertions', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const metrics = createMetricsCollector()
            const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)

            api.addRequestInterceptor(requestInterceptor)
            api.addResponseInterceptor(responseInterceptor)

            const response = await api.get('/users/1')

            // Assertions work normally
            assertResponse(response).toBeOk().toHaveBodyProperty('id', 1)

            // Metrics were still collected
            const report = metrics.getReport()
            expect(report.totalRequests).to.equal(1)
            expect(report.failedRequests.length).to.equal(0) // All requests successful
        })
    })
})
