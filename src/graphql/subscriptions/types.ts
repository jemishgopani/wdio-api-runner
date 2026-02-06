/**
 * GraphQL Subscription Type Definitions
 */

import type { GraphQLOperation, GraphQLVariables, GraphQLError } from '../types.js'

/**
 * Subscription protocol type
 */
export type SubscriptionProtocol = 'websocket' | 'sse'

/**
 * Subscription connection state
 */
export type SubscriptionState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'closed'

/**
 * WebSocket subscription configuration (graphql-ws protocol)
 */
export interface WebSocketSubscriptionConfig {
    /** WebSocket URL (wss:// or ws://) */
    url: string
    /** Connection parameters (sent in connection_init) */
    connectionParams?: Record<string, unknown> | (() => Record<string, unknown> | Promise<Record<string, unknown>>)
    /** Reconnection options */
    reconnect?: {
        /** Enable automatic reconnection */
        enabled?: boolean
        /** Maximum retry attempts */
        maxRetries?: number
        /** Delay between retries in ms */
        retryDelay?: number
    }
    /** Connection timeout in ms */
    connectionTimeout?: number
    /** Keep-alive interval in ms (ping/pong) */
    keepAliveInterval?: number
    /** Lazy connection (don't connect until first subscription) */
    lazy?: boolean
}

/**
 * SSE subscription configuration
 */
export interface SSESubscriptionConfig {
    /** SSE endpoint URL */
    url: string
    /** Headers for the SSE request */
    headers?: Record<string, string>
    /** Reconnection options */
    reconnect?: {
        /** Enable automatic reconnection */
        enabled?: boolean
        /** Maximum retry attempts */
        maxRetries?: number
        /** Delay between retries in ms */
        retryDelay?: number
    }
    /** With credentials (for cookies) */
    withCredentials?: boolean
}

/**
 * Subscription event handlers
 */
export interface SubscriptionCallbacks<TData = unknown> {
    /** Called when data is received */
    onData: (data: TData) => void
    /** Called when an error occurs */
    onError?: (error: GraphQLError | Error) => void
    /** Called when subscription completes normally */
    onComplete?: () => void
    /** Called when connection state changes */
    onStateChange?: (state: SubscriptionState) => void
}

/**
 * Active subscription handle
 */
export interface Subscription {
    /** Unique subscription ID */
    id: string
    /** Unsubscribe and close the subscription */
    unsubscribe(): void
    /** Get current subscription state */
    getState(): SubscriptionState
    /** Check if subscription is active */
    isActive(): boolean
}

/**
 * Internal subscription data for tracking
 */
export interface SubscriptionData<TVariables extends GraphQLVariables = GraphQLVariables> {
    id: string
    operation: GraphQLOperation<TVariables>
    callbacks: SubscriptionCallbacks
    state: SubscriptionState
    protocol: SubscriptionProtocol
}

/**
 * Subscription manager configuration
 */
export interface SubscriptionManagerConfig {
    /** Default protocol to use */
    defaultProtocol?: SubscriptionProtocol
    /** Default WebSocket config */
    webSocket?: Partial<WebSocketSubscriptionConfig>
    /** Default SSE config */
    sse?: Partial<SSESubscriptionConfig>
}

/**
 * Subscription manager interface
 */
export interface SubscriptionManager {
    /**
     * Subscribe to a GraphQL subscription operation using default protocol
     */
    subscribe<TData = unknown, TVariables extends GraphQLVariables = GraphQLVariables>(
        operation: string | GraphQLOperation<TVariables>,
        callbacks: SubscriptionCallbacks<TData>,
        variables?: TVariables
    ): Subscription

    /**
     * Create a WebSocket subscription
     */
    subscribeWebSocket<TData = unknown, TVariables extends GraphQLVariables = GraphQLVariables>(
        config: WebSocketSubscriptionConfig,
        operation: string | GraphQLOperation<TVariables>,
        callbacks: SubscriptionCallbacks<TData>,
        variables?: TVariables
    ): Subscription

    /**
     * Create an SSE subscription
     */
    subscribeSSE<TData = unknown, TVariables extends GraphQLVariables = GraphQLVariables>(
        config: SSESubscriptionConfig,
        operation: string | GraphQLOperation<TVariables>,
        callbacks: SubscriptionCallbacks<TData>,
        variables?: TVariables
    ): Subscription

    /**
     * Configure default subscription settings
     */
    configure(config: SubscriptionManagerConfig): void

    /**
     * Get all active subscriptions
     */
    getActiveSubscriptions(): Subscription[]

    /**
     * Get count of active subscriptions
     */
    getActiveCount(): number

    /**
     * Unsubscribe all active subscriptions
     */
    unsubscribeAll(): void

    /**
     * Close all connections and clean up
     */
    closeAll(): void
}

// ========== graphql-ws Protocol Types ==========

/**
 * graphql-ws message types
 */
export type GraphQLWSMessageType =
    | 'connection_init'
    | 'connection_ack'
    | 'ping'
    | 'pong'
    | 'subscribe'
    | 'next'
    | 'error'
    | 'complete'

/**
 * graphql-ws message structure
 */
export interface GraphQLWSMessage {
    id?: string
    type: GraphQLWSMessageType
    payload?: unknown
}
