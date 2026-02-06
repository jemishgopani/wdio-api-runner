---
sidebar_position: 3
title: Interceptors
description: Add middleware to modify requests and responses globally. Learn about request interceptors, response interceptors, and common patterns like authentication, logging, and retries.
---

# Interceptors

Interceptors allow you to modify requests before they're sent and responses after they're received. They're the ideal solution for cross-cutting concerns like authentication, logging, error handling, and request transformation.

## Overview

Interceptors act as middleware in your API request pipeline:

```
Request → [Request Interceptors] → Network → [Response Interceptors] → Response
```

| Type | When it runs | Common uses |
|------|--------------|-------------|
| **Request** | Before each request | Add auth headers, modify URLs, log requests |
| **Response** | After each response | Log responses, transform data, handle errors |

## Request Interceptors

Request interceptors run before every request is sent. They receive the URL and request options, and must return the (potentially modified) options.

### Basic Request Interceptor

```typescript
// Add a custom header to every request
api.addRequestInterceptor(async (url, options) => {
    return {
        ...options,
        headers: {
            ...options.headers,
            'X-Custom-Header': 'custom-value'
        }
    }
})
```

### Authentication Interceptor

The most common use case is adding authentication headers:

```typescript
api.addRequestInterceptor(async (url, options) => {
    const token = await getAuthToken()

    return {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        }
    }
})
```

### Dynamic Token Retrieval

```typescript
// Token that refreshes automatically
api.addRequestInterceptor(async (url, options) => {
    let token = await storage.get('access_token')

    // Check if token is expired
    if (isTokenExpired(token)) {
        token = await refreshToken()
        await storage.set('access_token', token)
    }

    return {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        }
    }
})
```

### URL Modification

Add API versioning or prefixes:

```typescript
// Add API version prefix
api.addRequestInterceptor(async (url, options) => {
    return {
        ...options,
        url: `/v2${url}`
    }
})

// Add tenant-specific prefix
api.addRequestInterceptor(async (url, options) => {
    const tenantId = getCurrentTenantId()
    return {
        ...options,
        url: `/tenants/${tenantId}${url}`
    }
})
```

### Request ID Tracking

Add unique identifiers for request tracing:

```typescript
api.addRequestInterceptor(async (url, options) => {
    const requestId = crypto.randomUUID()

    // Store for later reference if needed
    console.log(`Sending request ${requestId} to ${url}`)

    return {
        ...options,
        headers: {
            ...options.headers,
            'X-Request-ID': requestId,
            'X-Correlation-ID': getCorrelationId()
        }
    }
})
```

### Request Logging

Log all outgoing requests:

```typescript
api.addRequestInterceptor(async (url, options) => {
    console.log(`→ ${options.method || 'GET'} ${url}`)

    if (options.body) {
        console.log('  Body:', JSON.stringify(options.body, null, 2))
    }

    return options
})
```

### Conditional Headers

Add headers based on the request:

```typescript
api.addRequestInterceptor(async (url, options) => {
    const headers = { ...options.headers }

    // Add admin header for admin endpoints
    if (url.includes('/admin')) {
        headers['X-Admin-Access'] = 'true'
    }

    // Add file-specific headers
    if (url.includes('/upload')) {
        headers['X-Upload-Mode'] = 'chunked'
    }

    // Add idempotency key for mutations
    if (['POST', 'PUT', 'PATCH'].includes(options.method || '')) {
        headers['Idempotency-Key'] = crypto.randomUUID()
    }

    return { ...options, headers }
})
```

## Response Interceptors

Response interceptors run after every response is received. They receive the response object and must return it (potentially modified).

### Basic Response Interceptor

```typescript
api.addResponseInterceptor(async (response) => {
    console.log(`← ${response.status} ${response.statusText} (${response.duration}ms)`)
    return response
})
```

### Response Logging

Log response details:

```typescript
api.addResponseInterceptor(async (response) => {
    const icon = response.ok ? '✓' : '✗'
    console.log(`${icon} ${response.status} ${response.url} (${response.duration}ms)`)

    // Log errors in detail
    if (!response.ok) {
        console.error('Response body:', response.data)
    }

    return response
})
```

### Data Transformation

Unwrap nested response data:

```typescript
// Many APIs wrap data in a container object
// { "data": { "user": { ... } }, "meta": { ... } }

api.addResponseInterceptor(async (response) => {
    // Unwrap the data property
    if (response.data?.data && typeof response.data.data === 'object') {
        return {
            ...response,
            data: response.data.data,
            meta: response.data.meta // Preserve meta if needed
        }
    }
    return response
})
```

### Error Enrichment

Add additional context to errors:

```typescript
api.addResponseInterceptor(async (response) => {
    if (!response.ok) {
        // Enrich error with additional context
        const enrichedData = {
            ...response.data,
            _url: response.url,
            _status: response.status,
            _timestamp: new Date().toISOString()
        }

        return {
            ...response,
            data: enrichedData
        }
    }
    return response
})
```

### Performance Tracking

Collect performance metrics:

```typescript
const metrics: number[] = []

api.addResponseInterceptor(async (response) => {
    metrics.push(response.duration)

    // Calculate running average
    const avg = metrics.reduce((a, b) => a + b, 0) / metrics.length

    if (response.duration > avg * 2) {
        console.warn(`Slow request: ${response.url} took ${response.duration}ms (avg: ${avg.toFixed(0)}ms)`)
    }

    return response
})
```

### Automatic Error Handling

Handle common error scenarios:

```typescript
api.addResponseInterceptor(async (response) => {
    // Log server errors
    if (response.status >= 500) {
        console.error(`Server error on ${response.url}:`, response.data)
    }

    // Handle rate limiting
    if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        console.warn(`Rate limited. Retry after: ${retryAfter}s`)
    }

    // Handle maintenance mode
    if (response.status === 503) {
        console.warn('Service temporarily unavailable')
    }

    return response
})
```

## Interceptor Order

Interceptors run in the order they were added:

```typescript
// Request interceptors: First added runs first
api.addRequestInterceptor(async (url, options) => {
    console.log('1. First interceptor')
    return options
})

api.addRequestInterceptor(async (url, options) => {
    console.log('2. Second interceptor')
    return options
})

// Output:
// 1. First interceptor
// 2. Second interceptor
```

For response interceptors, the order is the same:

```typescript
api.addResponseInterceptor(async (response) => {
    console.log('1. First response interceptor')
    return response
})

api.addResponseInterceptor(async (response) => {
    console.log('2. Second response interceptor')
    return response
})
```

### Interceptor Pipeline

```
Request:
  → Interceptor 1 (auth) → Interceptor 2 (logging) → Network

Response:
  Network → Interceptor 1 (logging) → Interceptor 2 (transform) →
```

## Managing Interceptors

### Clear All Interceptors

Remove all registered interceptors:

```typescript
// Clear all interceptors (both request and response)
api.clearInterceptors()
```

### Clear Specific Types

Remove only request or response interceptors:

```typescript
// Clear only request interceptors
api.clearRequestInterceptors()

// Clear only response interceptors
api.clearResponseInterceptors()
```

### Interceptor Lifecycle

Set up interceptors in test hooks:

```typescript
describe('API Tests', () => {
    // Add interceptors before tests
    before(async () => {
        api.addRequestInterceptor(authInterceptor)
        api.addResponseInterceptor(loggingInterceptor)
    })

    // Clean up after tests
    after(async () => {
        api.clearInterceptors()
    })

    it('should work with interceptors', async () => {
        // Auth and logging applied automatically
        const response = await api.get('/users')
        expect(response.status).toBe(200)
    })
})
```

## Common Use Cases

### Token Refresh on 401

Automatically refresh tokens when they expire:

```typescript
let isRefreshing = false
let refreshPromise: Promise<string> | null = null

api.addResponseInterceptor(async (response) => {
    if (response.status === 401 && !isRefreshing) {
        isRefreshing = true

        try {
            // Only one refresh at a time
            refreshPromise = refreshPromise || refreshAuthToken()
            const newToken = await refreshPromise

            // Update the stored token
            api.setHeader('Authorization', `Bearer ${newToken}`)

            console.log('Token refreshed successfully')
        } catch (error) {
            console.error('Token refresh failed:', error)
            // Redirect to login or handle appropriately
        } finally {
            isRefreshing = false
            refreshPromise = null
        }
    }

    return response
})
```

### Request/Response Timing

Track request durations for performance monitoring:

```typescript
const requestTimings = new Map<string, number>()

api.addRequestInterceptor(async (url, options) => {
    const requestId = crypto.randomUUID()
    requestTimings.set(requestId, Date.now())

    return {
        ...options,
        headers: {
            ...options.headers,
            'X-Request-ID': requestId
        }
    }
})

api.addResponseInterceptor(async (response) => {
    const requestId = response.headers.get('X-Request-ID')

    if (requestId && requestTimings.has(requestId)) {
        const startTime = requestTimings.get(requestId)!
        const duration = Date.now() - startTime

        console.log(`${response.url}: ${duration}ms`)

        requestTimings.delete(requestId)
    }

    return response
})
```

### Request Caching

Cache GET requests for repeated calls:

```typescript
const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 60000 // 1 minute

api.addRequestInterceptor(async (url, options) => {
    const method = options.method || 'GET'

    // Only cache GET requests
    if (method !== 'GET') {
        return options
    }

    const cached = cache.get(url)
    const now = Date.now()

    if (cached && now - cached.timestamp < CACHE_TTL) {
        // Return cached response (you'd need custom handling for this)
        console.log(`Cache hit: ${url}`)
    }

    return options
})

api.addResponseInterceptor(async (response) => {
    // Cache successful GET responses
    if (response.ok && response.request.method === 'GET') {
        cache.set(response.url, {
            data: response.data,
            timestamp: Date.now()
        })
    }

    return response
})
```

### Request Deduplication

Prevent duplicate concurrent requests:

```typescript
const pendingRequests = new Map<string, Promise<unknown>>()

function getRequestKey(url: string, options: RequestInit): string {
    return `${options.method || 'GET'}:${url}:${JSON.stringify(options.body)}`
}

// Note: This is a simplified example; actual implementation would be more complex
```

### Environment-Specific Headers

Add headers based on environment:

```typescript
api.addRequestInterceptor(async (url, options) => {
    const env = process.env.NODE_ENV || 'development'

    const headers = {
        ...options.headers,
        'X-Environment': env,
        'X-Client-Version': process.env.npm_package_version
    }

    // Add debug headers in non-production
    if (env !== 'production') {
        headers['X-Debug-Mode'] = 'true'
        headers['X-Test-Run-ID'] = process.env.TEST_RUN_ID || 'local'
    }

    return { ...options, headers }
})
```

### Retry with Exponential Backoff

Implement custom retry logic:

```typescript
api.addResponseInterceptor(async (response) => {
    // Only retry on specific errors
    const retryableStatuses = [408, 429, 500, 502, 503, 504]

    if (retryableStatuses.includes(response.status)) {
        const retryCount = parseInt(response.headers.get('X-Retry-Count') || '0')
        const maxRetries = 3

        if (retryCount < maxRetries) {
            const delay = Math.pow(2, retryCount) * 1000 // Exponential backoff
            console.log(`Retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`)

            await new Promise(resolve => setTimeout(resolve, delay))

            // Note: Actual retry implementation would need to re-execute the request
        }
    }

    return response
})
```

## Best Practices

### 1. Keep Interceptors Focused

Each interceptor should do one thing well:

```typescript
// Good - single responsibility
api.addRequestInterceptor(addAuthHeader)
api.addRequestInterceptor(addRequestId)
api.addRequestInterceptor(logRequest)

// Avoid - too many responsibilities
api.addRequestInterceptor(async (url, options) => {
    // Auth + logging + modification + validation...
})
```

### 2. Handle Errors Gracefully

Don't let interceptor errors break requests:

```typescript
api.addRequestInterceptor(async (url, options) => {
    try {
        const token = await getToken()
        return {
            ...options,
            headers: { ...options.headers, 'Authorization': `Bearer ${token}` }
        }
    } catch (error) {
        console.error('Failed to get token:', error)
        // Return options unchanged rather than failing
        return options
    }
})
```

### 3. Document Your Interceptors

Make it clear what each interceptor does:

```typescript
/**
 * Adds authentication header to all requests.
 * Fetches token from secure storage and attaches as Bearer token.
 */
const authInterceptor = async (url: string, options: RequestInit) => {
    // Implementation
}

/**
 * Logs all requests and responses for debugging.
 * Only active in development environment.
 */
const loggingInterceptor = async (response: ApiResponse) => {
    // Implementation
}
```

### 4. Use Interceptors for Cross-Cutting Concerns

Interceptors are ideal for:
- Authentication
- Logging
- Error handling
- Request/response transformation
- Metrics collection

## Next Steps

- [Authentication](/core/authentication) — Built-in authentication helpers
- [API Client](/core/api-client) — Complete HTTP client reference
- [Assertions](/core/assertions) — Response validation helpers
