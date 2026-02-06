/**
 * GraphQL Subscriptions Module
 *
 * Provides WebSocket (graphql-ws) and SSE subscription support.
 */

// Subscription manager
export { createSubscriptionManager } from './SubscriptionManager.js'

// Protocol implementations
export { createWebSocketSubscription } from './WebSocketSubscription.js'
export { createSSESubscription } from './SSESubscription.js'

// Types
export type {
    SubscriptionProtocol,
    SubscriptionState,
    SubscriptionCallbacks,
    Subscription,
    SubscriptionManager,
    SubscriptionManagerConfig,
    SubscriptionData,
    WebSocketSubscriptionConfig,
    SSESubscriptionConfig,
    GraphQLWSMessageType,
    GraphQLWSMessage,
} from './types.js'
