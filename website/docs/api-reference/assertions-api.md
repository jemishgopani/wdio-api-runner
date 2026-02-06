---
sidebar_position: 3
title: Assertions API
description: Complete API reference for fluent assertions including status, header, body, schema, and performance assertions with chainable syntax.
---

# Assertions API

Complete reference for assertion helpers.

## assertResponse

Creates an assertion chain for an API response.

```typescript
function assertResponse<T>(response: ApiResponse<T>): ResponseAssertion<T>
```

### Example

```typescript
import { assertResponse } from 'wdio-api-runner'

assertResponse(response)
    .toBeSuccess()
    .and.toHaveContentType('application/json')
```

---

## Status Assertions

### toHaveStatus

Asserts the response has a specific status code.

```typescript
toHaveStatus(status: number): ResponseAssertion<T>
```

### toBeSuccess / toBeOk

Asserts the response is successful (2xx).

```typescript
toBeSuccess(): ResponseAssertion<T>
toBeOk(): ResponseAssertion<T>
```

### toBeClientError

Asserts the response is a client error (4xx).

```typescript
toBeClientError(): ResponseAssertion<T>
```

### toBeServerError

Asserts the response is a server error (5xx).

```typescript
toBeServerError(): ResponseAssertion<T>
```

### Specific Status Methods

| Method | Status Code |
|--------|-------------|
| `toBeCreated()` | 201 |
| `toBeNoContent()` | 204 |
| `toBeBadRequest()` | 400 |
| `toBeUnauthorized()` | 401 |
| `toBeForbidden()` | 403 |
| `toBeNotFound()` | 404 |
| `toBeConflict()` | 409 |
| `toBeUnprocessableEntity()` | 422 |
| `toBeInternalServerError()` | 500 |

---

## Header Assertions

### toHaveHeader

Asserts the response has a header (optionally with value).

```typescript
toHaveHeader(name: string, value?: string): ResponseAssertion<T>
```

### toHaveContentType

Asserts the response has a specific content type.

```typescript
toHaveContentType(contentType: string): ResponseAssertion<T>
```

---

## Body Assertions

### toHaveBodyProperty

Asserts the body has a property (optionally with value).

```typescript
toHaveBodyProperty(path: string, value?: any): ResponseAssertion<T>
```

Supports nested paths:

```typescript
assertResponse(response).toHaveBodyProperty('user.address.city', 'New York')
```

### toHaveBodyContaining

Asserts the body contains a string.

```typescript
toHaveBodyContaining(text: string): ResponseAssertion<T>
```

### toHaveBodyMatching

Asserts the body matches a regex.

```typescript
toHaveBodyMatching(pattern: RegExp): ResponseAssertion<T>
```

---

## Performance Assertions

### toRespondWithin

Asserts the response time is under a threshold.

```typescript
toRespondWithin(ms: number): ResponseAssertion<T>
```

---

## Schema Assertions

### toMatchSchema

Asserts the body matches a JSON schema.

```typescript
toMatchSchema(schema: object): ResponseAssertion<T>
```

### Example

```typescript
const schema = {
    type: 'object',
    required: ['id', 'name'],
    properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        email: { type: 'string', format: 'email' }
    }
}

assertResponse(response).toMatchSchema(schema)
```

---

## Chaining

### and

Chains assertions together.

```typescript
assertResponse(response)
    .toBeSuccess()
    .and.toHaveContentType('application/json')
    .and.toHaveBodyProperty('id')
    .and.toRespondWithin(500)
```

---

## Types

### ResponseAssertion

```typescript
interface ResponseAssertion<T> {
    // Status
    toHaveStatus(status: number): ResponseAssertion<T>
    toBeSuccess(): ResponseAssertion<T>
    toBeOk(): ResponseAssertion<T>
    toBeClientError(): ResponseAssertion<T>
    toBeServerError(): ResponseAssertion<T>
    toBeCreated(): ResponseAssertion<T>
    toBeNoContent(): ResponseAssertion<T>
    toBeBadRequest(): ResponseAssertion<T>
    toBeUnauthorized(): ResponseAssertion<T>
    toBeForbidden(): ResponseAssertion<T>
    toBeNotFound(): ResponseAssertion<T>

    // Headers
    toHaveHeader(name: string, value?: string): ResponseAssertion<T>
    toHaveContentType(contentType: string): ResponseAssertion<T>

    // Body
    toHaveBodyProperty(path: string, value?: any): ResponseAssertion<T>
    toHaveBodyContaining(text: string): ResponseAssertion<T>
    toHaveBodyMatching(pattern: RegExp): ResponseAssertion<T>

    // Schema
    toMatchSchema(schema: object): ResponseAssertion<T>

    // Performance
    toRespondWithin(ms: number): ResponseAssertion<T>

    // Chaining
    and: ResponseAssertion<T>
}
```
