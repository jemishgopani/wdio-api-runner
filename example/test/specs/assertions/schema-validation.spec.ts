import { createApiClient, assertResponse } from 'wdio-api-runner'
import { expect } from 'chai'
import type { User, Post } from '../../support/types.js'

describe('Assertions - Schema Validation', () => {
    const api = createApiClient({
        baseUrl: 'https://jsonplaceholder.typicode.com',
    })

    describe('Basic Schema Validation', () => {
        it('should validate user schema with toMatchSchema()', async () => {
            const response = await api.get<User>('/users/1')

            const userSchema = {
                type: 'object',
                required: ['id', 'name', 'username', 'email'],
                properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                    username: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string' },
                    website: { type: 'string' },
                },
            }

            assertResponse(response).toBeOk().toMatchSchema(userSchema)
        })

        it('should validate post schema', async () => {
            const response = await api.get<Post>('/posts/1')

            const postSchema = {
                type: 'object',
                required: ['id', 'userId', 'title', 'body'],
                properties: {
                    id: { type: 'integer' },
                    userId: { type: 'integer' },
                    title: { type: 'string' },
                    body: { type: 'string' },
                },
                additionalProperties: false,
            }

            assertResponse(response).toBeOk().toMatchSchema(postSchema)
        })
    })

    describe('Nested Object Schema', () => {
        it('should validate user with nested address schema', async () => {
            const response = await api.get<User>('/users/1')

            const userWithAddressSchema = {
                type: 'object',
                required: ['id', 'name', 'address'],
                properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                    address: {
                        type: 'object',
                        required: ['street', 'city', 'zipcode'],
                        properties: {
                            street: { type: 'string' },
                            suite: { type: 'string' },
                            city: { type: 'string' },
                            zipcode: { type: 'string' },
                            geo: {
                                type: 'object',
                                properties: {
                                    lat: { type: 'string' },
                                    lng: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            }

            assertResponse(response).toBeOk().toMatchSchema(userWithAddressSchema)
        })

        it('should validate user with company schema', async () => {
            const response = await api.get<User>('/users/1')

            const userWithCompanySchema = {
                type: 'object',
                required: ['company'],
                properties: {
                    company: {
                        type: 'object',
                        required: ['name', 'catchPhrase', 'bs'],
                        properties: {
                            name: { type: 'string' },
                            catchPhrase: { type: 'string' },
                            bs: { type: 'string' },
                        },
                    },
                },
            }

            assertResponse(response).toBeOk().toMatchSchema(userWithCompanySchema)
        })
    })

    describe('Array Schema Validation', () => {
        it('should validate array of users', async () => {
            const response = await api.get<User[]>('/users')

            const usersArraySchema = {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['id', 'name', 'email'],
                    properties: {
                        id: { type: 'number' },
                        name: { type: 'string' },
                        email: { type: 'string' },
                    },
                },
                minItems: 1,
                maxItems: 10,
            }

            assertResponse(response).toBeOk().toMatchSchema(usersArraySchema)
        })

        it('should validate array of posts', async () => {
            // Use URL query string to filter posts by userId
            const response = await api.get<Post[]>('/posts?userId=1')

            const postsSchema = {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['id', 'userId', 'title', 'body'],
                    properties: {
                        id: { type: 'integer' },
                        userId: { type: 'integer', const: 1 }, // All posts belong to user 1
                        title: { type: 'string', minLength: 1 },
                        body: { type: 'string', minLength: 1 },
                    },
                },
            }

            assertResponse(response).toBeOk().toMatchSchema(postsSchema)
        })
    })

    describe('Schema with Constraints', () => {
        it('should validate string patterns', async () => {
            const response = await api.get<User>('/users/1')

            const schemaWithPatterns = {
                type: 'object',
                properties: {
                    email: {
                        type: 'string',
                        format: 'email',
                    },
                    website: {
                        type: 'string',
                    },
                    phone: {
                        type: 'string',
                    },
                },
            }

            assertResponse(response).toBeOk().toMatchSchema(schemaWithPatterns)
        })

        it('should validate number ranges', async () => {
            const response = await api.get<User>('/users/1')

            const schemaWithRanges = {
                type: 'object',
                properties: {
                    id: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 100,
                    },
                },
            }

            assertResponse(response).toBeOk().toMatchSchema(schemaWithRanges)
        })

        it('should validate string length constraints', async () => {
            const response = await api.get<Post>('/posts/1')

            const schemaWithLengths = {
                type: 'object',
                properties: {
                    title: {
                        type: 'string',
                        minLength: 1,
                        maxLength: 500,
                    },
                    body: {
                        type: 'string',
                        minLength: 1,
                    },
                },
            }

            assertResponse(response).toBeOk().toMatchSchema(schemaWithLengths)
        })
    })

    describe('Schema with Enum Values', () => {
        it('should validate with enum constraints', async () => {
            // Using HTTPBin to get predictable response
            const httpbin = createApiClient({ baseUrl: 'https://httpbin.org' })
            const response = await httpbin.get<{ headers: { Host: string } }>('/headers')

            const schemaWithEnum = {
                type: 'object',
                properties: {
                    headers: {
                        type: 'object',
                        properties: {
                            Host: {
                                type: 'string',
                                enum: ['httpbin.org'],
                            },
                        },
                    },
                },
            }

            assertResponse(response).toBeOk().toMatchSchema(schemaWithEnum)
        })
    })

    describe('Combining Schema with Other Assertions', () => {
        it('should combine schema validation with property assertions', async () => {
            const response = await api.get<User>('/users/1')

            const basicSchema = {
                type: 'object',
                required: ['id', 'name', 'email'],
            }

            assertResponse(response)
                .toBeOk()
                .toMatchSchema(basicSchema)
                .toHaveBodyProperty('id', 1)
                .toHaveBodyProperty('name', 'Leanne Graham')
                .toHaveContentType('application/json; charset=utf-8')
        })

        it('should combine schema validation with performance assertions', async () => {
            const response = await api.get<User[]>('/users')

            const usersSchema = {
                type: 'array',
                minItems: 1,
            }

            assertResponse(response).toBeOk().toMatchSchema(usersSchema).toRespondWithin(5000).toHaveBodyLength(10)
        })
    })

    describe('Complete API Response Schema', () => {
        it('should validate complete user response schema', async () => {
            const response = await api.get<User>('/users/1')

            // Complete user schema matching JSONPlaceholder API
            const completeUserSchema = {
                type: 'object',
                required: ['id', 'name', 'username', 'email', 'address', 'phone', 'website', 'company'],
                properties: {
                    id: { type: 'integer', minimum: 1 },
                    name: { type: 'string', minLength: 1 },
                    username: { type: 'string', minLength: 1 },
                    email: { type: 'string', format: 'email' },
                    address: {
                        type: 'object',
                        required: ['street', 'suite', 'city', 'zipcode', 'geo'],
                        properties: {
                            street: { type: 'string' },
                            suite: { type: 'string' },
                            city: { type: 'string' },
                            zipcode: { type: 'string' },
                            geo: {
                                type: 'object',
                                required: ['lat', 'lng'],
                                properties: {
                                    lat: { type: 'string' },
                                    lng: { type: 'string' },
                                },
                            },
                        },
                    },
                    phone: { type: 'string' },
                    website: { type: 'string' },
                    company: {
                        type: 'object',
                        required: ['name', 'catchPhrase', 'bs'],
                        properties: {
                            name: { type: 'string' },
                            catchPhrase: { type: 'string' },
                            bs: { type: 'string' },
                        },
                    },
                },
                additionalProperties: false,
            }

            assertResponse(response).toBeOk().toMatchSchema(completeUserSchema)
        })
    })
})
