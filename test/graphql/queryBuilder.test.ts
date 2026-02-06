import { describe, it, expect } from 'vitest'
import { createQueryBuilder, gql, graphql } from '../../src/graphql/index.js'

describe('Query Builder', () => {
    describe('createQueryBuilder', () => {
        it('should create a query builder', () => {
            const builder = createQueryBuilder()

            expect(builder).toBeDefined()
            expect(builder.query).toBeInstanceOf(Function)
            expect(builder.mutation).toBeInstanceOf(Function)
            expect(builder.subscription).toBeInstanceOf(Function)
        })

        it('should build a simple query', () => {
            const result = createQueryBuilder().query('GetUsers').select('id', 'name').build()

            expect(result.query).toContain('query GetUsers')
            expect(result.query).toContain('id')
            expect(result.query).toContain('name')
            expect(result.operationName).toBe('GetUsers')
        })

        it('should build a query with variables', () => {
            const result = createQueryBuilder().query('GetUser').variable('id', 'ID!').field('user').build()

            expect(result.query).toContain('$id: ID!')
            expect(result.query).toContain('user')
        })

        it('should build a query with variable default value', () => {
            const result = createQueryBuilder().query('GetUsers').variable('limit', 'Int', 10).field('users').build()

            expect(result.query).toContain('$limit: Int = 10')
        })

        it('should build a mutation', () => {
            const result = createQueryBuilder()
                .mutation('CreateUser')
                .variable('name', 'String!')
                .field('createUser')
                .build()

            expect(result.query).toContain('mutation CreateUser')
            expect(result.query).toContain('$name: String!')
        })

        it('should build a subscription', () => {
            const result = createQueryBuilder().subscription('OnMessageReceived').field('messageReceived').build()

            expect(result.query).toContain('subscription OnMessageReceived')
        })

        it('should support field with arguments', () => {
            const result = createQueryBuilder()
                .query('GetUsers')
                .fieldWithArgs('users', { limit: '$limit', offset: 0 })
                .build()

            expect(result.query).toContain('users(limit: $limit, offset: 0)')
        })

        it('should support field alias', () => {
            const result = createQueryBuilder().query('GetData').field('users', 'allUsers').build()

            expect(result.query).toContain('allUsers: users')
        })

        it('should support nested fields with selectWith', () => {
            const result = createQueryBuilder()
                .query('GetUsers')
                .selectWith('users', (b) => b.select('id', 'name'))
                .build()

            expect(result.query).toContain('users {')
            expect(result.query).toContain('id')
            expect(result.query).toContain('name')
        })

        it('should support @include directive', () => {
            const result = createQueryBuilder()
                .query('GetUser')
                .variable('includeEmail', 'Boolean!')
                .select('id', 'name')
                .field('email')
                .include('includeEmail')
                .build()

            expect(result.query).toContain('@include(if: $includeEmail)')
        })

        it('should support @skip directive', () => {
            const result = createQueryBuilder()
                .query('GetUser')
                .variable('skipEmail', 'Boolean!')
                .select('id', 'name')
                .field('email')
                .skip('skipEmail')
                .build()

            expect(result.query).toContain('@skip(if: $skipEmail)')
        })

        it('should support fragment spreads', () => {
            const result = createQueryBuilder().query('GetUser').field('user').useFragment('UserFields').build()

            expect(result.query).toContain('...UserFields')
        })

        it('should support inline fragments', () => {
            const result = createQueryBuilder()
                .query('GetNode')
                .field('node')
                .inlineFragment('User', (b) => b.select('name', 'email'))
                .build()

            expect(result.query).toContain('... on User')
        })

        it('should support fragment definitions', () => {
            const result = createQueryBuilder()
                .query('GetUsers')
                .fragment('UserFields', 'User', (b) => b.select('id', 'name'))
                .field('users')
                .useFragment('UserFields')
                .build()

            expect(result.query).toContain('fragment UserFields on User')
            expect(result.query).toContain('...UserFields')
        })

        it('toString should return the query string', () => {
            const builder = createQueryBuilder().query('GetUsers').select('id')

            const queryString = builder.toString()

            expect(queryString).toContain('query GetUsers')
            expect(queryString).toContain('id')
        })
    })

    describe('gql tagged template literal', () => {
        it('should parse a simple query', () => {
            const result = gql`
                query GetUsers {
                    users {
                        id
                        name
                    }
                }
            `

            expect(result.query).toContain('query GetUsers')
            expect(result.operationName).toBe('GetUsers')
        })

        it('should parse a query without name', () => {
            const result = gql`
                query {
                    users {
                        id
                    }
                }
            `

            expect(result.query).toContain('query')
            expect(result.operationName).toBeUndefined()
        })

        it('should parse a mutation', () => {
            const result = gql`
                mutation CreateUser($name: String!) {
                    createUser(name: $name) {
                        id
                    }
                }
            `

            expect(result.query).toContain('mutation CreateUser')
            expect(result.operationName).toBe('CreateUser')
        })

        it('should parse a subscription', () => {
            const result = gql`
                subscription OnMessage {
                    messageReceived {
                        id
                        content
                    }
                }
            `

            expect(result.query).toContain('subscription OnMessage')
            expect(result.operationName).toBe('OnMessage')
        })

        it('should support interpolation', () => {
            const fields = 'id name email'
            const result = gql`
                query GetUser {
                    user { ${fields} }
                }
            `

            expect(result.query).toContain('id name email')
        })

        it('should preserve source', () => {
            const result = gql`
                query {
                    users {
                        id
                    }
                }
            `

            expect(result.source).toBeDefined()
        })
    })

    describe('graphql alias', () => {
        it('should be an alias for gql', () => {
            expect(graphql).toBe(gql)
        })

        it('should work the same as gql', () => {
            const result = graphql`
                query GetUsers {
                    users {
                        id
                    }
                }
            `

            expect(result.operationName).toBe('GetUsers')
        })
    })
})

describe('Query Builder - Complex Queries', () => {
    it('should build a complex nested query', () => {
        const result = createQueryBuilder()
            .query('GetUserWithPosts')
            .variable('userId', 'ID!')
            .variable('includeComments', 'Boolean', false)
            .selectWith('user', (b) =>
                b
                    .fieldWithArgs('user', { id: '$userId' })
                    .select('id', 'name', 'email')
                    .selectWith('posts', (p) =>
                        p
                            .select('id', 'title', 'content')
                            .selectWith('comments', (c) => c.select('id', 'text').include('includeComments'))
                    )
            )
            .build()

        expect(result.query).toContain('query GetUserWithPosts')
        expect(result.query).toContain('$userId: ID!')
        expect(result.query).toContain('$includeComments: Boolean = false')
    })

    it('should build a query with multiple root fields', () => {
        const result = createQueryBuilder()
            .query('GetDashboard')
            .fieldWithArgs('currentUser', {}, 'me')
            .fieldWithArgs('notifications', { limit: 5 })
            .fieldWithArgs('recentActivity', { since: '2024-01-01' })
            .build()

        expect(result.query).toContain('me: currentUser')
        expect(result.query).toContain('notifications(limit: 5)')
        expect(result.query).toContain('recentActivity(since: "2024-01-01")')
    })
})
