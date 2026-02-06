/**
 * GraphQL Client Module for wdio-api-runner
 *
 * Provides a comprehensive GraphQL client with:
 * - Query and mutation support
 * - Fluent query builder
 * - Tagged template literal (gql)
 * - WebSocket subscriptions (graphql-ws protocol)
 * - SSE subscriptions
 * - HAR logging integration
 * - Request/response interceptors (compatible with auth module)
 *
 * @example Basic usage
 * ```typescript
 * import { createGraphQLClient, gql } from 'wdio-api-runner'
 *
 * const graphql = createGraphQLClient({
 *     endpoint: 'https://api.example.com/graphql'
 * })
 *
 * const GET_USER = gql`
 *     query GetUser($id: ID!) {
 *         user(id: $id) { id name email }
 *     }
 * `
 *
 * const response = await graphql.query(GET_USER, { id: '123' })
 *
 * if (response.isSuccess) {
 *     console.log(response.data.data.user)
 * }
 * ```
 *
 * @example With authentication
 * ```typescript
 * import { bearerAuth } from 'wdio-api-runner'
 *
 * const auth = bearerAuth({ token: 'my-token' })
 * graphql.addRequestInterceptor(auth.interceptor)
 * ```
 *
 * @example Query builder
 * ```typescript
 * import { createQueryBuilder } from 'wdio-api-runner'
 *
 * const query = createQueryBuilder()
 *     .query('GetUsers')
 *     .variable('limit', 'Int', 10)
 *     .fieldWithArgs('users', { limit: '$limit' })
 *     .select('id', 'name', 'email')
 *     .build()
 * ```
 *
 * @example Subscriptions
 * ```typescript
 * graphql.subscriptions.configure({
 *     defaultProtocol: 'websocket',
 *     webSocket: { url: 'wss://api.example.com/graphql' }
 * })
 *
 * const subscription = graphql.subscriptions.subscribe(
 *     'subscription { messageReceived { id content } }',
 *     { onData: (data) => console.log(data) }
 * )
 * ```
 */

// Core client
export { createGraphQLClient } from './GraphQLClient.js'

// Query builder
export { createQueryBuilder, gql, graphql } from './QueryBuilder.js'

// ApiClient extension
export { extendWithGraphQL, createApiClientWithGraphQL, type ExtendedApiClient } from './ApiClientExtension.js'

// Error classes
export {
    GraphQLClientError,
    GraphQLNetworkError,
    GraphQLExecutionError,
    GraphQLSubscriptionError,
    GraphQLQueryBuilderError,
    createExecutionError,
} from './errors.js'

// Utility functions
export {
    normalizeOperation,
    extractOperationName,
    parseOperationType,
    isSubscription,
    truncateForLog,
    formatVariablesForLog,
    generateId,
    buildRequestBody,
} from './utils.js'

// Constants
export {
    DEFAULT_GRAPHQL_TIMEOUT,
    DEFAULT_GRAPHQL_HEADERS,
    DEFAULT_RETRIES,
    DEFAULT_RETRY_DELAY,
    DEFAULT_WS_CONNECTION_TIMEOUT,
    DEFAULT_WS_KEEP_ALIVE_INTERVAL,
    DEFAULT_WS_RECONNECT_DELAY,
    DEFAULT_WS_MAX_RETRIES,
    DEFAULT_SSE_RECONNECT_DELAY,
    DEFAULT_SSE_MAX_RETRIES,
    GRAPHQL_WS_PROTOCOL,
} from './constants.js'

// Subscriptions
export { createSubscriptionManager, createWebSocketSubscription, createSSESubscription } from './subscriptions/index.js'

// Types
export type {
    // Core types
    GraphQLOperationType,
    GraphQLVariables,
    GraphQLOperation,
    GraphQLOperationInput,
    GraphQLErrorLocation,
    GraphQLError,
    GraphQLResponseData,
    GraphQLResponse,

    // Configuration
    BaseGraphQLConfig,
    FetchGraphQLConfig,
    GraphQLRequestConfig,
    GraphQLClientConfig,
    GraphQLRequestOptions,
    GraphQLRunnerOptions,

    // Client interface
    GraphQLClient,

    // Query builder
    VariableDefinition,
    FieldSelection,
    FragmentDefinition,
    QueryBuilder,
    GraphQLTagResult,
} from './types.js'

// Subscription types
export type {
    SubscriptionProtocol,
    SubscriptionState,
    SubscriptionCallbacks,
    Subscription,
    SubscriptionManager,
    SubscriptionManagerConfig,
    WebSocketSubscriptionConfig,
    SSESubscriptionConfig,
} from './subscriptions/types.js'
