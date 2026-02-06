/**
 * WebSocket Subscription Implementation
 *
 * Implements the graphql-ws protocol for GraphQL subscriptions over WebSocket.
 * https://github.com/enisdenjo/graphql-ws/blob/master/PROTOCOL.md
 */

import logger from '@wdio/logger'

import type {
    Subscription,
    SubscriptionState,
    SubscriptionCallbacks,
    WebSocketSubscriptionConfig,
    GraphQLWSMessage,
} from './types.js'
import type { GraphQLOperation, GraphQLVariables, GraphQLError } from '../types.js'
import { GraphQLSubscriptionError } from '../errors.js'
import {
    DEFAULT_WS_CONNECTION_TIMEOUT,
    DEFAULT_WS_KEEP_ALIVE_INTERVAL,
    DEFAULT_WS_RECONNECT_DELAY,
    DEFAULT_WS_MAX_RETRIES,
    GRAPHQL_WS_PROTOCOL,
} from '../constants.js'

const log = logger('wdio-api-runner:graphql:ws')

/**
 * Create a WebSocket subscription using graphql-ws protocol
 */
export function createWebSocketSubscription<TData, TVariables extends GraphQLVariables>(
    id: string,
    config: WebSocketSubscriptionConfig,
    operation: GraphQLOperation<TVariables>,
    callbacks: SubscriptionCallbacks<TData>
): Subscription {
    let state: SubscriptionState = 'connecting'
    let ws: WebSocket | null = null
    let connectionAckReceived = false
    let reconnectAttempts = 0
    let keepAliveIntervalId: ReturnType<typeof setInterval> | null = null
    let connectionTimeoutId: ReturnType<typeof setTimeout> | null = null
    let isUnsubscribed = false

    const reconnectConfig = config.reconnect ?? {
        enabled: true,
        maxRetries: DEFAULT_WS_MAX_RETRIES,
        retryDelay: DEFAULT_WS_RECONNECT_DELAY,
    }
    const connectionTimeout = config.connectionTimeout ?? DEFAULT_WS_CONNECTION_TIMEOUT
    const keepAliveInterval = config.keepAliveInterval ?? DEFAULT_WS_KEEP_ALIVE_INTERVAL

    /**
     * Update state and notify callback
     */
    function setState(newState: SubscriptionState): void {
        if (state !== newState) {
            state = newState
            callbacks.onStateChange?.(state)
            log.debug(`Subscription ${id} state changed to: ${state}`)
        }
    }

    /**
     * Send a message over WebSocket
     */
    function send(message: GraphQLWSMessage): void {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message))
            log.debug(`Subscription ${id} sent: ${message.type}`)
        }
    }

    /**
     * Get connection params (can be async)
     */
    async function getConnectionParams(): Promise<Record<string, unknown>> {
        if (!config.connectionParams) {
            return {}
        }

        if (typeof config.connectionParams === 'function') {
            return await config.connectionParams()
        }

        return config.connectionParams
    }

    /**
     * Handle incoming WebSocket message
     */
    function handleMessage(event: MessageEvent): void {
        try {
            const message = JSON.parse(event.data) as GraphQLWSMessage
            log.debug(`Subscription ${id} received: ${message.type}`)

            switch (message.type) {
                case 'connection_ack':
                    connectionAckReceived = true
                    clearTimeout(connectionTimeoutId!)
                    setState('connected')

                    // Send subscribe message
                    send({
                        id,
                        type: 'subscribe',
                        payload: {
                            query: operation.query,
                            operationName: operation.operationName,
                            variables: operation.variables,
                        },
                    })

                    // Start keep-alive pings
                    if (keepAliveInterval > 0) {
                        keepAliveIntervalId = setInterval(() => {
                            send({ type: 'ping' })
                        }, keepAliveInterval)
                    }
                    break

                case 'ping':
                    send({ type: 'pong' })
                    break

                case 'pong':
                    // Keep-alive response, no action needed
                    break

                case 'next':
                    if (message.id === id && message.payload) {
                        const payload = message.payload as { data?: TData; errors?: GraphQLError[] }
                        if (payload.errors) {
                            for (const error of payload.errors) {
                                callbacks.onError?.(error)
                            }
                        }
                        if (payload.data !== undefined) {
                            callbacks.onData(payload.data)
                        }
                    }
                    break

                case 'error':
                    if (message.id === id) {
                        const errors = message.payload as GraphQLError[]
                        for (const error of errors) {
                            callbacks.onError?.(error)
                        }
                    }
                    break

                case 'complete':
                    if (message.id === id) {
                        setState('closed')
                        callbacks.onComplete?.()
                        cleanup()
                    }
                    break
            }
        } catch (error) {
            log.error(`Subscription ${id} message parse error:`, error)
            callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
        }
    }

    /**
     * Handle WebSocket error
     */
    function handleError(event: Event): void {
        log.error(`Subscription ${id} WebSocket error:`, event)
        setState('error')
        callbacks.onError?.(new GraphQLSubscriptionError('WebSocket error', id))

        if (reconnectConfig.enabled && reconnectAttempts < (reconnectConfig.maxRetries ?? DEFAULT_WS_MAX_RETRIES)) {
            attemptReconnect()
        }
    }

    /**
     * Handle WebSocket close
     */
    function handleClose(event: CloseEvent): void {
        log.debug(`Subscription ${id} WebSocket closed: ${event.code} ${event.reason}`)

        if (isUnsubscribed) {
            setState('closed')
            callbacks.onComplete?.()
            return
        }

        setState('disconnected')

        // Attempt reconnection if enabled and not manually closed
        if (
            reconnectConfig.enabled &&
            event.code !== 1000 &&
            reconnectAttempts < (reconnectConfig.maxRetries ?? DEFAULT_WS_MAX_RETRIES)
        ) {
            attemptReconnect()
        } else if (
            !reconnectConfig.enabled ||
            reconnectAttempts >= (reconnectConfig.maxRetries ?? DEFAULT_WS_MAX_RETRIES)
        ) {
            callbacks.onComplete?.()
        }
    }

    /**
     * Attempt to reconnect
     */
    function attemptReconnect(): void {
        reconnectAttempts++
        const delay = reconnectConfig.retryDelay ?? DEFAULT_WS_RECONNECT_DELAY

        log.info(
            `Subscription ${id} reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${reconnectConfig.maxRetries})`
        )

        setTimeout(() => {
            if (!isUnsubscribed) {
                connect()
            }
        }, delay)
    }

    /**
     * Connect to WebSocket
     */
    async function connect(): Promise<void> {
        try {
            setState('connecting')
            connectionAckReceived = false

            ws = new WebSocket(config.url, GRAPHQL_WS_PROTOCOL)

            ws.onopen = async () => {
                log.debug(`Subscription ${id} WebSocket opened`)

                // Set connection timeout
                connectionTimeoutId = setTimeout(() => {
                    if (!connectionAckReceived) {
                        log.error(`Subscription ${id} connection timeout`)
                        ws?.close()
                        callbacks.onError?.(new GraphQLSubscriptionError('Connection timeout', id))
                    }
                }, connectionTimeout)

                // Send connection_init
                const params = await getConnectionParams()
                send({
                    type: 'connection_init',
                    payload: params,
                })
            }

            ws.onmessage = handleMessage
            ws.onerror = handleError
            ws.onclose = handleClose
        } catch (error) {
            log.error(`Subscription ${id} connection error:`, error)
            setState('error')
            callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))

            if (reconnectConfig.enabled && reconnectAttempts < (reconnectConfig.maxRetries ?? DEFAULT_WS_MAX_RETRIES)) {
                attemptReconnect()
            }
        }
    }

    /**
     * Cleanup resources
     */
    function cleanup(): void {
        if (keepAliveIntervalId) {
            clearInterval(keepAliveIntervalId)
            keepAliveIntervalId = null
        }
        if (connectionTimeoutId) {
            clearTimeout(connectionTimeoutId)
            connectionTimeoutId = null
        }
        if (ws) {
            ws.onopen = null
            ws.onmessage = null
            ws.onerror = null
            ws.onclose = null
            ws = null
        }
    }

    // Start connection (unless lazy)
    if (!config.lazy) {
        connect()
    }

    // Return subscription handle
    return {
        id,

        unsubscribe(): void {
            if (isUnsubscribed) return

            isUnsubscribed = true
            log.debug(`Subscription ${id} unsubscribing`)

            // Send complete message if connected
            if (ws && ws.readyState === WebSocket.OPEN && connectionAckReceived) {
                send({ id, type: 'complete' })
            }

            // Close WebSocket
            if (ws && ws.readyState !== WebSocket.CLOSED) {
                ws.close(1000, 'Client unsubscribed')
            }

            cleanup()
            setState('closed')
        },

        getState(): SubscriptionState {
            return state
        },

        isActive(): boolean {
            return state === 'connecting' || state === 'connected'
        },
    }
}
