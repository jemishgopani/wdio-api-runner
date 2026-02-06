---
sidebar_position: 1
title: API Client API
description: Complete API reference for the HTTP client including createApiClient, HTTP methods (GET, POST, PUT, PATCH, DELETE), configuration methods, interceptors, and TypeScript types.
---

# API Client API

Complete reference for the API client methods and types.

## createApiClient

Creates a new API client instance.

```typescript
function createApiClient(config?: Partial<WebdriverIO.Config> | ApiClientOptions): ApiClient
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `Partial<WebdriverIO.Config> \| ApiClientOptions` | Configuration options |

### Returns

`ApiClient` - The API client instance

### Example

```typescript
import { createApiClient } from 'wdio-api-runner'

const api = createApiClient({
    baseUrl: 'https://api.example.com',
    timeout: 30000
})
```

---

## HTTP Methods

### get

```typescript
get<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>>
```

### post

```typescript
post<T>(url: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>>
```

### put

```typescript
put<T>(url: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>>
```

### patch

```typescript
patch<T>(url: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>>
```

### delete

```typescript
delete<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>>
```

### head

```typescript
head(url: string, options?: RequestOptions): Promise<ApiResponse<void>>
```

### options

```typescript
options(url: string, options?: RequestOptions): Promise<ApiResponse<void>>
```

### request

```typescript
request<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>>
```

---

## Configuration Methods

### setBaseUrl

Sets the base URL for all requests.

```typescript
setBaseUrl(url: string): void
```

### getBaseUrl

Gets the current base URL.

```typescript
getBaseUrl(): string
```

### setHeader

Sets a single header.

```typescript
setHeader(name: string, value: string): void
```

### setHeaders

Sets multiple headers.

```typescript
setHeaders(headers: Record<string, string>): void
```

### removeHeader

Removes a header.

```typescript
removeHeader(name: string): void
```

### getHeaders

Gets all current headers.

```typescript
getHeaders(): Record<string, string>
```

---

## Interceptors

### addRequestInterceptor

Adds a request interceptor.

```typescript
addRequestInterceptor(interceptor: RequestInterceptor): void
```

### addResponseInterceptor

Adds a response interceptor.

```typescript
addResponseInterceptor(interceptor: ResponseInterceptor): void
```

### clearInterceptors

Clears all interceptors.

```typescript
clearInterceptors(): void
```

### clearRequestInterceptors

Clears only request interceptors.

```typescript
clearRequestInterceptors(): void
```

### clearResponseInterceptors

Clears only response interceptors.

```typescript
clearResponseInterceptors(): void
```

---

## Types

### ApiResponse

```typescript
interface ApiResponse<T> {
    status: number
    statusText: string
    headers: Headers
    data: T
    ok: boolean
    duration: number
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
