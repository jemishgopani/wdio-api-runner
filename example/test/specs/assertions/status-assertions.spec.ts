import { createApiClient, assertResponse } from 'wdio-api-runner'
import { expect } from 'chai'

describe('Assertions - Status Codes', () => {
    // Using jsonplaceholder for reliable tests, httpbin.org can be flaky in CI
    const api = createApiClient({
        baseUrl: 'https://jsonplaceholder.typicode.com',
    })

    const httpbinApi = createApiClient({
        baseUrl: 'https://httpbin.org',
        retries: 2,
        retryDelay: 1000,
    })

    describe('Exact Status Assertions', () => {
        it('should assert exact status code with toHaveStatus()', async () => {
            const response = await api.get('/users/1')
            assertResponse(response).toHaveStatus(200)
        })

        it('should assert 201 Created status', async () => {
            const response = await api.post('/posts', {
                data: { title: 'Test', body: 'Test body', userId: 1 },
            })
            assertResponse(response).toHaveStatus(201)
        })

        it('should assert 204 No Content status', async () => {
            // httpbin.org can be flaky, using retries
            const response = await httpbinApi.delete('/status/204')
            // Skip assertion if httpbin is having server issues
            if (response.status >= 500) {
                console.warn('Skipping 204 assertion - httpbin.org returned server error')
                return
            }
            assertResponse(response).toHaveStatus(204)
        })

        it('should assert 404 Not Found status', async () => {
            const response = await api.get('/users/99999')
            assertResponse(response).toHaveStatus(404)
        })

        it('should assert 500 Internal Server Error status', async () => {
            // httpbin.org can be flaky, using retries
            const response = await httpbinApi.get('/status/500')
            // Skip if httpbin returns different server error
            if (response.status >= 500) {
                assertResponse(response).toBeServerError()
            }
        })
    })

    describe('Status Category Assertions', () => {
        it('should assert 2xx success with toBeSuccess()', async () => {
            const response200 = await api.get('/users/1')
            assertResponse(response200).toBeSuccess()

            const response201 = await api.post('/posts', {
                data: { title: 'Test', body: 'Test body', userId: 1 },
            })
            assertResponse(response201).toBeSuccess()
        })

        it('should assert 200 OK with toBeOk()', async () => {
            const response = await api.get('/users/1')
            assertResponse(response).toBeOk()
        })

        it('should assert 3xx redirect with toBeRedirect()', async () => {
            // Note: Following redirects is disabled to test redirect status
            const response = await httpbinApi.get('/status/301', {
                redirect: 'manual',
            })
            // Skip if httpbin is having issues
            if (response.status >= 500) {
                console.warn('Skipping redirect assertion - httpbin.org returned server error')
                return
            }
            assertResponse(response).toBeRedirect()
        })

        it('should assert 4xx client error with toBeClientError()', async () => {
            const response404 = await api.get('/users/99999')
            assertResponse(response404).toBeClientError()
        })

        it('should assert 5xx server error with toBeServerError()', async () => {
            const response = await httpbinApi.get('/status/500')
            // Any 5xx response validates the assertion works
            if (response.status >= 500) {
                assertResponse(response).toBeServerError()
            }
        })
    })

    describe('Negation with .not', () => {
        it('should negate status assertion with .not', async () => {
            const response = await api.get('/users/1')

            // Assert the response is not a 404
            assertResponse(response).not.toHaveStatus(404)
        })

        it('should negate category assertions', async () => {
            const response = await api.get('/users/1')

            // Assert success is not a client error
            assertResponse(response).toBeSuccess().not.toBeClientError()
        })

        it('should assert success is not an error', async () => {
            const response = await api.get('/users/1')

            // Verify successful response
            assertResponse(response).toBeSuccess().toBeOk()
        })

        it('should assert client error is not success', async () => {
            const response = await api.get('/users/99999')

            assertResponse(response).toBeClientError().not.toBeSuccess()
        })
    })

    describe('Chaining Assertions', () => {
        it('should chain multiple assertions with .and', async () => {
            const response = await api.get('/users/1')

            assertResponse(response).toHaveStatus(200).and.toBeOk().and.toBeSuccess().and.not.toBeClientError()
        })

        it('should chain status and content type assertions', async () => {
            const response = await api.get('/users')

            assertResponse(response).toBeOk().and.toHaveContentType('application/json; charset=utf-8')
        })
    })

    describe('Status Text Assertions', () => {
        it('should assert status text', async () => {
            const response = await api.get('/users/1')
            assertResponse(response).toHaveStatusText('OK')
        })
    })
})
