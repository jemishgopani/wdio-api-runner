---
sidebar_position: 1
title: API Client
description: Complete reference for the wdio-api-runner HTTP client including all HTTP methods, request options, response handling, type safety, and dynamic configuration.
---

# API Client

The `api` global provides a full-featured HTTP client for making requests in your tests. Built on the modern Fetch API, it offers a clean, Promise-based interface with automatic JSON parsing, response timing, and full TypeScript support.

## Overview

The API client is automatically available as a global `api` object in all your tests when using the API runner. It handles the complexities of HTTP communication so you can focus on writing tests.

| Feature | Description |
|---------|-------------|
| **All HTTP Methods** | GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS |
| **Automatic Parsing** | JSON responses are automatically parsed |
| **Response Timing** | Every response includes duration in milliseconds |
| **Type Safety** | Full TypeScript generics support |
| **Interceptors** | Modify requests and responses globally |
| **Retry Logic** | Built-in retry support with configurable delays |

## HTTP Methods

The client provides convenience methods for all standard HTTP methods:

### GET Requests

Retrieve resources from the server.

```typescript
// Simple GET request
const response = await api.get('/users')

// GET with type parameter for response data
const response = await api.get<User>('/users/1')
console.log(response.data.name) // TypeScript knows this is a User

// GET with query parameters
const response = await api.get('/users', {
    params: { page: 1, limit: 10, sort: 'name' }
})
// Request URL: /users?page=1&limit=10&sort=name
```

### POST Requests

Create new resources.

```typescript
// POST with JSON body (automatically serialized)
const response = await api.post<User>('/users', {
    name: 'John Doe',
    email: 'john@example.com'
})
console.log(response.data.id) // ID of created user

// POST with custom headers
const response = await api.post('/users', userData, {
    headers: { 'X-Request-Source': 'test-suite' }
})
```

### PUT Requests

Replace an entire resource.

```typescript
// PUT replaces the entire resource
const response = await api.put<User>('/users/1', {
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: 'admin'
})
```

### PATCH Requests

Partially update a resource.

```typescript
// PATCH updates only specified fields
const response = await api.patch<User>('/users/1', {
    status: 'active'
})
// Only the status field is updated
```

### DELETE Requests

Remove a resource.

```typescript
// Simple DELETE
const response = await api.delete('/users/1')
expect(response.status).toBe(200) // or 204

// DELETE with confirmation body (some APIs require this)
const response = await api.delete('/users/1', {
    body: { confirm: true }
})
```

### HEAD Requests

Retrieve headers without the response body.

```typescript
// Check if resource exists without downloading it
const response = await api.head('/files/large-file.zip')
const fileSize = response.headers.get('content-length')
console.log(`File size: ${fileSize} bytes`)
```

### OPTIONS Requests

Check allowed methods and CORS headers.

```typescript
// Check what methods are allowed
const response = await api.options('/users')
const allowedMethods = response.headers.get('allow')
console.log(`Allowed methods: ${allowedMethods}`)
```

## Response Object

Every request returns an `ApiResponse<T>` object containing all information about the response:

```typescript
interface ApiResponse<T> {
    // HTTP status code (200, 201, 400, 404, 500, etc.)
    status: number

    // HTTP status text ("OK", "Created", "Not Found", etc.)
    statusText: string

    // Response headers (Headers object)
    headers: Headers

    // Parsed response body (type T)
    data: T

    // true if status is in 200-299 range
    ok: boolean

    // Request duration in milliseconds
    duration: number

    // Original request URL
    url: string

    // Request configuration used
    request: RequestConfig
}
```

### Working with Responses

```typescript
const response = await api.get<User>('/users/1')

// Check status
if (response.ok) {
    console.log('Request succeeded')
} else {
    console.log(`Request failed: ${response.status} ${response.statusText}`)
}

// Access data
const user = response.data
console.log(`Hello, ${user.name}!`)

// Check headers
const contentType = response.headers.get('content-type')
const rateLimit = response.headers.get('x-rate-limit-remaining')

// Performance monitoring
if (response.duration > 1000) {
    console.warn(`Slow request: ${response.duration}ms`)
}
```

### Status Code Helpers

```typescript
const response = await api.get('/users/1')

// Quick boolean checks
response.ok        // true if 200-299
response.status    // exact status code

// Common patterns
if (response.status === 404) {
    console.log('User not found')
}

if (response.status >= 500) {
    console.log('Server error occurred')
}
```

## Request Options

Customize individual requests with options:

```typescript
interface RequestOptions {
    // Additional headers for this request
    headers?: Record<string, string>

    // Query parameters (appended to URL)
    params?: Record<string, string | number | boolean>

    // Request timeout in milliseconds
    timeout?: number

    // Number of retry attempts on failure
    retries?: number

    // Delay between retries in milliseconds
    retryDelay?: number

    // Request body (for POST, PUT, PATCH)
    body?: unknown
}
```

### Headers

```typescript
const response = await api.get('/protected/resource', {
    headers: {
        'Authorization': 'Bearer my-token',
        'X-Custom-Header': 'custom-value',
        'Accept-Language': 'en-US'
    }
})
```

### Query Parameters

```typescript
// Object-based (recommended)
const response = await api.get('/search', {
    params: {
        q: 'search term',
        page: 1,
        limit: 20,
        includeArchived: false
    }
})
// URL: /search?q=search%20term&page=1&limit=20&includeArchived=false

// Manual URL construction (also works)
const response = await api.get('/search?q=search%20term&page=1')
```

### Timeout

```typescript
// Per-request timeout
const response = await api.get('/slow-endpoint', {
    timeout: 60000 // 60 seconds
})

// Different timeouts for different endpoints
const fastResponse = await api.get('/health', { timeout: 1000 })
const slowResponse = await api.get('/report/generate', { timeout: 300000 })
```

### Retries

```typescript
// Retry failed requests
const response = await api.get('/flaky-endpoint', {
    retries: 3,       // Try up to 3 times
    retryDelay: 1000  // Wait 1 second between retries
})
```

## Request Body Types

### JSON (Default)

Objects are automatically serialized as JSON:

```typescript
// Object body → Content-Type: application/json
const response = await api.post('/users', {
    name: 'John',
    email: 'john@example.com',
    preferences: {
        theme: 'dark',
        notifications: true
    }
})
```

### FormData

For file uploads and multipart forms:

```typescript
const formData = new FormData()
formData.append('file', new Blob(['file content']), 'document.txt')
formData.append('description', 'Test document')
formData.append('category', 'testing')

const response = await api.post('/files/upload', formData)
// Content-Type is automatically set to multipart/form-data
```

### URL Encoded

For traditional form submissions:

```typescript
const params = new URLSearchParams()
params.append('username', 'john')
params.append('password', 'secret123')
params.append('remember', 'true')

const response = await api.post('/auth/login', params)
// Content-Type: application/x-www-form-urlencoded
```

### Raw String

For plain text or custom formats:

```typescript
const response = await api.post('/log', 'Plain text log message', {
    headers: { 'Content-Type': 'text/plain' }
})

// XML example
const xmlBody = `<?xml version="1.0"?>
<user>
    <name>John</name>
    <email>john@example.com</email>
</user>`

const response = await api.post('/users', xmlBody, {
    headers: { 'Content-Type': 'application/xml' }
})
```

## Dynamic Configuration

Modify client settings during test execution:

### Base URL Management

```typescript
// Get current base URL
const currentUrl = api.getBaseUrl()
console.log(`Testing against: ${currentUrl}`)

// Change base URL mid-test (useful for multi-service testing)
api.setBaseUrl('https://service-a.example.com')
const responseA = await api.get('/endpoint')

api.setBaseUrl('https://service-b.example.com')
const responseB = await api.get('/endpoint')

// Reset to original
api.setBaseUrl('https://api.example.com')
```

### Header Management

```typescript
// Add or update a single header
api.setHeader('Authorization', 'Bearer new-token')
api.setHeader('X-Request-ID', crypto.randomUUID())

// Add or update multiple headers at once
api.setHeaders({
    'X-Request-ID': crypto.randomUUID(),
    'X-Client-Version': '2.0.0',
    'X-Environment': 'staging'
})

// Remove a header
api.removeHeader('X-Temporary-Header')

// Get all current default headers
const headers = api.getHeaders()
console.log('Current headers:', headers)
```

### Example: Token Refresh

```typescript
describe('User API with token refresh', () => {
    let accessToken: string

    before(async () => {
        // Login and get initial token
        const loginResponse = await api.post('/auth/login', {
            username: 'testuser',
            password: 'testpass'
        })
        accessToken = loginResponse.data.accessToken
        api.setHeader('Authorization', `Bearer ${accessToken}`)
    })

    it('should refresh token when expired', async () => {
        // Simulate token expiration by getting a new one
        const refreshResponse = await api.post('/auth/refresh')
        accessToken = refreshResponse.data.accessToken
        api.setHeader('Authorization', `Bearer ${accessToken}`)

        // Continue with refreshed token
        const response = await api.get('/protected/resource')
        expect(response.status).toBe(200)
    })
})
```

## Custom Request

For full control over the request, use the `request` method:

```typescript
const response = await api.request('/custom-endpoint', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'value'
    },
    body: JSON.stringify({
        query: 'custom query',
        options: { format: 'json' }
    }),
    timeout: 30000
})
```

### GraphQL via Custom Request

```typescript
const response = await api.request('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        query: `
            query GetUser($id: ID!) {
                user(id: $id) {
                    id
                    name
                    email
                }
            }
        `,
        variables: { id: '123' }
    })
})

const user = response.data.data.user
```

## Type Safety

Use TypeScript generics for fully typed responses:

### Define Response Types

```typescript
// Define your API response types
interface User {
    id: number
    name: string
    email: string
    createdAt: string
}

interface UserListResponse {
    users: User[]
    total: number
    page: number
    pageSize: number
}

interface CreateUserRequest {
    name: string
    email: string
    password: string
}

interface ApiError {
    code: string
    message: string
    details?: Record<string, string[]>
}
```

### Type-Safe Requests

```typescript
// GET with typed response
const response = await api.get<User>('/users/1')
const userName: string = response.data.name // TypeScript knows this is string

// POST with typed response
const newUser: CreateUserRequest = {
    name: 'John',
    email: 'john@example.com',
    password: 'secure123'
}
const createResponse = await api.post<User>('/users', newUser)
const userId: number = createResponse.data.id

// List with pagination
const listResponse = await api.get<UserListResponse>('/users', {
    params: { page: 1, pageSize: 10 }
})
const users: User[] = listResponse.data.users
const total: number = listResponse.data.total
```

### Error Type Handling

```typescript
const response = await api.post<User>('/users', userData)

if (response.ok) {
    // Success response
    const user: User = response.data
    console.log(`Created user: ${user.name}`)
} else {
    // Error response - cast to error type
    const error = response.data as ApiError
    console.log(`Error: ${error.message}`)
    if (error.details) {
        Object.entries(error.details).forEach(([field, messages]) => {
            console.log(`  ${field}: ${messages.join(', ')}`)
        })
    }
}
```

## Best Practices

### 1. Use Type Parameters

Always specify response types for better IDE support and compile-time checking:

```typescript
// Good
const response = await api.get<User>('/users/1')

// Avoid
const response = await api.get('/users/1')
```

### 2. Handle Errors Gracefully

Check `response.ok` before accessing data:

```typescript
const response = await api.get<User>('/users/1')

if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status}`)
}

// Safe to use response.data here
const user = response.data
```

### 3. Use Interceptors for Cross-Cutting Concerns

Don't repeat authentication logic in every request:

```typescript
// Good: Set up once in before hook
before(async () => {
    api.addRequestInterceptor(authInterceptor)
})

// Avoid: Passing token in every request
const response = await api.get('/users', {
    headers: { 'Authorization': `Bearer ${token}` }
})
```

### 4. Configure Timeouts Appropriately

Set reasonable timeouts based on expected response times:

```typescript
// Health checks should be fast
await api.get('/health', { timeout: 2000 })

// Report generation might take longer
await api.get('/reports/annual', { timeout: 120000 })
```

## Next Steps

- [Assertions](/core/assertions) — Fluent assertion helpers for response validation
- [Interceptors](/core/interceptors) — Add middleware for auth, logging, and more
- [Authentication](/core/authentication) — Built-in authentication helpers
