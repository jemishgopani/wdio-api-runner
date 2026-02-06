---
sidebar_position: 3
title: GraphQL Subscriptions
description: Real-time GraphQL testing with WebSocket and Server-Sent Events (SSE) subscriptions. Learn setup, message handling, and testing patterns.
---

# GraphQL Subscriptions

wdio-api-runner supports real-time GraphQL subscriptions via WebSocket and Server-Sent Events (SSE). This enables testing of real-time features like live updates, notifications, and streaming data.

## Overview

Subscriptions enable real-time, bidirectional communication:

| Protocol | Best For | Support |
|----------|----------|---------|
| **WebSocket** | Bidirectional, low-latency | Full support |
| **SSE** | Server-push, simpler setup | Full support |

## Configuration

### WebSocket Subscriptions

Configure WebSocket connection for subscriptions:

```typescript
import { createGraphQLClient } from 'wdio-api-runner'

const graphql = createGraphQLClient({
    endpoint: 'https://api.example.com/graphql'
})

graphql.subscriptions.configure({
    webSocket: {
        // WebSocket URL (typically wss:// for secure)
        url: 'wss://api.example.com/graphql',

        // Authentication parameters sent on connection
        connectionParams: {
            authToken: 'your-auth-token'
        },

        // Optional: Connection timeout
        connectionTimeout: 10000,

        // Optional: Lazy connection (connect on first subscribe)
        lazy: true
    }
})
```

### SSE Subscriptions

Configure Server-Sent Events for subscriptions:

```typescript
graphql.subscriptions.configure({
    sse: {
        // SSE endpoint URL
        url: 'https://api.example.com/graphql/stream',

        // Headers for SSE requests
        headers: {
            'Authorization': 'Bearer token'
        }
    }
})
```

### Full Configuration

```typescript
graphql.subscriptions.configure({
    webSocket: {
        url: 'wss://api.example.com/graphql',
        connectionParams: {
            authToken: process.env.WS_TOKEN
        },
        // Auto-reconnection settings
        reconnect: true,
        reconnectAttempts: 5,
        reconnectInterval: 1000,
        // Ping/pong for connection health
        keepAlive: 30000
    },
    sse: {
        url: 'https://api.example.com/graphql/stream',
        headers: {
            'Authorization': `Bearer ${process.env.SSE_TOKEN}`
        }
    }
})
```

## Basic Subscription

### Subscribe to Events

```typescript
const subscription = graphql.subscriptions.subscribe(
    `subscription {
        messageReceived {
            id
            content
            sender {
                id
                name
            }
            createdAt
        }
    }`,
    {
        // Called for each received message
        onData: (data) => {
            console.log('New message:', data.messageReceived)
        },

        // Called on subscription errors
        onError: (error) => {
            console.error('Subscription error:', error)
        },

        // Called when subscription completes
        onComplete: () => {
            console.log('Subscription completed')
        }
    }
)

// Later: cleanup the subscription
subscription.unsubscribe()
```

### Subscription with Variables

Pass variables to your subscription:

```typescript
const subscription = graphql.subscriptions.subscribe(
    `subscription OnNewComment($postId: ID!) {
        commentAdded(postId: $postId) {
            id
            text
            author {
                id
                name
                avatar
            }
            createdAt
        }
    }`,
    {
        // Variables for the subscription
        variables: { postId: '123' },

        onData: (data) => {
            const comment = data.commentAdded
            console.log(`New comment from ${comment.author.name}: ${comment.text}`)
        },

        onError: (error) => {
            console.error('Error:', error)
        }
    }
)
```

### Multiple Subscriptions

Run multiple subscriptions simultaneously:

```typescript
// Subscribe to messages
const messagesSub = graphql.subscriptions.subscribe(
    `subscription { messageReceived { id content } }`,
    {
        onData: (data) => console.log('Message:', data.messageReceived)
    }
)

// Subscribe to notifications
const notificationsSub = graphql.subscriptions.subscribe(
    `subscription { notificationReceived { id type title } }`,
    {
        onData: (data) => console.log('Notification:', data.notificationReceived)
    }
)

// Subscribe to presence updates
const presenceSub = graphql.subscriptions.subscribe(
    `subscription { userPresenceChanged { userId status } }`,
    {
        onData: (data) => console.log('Presence:', data.userPresenceChanged)
    }
)

// Cleanup all
messagesSub.unsubscribe()
notificationsSub.unsubscribe()
presenceSub.unsubscribe()
```

## Collecting Messages

For testing scenarios where you need to collect and verify multiple messages:

### Basic Collection

```typescript
it('should receive multiple messages', async () => {
    const messages: Message[] = []

    const subscription = graphql.subscriptions.subscribe(
        `subscription { messageReceived { id content } }`,
        {
            onData: (data) => {
                messages.push(data.messageReceived)
            }
        }
    )

    // Trigger actions that create messages
    await api.post('/messages', { content: 'Hello' })
    await api.post('/messages', { content: 'World' })
    await api.post('/messages', { content: '!' })

    // Wait for messages to arrive
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Verify
    expect(messages.length).toBe(3)
    expect(messages[0].content).toBe('Hello')
    expect(messages[1].content).toBe('World')
    expect(messages[2].content).toBe('!')

    subscription.unsubscribe()
})
```

### Collection with Timeout

```typescript
async function collectMessages(
    count: number,
    timeoutMs: number = 5000
): Promise<Message[]> {
    const messages: Message[] = []

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            subscription.unsubscribe()
            reject(new Error(`Timeout: received ${messages.length}/${count} messages`))
        }, timeoutMs)

        const subscription = graphql.subscriptions.subscribe(
            `subscription { messageReceived { id content } }`,
            {
                onData: (data) => {
                    messages.push(data.messageReceived)
                    if (messages.length >= count) {
                        clearTimeout(timeout)
                        subscription.unsubscribe()
                        resolve(messages)
                    }
                },
                onError: (error) => {
                    clearTimeout(timeout)
                    subscription.unsubscribe()
                    reject(error)
                }
            }
        )
    })
}

// Usage
it('should receive exactly 3 messages', async () => {
    const messagesPromise = collectMessages(3, 5000)

    // Trigger messages
    await api.post('/messages', { content: 'One' })
    await api.post('/messages', { content: 'Two' })
    await api.post('/messages', { content: 'Three' })

    const messages = await messagesPromise
    expect(messages).toHaveLength(3)
})
```

## Async Iterator Pattern

Use async iteration for cleaner message handling:

```typescript
const subscription = graphql.subscriptions.subscribe(
    `subscription { messageReceived { id content } }`
)

let messagesReceived = 0

// Use async iteration
for await (const data of subscription) {
    console.log('Received:', data.messageReceived)
    messagesReceived++

    // Break after 5 messages
    if (messagesReceived >= 5) {
        break
    }
}

// Always clean up
subscription.unsubscribe()
```

### Async Iterator with Timeout

```typescript
async function* withTimeout<T>(
    subscription: AsyncIterable<T>,
    timeoutMs: number
): AsyncGenerator<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    })

    const iterator = subscription[Symbol.asyncIterator]()

    while (true) {
        const result = await Promise.race([
            iterator.next(),
            timeoutPromise
        ])

        if (result.done) break
        yield result.value
    }
}

// Usage
const subscription = graphql.subscriptions.subscribe(
    `subscription { messageReceived { id } }`
)

try {
    for await (const data of withTimeout(subscription, 5000)) {
        console.log('Received:', data)
    }
} catch (error) {
    if (error.message === 'Timeout') {
        console.log('No more messages within timeout')
    }
}

subscription.unsubscribe()
```

## Connection Lifecycle

### Connection Events

Monitor WebSocket connection state:

```typescript
graphql.subscriptions.configure({
    webSocket: {
        url: 'wss://api.example.com/graphql',

        onConnected: () => {
            console.log('WebSocket connected')
        },

        onDisconnected: (reason) => {
            console.log('WebSocket disconnected:', reason)
        },

        onReconnecting: (attempt) => {
            console.log(`Reconnecting... attempt ${attempt}`)
        },

        onReconnected: () => {
            console.log('WebSocket reconnected')
        },

        onError: (error) => {
            console.error('WebSocket error:', error)
        }
    }
})
```

### Manual Connection Management

Control connection manually:

```typescript
// Connect manually (if lazy: true or not yet connected)
await graphql.subscriptions.connect()

// Check connection status
const isConnected = graphql.subscriptions.isConnected()
console.log(`Connected: ${isConnected}`)

// Get connection state
const state = graphql.subscriptions.getState()
console.log(`State: ${state}`) // 'connecting' | 'connected' | 'disconnected'

// Disconnect manually
await graphql.subscriptions.disconnect()
```

### Graceful Shutdown

```typescript
describe('Real-time features', () => {
    beforeAll(async () => {
        await graphql.subscriptions.connect()
    })

    afterAll(async () => {
        await graphql.subscriptions.disconnect()
    })

    it('should handle real-time updates', async () => {
        // Tests run with active connection
    })
})
```

## Reconnection

### Auto-Reconnect Configuration

```typescript
graphql.subscriptions.configure({
    webSocket: {
        url: 'wss://api.example.com/graphql',

        // Enable auto-reconnect
        reconnect: true,

        // Maximum reconnection attempts
        reconnectAttempts: 5,

        // Base interval between attempts (ms)
        reconnectInterval: 1000,

        // Exponential backoff (interval doubles each attempt)
        reconnectIntervalMax: 30000
    }
})
```

### Manual Reconnect

```typescript
// Force reconnection
await graphql.subscriptions.reconnect()

// Reconnect with new parameters
await graphql.subscriptions.reconnect({
    connectionParams: {
        authToken: 'new-refreshed-token'
    }
})
```

### Handle Reconnection in Subscriptions

```typescript
const subscription = graphql.subscriptions.subscribe(
    `subscription { updates { id } }`,
    {
        onData: (data) => {
            console.log('Update:', data)
        },

        // Called when reconnecting
        onReconnecting: () => {
            console.log('Reconnecting... subscription will resume')
        },

        // Called after successful reconnect
        onReconnected: () => {
            console.log('Reconnected and subscription resumed')
        }
    }
)
```

## Testing Patterns

### Wait for Specific Message

Test that a specific event is received:

```typescript
it('should receive notification on user update', async () => {
    // Create a promise that resolves when the right message arrives
    const receivedPromise = new Promise<UserUpdate>((resolve, reject) => {
        const timeout = setTimeout(() => {
            subscription.unsubscribe()
            reject(new Error('Timeout waiting for update'))
        }, 5000)

        const subscription = graphql.subscriptions.subscribe(
            `subscription { userUpdated { id name email } }`,
            {
                onData: (data) => {
                    if (data.userUpdated.id === '123') {
                        clearTimeout(timeout)
                        subscription.unsubscribe()
                        resolve(data.userUpdated)
                    }
                },
                onError: (error) => {
                    clearTimeout(timeout)
                    subscription.unsubscribe()
                    reject(error)
                }
            }
        )
    })

    // Trigger the update via API
    await api.patch('/users/123', { name: 'New Name' })

    // Wait for the subscription message
    const update = await receivedPromise
    expect(update.name).toBe('New Name')
})
```

### Race Between Message and Timeout

```typescript
it('should receive message within timeout', async () => {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 5000)
    })

    const messagePromise = new Promise<Message>((resolve, reject) => {
        const subscription = graphql.subscriptions.subscribe(
            `subscription { messageReceived { id content } }`,
            {
                onData: (data) => {
                    subscription.unsubscribe()
                    resolve(data.messageReceived)
                },
                onError: (error) => {
                    subscription.unsubscribe()
                    reject(error)
                }
            }
        )
    })

    // Trigger a message
    await api.post('/messages', { content: 'Test' })

    // Race between message and timeout
    const result = await Promise.race([messagePromise, timeoutPromise])

    expect(result).toBeDefined()
    expect(result.content).toBe('Test')
})
```

### Test Message Order

```typescript
it('should receive messages in order', async () => {
    const messages: string[] = []
    const expectedCount = 5

    const completed = new Promise<void>((resolve) => {
        const subscription = graphql.subscriptions.subscribe(
            `subscription { messageReceived { id content sequence } }`,
            {
                onData: (data) => {
                    messages.push(data.messageReceived.content)
                    if (messages.length === expectedCount) {
                        subscription.unsubscribe()
                        resolve()
                    }
                }
            }
        )
    })

    // Send messages with sequence
    for (let i = 1; i <= expectedCount; i++) {
        await api.post('/messages', {
            content: `Message ${i}`,
            sequence: i
        })
    }

    await completed

    // Verify order
    expect(messages).toEqual([
        'Message 1',
        'Message 2',
        'Message 3',
        'Message 4',
        'Message 5'
    ])
})
```

### Test Subscription Filtering

```typescript
it('should only receive messages for subscribed room', async () => {
    const room1Messages: Message[] = []
    const room2Messages: Message[] = []

    const sub1 = graphql.subscriptions.subscribe(
        `subscription OnRoomMessage($roomId: ID!) {
            messageReceived(roomId: $roomId) { id content }
        }`,
        {
            variables: { roomId: 'room-1' },
            onData: (data) => room1Messages.push(data.messageReceived)
        }
    )

    const sub2 = graphql.subscriptions.subscribe(
        `subscription OnRoomMessage($roomId: ID!) {
            messageReceived(roomId: $roomId) { id content }
        }`,
        {
            variables: { roomId: 'room-2' },
            onData: (data) => room2Messages.push(data.messageReceived)
        }
    )

    // Send messages to different rooms
    await api.post('/messages', { roomId: 'room-1', content: 'Hello Room 1' })
    await api.post('/messages', { roomId: 'room-2', content: 'Hello Room 2' })
    await api.post('/messages', { roomId: 'room-1', content: 'Another for Room 1' })

    await new Promise(resolve => setTimeout(resolve, 1000))

    // Verify filtering
    expect(room1Messages.length).toBe(2)
    expect(room2Messages.length).toBe(1)
    expect(room1Messages[0].content).toBe('Hello Room 1')
    expect(room2Messages[0].content).toBe('Hello Room 2')

    sub1.unsubscribe()
    sub2.unsubscribe()
})
```

## Cleanup

Always clean up subscriptions to prevent resource leaks:

### Per-Test Cleanup

```typescript
describe('Real-time features', () => {
    let subscription: Subscription

    afterEach(async () => {
        // Clean up subscription after each test
        if (subscription) {
            subscription.unsubscribe()
        }
    })

    afterAll(async () => {
        // Disconnect WebSocket after all tests
        await graphql.subscriptions.disconnect()
    })

    it('should handle real-time updates', async () => {
        subscription = graphql.subscriptions.subscribe(
            `subscription { updates { id } }`,
            {
                onData: (data) => console.log(data)
            }
        )

        // Test logic...
    })
})
```

### Multiple Subscriptions Cleanup

```typescript
describe('Chat features', () => {
    const subscriptions: Subscription[] = []

    afterEach(() => {
        // Unsubscribe all
        subscriptions.forEach(sub => sub.unsubscribe())
        subscriptions.length = 0 // Clear array
    })

    afterAll(async () => {
        await graphql.subscriptions.disconnect()
    })

    it('should handle multiple chat rooms', async () => {
        const rooms = ['room-1', 'room-2', 'room-3']

        rooms.forEach(roomId => {
            const sub = graphql.subscriptions.subscribe(
                `subscription { messageReceived(roomId: "${roomId}") { id } }`,
                { onData: console.log }
            )
            subscriptions.push(sub)
        })

        // Test logic...
    })
})
```

## Best Practices

### 1. Always Handle Cleanup

```typescript
// Store subscription reference
const subscription = graphql.subscriptions.subscribe(...)

// Clean up when done
afterEach(() => subscription.unsubscribe())
```

### 2. Set Reasonable Timeouts

```typescript
// Don't wait forever
const timeout = setTimeout(() => {
    subscription.unsubscribe()
    reject(new Error('Timeout'))
}, 10000)
```

### 3. Handle All Error Cases

```typescript
graphql.subscriptions.subscribe(query, {
    onData: (data) => { /* handle data */ },
    onError: (error) => { /* handle errors */ },
    onComplete: () => { /* handle completion */ }
})
```

### 4. Test Edge Cases

```typescript
it('should handle rapid messages', async () => { /* ... */ })
it('should handle reconnection', async () => { /* ... */ })
it('should handle subscription errors', async () => { /* ... */ })
it('should filter messages correctly', async () => { /* ... */ })
```

## Next Steps

- [GraphQL Client](/graphql/client) — Queries and mutations
- [Query Builder](/graphql/query-builder) — Build queries programmatically
- [API Client](/core/api-client) — REST API testing
