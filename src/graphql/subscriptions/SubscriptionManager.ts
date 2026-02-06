/**
 * Subscription Manager
 *
 * Unified manager for GraphQL subscriptions supporting both
 * WebSocket (graphql-ws) and SSE protocols.
 */

import logger from '@wdio/logger'

import type {
    SubscriptionManager,
    SubscriptionManagerConfig,
    Subscription,
    SubscriptionCallbacks,
    SubscriptionProtocol,
    WebSocketSubscriptionConfig,
    SSESubscriptionConfig,
} from './types.js'
import type { GraphQLOperation, GraphQLVariables } from '../types.js'
import { createWebSocketSubscription } from './WebSocketSubscription.js'
import { createSSESubscription } from './SSESubscription.js'
import { generateId } from '../utils.js'
import { GraphQLSubscriptionError } from '../errors.js'

const log = logger('wdio-api-runner:graphql:subscriptions')

/**
 * Create a subscription manager
 *
 * @example Basic usage
 * ```typescript
 * const manager = createSubscriptionManager()
 *
 * // Configure defaults
 * manager.configure({
 *     defaultProtocol: 'websocket',
 *     webSocket: { url: 'wss://api.example.com/graphql' }
 * })
 *
 * // Subscribe
 * const subscription = manager.subscribe(
 *     'subscription { messageReceived { id content } }',
 *     { onData: (data) => console.log(data) }
 * )
 *
 * // Later...
 * subscription.unsubscribe()
 * ```
 */
export function createSubscriptionManager(): SubscriptionManager {
    const activeSubscriptions = new Map<string, Subscription>()

    let defaultProtocol: SubscriptionProtocol = 'websocket'
    let defaultWebSocketConfig: Partial<WebSocketSubscriptionConfig> = {}
    let defaultSSEConfig: Partial<SSESubscriptionConfig> = {}

    /**
     * Normalize operation input
     */
    function normalizeOperation<TVariables extends GraphQLVariables>(
        operation: string | GraphQLOperation<TVariables>,
        variables?: TVariables
    ): GraphQLOperation<TVariables> {
        if (typeof operation === 'string') {
            return { query: operation, variables }
        }
        return { ...operation, variables: variables ?? operation.variables }
    }

    /**
     * Track a subscription
     */
    function trackSubscription(subscription: Subscription): void {
        activeSubscriptions.set(subscription.id, subscription)
        log.debug(`Subscription ${subscription.id} tracked. Active: ${activeSubscriptions.size}`)
    }

    /**
     * Untrack a subscription
     */
    function untrackSubscription(id: string): void {
        activeSubscriptions.delete(id)
        log.debug(`Subscription ${id} untracked. Active: ${activeSubscriptions.size}`)
    }

    /**
     * Wrap callbacks to handle untracking
     */
    function wrapCallbacks<TData>(id: string, callbacks: SubscriptionCallbacks<TData>): SubscriptionCallbacks<TData> {
        return {
            ...callbacks,
            onComplete: () => {
                untrackSubscription(id)
                callbacks.onComplete?.()
            },
            onError: (error) => {
                callbacks.onError?.(error)
            },
        }
    }

    return {
        subscribe<TData, TVariables extends GraphQLVariables>(
            operation: string | GraphQLOperation<TVariables>,
            callbacks: SubscriptionCallbacks<TData>,
            variables?: TVariables
        ): Subscription {
            const normalizedOp = normalizeOperation(operation, variables)
            const id = generateId('sub')

            // Use default protocol configuration
            if (defaultProtocol === 'websocket') {
                if (!defaultWebSocketConfig.url) {
                    throw new GraphQLSubscriptionError(
                        'WebSocket URL not configured. Call configure() first or use subscribeWebSocket() directly.',
                        id
                    )
                }
                return this.subscribeWebSocket(
                    defaultWebSocketConfig as WebSocketSubscriptionConfig,
                    normalizedOp,
                    callbacks
                )
            } else {
                if (!defaultSSEConfig.url) {
                    throw new GraphQLSubscriptionError(
                        'SSE URL not configured. Call configure() first or use subscribeSSE() directly.',
                        id
                    )
                }
                return this.subscribeSSE(defaultSSEConfig as SSESubscriptionConfig, normalizedOp, callbacks)
            }
        },

        subscribeWebSocket<TData, TVariables extends GraphQLVariables>(
            config: WebSocketSubscriptionConfig,
            operation: string | GraphQLOperation<TVariables>,
            callbacks: SubscriptionCallbacks<TData>,
            variables?: TVariables
        ): Subscription {
            const normalizedOp = normalizeOperation(operation, variables)
            const id = generateId('ws')
            const mergedConfig = { ...defaultWebSocketConfig, ...config }

            log.info(`Creating WebSocket subscription ${id} to ${mergedConfig.url}`)

            const subscription = createWebSocketSubscription(
                id,
                mergedConfig as WebSocketSubscriptionConfig,
                normalizedOp,
                wrapCallbacks(id, callbacks)
            )

            trackSubscription(subscription)
            return subscription
        },

        subscribeSSE<TData, TVariables extends GraphQLVariables>(
            config: SSESubscriptionConfig,
            operation: string | GraphQLOperation<TVariables>,
            callbacks: SubscriptionCallbacks<TData>,
            variables?: TVariables
        ): Subscription {
            const normalizedOp = normalizeOperation(operation, variables)
            const id = generateId('sse')
            const mergedConfig = { ...defaultSSEConfig, ...config }

            log.info(`Creating SSE subscription ${id} to ${mergedConfig.url}`)

            const subscription = createSSESubscription(
                id,
                mergedConfig as SSESubscriptionConfig,
                normalizedOp,
                wrapCallbacks(id, callbacks)
            )

            trackSubscription(subscription)
            return subscription
        },

        configure(config: SubscriptionManagerConfig): void {
            if (config.defaultProtocol) {
                defaultProtocol = config.defaultProtocol
                log.debug(`Default subscription protocol set to: ${defaultProtocol}`)
            }

            if (config.webSocket) {
                defaultWebSocketConfig = { ...defaultWebSocketConfig, ...config.webSocket }
                log.debug('WebSocket default config updated')
            }

            if (config.sse) {
                defaultSSEConfig = { ...defaultSSEConfig, ...config.sse }
                log.debug('SSE default config updated')
            }

            log.info('Subscription manager configured')
        },

        getActiveSubscriptions(): Subscription[] {
            return Array.from(activeSubscriptions.values())
        },

        getActiveCount(): number {
            return activeSubscriptions.size
        },

        unsubscribeAll(): void {
            log.info(`Unsubscribing all ${activeSubscriptions.size} subscriptions`)

            for (const subscription of activeSubscriptions.values()) {
                try {
                    subscription.unsubscribe()
                } catch (error) {
                    log.error(`Error unsubscribing ${subscription.id}:`, error)
                }
            }

            activeSubscriptions.clear()
        },

        closeAll(): void {
            this.unsubscribeAll()
            // Reset default configurations
            defaultWebSocketConfig = {}
            defaultSSEConfig = {}
            log.info('Subscription manager closed and reset')
        },
    }
}
