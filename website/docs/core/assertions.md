---
sidebar_position: 2
title: Assertions
description: Fluent assertion helpers for API response validation including status checks, header validation, body assertions, JSON schema validation, and performance checks.
---

# Assertions

wdio-api-runner provides fluent assertion helpers that make API response validation readable, expressive, and maintainable. These assertions are designed to chain naturally, making your tests self-documenting.

## Overview

The assertion library offers a chainable API for validating HTTP responses:

```typescript
import { assertResponse } from 'wdio-api-runner'

const response = await api.get('/users/1')

assertResponse(response)
    .toBeSuccess()
    .and.toHaveContentType('application/json')
    .and.toHaveBodyProperty('email')
    .and.toRespondWithin(500)
```

### Why Use Fluent Assertions?

| Benefit | Description |
|---------|-------------|
| **Readability** | Assertions read like natural language |
| **Chaining** | Multiple validations in a single statement |
| **Descriptive Errors** | Clear messages when assertions fail |
| **Type Safety** | Full TypeScript support with IntelliSense |
| **Consistency** | Standard patterns across all tests |

## Getting Started

Import the assertion function and wrap your response:

```typescript
import { assertResponse } from 'wdio-api-runner'

describe('User API', () => {
    it('should return user details', async () => {
        const response = await api.get('/users/1')

        assertResponse(response)
            .toBeSuccess()
            .and.toHaveBodyProperty('id', 1)
    })
})
```

## Status Assertions

### Exact Status Code

Verify a specific HTTP status code:

```typescript
assertResponse(response).toHaveStatus(200)
assertResponse(response).toHaveStatus(201)
assertResponse(response).toHaveStatus(204)
assertResponse(response).toHaveStatus(404)
```

### Success Responses (2xx)

Check that the response is successful:

```typescript
// Any 2xx status code
assertResponse(response).toBeSuccess()
assertResponse(response).toBeOk() // alias for toBeSuccess()

// Specific success codes
assertResponse(response).toBeCreated()    // 201 Created
assertResponse(response).toBeAccepted()   // 202 Accepted
assertResponse(response).toBeNoContent()  // 204 No Content
```

### Client Error Responses (4xx)

Validate client error responses:

```typescript
// Any 4xx status code
assertResponse(response).toBeClientError()

// Specific client errors
assertResponse(response).toBeBadRequest()    // 400 Bad Request
assertResponse(response).toBeUnauthorized()  // 401 Unauthorized
assertResponse(response).toBeForbidden()     // 403 Forbidden
assertResponse(response).toBeNotFound()      // 404 Not Found
assertResponse(response).toBeConflict()      // 409 Conflict
assertResponse(response).toBeUnprocessable() // 422 Unprocessable Entity
assertResponse(response).toBeTooManyRequests() // 429 Too Many Requests
```

### Server Error Responses (5xx)

Check for server-side errors:

```typescript
// Any 5xx status code
assertResponse(response).toBeServerError()

// Specific server errors
assertResponse(response).toBeInternalServerError() // 500
assertResponse(response).toBeServiceUnavailable()  // 503
```

### Example: Testing Different Response Codes

```typescript
describe('User API - Status Codes', () => {
    it('should return 200 for existing user', async () => {
        const response = await api.get('/users/1')
        assertResponse(response).toBeSuccess()
    })

    it('should return 201 when creating user', async () => {
        const response = await api.post('/users', { name: 'John', email: 'john@example.com' })
        assertResponse(response).toBeCreated()
    })

    it('should return 204 when deleting user', async () => {
        const response = await api.delete('/users/1')
        assertResponse(response).toBeNoContent()
    })

    it('should return 404 for non-existent user', async () => {
        const response = await api.get('/users/99999')
        assertResponse(response).toBeNotFound()
    })

    it('should return 400 for invalid data', async () => {
        const response = await api.post('/users', { email: 'invalid-email' })
        assertResponse(response).toBeBadRequest()
    })

    it('should return 401 without authentication', async () => {
        const response = await api.get('/admin/dashboard')
        assertResponse(response).toBeUnauthorized()
    })
})
```

## Header Assertions

### Check Header Exists

Verify a header is present (regardless of value):

```typescript
assertResponse(response).toHaveHeader('Content-Type')
assertResponse(response).toHaveHeader('X-Request-Id')
assertResponse(response).toHaveHeader('Cache-Control')
```

### Check Header Value

Verify a header has a specific value:

```typescript
// Exact match
assertResponse(response).toHaveHeader('Content-Type', 'application/json')

// With charset
assertResponse(response).toHaveHeader('Content-Type', 'application/json; charset=utf-8')

// Custom headers
assertResponse(response).toHaveHeader('X-Rate-Limit-Limit', '1000')
```

### Content-Type Shorthand

The most common header check has a dedicated method:

```typescript
assertResponse(response).toHaveContentType('application/json')
assertResponse(response).toHaveContentType('text/html')
assertResponse(response).toHaveContentType('application/xml')
assertResponse(response).toHaveContentType('text/plain')
```

### Example: Validating Response Headers

```typescript
describe('API Headers', () => {
    it('should return proper content type', async () => {
        const response = await api.get('/users')

        assertResponse(response)
            .toBeSuccess()
            .and.toHaveContentType('application/json')
    })

    it('should include rate limit headers', async () => {
        const response = await api.get('/users')

        assertResponse(response)
            .toHaveHeader('X-Rate-Limit-Limit')
            .and.toHaveHeader('X-Rate-Limit-Remaining')
            .and.toHaveHeader('X-Rate-Limit-Reset')
    })

    it('should include request tracking', async () => {
        const response = await api.get('/users')

        assertResponse(response).toHaveHeader('X-Request-Id')
    })

    it('should set cache control for static resources', async () => {
        const response = await api.get('/config')

        assertResponse(response)
            .toHaveHeader('Cache-Control', 'max-age=3600')
    })
})
```

## Body Assertions

### Property Existence

Check that a property exists in the response body:

```typescript
// Top-level property
assertResponse(response).toHaveBodyProperty('id')
assertResponse(response).toHaveBodyProperty('name')
assertResponse(response).toHaveBodyProperty('email')

// Nested property (dot notation)
assertResponse(response).toHaveBodyProperty('user.profile')
assertResponse(response).toHaveBodyProperty('user.profile.avatar')
assertResponse(response).toHaveBodyProperty('meta.pagination.page')
```

### Property Value

Verify a property has a specific value:

```typescript
// Exact value match
assertResponse(response).toHaveBodyProperty('id', 1)
assertResponse(response).toHaveBodyProperty('status', 'active')
assertResponse(response).toHaveBodyProperty('isAdmin', true)

// Nested property value
assertResponse(response).toHaveBodyProperty('user.email', 'john@example.com')
assertResponse(response).toHaveBodyProperty('meta.total', 100)
```

### Array Index Access

Access array elements using bracket notation:

```typescript
// First item in array
assertResponse(response).toHaveBodyProperty('users[0].name')

// Specific index
assertResponse(response).toHaveBodyProperty('errors[0].field', 'email')
assertResponse(response).toHaveBodyProperty('errors[0].message', 'Invalid email format')

// Nested arrays
assertResponse(response).toHaveBodyProperty('data[0].tags[0]', 'important')
```

### Body Content Matching

Check if the body contains specific text:

```typescript
// Contains substring
assertResponse(response).toHaveBodyContaining('success')
assertResponse(response).toHaveBodyContaining('user')

// For string responses
assertResponse(response).toHaveBodyContaining('Welcome')
```

### Regex Pattern Matching

Validate body content against a regular expression:

```typescript
// Pattern matching
assertResponse(response).toHaveBodyMatching(/user_\d+/)
assertResponse(response).toHaveBodyMatching(/^[A-Za-z0-9-]+$/)
assertResponse(response).toHaveBodyMatching(/\d{4}-\d{2}-\d{2}/)
```

### Example: Validating Response Bodies

```typescript
describe('User Response Body', () => {
    it('should return complete user object', async () => {
        const response = await api.get('/users/1')

        assertResponse(response)
            .toBeSuccess()
            .and.toHaveBodyProperty('id')
            .and.toHaveBodyProperty('name')
            .and.toHaveBodyProperty('email')
            .and.toHaveBodyProperty('createdAt')
    })

    it('should return user with correct ID', async () => {
        const response = await api.get('/users/1')

        assertResponse(response)
            .toHaveBodyProperty('id', 1)
    })

    it('should return nested profile data', async () => {
        const response = await api.get('/users/1?include=profile')

        assertResponse(response)
            .toHaveBodyProperty('profile.bio')
            .and.toHaveBodyProperty('profile.avatar')
            .and.toHaveBodyProperty('profile.location')
    })

    it('should return paginated list', async () => {
        const response = await api.get('/users?page=1&limit=10')

        assertResponse(response)
            .toHaveBodyProperty('data')
            .and.toHaveBodyProperty('meta.currentPage', 1)
            .and.toHaveBodyProperty('meta.perPage', 10)
            .and.toHaveBodyProperty('meta.total')
    })
})
```

## Performance Assertions

Validate response times for performance testing:

```typescript
// Response must complete within specified milliseconds
assertResponse(response).toRespondWithin(500)   // 500ms
assertResponse(response).toRespondWithin(1000)  // 1 second
assertResponse(response).toRespondWithin(5000)  // 5 seconds
```

### Example: Performance Requirements

```typescript
describe('API Performance', () => {
    it('should return user list within 500ms', async () => {
        const response = await api.get('/users')

        assertResponse(response)
            .toBeSuccess()
            .and.toRespondWithin(500)
    })

    it('should handle complex query within 2 seconds', async () => {
        const response = await api.get('/reports/summary', {
            params: { startDate: '2024-01-01', endDate: '2024-12-31' }
        })

        assertResponse(response)
            .toBeSuccess()
            .and.toRespondWithin(2000)
    })

    it('should cache responses for fast retrieval', async () => {
        // First request (cache miss)
        await api.get('/config')

        // Second request (cache hit) should be fast
        const response = await api.get('/config')

        assertResponse(response)
            .toRespondWithin(100)
    })
})
```

## JSON Schema Validation

Validate response structure against a JSON Schema:

### Basic Schema Validation

```typescript
const userSchema = {
    type: 'object',
    required: ['id', 'name', 'email'],
    properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        email: { type: 'string', format: 'email' }
    }
}

assertResponse(response).toMatchSchema(userSchema)
```

### Strict Schema (No Additional Properties)

```typescript
const strictUserSchema = {
    type: 'object',
    additionalProperties: false,  // Fail if extra properties exist
    required: ['id', 'name', 'email'],
    properties: {
        id: { type: 'number' },
        name: { type: 'string', minLength: 1 },
        email: { type: 'string', format: 'email' }
    }
}

assertResponse(response).toMatchSchema(strictUserSchema)
```

### Complex Nested Schema

```typescript
const orderSchema = {
    type: 'object',
    required: ['id', 'customer', 'items', 'total'],
    properties: {
        id: { type: 'string', pattern: '^ORD-\\d+$' },
        customer: {
            type: 'object',
            required: ['id', 'email'],
            properties: {
                id: { type: 'number' },
                email: { type: 'string', format: 'email' },
                name: { type: 'string' }
            }
        },
        items: {
            type: 'array',
            minItems: 1,
            items: {
                type: 'object',
                required: ['productId', 'quantity', 'price'],
                properties: {
                    productId: { type: 'number' },
                    quantity: { type: 'integer', minimum: 1 },
                    price: { type: 'number', minimum: 0 }
                }
            }
        },
        total: { type: 'number', minimum: 0 },
        status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'shipped', 'delivered']
        },
        createdAt: { type: 'string', format: 'date-time' }
    }
}

assertResponse(response).toMatchSchema(orderSchema)
```

### Example: Contract Testing with Schema

```typescript
describe('API Contract Tests', () => {
    const userSchema = {
        type: 'object',
        required: ['id', 'name', 'email', 'createdAt'],
        properties: {
            id: { type: 'number' },
            name: { type: 'string', minLength: 1 },
            email: { type: 'string', format: 'email' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
        }
    }

    const errorSchema = {
        type: 'object',
        required: ['code', 'message'],
        properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            details: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        field: { type: 'string' },
                        error: { type: 'string' }
                    }
                }
            }
        }
    }

    it('GET /users/{id} should match user schema', async () => {
        const response = await api.get('/users/1')

        assertResponse(response)
            .toBeSuccess()
            .and.toMatchSchema(userSchema)
    })

    it('POST /users with invalid data should match error schema', async () => {
        const response = await api.post('/users', { name: '' })

        assertResponse(response)
            .toBeBadRequest()
            .and.toMatchSchema(errorSchema)
    })
})
```

## Chaining Assertions

Use `.and` for readable, chainable assertions:

```typescript
assertResponse(response)
    .toBeSuccess()
    .and.toHaveContentType('application/json')
    .and.toHaveHeader('X-Request-Id')
    .and.toHaveBodyProperty('id')
    .and.toHaveBodyProperty('email')
    .and.toRespondWithin(1000)
```

### Logical Grouping

Group related assertions for clarity:

```typescript
describe('Complete API Response Validation', () => {
    it('should validate entire response', async () => {
        const response = await api.post('/orders', {
            productId: 123,
            quantity: 2
        })

        // Status validation
        assertResponse(response).toBeCreated()

        // Header validation
        assertResponse(response)
            .toHaveContentType('application/json')
            .and.toHaveHeader('Location')

        // Body validation
        assertResponse(response)
            .toHaveBodyProperty('id')
            .and.toHaveBodyProperty('status', 'pending')
            .and.toHaveBodyProperty('total')

        // Performance validation
        assertResponse(response).toRespondWithin(500)
    })
})
```

## Combining with Standard Assertions

Use fluent assertions alongside standard expect for complex checks:

```typescript
const response = await api.get<User>('/users/1')

// Fluent assertions for common checks
assertResponse(response)
    .toBeSuccess()
    .and.toHaveContentType('application/json')

// Standard assertions for complex logic
expect(response.data.roles).toContain('admin')
expect(response.data.permissions.length).toBeGreaterThan(0)
expect(new Date(response.data.createdAt)).toBeInstanceOf(Date)
expect(response.data.email).toMatch(/^[^@]+@[^@]+\.[^@]+$/)

// Array assertions
expect(response.data.tags).toHaveLength(3)
expect(response.data.tags).toEqual(expect.arrayContaining(['active', 'verified']))
```

## Error Response Assertions

Validate error responses thoroughly:

```typescript
describe('Error Response Handling', () => {
    it('should return validation errors', async () => {
        const response = await api.post('/users', {
            email: 'not-an-email',
            password: '123' // too short
        })

        assertResponse(response)
            .toBeBadRequest()
            .and.toHaveBodyProperty('errors')
            .and.toHaveBodyProperty('errors[0].field')
            .and.toHaveBodyProperty('errors[0].message')
    })

    it('should return 404 with proper error body', async () => {
        const response = await api.get('/users/99999')

        assertResponse(response)
            .toBeNotFound()
            .and.toHaveBodyProperty('code', 'USER_NOT_FOUND')
            .and.toHaveBodyProperty('message')
    })

    it('should return 401 with authentication error', async () => {
        api.removeHeader('Authorization')
        const response = await api.get('/protected/resource')

        assertResponse(response)
            .toBeUnauthorized()
            .and.toHaveBodyProperty('code', 'AUTHENTICATION_REQUIRED')
    })
})
```

## Best Practices

### 1. Start with Status Assertions

Always verify the status code first:

```typescript
// Good
assertResponse(response)
    .toBeSuccess()
    .and.toHaveBodyProperty('data')

// Also good for explicit status
assertResponse(response)
    .toHaveStatus(201)
    .and.toHaveBodyProperty('id')
```

### 2. Use Semantic Methods

Prefer semantic methods over raw status codes when possible:

```typescript
// Good - self-documenting
assertResponse(response).toBeCreated()

// Less clear
assertResponse(response).toHaveStatus(201)
```

### 3. Chain Related Assertions

Keep related assertions together:

```typescript
// Good - body assertions grouped
assertResponse(response)
    .toHaveBodyProperty('user.id')
    .and.toHaveBodyProperty('user.name')
    .and.toHaveBodyProperty('user.email')
```

### 4. Use Schema Validation for Contract Tests

JSON Schema validation ensures API contracts are maintained:

```typescript
// Define schemas once, reuse everywhere
const schemas = {
    user: { /* ... */ },
    error: { /* ... */ },
    pagination: { /* ... */ }
}

assertResponse(response).toMatchSchema(schemas.user)
```

## Next Steps

- [Interceptors](/core/interceptors) — Add middleware for requests and responses
- [Authentication](/core/authentication) — Built-in authentication helpers
- [API Client](/core/api-client) — Complete HTTP client reference
