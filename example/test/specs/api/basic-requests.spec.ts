import { createApiClient, assertResponse } from 'wdio-api-runner'
import { expect } from 'chai'
import type { User, Post, NewUser } from '../../support/types.js'

describe('API Client - Basic Requests', () => {
    const api = createApiClient({
        baseUrl: 'https://jsonplaceholder.typicode.com',
    })

    describe('GET Requests', () => {
        it('should fetch all users', async () => {
            const response = await api.get<User[]>('/users')

            assertResponse(response).toBeOk().toHaveHeader('content-type')

            expect(response.data).to.be.an('array')
            expect(response.data.length).to.equal(10)
        })

        it('should fetch a single user by ID', async () => {
            const response = await api.get<User>('/users/1')

            assertResponse(response)
                .toHaveStatus(200)
                .toHaveBodyProperty('id', 1)
                .toHaveBodyProperty('name', 'Leanne Graham')
        })

        it('should return 404 for non-existent user', async () => {
            const response = await api.get('/users/999')

            assertResponse(response).toHaveStatus(404)
        })

        it('should fetch posts with query parameters', async () => {
            // JSONPlaceholder supports filtering via query string
            const response = await api.get<Post[]>('/posts?userId=1')

            assertResponse(response).toBeOk()
            expect(response.data.every((post) => post.userId === 1)).to.be.true
            expect(response.data.length).to.equal(10) // User 1 has 10 posts
        })
    })

    describe('POST Requests', () => {
        it('should create a new user', async () => {
            const newUser: NewUser = {
                name: 'John Doe',
                username: 'johndoe',
                email: 'john@example.com',
            }

            const response = await api.post<User>('/users', newUser)

            assertResponse(response)
                .toHaveStatus(201)
                .toHaveBodyProperty('name', 'John Doe')
                .toHaveBodyProperty('username', 'johndoe')
                .toHaveBodyProperty('email', 'john@example.com')

            // JSONPlaceholder returns the created resource with an ID
            expect(response.data.id).to.exist
        })

        it('should create a post with userId', async () => {
            const newPost = {
                title: 'Test Post',
                body: 'This is a test post body',
                userId: 1,
            }

            const response = await api.post<Post>('/posts', newPost)

            assertResponse(response)
                .toHaveStatus(201)
                .toHaveBodyProperty('title', 'Test Post')
                .toHaveBodyProperty('userId', 1)
        })
    })

    describe('PUT Requests', () => {
        it('should update a user completely', async () => {
            const updatedUser = {
                id: 1,
                name: 'Updated Name',
                username: 'updateduser',
                email: 'updated@example.com',
                phone: '123-456-7890',
                website: 'example.com',
            }

            const response = await api.put<User>('/users/1', updatedUser)

            assertResponse(response)
                .toBeOk()
                .toHaveBodyProperty('name', 'Updated Name')
                .toHaveBodyProperty('email', 'updated@example.com')
        })
    })

    describe('PATCH Requests', () => {
        it('should partially update a user', async () => {
            const partialUpdate = {
                name: 'Partially Updated Name',
            }

            const response = await api.patch<User>('/users/1', partialUpdate)

            assertResponse(response)
                .toBeOk()
                .toHaveBodyProperty('name', 'Partially Updated Name')
                .toHaveBodyProperty('id', 1) // Original ID preserved
        })
    })

    describe('DELETE Requests', () => {
        it('should delete a user', async () => {
            const response = await api.delete('/users/1')

            assertResponse(response).toBeOk()
        })

        it('should delete a post', async () => {
            const response = await api.delete('/posts/1')

            assertResponse(response).toHaveStatus(200)
        })
    })

    describe('Response Properties', () => {
        it('should include response duration', async () => {
            const response = await api.get('/users/1')

            expect(response.duration).to.be.above(0)
            expect(typeof response.duration).to.equal('number')
        })

        it('should include response headers', async () => {
            const response = await api.get('/users/1')

            expect(response.headers).to.exist
            expect(response.headers.get('content-type')).to.include('application/json')
        })

        it('should include status information', async () => {
            const response = await api.get('/users/1')

            expect(response.status).to.equal(200)
            expect(response.statusText).to.equal('OK')
            expect(response.ok).to.be.true
        })
    })
})
