---
sidebar_position: 2
title: GraphQL API
description: Complete API reference for the GraphQL client including createGraphQLClient, query/mutation methods, query builder, subscriptions, and TypeScript types.
---

# GraphQL API

Complete reference for the GraphQL client.

## createGraphQLClient

Creates a new GraphQL client instance.

```typescript
function createGraphQLClient(options: GraphQLClientOptions): GraphQLClient
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.endpoint` | `string` | GraphQL endpoint URL |
| `options.headers` | `Record<string, string>` | Default headers |
| `options.timeout` | `number` | Request timeout in ms |

### Example

```typescript
import { createGraphQLClient } from 'wdio-api-runner'

const graphql = createGraphQLClient({
    endpoint: 'https://api.example.com/graphql',
    headers: { 'Authorization': 'Bearer token' }
})
```

---

## Query Methods

### query

Executes a GraphQL query.

```typescript
query<T>(
    query: string,
    variables?: Record<string, any>,
    options?: RequestOptions
): Promise<GraphQLResponse<T>>
```

### mutate

Executes a GraphQL mutation.

```typescript
mutate<T>(
    mutation: string,
    variables?: Record<string, any>,
    options?: RequestOptions
): Promise<GraphQLResponse<T>>
```

### execute

Executes a built query.

```typescript
execute<T>(
    query: BuiltQuery,
    variables?: Record<string, any>
): Promise<GraphQLResponse<T>>
```

---

## Query Builder

### buildQuery

Creates a query builder.

```typescript
buildQuery(operationName: string): QueryBuilder
```

### buildMutation

Creates a mutation builder.

```typescript
buildMutation(operationName: string): QueryBuilder
```

### QueryBuilder Methods

| Method | Description |
|--------|-------------|
| `addVariable(name, type, defaultValue?)` | Add a variable |
| `select(field, options)` | Add a field selection |
| `addFragment(name, onType, fields)` | Add a fragment |
| `build()` | Build the query string |

---

## Subscriptions

### subscriptions.configure

Configures subscription transport.

```typescript
subscriptions.configure(options: SubscriptionOptions): void
```

### subscriptions.subscribe

Creates a subscription.

```typescript
subscriptions.subscribe<T>(
    subscription: string,
    options: SubscribeOptions<T>
): Subscription
```

### subscriptions.connect

Manually connects.

```typescript
subscriptions.connect(): Promise<void>
```

### subscriptions.disconnect

Disconnects.

```typescript
subscriptions.disconnect(): Promise<void>
```

### subscriptions.isConnected

Checks connection status.

```typescript
subscriptions.isConnected(): boolean
```

---

## Configuration Methods

### setEndpoint

Sets the GraphQL endpoint.

```typescript
setEndpoint(url: string): void
```

### setHeader

Sets a header.

```typescript
setHeader(name: string, value: string): void
```

---

## Types

### GraphQLClientOptions

```typescript
interface GraphQLClientOptions {
    endpoint: string
    headers?: Record<string, string>
    timeout?: number
}
```

### GraphQLResponse

```typescript
interface GraphQLResponse<T> {
    isSuccess: boolean
    isError: boolean
    isNetworkError: boolean
    data?: {
        data: T
        errors?: GraphQLError[]
    }
    errors?: GraphQLError[]
    error?: Error
    status: number
    headers: Headers
}
```

### GraphQLError

```typescript
interface GraphQLError {
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: (string | number)[]
    extensions?: Record<string, any>
}
```

### SubscriptionOptions

```typescript
interface SubscriptionOptions {
    webSocket?: {
        url: string
        connectionParams?: Record<string, any>
        reconnect?: boolean
        reconnectAttempts?: number
        reconnectInterval?: number
    }
    sse?: {
        url: string
        headers?: Record<string, string>
    }
}
```

### SubscribeOptions

```typescript
interface SubscribeOptions<T> {
    variables?: Record<string, any>
    onData?: (data: T) => void
    onError?: (error: Error) => void
    onComplete?: () => void
}
```

### Subscription

```typescript
interface Subscription {
    unsubscribe(): void
}
```
