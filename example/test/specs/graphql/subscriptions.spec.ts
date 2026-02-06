import {
    createSubscriptionManager,
    createWebSocketSubscription,
    createSSESubscription,
    GraphQLSubscriptionError,
} from 'wdio-api-runner'
import { expect } from 'chai'

/**
 * GraphQL Subscriptions Examples
 *
 * These tests demonstrate how to use GraphQL subscriptions for real-time data.
 * WebdriverIO API Runner supports both WebSocket (graphql-ws protocol) and
 * Server-Sent Events (SSE) for GraphQL subscriptions.
 *
 * Note: Real subscription testing requires a GraphQL server with subscription
 * support. These examples focus on the API patterns and configuration options.
 */
describe('GraphQL - Subscriptions', () => {
    describe('Subscription Manager', () => {
        it('should create a subscription manager', () => {
            const manager = createSubscriptionManager()

            // Manager provides these methods:
            expect(manager.subscribe).to.be.a('function')
            expect(manager.subscribeWebSocket).to.be.a('function')
            expect(manager.subscribeSSE).to.be.a('function')
            expect(manager.configure).to.be.a('function')
            expect(manager.getActiveSubscriptions).to.be.a('function')
            expect(manager.getActiveCount).to.be.a('function')
            expect(manager.unsubscribeAll).to.be.a('function')
            expect(manager.closeAll).to.be.a('function')
        })

        it('should configure subscription manager with WebSocket defaults', () => {
            const manager = createSubscriptionManager()

            // Configure default WebSocket settings
            manager.configure({
                defaultProtocol: 'websocket',
                webSocket: {
                    url: 'wss://api.example.com/graphql',
                    connectionParams: {
                        authorization: 'Bearer my-token',
                    },
                },
            })

            // Manager is now configured
            expect(manager.getActiveCount()).to.equal(0)
        })

        it('should configure subscription manager with SSE defaults', () => {
            const manager = createSubscriptionManager()

            // Configure default SSE settings
            manager.configure({
                defaultProtocol: 'sse',
                sse: {
                    url: 'https://api.example.com/graphql/stream',
                    headers: {
                        Authorization: 'Bearer my-token',
                    },
                },
            })

            expect(manager.getActiveCount()).to.equal(0)
        })

        it('should configure with both WebSocket and SSE options', () => {
            const manager = createSubscriptionManager()

            // Configure both protocols
            manager.configure({
                defaultProtocol: 'websocket',
                webSocket: {
                    url: 'wss://api.example.com/graphql',
                    connectionParams: async () => ({
                        // Dynamic auth token
                        authorization: `Bearer ${await getToken()}`,
                    }),
                    reconnect: {
                        enabled: true,
                        maxRetries: 5,
                        retryDelay: 1000,
                    },
                },
                sse: {
                    url: 'https://api.example.com/graphql/stream',
                    withCredentials: true,
                },
            })

            expect(manager.getActiveCount()).to.equal(0)
        })

        it('should track active subscription count', () => {
            const manager = createSubscriptionManager()

            // Initially no subscriptions
            expect(manager.getActiveCount()).to.equal(0)
            expect(manager.getActiveSubscriptions()).to.deep.equal([])
        })

        it('should close all subscriptions and reset', () => {
            const manager = createSubscriptionManager()

            manager.configure({
                defaultProtocol: 'websocket',
                webSocket: { url: 'wss://api.example.com/graphql' },
            })

            // Close and reset
            manager.closeAll()

            expect(manager.getActiveCount()).to.equal(0)
        })
    })

    describe('WebSocket Subscription Patterns', () => {
        it('should demonstrate WebSocket subscription configuration', () => {
            const manager = createSubscriptionManager()

            // WebSocket configuration options
            const wsConfig = {
                url: 'wss://api.example.com/graphql',
                // Connection parameters (sent with connection_init)
                connectionParams: {
                    authorization: 'Bearer my-token',
                },
                // Connection timeout
                connectionTimeout: 10000, // 10 seconds
                // Keep-alive ping interval
                keepAliveInterval: 30000, // 30 seconds
                // Reconnection settings
                reconnect: {
                    enabled: true,
                    maxRetries: 5,
                    retryDelay: 2000, // 2 seconds
                },
                // Lazy connection (only connect when subscribing)
                lazy: false,
            }

            // Configure manager with WebSocket settings
            manager.configure({
                defaultProtocol: 'websocket',
                webSocket: wsConfig,
            })

            expect(manager.getActiveCount()).to.equal(0)
        })

        it('should demonstrate dynamic connection params', () => {
            const manager = createSubscriptionManager()

            // Dynamic connection params (e.g., refreshing auth token)
            manager.configure({
                defaultProtocol: 'websocket',
                webSocket: {
                    url: 'wss://api.example.com/graphql',
                    connectionParams: async () => {
                        // Fetch fresh token before connecting
                        const token = await getToken()
                        return {
                            authorization: `Bearer ${token}`,
                            'x-request-id': generateRequestId(),
                        }
                    },
                },
            })

            expect(manager.getActiveCount()).to.equal(0)
        })

        it('should demonstrate subscription query format', () => {
            // Example subscription queries
            const messageSubscription = `
                subscription OnMessageReceived {
                    messageReceived {
                        id
                        content
                        sender {
                            id
                            name
                        }
                        createdAt
                    }
                }
            `

            const notificationSubscription = `
                subscription OnNotification($userId: ID!) {
                    notification(userId: $userId) {
                        id
                        type
                        message
                        read
                    }
                }
            `

            const orderUpdateSubscription = `
                subscription OnOrderUpdate($orderId: ID!) {
                    orderUpdate(orderId: $orderId) {
                        id
                        status
                        updatedAt
                        items {
                            id
                            quantity
                        }
                    }
                }
            `

            // These would be used with manager.subscribe()
            expect(messageSubscription).to.include('subscription')
            expect(notificationSubscription).to.include('$userId')
            expect(orderUpdateSubscription).to.include('$orderId')
        })
    })

    describe('SSE Subscription Patterns', () => {
        it('should demonstrate SSE subscription configuration', () => {
            const manager = createSubscriptionManager()

            // SSE configuration options
            const sseConfig = {
                url: 'https://api.example.com/graphql/stream',
                // Custom headers for authentication
                headers: {
                    Authorization: 'Bearer my-token',
                    'X-Client-Version': '1.0.0',
                },
                // Include credentials (cookies)
                withCredentials: true,
                // Reconnection settings
                reconnect: {
                    enabled: true,
                    maxRetries: 3,
                    retryDelay: 5000, // 5 seconds
                },
            }

            manager.configure({
                defaultProtocol: 'sse',
                sse: sseConfig,
            })

            expect(manager.getActiveCount()).to.equal(0)
        })

        it('should demonstrate when to use SSE vs WebSocket', () => {
            /**
             * Use SSE when:
             * - Server doesn't support WebSocket
             * - Working through restrictive proxies/firewalls
             * - Simple one-way real-time data flow
             * - Browser compatibility is critical (SSE has wider support)
             *
             * Use WebSocket when:
             * - Need bidirectional communication
             * - Require lower latency
             * - Server supports graphql-ws protocol
             * - Need advanced features like multiplexing
             */

            const manager = createSubscriptionManager()

            // Example: API behind corporate proxy - use SSE
            manager.configure({
                defaultProtocol: 'sse',
                sse: {
                    url: 'https://api.company.com/graphql/sse',
                },
            })

            expect(manager.getActiveCount()).to.equal(0)
        })
    })

    describe('Subscription Callbacks', () => {
        it('should demonstrate callback structure', () => {
            // Subscription callbacks interface
            interface SubscriptionCallbacks<TData> {
                // Called when new data arrives (required)
                onData: (data: TData) => void
                // Called on errors (optional)
                onError?: (error: Error) => void
                // Called when subscription completes (optional)
                onComplete?: () => void
                // Called when state changes (optional)
                onStateChange?: (state: string) => void
            }

            // Example usage with typed data
            interface MessageData {
                messageReceived: {
                    id: string
                    content: string
                    sender: { id: string; name: string }
                }
            }

            const callbacks: SubscriptionCallbacks<MessageData> = {
                onData: (data) => {
                    console.log('New message:', data.messageReceived.content)
                },
                onError: (error) => {
                    console.error('Subscription error:', error.message)
                },
                onComplete: () => {
                    console.log('Subscription completed')
                },
                onStateChange: (state) => {
                    console.log('State changed to:', state)
                },
            }

            expect(callbacks.onData).to.be.a('function')
        })

        it('should demonstrate collecting subscription data', async () => {
            // Pattern for collecting data in tests
            const receivedMessages: unknown[] = []
            const errors: Error[] = []
            let completed = false
            let currentState = 'idle'

            const callbacks = {
                onData: (data: unknown) => {
                    receivedMessages.push(data)
                },
                onError: (error: Error) => {
                    errors.push(error)
                },
                onComplete: () => {
                    completed = true
                },
                onStateChange: (state: string) => {
                    currentState = state
                },
            }

            // In a real test, you would use these callbacks with a subscription
            // and then assert on the collected data

            expect(receivedMessages).to.be.an('array')
            expect(errors).to.be.an('array')
            expect(completed).to.equal(false)
            expect(currentState).to.equal('idle')
        })
    })

    describe('Subscription States', () => {
        it('should demonstrate subscription state machine', () => {
            /**
             * Subscription states:
             * - 'connecting': Initial connection in progress
             * - 'connected': Successfully connected and receiving data
             * - 'disconnected': Connection lost, may reconnect
             * - 'error': Error occurred
             * - 'closed': Subscription ended (manually or completed)
             */

            const validStates = ['connecting', 'connected', 'disconnected', 'error', 'closed']

            // State transitions:
            // connecting -> connected (success)
            // connecting -> error (failure)
            // connected -> disconnected (connection lost)
            // disconnected -> connecting (reconnecting)
            // * -> closed (unsubscribe or complete)

            expect(validStates).to.include('connecting')
            expect(validStates).to.include('connected')
            expect(validStates).to.include('closed')
        })

        it('should demonstrate handling state changes', () => {
            let connectionAttempts = 0
            let isConnected = false

            const handleStateChange = (state: string) => {
                switch (state) {
                    case 'connecting':
                        connectionAttempts++
                        console.log(`Connection attempt ${connectionAttempts}`)
                        break
                    case 'connected':
                        isConnected = true
                        console.log('Connected! Ready to receive data')
                        break
                    case 'disconnected':
                        isConnected = false
                        console.log('Disconnected. Will retry...')
                        break
                    case 'error':
                        console.error('Subscription error occurred')
                        break
                    case 'closed':
                        isConnected = false
                        console.log('Subscription closed')
                        break
                }
            }

            // Simulate state transitions
            handleStateChange('connecting')
            expect(connectionAttempts).to.equal(1)

            handleStateChange('connected')
            expect(isConnected).to.equal(true)

            handleStateChange('closed')
            expect(isConnected).to.equal(false)
        })
    })

    describe('Subscription Handle', () => {
        it('should demonstrate subscription handle interface', () => {
            /**
             * When you create a subscription, you get a handle with:
             * - id: Unique subscription identifier
             * - unsubscribe(): Stop the subscription
             * - getState(): Get current state
             * - isActive(): Check if still active
             */

            // Example subscription handle interface
            interface SubscriptionHandle {
                id: string
                unsubscribe: () => void
                getState: () => string
                isActive: () => boolean
            }

            // Mock handle for demonstration
            const mockHandle: SubscriptionHandle = {
                id: 'sub_12345',
                unsubscribe: () => {
                    console.log('Unsubscribed')
                },
                getState: () => 'connected',
                isActive: () => true,
            }

            expect(mockHandle.id).to.be.a('string')
            expect(mockHandle.getState()).to.equal('connected')
            expect(mockHandle.isActive()).to.equal(true)
        })

        it('should demonstrate unsubscribe pattern', async () => {
            // Pattern: Subscribe, do work, unsubscribe
            const manager = createSubscriptionManager()

            manager.configure({
                defaultProtocol: 'websocket',
                webSocket: { url: 'wss://api.example.com/graphql' },
            })

            // In a real scenario:
            // const subscription = manager.subscribe(query, callbacks);
            //
            // ... wait for data or timeout ...
            //
            // subscription.unsubscribe();

            // Cleanup all at once
            manager.unsubscribeAll()
            expect(manager.getActiveCount()).to.equal(0)
        })
    })

    describe('Error Handling', () => {
        it('should demonstrate GraphQL subscription error', () => {
            // GraphQLSubscriptionError is thrown for subscription-specific errors
            const error = new GraphQLSubscriptionError('Connection timeout', 'sub_123')

            expect(error).to.be.instanceOf(Error)
            expect(error.message).to.equal('Connection timeout')
            expect(error.name).to.equal('GraphQLSubscriptionError')
        })

        it('should demonstrate error handling patterns', () => {
            const errors: Error[] = []
            let shouldReconnect = true

            const handleError = (error: Error) => {
                errors.push(error)

                // Decide whether to reconnect based on error
                if (error.message.includes('Authentication failed')) {
                    shouldReconnect = false // Don't reconnect for auth errors
                    console.log('Auth error - need to re-authenticate')
                } else if (error.message.includes('Connection timeout')) {
                    shouldReconnect = true // Reconnect for transient errors
                    console.log('Timeout - will reconnect')
                }
            }

            // Simulate errors
            handleError(new Error('Connection timeout'))
            expect(errors.length).to.equal(1)
            expect(shouldReconnect).to.equal(true)

            handleError(new Error('Authentication failed'))
            expect(errors.length).to.equal(2)
            expect(shouldReconnect).to.equal(false)
        })
    })

    describe('Real-world Usage Patterns', () => {
        it('should demonstrate chat message subscription pattern', () => {
            const manager = createSubscriptionManager()

            // Configure for chat application
            manager.configure({
                defaultProtocol: 'websocket',
                webSocket: {
                    url: 'wss://chat.example.com/graphql',
                    connectionParams: {
                        authorization: 'Bearer user-token',
                    },
                    reconnect: {
                        enabled: true,
                        maxRetries: 10,
                        retryDelay: 1000,
                    },
                },
            })

            // Example subscription query
            const chatSubscription = `
                subscription OnChatMessage($roomId: ID!) {
                    chatMessage(roomId: $roomId) {
                        id
                        text
                        user {
                            id
                            name
                            avatar
                        }
                        timestamp
                    }
                }
            `

            // Example callbacks
            interface ChatMessage {
                chatMessage: {
                    id: string
                    text: string
                    user: { id: string; name: string; avatar: string }
                    timestamp: string
                }
            }

            const messages: ChatMessage[] = []

            const callbacks = {
                onData: (data: ChatMessage) => {
                    messages.push(data)
                    // Update UI with new message
                },
                onError: (error: Error) => {
                    console.error('Chat error:', error)
                },
            }

            // In real usage:
            // const sub = manager.subscribe(chatSubscription, callbacks, { roomId: 'room-123' });

            expect(chatSubscription).to.include('chatMessage')
            expect(messages).to.be.an('array')
        })

        it('should demonstrate order tracking subscription pattern', () => {
            const manager = createSubscriptionManager()

            // Configure for e-commerce order tracking
            manager.configure({
                defaultProtocol: 'sse', // SSE works well for one-way updates
                sse: {
                    url: 'https://orders.example.com/graphql/stream',
                    headers: {
                        Authorization: 'Bearer customer-token',
                    },
                },
            })

            // Order status subscription
            const orderSubscription = `
                subscription TrackOrder($orderId: ID!) {
                    orderStatus(orderId: $orderId) {
                        status
                        location
                        estimatedDelivery
                        history {
                            status
                            timestamp
                            description
                        }
                    }
                }
            `

            expect(orderSubscription).to.include('orderStatus')
        })

        it('should demonstrate live dashboard subscription pattern', () => {
            const manager = createSubscriptionManager()

            // Configure for real-time dashboard
            manager.configure({
                defaultProtocol: 'websocket',
                webSocket: {
                    url: 'wss://dashboard.example.com/graphql',
                    keepAliveInterval: 15000, // Ping every 15 seconds
                },
            })

            // Multiple subscriptions for dashboard
            const metricsSubscription = `
                subscription LiveMetrics {
                    metrics {
                        cpu
                        memory
                        requestsPerSecond
                        errorRate
                    }
                }
            `

            const alertsSubscription = `
                subscription SystemAlerts {
                    alert {
                        id
                        severity
                        message
                        timestamp
                    }
                }
            `

            expect(metricsSubscription).to.include('metrics')
            expect(alertsSubscription).to.include('alert')
        })
    })

    describe('Testing Best Practices', () => {
        it('should demonstrate subscription test setup pattern', async () => {
            const manager = createSubscriptionManager()

            // Setup
            manager.configure({
                defaultProtocol: 'websocket',
                webSocket: { url: 'wss://test.example.com/graphql' },
            })

            // Test logic would go here
            // - Subscribe
            // - Wait for data or timeout
            // - Assert on received data

            // Teardown - always clean up
            manager.closeAll()
            expect(manager.getActiveCount()).to.equal(0)
        })

        it('should demonstrate timeout pattern for subscriptions', async () => {
            // Helper to wait for subscription data with timeout
            function waitForSubscriptionData<T>(timeoutMs: number): Promise<T[]> {
                return new Promise((resolve, reject) => {
                    const data: T[] = []
                    const timeout = setTimeout(() => {
                        if (data.length > 0) {
                            resolve(data)
                        } else {
                            reject(new Error('Subscription timeout - no data received'))
                        }
                    }, timeoutMs)

                    // In real usage, this would be connected to subscription callbacks
                    // callbacks.onData = (item: T) => {
                    //     data.push(item);
                    //     if (data.length >= expectedCount) {
                    //         clearTimeout(timeout);
                    //         resolve(data);
                    //     }
                    // };
                })
            }

            expect(waitForSubscriptionData).to.be.a('function')
        })
    })
})

// Helper functions used in examples
async function getToken(): Promise<string> {
    // Simulates fetching a token
    return 'simulated-auth-token'
}

function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
