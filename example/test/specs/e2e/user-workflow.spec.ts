import {
    createApiClient,
    assertResponse,
    createMetricsCollector,
    createMetricsInterceptors,
    formatConsoleReport,
} from 'wdio-api-runner'
import { expect } from 'chai'
import type { User, Post, Comment } from '../../support/types.js'

/**
 * End-to-End API Workflow Example
 *
 * This test suite demonstrates a complete API testing workflow
 * using wdio-api-runner with:
 * - Full CRUD operations
 * - Fluent assertions
 * - Performance metrics
 * - Real-world patterns
 */
describe('E2E - User API Workflow', () => {
    const api = createApiClient({
        baseUrl: 'https://jsonplaceholder.typicode.com',
    })

    // Set up metrics collection for the entire suite
    const metrics = createMetricsCollector({
        slowThreshold: 1000, // 1 second
    })
    const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)

    before(() => {
        api.addRequestInterceptor(requestInterceptor)
        api.addResponseInterceptor(responseInterceptor)
    })

    after(() => {
        // Print metrics report after all tests
        const report = metrics.getReport()
        console.log('\n=== API Test Metrics Report ===')
        console.log(formatConsoleReport(report))
    })

    describe('User CRUD Operations', () => {
        let createdUserId: number

        it('should list all users', async () => {
            const response = await api.get<User[]>('/users')

            assertResponse(response).toBeOk().toHaveContentType('application/json; charset=utf-8').toHaveBodyLength(10)

            // Verify user structure
            const firstUser = response.data[0]
            expect(firstUser.id).to.exist
            expect(firstUser.name).to.exist
            expect(firstUser.email).to.exist
        })

        it('should get a single user by ID', async () => {
            const response = await api.get<User>('/users/1')

            assertResponse(response)
                .toBeOk()
                .toHaveBodyProperty('id', 1)
                .toHaveBodyProperty('name', 'Leanne Graham')
                .toHaveBodyProperty('email', 'Sincere@april.biz')
                .toHaveBodyProperty('address.city', 'Gwenborough')
                .toRespondWithin(5000)
        })

        it('should create a new user', async () => {
            const newUser = {
                name: 'John Doe',
                username: 'johndoe',
                email: 'john.doe@example.com',
                phone: '555-1234',
                website: 'johndoe.com',
                company: {
                    name: 'Doe Industries',
                    catchPhrase: 'Making things happen',
                    bs: 'innovative solutions',
                },
            }

            const response = await api.post<User>('/users', newUser)

            assertResponse(response)
                .toHaveStatus(201)
                .toHaveBodyProperty('name', 'John Doe')
                .toHaveBodyProperty('email', 'john.doe@example.com')
                .toHaveBodyProperty('company.name', 'Doe Industries')

            // Store ID for later tests
            createdUserId = response.data.id
            expect(createdUserId).to.exist
        })

        it('should update user with PUT', async () => {
            const updatedUser = {
                id: 1,
                name: 'Updated User Name',
                username: 'updateduser',
                email: 'updated@example.com',
                phone: '555-9999',
                website: 'updated.com',
                address: {
                    street: 'New Street',
                    suite: 'Suite 100',
                    city: 'New City',
                    zipcode: '12345',
                    geo: { lat: '0', lng: '0' },
                },
                company: {
                    name: 'Updated Company',
                    catchPhrase: 'New catchphrase',
                    bs: 'new bs',
                },
            }

            const response = await api.put<User>('/users/1', updatedUser)

            assertResponse(response)
                .toBeOk()
                .toHaveBodyProperty('name', 'Updated User Name')
                .toHaveBodyProperty('email', 'updated@example.com')
                .toHaveBodyProperty('address.city', 'New City')
        })

        it('should partially update user with PATCH', async () => {
            const partialUpdate = {
                name: 'Partially Updated Name',
            }

            const response = await api.patch<User>('/users/1', partialUpdate)

            assertResponse(response)
                .toBeOk()
                .toHaveBodyProperty('name', 'Partially Updated Name')
                .toHaveBodyProperty('id', 1) // Original ID preserved
        })

        it('should delete a user', async () => {
            const response = await api.delete('/users/1')

            assertResponse(response).toBeOk()
        })
    })

    describe('User Posts Workflow', () => {
        it('should get all posts for a user', async () => {
            const response = await api.get<Post[]>('/users/1/posts')

            assertResponse(response).toBeOk().toHaveBody()

            // All posts should belong to user 1
            response.data.forEach((post) => {
                expect(post.userId).to.equal(1)
            })
        })

        it('should create a post for a user', async () => {
            const newPost = {
                title: 'My New Post',
                body: 'This is the content of my new post. It contains interesting information.',
                userId: 1,
            }

            const response = await api.post<Post>('/posts', newPost)

            assertResponse(response)
                .toHaveStatus(201)
                .toHaveBodyProperty('title', 'My New Post')
                .toHaveBodyProperty('userId', 1)
                .toHaveBodyProperty('id') // New ID assigned

            // Validate schema
            const postSchema = {
                type: 'object',
                required: ['id', 'title', 'body', 'userId'],
                properties: {
                    id: { type: 'integer' },
                    title: { type: 'string' },
                    body: { type: 'string' },
                    userId: { type: 'integer' },
                },
            }

            assertResponse(response).toMatchSchema(postSchema)
        })

        it('should get comments for a post', async () => {
            const response = await api.get<Comment[]>('/posts/1/comments')

            assertResponse(response).toBeOk().toHaveBody()

            // All comments should belong to post 1
            response.data.forEach((comment) => {
                expect(comment.postId).to.equal(1)
                expect(comment.email).to.exist
                expect(comment.body).to.exist
            })
        })
    })

    describe('Pagination and Filtering', () => {
        it('should support pagination with query params', async () => {
            const response = await api.get<Post[]>('/posts?_page=1&_limit=5')

            assertResponse(response).toBeOk().toHaveBodyLength(5)
        })

        it('should filter posts by userId', async () => {
            const response = await api.get<Post[]>('/posts?userId=2')

            assertResponse(response).toBeOk()

            // All posts should belong to user 2
            response.data.forEach((post) => {
                expect(post.userId).to.equal(2)
            })
        })

        it('should get specific post by ID', async () => {
            const response = await api.get<Post>('/posts/5')

            assertResponse(response).toBeOk().toHaveBodyProperty('id', 5)
        })
    })

    describe('Error Handling', () => {
        it('should handle 404 for non-existent user', async () => {
            const response = await api.get('/users/9999')

            assertResponse(response).toHaveStatus(404).toBeClientError().not.toBeOk()
        })

        it('should handle invalid post ID', async () => {
            const response = await api.get('/posts/99999')

            assertResponse(response).toHaveStatus(404)
        })
    })

    describe('Complete Workflow Integration', () => {
        it('should complete a full user-post-comment workflow', async () => {
            // Step 1: Get a user
            const userResponse = await api.get<User>('/users/3')
            assertResponse(userResponse).toBeOk()
            const user = userResponse.data

            // Step 2: Get user's posts
            const postsResponse = await api.get<Post[]>(`/users/${user.id}/posts`)
            assertResponse(postsResponse).toBeOk()
            const userPosts = postsResponse.data

            // Step 3: Create a new post for the user
            const newPost = {
                title: `Post by ${user.name}`,
                body: 'This is a test post created during the workflow test.',
                userId: user.id,
            }

            const createPostResponse = await api.post<Post>('/posts', newPost)
            assertResponse(createPostResponse).toHaveStatus(201).toHaveBodyProperty('userId', user.id)

            // Step 4: If user has posts, get comments from first post
            if (userPosts.length > 0) {
                const commentsResponse = await api.get<Comment[]>(`/posts/${userPosts[0].id}/comments`)
                assertResponse(commentsResponse).toBeOk()
            }

            // Step 5: Update the user
            const updateResponse = await api.patch<User>(`/users/${user.id}`, {
                name: 'Updated During Workflow',
            })
            assertResponse(updateResponse).toBeOk().toHaveBodyProperty('id', user.id)

            // All steps completed successfully
            console.log(`Completed workflow for user: ${user.name}`)
            console.log(`User has ${userPosts.length} posts`)
        })
    })

    describe('Schema Validation Workflow', () => {
        it('should validate user list schema', async () => {
            const response = await api.get<User[]>('/users')

            const usersSchema = {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['id', 'name', 'username', 'email'],
                    properties: {
                        id: { type: 'integer', minimum: 1 },
                        name: { type: 'string', minLength: 1 },
                        username: { type: 'string', minLength: 1 },
                        email: { type: 'string', format: 'email' },
                        phone: { type: 'string' },
                        website: { type: 'string' },
                        address: {
                            type: 'object',
                            properties: {
                                street: { type: 'string' },
                                city: { type: 'string' },
                                zipcode: { type: 'string' },
                            },
                        },
                        company: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                            },
                        },
                    },
                },
                minItems: 1,
            }

            assertResponse(response).toBeOk().toMatchSchema(usersSchema)
        })
    })

    describe('Performance Verification', () => {
        it('should respond within acceptable time', async () => {
            const response = await api.get('/users')

            // API should respond within 3 seconds
            assertResponse(response).toBeOk().toRespondWithin(3000)
        })

        it('should handle multiple concurrent requests', async () => {
            const requests = [
                api.get('/users/1'),
                api.get('/users/2'),
                api.get('/users/3'),
                api.get('/posts/1'),
                api.get('/posts/2'),
            ]

            const responses = await Promise.all(requests)

            // All requests should succeed
            responses.forEach((response) => {
                assertResponse(response).toBeOk()
            })
        })
    })
})
