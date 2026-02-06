/**
 * Server-Sent Events (SSE) Subscription Implementation
 *
 * Implements GraphQL subscriptions over SSE, which is simpler than WebSocket
 * and works through proxies and load balancers.
 */

import logger from '@wdio/logger'

import type { Subscription, SubscriptionState, SubscriptionCallbacks, SSESubscriptionConfig } from './types.js'
import type { GraphQLOperation, GraphQLVariables, GraphQLError } from '../types.js'
import { GraphQLSubscriptionError } from '../errors.js'
import { DEFAULT_SSE_RECONNECT_DELAY, DEFAULT_SSE_MAX_RETRIES } from '../constants.js'

const log = logger('wdio-api-runner:graphql:sse')

/**
 * Create an SSE subscription
 *
 * SSE subscriptions work by making a GET or POST request to the GraphQL endpoint
 * and receiving events as they occur.
 */
export function createSSESubscription<TData, TVariables extends GraphQLVariables>(
    id: string,
    config: SSESubscriptionConfig,
    operation: GraphQLOperation<TVariables>,
    callbacks: SubscriptionCallbacks<TData>
): Subscription {
    let state: SubscriptionState = 'connecting'
    let eventSource: EventSource | null = null
    let reconnectAttempts = 0
    let isUnsubscribed = false
    let abortController: AbortController | null = null

    const reconnectConfig = config.reconnect ?? {
        enabled: true,
        maxRetries: DEFAULT_SSE_MAX_RETRIES,
        retryDelay: DEFAULT_SSE_RECONNECT_DELAY,
    }

    /**
     * Update state and notify callback
     */
    function setState(newState: SubscriptionState): void {
        if (state !== newState) {
            state = newState
            callbacks.onStateChange?.(state)
            log.debug(`SSE Subscription ${id} state changed to: ${state}`)
        }
    }

    /**
     * Build the SSE URL with query parameters
     */
    function buildUrl(): string {
        const url = new URL(config.url)

        // Add query as URL parameter (for GET-based SSE)
        url.searchParams.set('query', operation.query)

        if (operation.operationName) {
            url.searchParams.set('operationName', operation.operationName)
        }

        if (operation.variables && Object.keys(operation.variables).length > 0) {
            url.searchParams.set('variables', JSON.stringify(operation.variables))
        }

        return url.toString()
    }

    /**
     * Handle SSE message event
     */
    function handleMessage(event: MessageEvent): void {
        try {
            log.debug(`SSE Subscription ${id} received message`)

            const data = JSON.parse(event.data) as { data?: TData; errors?: GraphQLError[] }

            if (data.errors && data.errors.length > 0) {
                for (const error of data.errors) {
                    callbacks.onError?.(error)
                }
            }

            if (data.data !== undefined) {
                callbacks.onData(data.data)
            }
        } catch (error) {
            log.error(`SSE Subscription ${id} message parse error:`, error)
            callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
        }
    }

    /**
     * Handle SSE error event
     */
    function handleError(event: Event): void {
        log.error(`SSE Subscription ${id} error:`, event)

        if (eventSource?.readyState === EventSource.CLOSED) {
            setState('disconnected')

            if (
                !isUnsubscribed &&
                reconnectConfig.enabled &&
                reconnectAttempts < (reconnectConfig.maxRetries ?? DEFAULT_SSE_MAX_RETRIES)
            ) {
                attemptReconnect()
            } else {
                setState('error')
                callbacks.onError?.(new GraphQLSubscriptionError('SSE connection closed', id))
                callbacks.onComplete?.()
            }
        } else {
            setState('error')
            callbacks.onError?.(new GraphQLSubscriptionError('SSE error', id))
        }
    }

    /**
     * Handle SSE open event
     */
    function handleOpen(): void {
        log.debug(`SSE Subscription ${id} connected`)
        reconnectAttempts = 0
        setState('connected')
    }

    /**
     * Attempt to reconnect
     */
    function attemptReconnect(): void {
        reconnectAttempts++
        const delay = reconnectConfig.retryDelay ?? DEFAULT_SSE_RECONNECT_DELAY

        log.info(
            `SSE Subscription ${id} reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${reconnectConfig.maxRetries})`
        )

        setTimeout(() => {
            if (!isUnsubscribed) {
                connect()
            }
        }, delay)
    }

    /**
     * Connect using EventSource (native SSE)
     */
    function connectEventSource(): void {
        const url = buildUrl()

        eventSource = new EventSource(url, {
            withCredentials: config.withCredentials ?? false,
        })

        eventSource.onopen = handleOpen
        eventSource.onmessage = handleMessage
        eventSource.onerror = handleError

        // Handle custom event types if the server uses them
        eventSource.addEventListener('next', handleMessage)
        eventSource.addEventListener('error', (event: Event) => {
            const messageEvent = event as MessageEvent
            if (messageEvent.data) {
                try {
                    const errors = JSON.parse(messageEvent.data) as GraphQLError[]
                    for (const error of errors) {
                        callbacks.onError?.(error)
                    }
                } catch {
                    handleError(event)
                }
            }
        })
        eventSource.addEventListener('complete', () => {
            log.debug(`SSE Subscription ${id} completed`)
            setState('closed')
            callbacks.onComplete?.()
            cleanup()
        })
    }

    /**
     * Connect using fetch with streaming (for servers that require POST or custom headers)
     */
    async function connectFetch(): Promise<void> {
        abortController = new AbortController()

        try {
            const response = await fetch(config.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'text/event-stream',
                    ...config.headers,
                },
                body: JSON.stringify({
                    query: operation.query,
                    operationName: operation.operationName,
                    variables: operation.variables,
                }),
                signal: abortController.signal,
                credentials: config.withCredentials ? 'include' : 'same-origin',
            })

            if (!response.ok) {
                throw new GraphQLSubscriptionError(`SSE request failed: ${response.status} ${response.statusText}`, id)
            }

            if (!response.body) {
                throw new GraphQLSubscriptionError('Response body is null', id)
            }

            setState('connected')
            reconnectAttempts = 0

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()

                if (done || isUnsubscribed) {
                    break
                }

                buffer += decoder.decode(value, { stream: true })

                // Process complete SSE events
                const events = buffer.split('\n\n')
                buffer = events.pop() ?? ''

                for (const event of events) {
                    if (!event.trim()) continue

                    const lines = event.split('\n')
                    let eventType = 'message'
                    let data = ''

                    for (const line of lines) {
                        if (line.startsWith('event:')) {
                            eventType = line.slice(6).trim()
                        } else if (line.startsWith('data:')) {
                            data += line.slice(5).trim()
                        }
                    }

                    if (data) {
                        if (eventType === 'complete') {
                            setState('closed')
                            callbacks.onComplete?.()
                            return
                        }

                        handleMessage({ data } as MessageEvent)
                    }
                }
            }

            // Stream ended
            if (!isUnsubscribed) {
                setState('disconnected')
                if (
                    reconnectConfig.enabled &&
                    reconnectAttempts < (reconnectConfig.maxRetries ?? DEFAULT_SSE_MAX_RETRIES)
                ) {
                    attemptReconnect()
                } else {
                    callbacks.onComplete?.()
                }
            }
        } catch (error) {
            if (isUnsubscribed) return

            log.error(`SSE Subscription ${id} fetch error:`, error)
            setState('error')
            callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))

            if (
                reconnectConfig.enabled &&
                reconnectAttempts < (reconnectConfig.maxRetries ?? DEFAULT_SSE_MAX_RETRIES)
            ) {
                attemptReconnect()
            } else {
                callbacks.onComplete?.()
            }
        }
    }

    /**
     * Connect to SSE stream
     */
    function connect(): void {
        setState('connecting')

        // Use EventSource if no custom headers needed, otherwise use fetch
        if (!config.headers || Object.keys(config.headers).length === 0) {
            connectEventSource()
        } else {
            connectFetch()
        }
    }

    /**
     * Cleanup resources
     */
    function cleanup(): void {
        if (eventSource) {
            eventSource.close()
            eventSource = null
        }
        if (abortController) {
            abortController.abort()
            abortController = null
        }
    }

    // Start connection
    connect()

    // Return subscription handle
    return {
        id,

        unsubscribe(): void {
            if (isUnsubscribed) return

            isUnsubscribed = true
            log.debug(`SSE Subscription ${id} unsubscribing`)

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
