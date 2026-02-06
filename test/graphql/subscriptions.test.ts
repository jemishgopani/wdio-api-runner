import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSubscriptionManager } from '../../src/graphql/subscriptions/SubscriptionManager.js'
import type { SubscriptionCallbacks, SubscriptionState } from '../../src/graphql/subscriptions/types.js'

// Mock WebSocket
class MockWebSocket {
    static instances: MockWebSocket[] = []
    readyState = 0 // CONNECTING
    url: string
    onopen: ((event: Event) => void) | null = null
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: ((event: Event) => void) | null = null
    onclose: ((event: CloseEvent) => void) | null = null

    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSING = 2
    static readonly CLOSED = 3

    constructor(url: string) {
        this.url = url
        MockWebSocket.instances.push(this)
    }

    send = vi.fn()
    close = vi.fn((code = 1000, reason = '') => {
        this.readyState = MockWebSocket.CLOSED
        this.onclose?.({ code, reason, wasClean: true } as CloseEvent)
    })

    // Test helpers
    simulateOpen() {
        this.readyState = MockWebSocket.OPEN
        this.onopen?.({} as Event)
    }

    simulateMessage(data: unknown) {
        this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
    }

    simulateError(error: Error) {
        this.onerror?.({ error } as unknown as Event)
    }

    simulateClose(code = 1000, reason = '') {
        this.readyState = MockWebSocket.CLOSED
        this.onclose?.({ code, reason, wasClean: true } as CloseEvent)
    }

    static clearInstances() {
        MockWebSocket.instances = []
    }

    static getLastInstance(): MockWebSocket | undefined {
        return MockWebSocket.instances[MockWebSocket.instances.length - 1]
    }
}

// Mock EventSource for SSE
class MockEventSource {
    static instances: MockEventSource[] = []
    url: string
    readyState = 0 // CONNECTING
    onopen: ((event: Event) => void) | null = null
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: ((event: Event) => void) | null = null
    private eventListeners: Map<string, ((event: Event | MessageEvent) => void)[]> = new Map()

    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSED = 2

    constructor(url: string, _options?: { withCredentials?: boolean }) {
        this.url = url
        MockEventSource.instances.push(this)
    }

    addEventListener = vi.fn((event: string, listener: (event: Event | MessageEvent) => void) => {
        const listeners = this.eventListeners.get(event) || []
        listeners.push(listener)
        this.eventListeners.set(event, listeners)
    })

    removeEventListener = vi.fn((event: string, listener: (event: Event | MessageEvent) => void) => {
        const listeners = this.eventListeners.get(event) || []
        const index = listeners.indexOf(listener)
        if (index > -1) {
            listeners.splice(index, 1)
        }
    })

    close = vi.fn(() => {
        this.readyState = MockEventSource.CLOSED
    })

    // Test helpers
    simulateOpen() {
        this.readyState = MockEventSource.OPEN
        this.onopen?.({} as Event)
    }

    simulateMessage(data: unknown) {
        const event = { data: JSON.stringify(data) } as MessageEvent
        this.onmessage?.(event)
        // Also fire 'next' event listeners
        const listeners = this.eventListeners.get('next') || []
        listeners.forEach((listener) => listener(event))
    }

    simulateError(error: Error) {
        this.onerror?.({ error } as unknown as Event)
    }

    static clearInstances() {
        MockEventSource.instances = []
    }

    static getLastInstance(): MockEventSource | undefined {
        return MockEventSource.instances[MockEventSource.instances.length - 1]
    }
}

// Install mocks
vi.stubGlobal('WebSocket', MockWebSocket)
vi.stubGlobal('EventSource', MockEventSource)

describe('SubscriptionManager', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        MockWebSocket.clearInstances()
        MockEventSource.clearInstances()
    })

    afterEach(() => {
        MockWebSocket.clearInstances()
        MockEventSource.clearInstances()
    })

    describe('configuration', () => {
        it('should configure default protocol', () => {
            const manager = createSubscriptionManager()

            manager.configure({
                defaultProtocol: 'sse',
                sse: { url: 'https://api.example.com/graphql/stream' },
            })

            // Should not throw
            expect(manager.getActiveCount()).toBe(0)
        })

        it('should configure WebSocket defaults', () => {
            const manager = createSubscriptionManager()

            manager.configure({
                defaultProtocol: 'websocket',
                webSocket: {
                    url: 'wss://api.example.com/graphql',
                    connectionParams: { authToken: 'test-token' },
                },
            })

            expect(manager.getActiveCount()).toBe(0)
        })

        it('should configure SSE defaults', () => {
            const manager = createSubscriptionManager()

            manager.configure({
                defaultProtocol: 'sse',
                sse: {
                    url: 'https://api.example.com/graphql/stream',
                    headers: { Authorization: 'Bearer test' },
                },
            })

            expect(manager.getActiveCount()).toBe(0)
        })
    })

    describe('subscribe', () => {
        it('should throw if WebSocket URL not configured', () => {
            const manager = createSubscriptionManager()

            expect(() => manager.subscribe('subscription { messageReceived { id } }', { onData: vi.fn() })).toThrow(
                /WebSocket URL not configured/
            )
        })

        it('should throw if SSE URL not configured when using SSE protocol', () => {
            const manager = createSubscriptionManager()
            manager.configure({ defaultProtocol: 'sse' })

            expect(() => manager.subscribe('subscription { messageReceived { id } }', { onData: vi.fn() })).toThrow(
                /SSE URL not configured/
            )
        })

        it('should create subscription with configured defaults', () => {
            const manager = createSubscriptionManager()
            manager.configure({
                defaultProtocol: 'websocket',
                webSocket: { url: 'wss://api.example.com/graphql' },
            })

            const onData = vi.fn()
            const subscription = manager.subscribe('subscription { messageReceived { id } }', { onData })

            expect(subscription).toBeDefined()
            expect(subscription.id).toMatch(/^ws_/)
            expect(manager.getActiveCount()).toBe(1)
        })
    })

    describe('subscribeWebSocket', () => {
        it('should create a WebSocket subscription', () => {
            const manager = createSubscriptionManager()
            const onData = vi.fn()

            const subscription = manager.subscribeWebSocket(
                { url: 'wss://api.example.com/graphql' },
                'subscription { messageReceived { id } }',
                { onData }
            )

            expect(subscription).toBeDefined()
            expect(subscription.id).toMatch(/^ws_/)
            expect(MockWebSocket.instances.length).toBe(1)
        })

        it('should track subscription state', () => {
            const manager = createSubscriptionManager()
            const onStateChange = vi.fn()

            const subscription = manager.subscribeWebSocket(
                { url: 'wss://api.example.com/graphql' },
                'subscription { test }',
                { onData: vi.fn(), onStateChange }
            )

            expect(subscription.getState()).toBe('connecting')
            expect(subscription.isActive()).toBe(true)
        })

        it('should handle WebSocket open event', async () => {
            const manager = createSubscriptionManager()
            const onStateChange = vi.fn()

            manager.subscribeWebSocket({ url: 'wss://api.example.com/graphql' }, 'subscription { test }', {
                onData: vi.fn(),
                onStateChange,
            })

            const ws = MockWebSocket.getLastInstance()!
            ws.simulateOpen()

            // Wait for async onopen handler to complete
            await new Promise((resolve) => setTimeout(resolve, 10))

            // Should send connection_init
            expect(ws.send).toHaveBeenCalled()
            expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('connection_init'))
        })

        it('should handle incoming data', () => {
            const manager = createSubscriptionManager()
            const onData = vi.fn()

            const subscription = manager.subscribeWebSocket(
                { url: 'wss://api.example.com/graphql' },
                'subscription { test }',
                { onData }
            )

            const ws = MockWebSocket.getLastInstance()!
            ws.simulateOpen()

            // Simulate connection_ack
            ws.simulateMessage({ type: 'connection_ack' })

            // Simulate data message
            ws.simulateMessage({
                id: subscription.id,
                type: 'next',
                payload: { data: { test: 'hello' } },
            })

            expect(onData).toHaveBeenCalledWith({ test: 'hello' })
        })

        it('should handle errors', () => {
            const manager = createSubscriptionManager()
            const onError = vi.fn()

            const subscription = manager.subscribeWebSocket(
                { url: 'wss://api.example.com/graphql' },
                'subscription { test }',
                { onData: vi.fn(), onError }
            )

            const ws = MockWebSocket.getLastInstance()!
            ws.simulateOpen()
            ws.simulateMessage({ type: 'connection_ack' })

            // Simulate error message
            ws.simulateMessage({
                id: subscription.id,
                type: 'error',
                payload: [{ message: 'Subscription error' }],
            })

            expect(onError).toHaveBeenCalled()
        })

        it('should handle complete event', () => {
            const manager = createSubscriptionManager()
            const onComplete = vi.fn()

            const subscription = manager.subscribeWebSocket(
                { url: 'wss://api.example.com/graphql' },
                'subscription { test }',
                { onData: vi.fn(), onComplete }
            )

            const ws = MockWebSocket.getLastInstance()!
            ws.simulateOpen()
            ws.simulateMessage({ type: 'connection_ack' })
            ws.simulateMessage({ id: subscription.id, type: 'complete' })

            expect(onComplete).toHaveBeenCalled()
        })

        it('should unsubscribe properly', () => {
            const manager = createSubscriptionManager()

            const subscription = manager.subscribeWebSocket(
                { url: 'wss://api.example.com/graphql' },
                'subscription { test }',
                { onData: vi.fn() }
            )

            expect(manager.getActiveCount()).toBe(1)

            subscription.unsubscribe()

            expect(subscription.isActive()).toBe(false)
        })
    })

    describe('subscribeSSE', () => {
        it('should create an SSE subscription', () => {
            const manager = createSubscriptionManager()
            const onData = vi.fn()

            const subscription = manager.subscribeSSE(
                { url: 'https://api.example.com/graphql/stream' },
                'subscription { messageReceived { id } }',
                { onData }
            )

            expect(subscription).toBeDefined()
            expect(subscription.id).toMatch(/^sse_/)
        })

        it('should track SSE subscription state', () => {
            const manager = createSubscriptionManager()

            const subscription = manager.subscribeSSE(
                { url: 'https://api.example.com/graphql/stream' },
                'subscription { test }',
                { onData: vi.fn() }
            )

            expect(subscription.getState()).toBe('connecting')
            expect(subscription.isActive()).toBe(true)
        })

        it('should unsubscribe SSE properly', () => {
            const manager = createSubscriptionManager()

            const subscription = manager.subscribeSSE(
                { url: 'https://api.example.com/graphql/stream' },
                'subscription { test }',
                { onData: vi.fn() }
            )

            expect(manager.getActiveCount()).toBe(1)

            subscription.unsubscribe()

            expect(subscription.isActive()).toBe(false)
        })
    })

    describe('subscription management', () => {
        it('should track active subscriptions', () => {
            const manager = createSubscriptionManager()

            const sub1 = manager.subscribeWebSocket({ url: 'wss://api.example.com/graphql' }, 'subscription { one }', {
                onData: vi.fn(),
            })

            const sub2 = manager.subscribeWebSocket({ url: 'wss://api.example.com/graphql' }, 'subscription { two }', {
                onData: vi.fn(),
            })

            expect(manager.getActiveCount()).toBe(2)
            expect(manager.getActiveSubscriptions()).toHaveLength(2)
            expect(manager.getActiveSubscriptions().map((s) => s.id)).toContain(sub1.id)
            expect(manager.getActiveSubscriptions().map((s) => s.id)).toContain(sub2.id)
        })

        it('should unsubscribe all', () => {
            const manager = createSubscriptionManager()

            manager.subscribeWebSocket({ url: 'wss://api.example.com/graphql' }, 'subscription { one }', {
                onData: vi.fn(),
            })

            manager.subscribeWebSocket({ url: 'wss://api.example.com/graphql' }, 'subscription { two }', {
                onData: vi.fn(),
            })

            expect(manager.getActiveCount()).toBe(2)

            manager.unsubscribeAll()

            expect(manager.getActiveCount()).toBe(0)
        })

        it('should close all and reset config', () => {
            const manager = createSubscriptionManager()
            manager.configure({
                defaultProtocol: 'websocket',
                webSocket: { url: 'wss://api.example.com/graphql' },
            })

            manager.subscribeWebSocket({ url: 'wss://api.example.com/graphql' }, 'subscription { test }', {
                onData: vi.fn(),
            })

            manager.closeAll()

            expect(manager.getActiveCount()).toBe(0)

            // After closeAll, trying to subscribe without URL should throw
            expect(() => manager.subscribe('subscription { test }', { onData: vi.fn() })).toThrow(
                /WebSocket URL not configured/
            )
        })
    })

    describe('operation handling', () => {
        it('should accept string operations', () => {
            const manager = createSubscriptionManager()

            const subscription = manager.subscribeWebSocket(
                { url: 'wss://api.example.com/graphql' },
                'subscription { messageReceived { id content } }',
                { onData: vi.fn() }
            )

            expect(subscription).toBeDefined()
        })

        it('should accept operation objects', () => {
            const manager = createSubscriptionManager()

            const subscription = manager.subscribeWebSocket(
                { url: 'wss://api.example.com/graphql' },
                {
                    query: 'subscription OnMessage($channelId: ID!) { messageReceived(channelId: $channelId) { id } }',
                    variables: { channelId: '123' },
                },
                { onData: vi.fn() }
            )

            expect(subscription).toBeDefined()
        })

        it('should accept variables as separate parameter', () => {
            const manager = createSubscriptionManager()

            const subscription = manager.subscribeWebSocket(
                { url: 'wss://api.example.com/graphql' },
                'subscription OnMessage($channelId: ID!) { messageReceived(channelId: $channelId) { id } }',
                { onData: vi.fn() },
                { channelId: '123' }
            )

            expect(subscription).toBeDefined()
        })
    })

    describe('callbacks', () => {
        it('should call onStateChange when state changes', () => {
            const manager = createSubscriptionManager()
            const onStateChange = vi.fn()

            manager.subscribeWebSocket({ url: 'wss://api.example.com/graphql' }, 'subscription { test }', {
                onData: vi.fn(),
                onStateChange,
            })

            const ws = MockWebSocket.getLastInstance()!

            // Initial state should be connecting
            ws.simulateOpen()
            ws.simulateMessage({ type: 'connection_ack' })

            expect(onStateChange).toHaveBeenCalledWith('connected')
        })

        it('should call onError on WebSocket error', () => {
            const manager = createSubscriptionManager()
            const onError = vi.fn()

            manager.subscribeWebSocket({ url: 'wss://api.example.com/graphql' }, 'subscription { test }', {
                onData: vi.fn(),
                onError,
            })

            const ws = MockWebSocket.getLastInstance()!
            ws.simulateError(new Error('Connection failed'))

            expect(onError).toHaveBeenCalled()
        })

        it('should call onComplete when unsubscribed', () => {
            const manager = createSubscriptionManager()
            const onComplete = vi.fn()

            const subscription = manager.subscribeWebSocket(
                { url: 'wss://api.example.com/graphql' },
                'subscription { test }',
                { onData: vi.fn(), onComplete }
            )

            const ws = MockWebSocket.getLastInstance()!
            ws.simulateOpen()
            ws.simulateMessage({ type: 'connection_ack' })
            ws.simulateMessage({ id: subscription.id, type: 'complete' })

            expect(onComplete).toHaveBeenCalled()
        })
    })
})
