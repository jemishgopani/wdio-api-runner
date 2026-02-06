import { createApiClient, assertResponse } from 'wdio-api-runner'
import { expect } from 'chai'

describe('API Client - Interceptors', () => {
    describe('Request Interceptors', () => {
        it('should modify URL with interceptor', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            // Add interceptor that adds query parameter
            api.addRequestInterceptor((url, options) => {
                const modifiedUrl = new URL(url)
                modifiedUrl.searchParams.set('intercepted', 'yes')
                return { url: modifiedUrl.toString(), options }
            })

            const response = await api.get<{ args: Record<string, string> }>('/get')

            assertResponse(response).toBeOk()
            expect(response.data.args.intercepted).to.equal('yes')
        })

        it('should log requests with interceptor', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const requestLogs: string[] = []

            // Add logging interceptor
            api.addRequestInterceptor((url, options) => {
                requestLogs.push(`${options.method || 'GET'} ${url}`)
                return { url, options }
            })

            await api.get('/users/1')
            await api.post('/posts', { title: 'Test' })

            expect(requestLogs.length).to.equal(2)
            expect(requestLogs[0]).to.include('/users/1')
            expect(requestLogs[1]).to.include('/posts')
        })

        it('should chain multiple request interceptors', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            const executionOrder: string[] = []

            // First interceptor - add first param
            api.addRequestInterceptor((url, options) => {
                executionOrder.push('first')
                const modifiedUrl = new URL(url)
                modifiedUrl.searchParams.set('step', '1')
                return { url: modifiedUrl.toString(), options }
            })

            // Second interceptor - add second param
            api.addRequestInterceptor((url, options) => {
                executionOrder.push('second')
                const modifiedUrl = new URL(url)
                modifiedUrl.searchParams.set('step2', '2')
                return { url: modifiedUrl.toString(), options }
            })

            const response = await api.get<{ args: Record<string, string> }>('/get')

            assertResponse(response).toBeOk()
            expect(executionOrder).to.deep.equal(['first', 'second'])
            expect(response.data.args.step).to.equal('1')
            expect(response.data.args.step2).to.equal('2')
        })
    })

    describe('Response Interceptors', () => {
        it('should transform response with interceptor', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            // Add response interceptor that adds metadata
            api.addResponseInterceptor((response) => {
                return {
                    ...response,
                    data: {
                        ...response.data,
                        _metadata: {
                            intercepted: true,
                            timestamp: Date.now(),
                        },
                    },
                }
            })

            const response = await api.get<{ id: number; _metadata: { intercepted: boolean } }>('/users/1')

            assertResponse(response).toBeOk()
            expect(response.data._metadata.intercepted).to.equal(true)
            expect(response.data._metadata.timestamp).to.exist
        })

        it('should log responses with interceptor', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const logs: string[] = []

            // Add logging interceptor
            api.addResponseInterceptor((response) => {
                logs.push(`${response.status} ${response.statusText} - ${response.duration}ms`)
                return response
            })

            await api.get('/users/1')
            await api.get('/users/2')

            expect(logs.length).to.equal(2)
            expect(logs[0]).to.include('200 OK')
            expect(logs[1]).to.include('200 OK')
        })

        it('should chain multiple response interceptors', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const executionOrder: string[] = []

            // First response interceptor
            api.addResponseInterceptor((response) => {
                executionOrder.push('first')
                return {
                    ...response,
                    data: { ...response.data, step1: true },
                }
            })

            // Second response interceptor
            api.addResponseInterceptor((response) => {
                executionOrder.push('second')
                return {
                    ...response,
                    data: { ...response.data, step2: true },
                }
            })

            const response = await api.get<{ step1: boolean; step2: boolean }>('/users/1')

            assertResponse(response).toBeOk()
            expect(executionOrder).to.deep.equal(['first', 'second'])
            expect(response.data.step1).to.equal(true)
            expect(response.data.step2).to.equal(true)
        })
    })

    describe('Interceptor Management', () => {
        it('should clear all interceptors', async () => {
            const api = createApiClient({
                baseUrl: 'https://httpbin.org',
            })

            let interceptorCalled = false

            api.addRequestInterceptor((url, options) => {
                interceptorCalled = true
                return { url, options }
            })

            // Clear interceptors
            api.clearInterceptors()

            await api.get('/get')

            expect(interceptorCalled).to.equal(false)
        })
    })

    describe('Real-world Interceptor Patterns', () => {
        it('should implement request timing interceptor', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const timings: { duration: number }[] = []

            // Response interceptor for timing
            api.addResponseInterceptor((response) => {
                timings.push({
                    duration: response.duration,
                })
                return response
            })

            await api.get('/users')
            await api.get('/posts')

            expect(timings.length).to.equal(2)
            timings.forEach((t) => expect(t.duration).to.be.above(0))
        })

        it('should implement retry logic with interceptor', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            let attempts = 0

            // Track attempts via response interceptor
            api.addResponseInterceptor((response) => {
                attempts++
                return {
                    ...response,
                    data: { ...response.data, attempts },
                }
            })

            const response = await api.get<{ id: number; attempts: number }>('/users/1')

            assertResponse(response).toBeOk()
            expect(response.data.attempts).to.equal(1)
        })

        it('should implement response caching pattern', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const cachedResponses: unknown[] = []

            // Add caching via response interceptor
            api.addResponseInterceptor((response) => {
                // Store response data
                cachedResponses.push(response.data)
                return response
            })

            await api.get('/users/1')
            await api.get('/users/2')

            // Verify responses were cached
            expect(cachedResponses.length).to.equal(2)
            expect(cachedResponses[0]).to.have.property('id', 1)
            expect(cachedResponses[1]).to.have.property('id', 2)
        })
    })
})
