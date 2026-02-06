---
sidebar_position: 5
title: Type Definitions
description: Complete TypeScript type definitions including ApiResponse, ApiClient, GraphQL types, interceptors, subscriptions, authentication, metrics, and configuration interfaces.
---

# Type Definitions

Complete TypeScript type definitions for wdio-api-runner.

## Core Types

### ApiResponse

```typescript
interface ApiResponse<T> {
    /** HTTP status code */
    status: number

    /** HTTP status text */
    statusText: string

    /** Response headers */
    headers: Headers

    /** Parsed response body */
    data: T

    /** True if status is 2xx */
    ok: boolean

    /** Request duration in milliseconds */
    duration: number
}
```

### ApiClient

```typescript
interface ApiClient {
    get<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>>
    post<T>(url: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>>
    put<T>(url: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>>
    patch<T>(url: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>>
    delete<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>>
    head(url: string, options?: RequestOptions): Promise<ApiResponse<void>>
    options(url: string, options?: RequestOptions): Promise<ApiResponse<void>>
    request<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>>

    setBaseUrl(url: string): void
    getBaseUrl(): string
    setHeader(name: string, value: string): void
    setHeaders(headers: Record<string, string>): void
    removeHeader(name: string): void
    getHeaders(): Record<string, string>

    addRequestInterceptor(interceptor: RequestInterceptor): void
    addResponseInterceptor(interceptor: ResponseInterceptor): void
    clearInterceptors(): void
    clearRequestInterceptors(): void
    clearResponseInterceptors(): void
}
```

### ApiClientOptions

```typescript
interface ApiClientOptions {
    baseUrl?: string
    timeout?: number
    headers?: Record<string, string>
    verbose?: boolean
    retries?: number
    retryDelay?: number
}
```

### RequestOptions

```typescript
interface RequestOptions extends RequestInit {
    timeout?: number
    retries?: number
    retryDelay?: number
}
```

---

## Interceptor Types

### RequestInterceptor

```typescript
type RequestInterceptor = (
    url: string,
    options: RequestInit
) => Promise<RequestInit & { url?: string }>
```

### ResponseInterceptor

```typescript
type ResponseInterceptor = <T>(
    response: ApiResponse<T>
) => Promise<ApiResponse<T>>
```

---

## GraphQL Types

### GraphQLClient

```typescript
interface GraphQLClient {
    query<T>(
        query: string,
        variables?: Record<string, any>,
        options?: RequestOptions
    ): Promise<GraphQLResponse<T>>

    mutate<T>(
        mutation: string,
        variables?: Record<string, any>,
        options?: RequestOptions
    ): Promise<GraphQLResponse<T>>

    execute<T>(
        query: BuiltQuery,
        variables?: Record<string, any>
    ): Promise<GraphQLResponse<T>>

    buildQuery(name: string): QueryBuilder
    buildMutation(name: string): QueryBuilder

    setEndpoint(url: string): void
    setHeader(name: string, value: string): void

    subscriptions: SubscriptionManager
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
    locations?: Array<{
        line: number
        column: number
    }>
    path?: (string | number)[]
    extensions?: Record<string, any>
}
```

### GraphQLClientOptions

```typescript
interface GraphQLClientOptions {
    endpoint: string
    headers?: Record<string, string>
    timeout?: number
}
```

---

## Subscription Types

### SubscriptionManager

```typescript
interface SubscriptionManager {
    configure(options: SubscriptionOptions): void
    subscribe<T>(
        subscription: string,
        options?: SubscribeOptions<T>
    ): Subscription
    connect(): Promise<void>
    disconnect(): Promise<void>
    isConnected(): boolean
    reconnect(): Promise<void>
}
```

### SubscriptionOptions

```typescript
interface SubscriptionOptions {
    webSocket?: WebSocketOptions
    sse?: SSEOptions
}

interface WebSocketOptions {
    url: string
    connectionParams?: Record<string, any>
    reconnect?: boolean
    reconnectAttempts?: number
    reconnectInterval?: number
    onConnected?: () => void
    onDisconnected?: () => void
    onError?: (error: Error) => void
}

interface SSEOptions {
    url: string
    headers?: Record<string, string>
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

---

## Authentication Types

### TokenStorage

```typescript
interface TokenStorage {
    get(key: string): Promise<string | null>
    set(
        key: string,
        value: string,
        options?: { expiresIn?: number }
    ): Promise<void>
    isValid(key: string): Promise<boolean>
    clear(): Promise<void>
}
```

---

## Metrics Types

### MetricsReport

```typescript
interface MetricsReport {
    overall: MetricsStats
    endpoints: Record<string, MetricsStats>
    byStatus: Record<number, number>
    timeline: MetricEntry[]
}

interface MetricsStats {
    count: number
    errorCount: number
    errorRate: number
    mean: number
    median: number
    p50: number
    p75: number
    p90: number
    p95: number
    p99: number
    min: number
    max: number
    stdDev: number
}

interface MetricEntry {
    timestamp: number
    endpoint: string
    duration: number
    status: number
}
```

---

## Config Types

### ApiRunnerConfig

```typescript
interface ApiRunnerConfig {
    timeout?: number
    retries?: number
    retryDelay?: number
    headers?: Record<string, string>
    verbose?: boolean
    client?: any
    clientFactory?: (config: WebdriverIO.Config) => any
    globalName?: string
    logging?: LoggingConfig
}
```

### GraphQLRunnerConfig

```typescript
interface GraphQLRunnerConfig {
    endpoint?: string
    headers?: Record<string, string>
    timeout?: number
    webSocket?: WebSocketOptions
    sse?: SSEOptions
}
```

### LoggingConfig

```typescript
interface LoggingConfig {
    enabled?: boolean
    outputDir?: string
    filename?: string
    filter?: {
        includeUrls?: string[]
        excludeUrls?: string[]
        statusCodes?: number[]
    }
    redact?: {
        headers?: string[]
        bodyFields?: string[]
    }
}
```
