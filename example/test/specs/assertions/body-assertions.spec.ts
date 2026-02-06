import { createApiClient, assertResponse } from 'wdio-api-runner'
import { expect } from 'chai'
import type { User, Post } from '../../support/types.js'

describe('Assertions - Body and Properties', () => {
    const api = createApiClient({
        baseUrl: 'https://jsonplaceholder.typicode.com',
    })

    describe('Body Existence Assertions', () => {
        it('should assert response has body with toHaveBody()', async () => {
            const response = await api.get<User>('/users/1')

            assertResponse(response).toBeOk().toHaveBody()
        })

        it('should assert response has empty body with toHaveEmptyBody()', async () => {
            const httpbin = createApiClient({ baseUrl: 'https://httpbin.org' })
            const response = await httpbin.delete('/status/204')

            assertResponse(response).toHaveStatus(204).toHaveEmptyBody()
        })

        it('should negate body assertions', async () => {
            const response = await api.get<User>('/users/1')

            assertResponse(response).toBeOk().not.toHaveEmptyBody()
        })
    })

    describe('Property Assertions', () => {
        it('should assert top-level property exists', async () => {
            const response = await api.get<User>('/users/1')

            assertResponse(response).toHaveBodyProperty('id').toHaveBodyProperty('name').toHaveBodyProperty('email')
        })

        it('should assert property has specific value', async () => {
            const response = await api.get<User>('/users/1')

            assertResponse(response)
                .toHaveBodyProperty('id', 1)
                .toHaveBodyProperty('name', 'Leanne Graham')
                .toHaveBodyProperty('username', 'Bret')
        })

        it('should assert nested property with dot notation', async () => {
            const response = await api.get<User>('/users/1')

            // Access nested properties using dot notation
            assertResponse(response)
                .toHaveBodyProperty('address.city', 'Gwenborough')
                .toHaveBodyProperty('address.zipcode', '92998-3874')
                .toHaveBodyProperty('company.name', 'Romaguera-Crona')
        })

        it('should assert deeply nested property', async () => {
            const response = await api.get<User>('/users/1')

            // Access deeply nested geo coordinates
            assertResponse(response)
                .toHaveBodyProperty('address.geo.lat', '-37.3159')
                .toHaveBodyProperty('address.geo.lng', '81.1496')
        })

        it('should negate property assertions', async () => {
            const response = await api.get<User>('/users/1')

            // Assert that non-existent field is not present
            assertResponse(response).not.toHaveBodyProperty('nonExistentField')
        })
    })

    describe('Array Length Assertions', () => {
        it('should assert array length with toHaveBodyLength()', async () => {
            const response = await api.get<User[]>('/users')

            assertResponse(response).toBeOk().toHaveBodyLength(10) // JSONPlaceholder returns 10 users
        })

        it('should assert posts array length', async () => {
            const response = await api.get<Post[]>('/posts')

            assertResponse(response).toBeOk().toHaveBodyLength(100) // JSONPlaceholder returns 100 posts
        })

        it('should assert filtered results length', async () => {
            // Use direct URL with query string for filtering
            const response = await api.get<Post[]>('/posts?userId=1')

            assertResponse(response).toBeOk().toHaveBodyLength(10) // User 1 has 10 posts
        })
    })

    describe('Complex Property Assertions', () => {
        it('should combine multiple property assertions', async () => {
            const response = await api.get<User>('/users/1')

            assertResponse(response)
                .toBeOk()
                .toHaveBody()
                .toHaveBodyProperty('id', 1)
                .toHaveBodyProperty('name', 'Leanne Graham')
                .toHaveBodyProperty('address.city', 'Gwenborough')
                .toHaveBodyProperty('company.name', 'Romaguera-Crona')
        })

        it('should assert post properties', async () => {
            const response = await api.get<Post>('/posts/1')

            assertResponse(response)
                .toBeOk()
                .toHaveBodyProperty('id', 1)
                .toHaveBodyProperty('userId', 1)
                .toHaveBodyProperty('title')
                .toHaveBodyProperty('body')
        })

        it('should assert created resource properties', async () => {
            const newPost = {
                title: 'Test Title',
                body: 'Test body content',
                userId: 1,
            }

            const response = await api.post<Post>('/posts', newPost)

            assertResponse(response)
                .toHaveStatus(201)
                .toHaveBodyProperty('title', 'Test Title')
                .toHaveBodyProperty('body', 'Test body content')
                .toHaveBodyProperty('userId', 1)
                .toHaveBodyProperty('id') // New ID assigned
        })
    })

    describe('Header Assertions', () => {
        it('should assert header exists', async () => {
            const response = await api.get('/users')

            assertResponse(response).toHaveHeader('content-type')
        })

        it('should assert header has value', async () => {
            const response = await api.get('/users')

            assertResponse(response).toHaveHeader('content-type', 'application/json; charset=utf-8')
        })

        it('should assert content type shorthand', async () => {
            const response = await api.get('/users')

            assertResponse(response).toHaveContentType('application/json; charset=utf-8')
        })

        it('should negate header assertions', async () => {
            const response = await api.get('/users')

            // Assert that custom header is not present
            assertResponse(response).not.toHaveHeader('x-custom-header')
        })
    })

    describe('Performance Assertions', () => {
        it('should assert response time with toRespondWithin()', async () => {
            const response = await api.get('/users/1')

            // Response should be within 5 seconds
            assertResponse(response).toBeOk().toRespondWithin(5000)
        })

        it('should combine performance with other assertions', async () => {
            const response = await api.get('/users/1')

            assertResponse(response)
                .toBeOk()
                .toRespondWithin(5000)
                .toHaveBodyProperty('id', 1)
                .toHaveContentType('application/json; charset=utf-8')
        })
    })

    describe('getResponse() Helper', () => {
        it('should access underlying response', async () => {
            const response = await api.get<User>('/users/1')

            const assertions = assertResponse(response)
            const underlyingResponse = assertions.getResponse()

            expect(underlyingResponse.status).to.equal(200)
            expect(underlyingResponse.data.id).to.equal(1)
            expect(underlyingResponse.duration).to.be.above(0)
        })
    })
})
