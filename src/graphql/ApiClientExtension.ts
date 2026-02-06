/**
 * ApiClient GraphQL Extension
 *
 * Provides optional integration between the REST ApiClient and GraphQL client,
 * allowing access via `api.graphql`.
 */

import type { ApiClient } from '../shared/types.js'
import type { GraphQLClient, GraphQLClientConfig } from './types.js'
import { createGraphQLClient } from './GraphQLClient.js'

/**
 * Extended ApiClient with GraphQL support
 */
export interface ExtendedApiClient extends ApiClient {
    /** GraphQL client accessible via api.graphql */
    graphql: GraphQLClient
}

/**
 * Extends an existing ApiClient with GraphQL capabilities
 *
 * This allows you to use both REST and GraphQL from a single client instance:
 *
 * @example
 * ```typescript
 * import { createApiClient } from 'wdio-api-runner'
 * import { extendWithGraphQL } from 'wdio-api-runner'
 *
 * const api = createApiClient(config)
 * const extendedApi = extendWithGraphQL(api, {
 *     endpoint: 'https://api.example.com/graphql'
 * })
 *
 * // REST requests
 * await extendedApi.get('/users')
 *
 * // GraphQL requests
 * await extendedApi.graphql.query(`
 *     query { users { id name } }
 * `)
 * ```
 *
 * @param apiClient - The existing ApiClient to extend
 * @param config - GraphQL client configuration (endpoint is required)
 * @returns Extended ApiClient with graphql property
 */
export function extendWithGraphQL(
    apiClient: ApiClient,
    config: Partial<GraphQLClientConfig> & { endpoint?: string } = {}
): ExtendedApiClient {
    // Derive endpoint from ApiClient baseUrl if not provided
    const endpoint = config.endpoint ?? `${apiClient.getBaseUrl()}/graphql`

    // Create GraphQL client with shared headers if not specified
    const graphqlConfig: GraphQLClientConfig = {
        endpoint,
        headers: config.headers ?? apiClient.getHeaders(),
        timeout: config.timeout,
        retries: config.retries,
        retryDelay: config.retryDelay,
        verbose: config.verbose,
        type: config.type ?? 'fetch',
    }

    const graphqlClient = createGraphQLClient(graphqlConfig)

    // Return extended client
    return {
        ...apiClient,
        graphql: graphqlClient,
    }
}

/**
 * Create an ApiClient factory that includes GraphQL support
 *
 * @example
 * ```typescript
 * import { createApiClientWithGraphQL } from 'wdio-api-runner'
 *
 * const api = createApiClientWithGraphQL(config, {
 *     endpoint: 'https://api.example.com/graphql'
 * })
 *
 * await api.graphql.query(...)
 * ```
 */
export function createApiClientWithGraphQL(
    config: WebdriverIO.Config,
    graphqlConfig?: Partial<GraphQLClientConfig>
): ExtendedApiClient {
    // Import dynamically to avoid circular dependency

    const { createApiClient } = require('../client/ApiClient.js')

    const apiClient = createApiClient(config)
    return extendWithGraphQL(apiClient, graphqlConfig)
}
