import { createApiClient, assertResponse } from 'wdio-api-runner'
import { expect } from 'chai'

describe('Assertions - Status Codes', () => {
    const api = createApiClient({
        baseUrl: 'https://httpbin.org',
    })

    describe('Exact Status Assertions', () => {
        it('should assert exact status code with toHaveStatus()', async () => {
            const response = await api.get('/status/200')
            assertResponse(response).toHaveStatus(200)
        })

        it('should assert 201 Created status', async () => {
            const response = await api.post('/status/201')
            assertResponse(response).toHaveStatus(201)
        })

        it('should assert 204 No Content status', async () => {
            const response = await api.delete('/status/204')
            assertResponse(response).toHaveStatus(204)
        })

        it('should assert 400 Bad Request status', async () => {
            const response = await api.get('/status/400')
            assertResponse(response).toHaveStatus(400)
        })

        it('should assert 404 Not Found status', async () => {
            const response = await api.get('/status/404')
            assertResponse(response).toHaveStatus(404)
        })

        it('should assert 500 Internal Server Error status', async () => {
            const response = await api.get('/status/500')
            assertResponse(response).toHaveStatus(500)
        })
    })

    describe('Status Category Assertions', () => {
        it('should assert 2xx success with toBeSuccess()', async () => {
            const response200 = await api.get('/status/200')
            assertResponse(response200).toBeSuccess()

            const response201 = await api.post('/status/201')
            assertResponse(response201).toBeSuccess()

            const response204 = await api.delete('/status/204')
            assertResponse(response204).toBeSuccess()
        })

        it('should assert 200 OK with toBeOk()', async () => {
            const response = await api.get('/status/200')
            assertResponse(response).toBeOk()
        })

        it('should assert 3xx redirect with toBeRedirect()', async () => {
            // Note: Following redirects is disabled to test redirect status
            const response = await api.get('/status/301', {
                redirect: 'manual',
            })
            assertResponse(response).toBeRedirect()
        })

        it('should assert 4xx client error with toBeClientError()', async () => {
            const response400 = await api.get('/status/400')
            assertResponse(response400).toBeClientError()

            const response404 = await api.get('/status/404')
            assertResponse(response404).toBeClientError()

            const response401 = await api.get('/status/401')
            assertResponse(response401).toBeClientError()
        })

        it('should assert 5xx server error with toBeServerError()', async () => {
            const response500 = await api.get('/status/500')
            assertResponse(response500).toBeServerError()

            const response502 = await api.get('/status/502')
            assertResponse(response502).toBeServerError()

            const response503 = await api.get('/status/503')
            assertResponse(response503).toBeServerError()
        })
    })

    describe('Negation with .not', () => {
        it('should negate status assertion with .not', async () => {
            const response = await api.get('/status/200')

            // Assert the response is not a 404
            assertResponse(response).not.toHaveStatus(404)
        })

        it('should negate category assertions', async () => {
            const response = await api.get('/status/200')

            // Assert success is not a client error
            assertResponse(response).toBeSuccess().not.toBeClientError()
        })

        it('should assert success is not an error', async () => {
            const response = await api.get('/status/200')

            // Verify successful response
            assertResponse(response).toBeSuccess().toBeOk()
        })

        it('should assert client error is not success', async () => {
            const response = await api.get('/status/404')

            assertResponse(response).toBeClientError().not.toBeSuccess()
        })
    })

    describe('Chaining Assertions', () => {
        it('should chain multiple assertions with .and', async () => {
            const api2 = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const response = await api2.get('/users/1')

            assertResponse(response).toHaveStatus(200).and.toBeOk().and.toBeSuccess().and.not.toBeClientError()
        })

        it('should chain status and content type assertions', async () => {
            const api2 = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const response = await api2.get('/users')

            assertResponse(response).toBeOk().and.toHaveContentType('application/json; charset=utf-8')
        })
    })

    describe('Status Text Assertions', () => {
        it('should assert status text', async () => {
            const api2 = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const response = await api2.get('/users/1')
            assertResponse(response).toHaveStatusText('OK')
        })
    })
})
