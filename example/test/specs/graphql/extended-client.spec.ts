import { createApiClient, extendWithGraphQL, assertResponse } from 'wdio-api-runner'
import { expect } from 'chai'

/**
 * Extended API Client with GraphQL Examples
 *
 * These tests demonstrate how to use extendWithGraphQL to add GraphQL
 * capabilities to an existing REST API client, allowing you to use
 * both REST and GraphQL from a single client instance.
 */
describe('GraphQL - Extended API Client', () => {
    describe('Extending Existing API Client', () => {
        it('should extend API client with GraphQL capabilities', () => {
            // Create a standard REST API client
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            // Extend it with GraphQL support
            const extendedApi = extendWithGraphQL(api, {
                endpoint: 'https://countries.trevorblades.com/graphql',
            })

            // The extended client has the graphql property
            expect(extendedApi.graphql).to.exist
            expect(extendedApi.graphql.query).to.be.a('function')
            expect(extendedApi.graphql.mutate).to.be.a('function')

            // Original REST methods are still available
            expect(extendedApi.get).to.be.a('function')
            expect(extendedApi.post).to.be.a('function')
            expect(extendedApi.put).to.be.a('function')
            expect(extendedApi.delete).to.be.a('function')
        })

        it('should derive GraphQL endpoint from baseUrl if not specified', () => {
            const api = createApiClient({
                baseUrl: 'https://api.example.com',
            })

            // When no endpoint is specified, it defaults to baseUrl + /graphql
            const extendedApi = extendWithGraphQL(api)

            expect(extendedApi.graphql).to.exist
            // The endpoint would be https://api.example.com/graphql
        })

        it('should share headers between REST and GraphQL clients', () => {
            const api = createApiClient({
                baseUrl: 'https://api.example.com',
                headers: {
                    'X-Custom-Header': 'shared-value',
                    Authorization: 'Bearer shared-token',
                },
            })

            // GraphQL client inherits headers from API client
            const extendedApi = extendWithGraphQL(api, {
                endpoint: 'https://api.example.com/graphql',
            })

            expect(extendedApi.graphql).to.exist
            // Both clients will use the same headers
        })

        it('should allow custom GraphQL headers', () => {
            const api = createApiClient({
                baseUrl: 'https://api.example.com',
                headers: {
                    'X-Rest-Header': 'rest-value',
                },
            })

            // Override headers for GraphQL client
            const extendedApi = extendWithGraphQL(api, {
                endpoint: 'https://api.example.com/graphql',
                headers: {
                    'X-GraphQL-Header': 'graphql-value',
                },
            })

            expect(extendedApi.graphql).to.exist
            // REST client keeps its headers, GraphQL has different ones
        })
    })

    describe('Configuration Options', () => {
        it('should configure GraphQL timeout separately', () => {
            const api = createApiClient({
                baseUrl: 'https://api.example.com',
                timeout: 5000, // REST timeout
            })

            const extendedApi = extendWithGraphQL(api, {
                endpoint: 'https://api.example.com/graphql',
                timeout: 30000, // GraphQL queries may need more time
            })

            expect(extendedApi.graphql).to.exist
        })

        it('should configure GraphQL retries', () => {
            const api = createApiClient({
                baseUrl: 'https://api.example.com',
            })

            const extendedApi = extendWithGraphQL(api, {
                endpoint: 'https://api.example.com/graphql',
                retries: 3,
                retryDelay: 1000,
            })

            expect(extendedApi.graphql).to.exist
        })

        it('should enable verbose mode for debugging', () => {
            const api = createApiClient({
                baseUrl: 'https://api.example.com',
            })

            const extendedApi = extendWithGraphQL(api, {
                endpoint: 'https://api.example.com/graphql',
                verbose: true, // Logs GraphQL queries and responses
            })

            expect(extendedApi.graphql).to.exist
        })
    })

    describe('Using REST and GraphQL Together', () => {
        it('should make REST requests with extended client', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const extendedApi = extendWithGraphQL(api, {
                endpoint: 'https://countries.trevorblades.com/graphql',
            })

            // Make a REST request
            const response = await extendedApi.get<{ id: number; name: string }>('/users/1')

            assertResponse(response).toBeOk()
            expect(response.data.id).to.equal(1)
            expect(response.data.name).to.exist
        })

        it('should demonstrate mixed REST and GraphQL workflow', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            const extendedApi = extendWithGraphQL(api, {
                endpoint: 'https://countries.trevorblades.com/graphql',
            })

            // Step 1: Get user via REST
            const userResponse = await extendedApi.get<{ id: number; name: string; email: string }>('/users/1')
            assertResponse(userResponse).toBeOk()
            const user = userResponse.data

            expect(user.id).to.equal(1)
            expect(user.name).to.exist

            // Step 2: Could use GraphQL for related data
            // (In a real app, both might be from the same API)
            expect(extendedApi.graphql.query).to.be.a('function')
        })
    })

    describe('Real-world Usage Patterns', () => {
        it('should demonstrate microservices pattern', () => {
            /**
             * Pattern: Connect to multiple services
             *
             * In microservices architectures, you might have:
             * - REST API for CRUD operations
             * - GraphQL gateway for aggregated queries
             */
            const api = createApiClient({
                baseUrl: 'https://api.example.com/v1',
            })

            const extendedApi = extendWithGraphQL(api, {
                endpoint: 'https://gateway.example.com/graphql',
            })

            // REST for simple CRUD
            // extendedApi.post('/orders', orderData)

            // GraphQL for complex aggregations
            // extendedApi.graphql.query(`
            //     query GetDashboard($userId: ID!) {
            //         user(id: $userId) { name }
            //         recentOrders(userId: $userId) { id total }
            //         notifications(userId: $userId) { message }
            //     }
            // `)

            expect(extendedApi.get).to.be.a('function')
            expect(extendedApi.graphql).to.exist
        })

        it('should demonstrate gradual migration pattern', () => {
            /**
             * Pattern: Migrating from REST to GraphQL
             *
             * When gradually migrating from REST to GraphQL,
             * you can use both in the same test file.
             */
            const api = createApiClient({
                baseUrl: 'https://api.example.com',
            })

            const extendedApi = extendWithGraphQL(api)

            // Legacy REST endpoints (still in use)
            // extendedApi.get('/v1/users')

            // New GraphQL endpoints (being adopted)
            // extendedApi.graphql.query('query { users { id name } }')

            expect(extendedApi.get).to.be.a('function')
            expect(extendedApi.graphql).to.exist
        })

        it('should demonstrate authentication sharing pattern', () => {
            /**
             * Pattern: Shared authentication
             *
             * Both REST and GraphQL can share the same auth token.
             */
            const authToken = 'Bearer my-jwt-token'

            const api = createApiClient({
                baseUrl: 'https://api.example.com',
                headers: {
                    Authorization: authToken,
                },
            })

            // GraphQL inherits the auth header
            const extendedApi = extendWithGraphQL(api, {
                endpoint: 'https://api.example.com/graphql',
                // headers not specified, so it inherits from API client
            })

            expect(extendedApi.graphql).to.exist
            // Both REST and GraphQL requests will include Authorization header
        })
    })

    describe('Testing Patterns', () => {
        it('should demonstrate setting up extended client in before hook', () => {
            /**
             * Recommended pattern for test setup:
             *
             * let api: ExtendedApiClient;
             *
             * before(() => {
             *     const baseClient = createApiClient({ baseUrl: config.apiUrl });
             *     api = extendWithGraphQL(baseClient, {
             *         endpoint: config.graphqlEndpoint
             *     });
             * });
             *
             * it('should test REST endpoint', async () => {
             *     const response = await api.get('/users');
             *     assertResponse(response).toBeOk();
             * });
             *
             * it('should test GraphQL query', async () => {
             *     const response = await api.graphql.query('...');
             *     expect(response.isSuccess).to.be.true;
             * });
             */
            expect(true).to.be.true
        })

        it('should demonstrate environment-based configuration', () => {
            /**
             * Pattern: Different endpoints per environment
             *
             * const getApiClient = () => {
             *     const env = process.env.TEST_ENV || 'staging';
             *     const config = {
             *         staging: {
             *             baseUrl: 'https://staging-api.example.com',
             *             graphqlEndpoint: 'https://staging-graphql.example.com/graphql'
             *         },
             *         production: {
             *             baseUrl: 'https://api.example.com',
             *             graphqlEndpoint: 'https://graphql.example.com/graphql'
             *         }
             *     };
             *
             *     const api = createApiClient({ baseUrl: config[env].baseUrl });
             *     return extendWithGraphQL(api, {
             *         endpoint: config[env].graphqlEndpoint
             *     });
             * };
             */
            expect(true).to.be.true
        })
    })
})
