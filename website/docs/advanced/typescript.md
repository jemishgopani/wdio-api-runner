---
sidebar_position: 3
title: TypeScript Integration
description: Full TypeScript support with typed responses, generic types, type guards, and utility types for type-safe API testing.
---

# TypeScript Integration

wdio-api-runner is built with TypeScript and provides full type support. All APIs are strongly typed, enabling IDE autocompletion, compile-time error checking, and self-documenting code.

## Type Definitions

The package includes comprehensive TypeScript definitions that are automatically available when you import from `wdio-api-runner`.

## Typed Responses

### Generic Response Types

```typescript
interface User {
    id: number
    name: string
    email: string
}

// Type the response data
const response = await api.get<User>('/users/1')
console.log(response.data.name) // TypeScript knows this is string
```

### Complex Types

```typescript
interface PaginatedResponse<T> {
    data: T[]
    total: number
    page: number
    pageSize: number
}

interface User {
    id: number
    name: string
}

const response = await api.get<PaginatedResponse<User>>('/users?page=1')
console.log(response.data.data[0].name) // Fully typed
console.log(response.data.total) // number
```

## API Response Type

```typescript
import type { ApiResponse } from 'wdio-api-runner'

async function fetchUser(id: string): Promise<ApiResponse<User>> {
    return api.get<User>(`/users/${id}`)
}

const response = await fetchUser('123')
// response.status: number
// response.data: User
// response.ok: boolean
// response.duration: number
```

## Request Options Type

```typescript
import type { RequestOptions } from 'wdio-api-runner'

const options: RequestOptions = {
    headers: {
        'X-Custom': 'value'
    },
    timeout: 5000,
    retries: 3,
    retryDelay: 1000
}

await api.get('/users', options)
```

## GraphQL Types

```typescript
import type { GraphQLResponse, GraphQLError } from 'wdio-api-runner'

interface GetUserQuery {
    user: {
        id: string
        name: string
    }
}

const response = await graphql.query<GetUserQuery>(`
    query GetUser($id: ID!) {
        user(id: $id) { id name }
    }
`, { id: '123' })

if (response.isSuccess) {
    const user = response.data.data.user // Typed as { id: string, name: string }
}
```

## Extending Global Types

Add custom properties to the API client:

```typescript
// types/wdio-api-runner.d.ts
declare module 'wdio-api-runner' {
    interface ApiClient {
        customMethod(data: MyData): Promise<ApiResponse<MyResult>>
    }
}
```

## Config Type Safety

```typescript
// wdio.conf.ts
import type { Options } from '@wdio/types'

export const config: Options.Testrunner = {
    runner: 'api',

    apiRunner: {
        baseUrl: 'https://api.example.com',
        timeout: 30000,
        headers: {
            'Content-Type': 'application/json'
        }
    }
}
```

## Type Guards

```typescript
import type { ApiResponse } from 'wdio-api-runner'

function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & { ok: true } {
    return response.ok
}

const response = await api.get<User>('/users/1')

if (isSuccessResponse(response)) {
    // TypeScript knows response.ok is true here
    console.log(response.data)
}
```

## Utility Types

```typescript
import type {
    ApiResponse,
    ApiClientOptions,
    RequestInterceptor,
    ResponseInterceptor
} from 'wdio-api-runner'

// Create a typed interceptor
const authInterceptor: RequestInterceptor = async (url, options) => {
    return {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': 'Bearer token'
        }
    }
}

// Create a typed response interceptor
const logInterceptor: ResponseInterceptor = async (response) => {
    console.log(`${response.status}: ${response.duration}ms`)
    return response
}
```

## Strict Null Checks

The types are designed to work well with `strictNullChecks`:

```typescript
const response = await api.get<User | null>('/users/maybe-exists')

if (response.data) {
    // TypeScript knows response.data is User here
    console.log(response.data.name)
}
```

## Error Types

```typescript
interface ApiError {
    code: string
    message: string
    details?: Record<string, string[]>
}

const response = await api.post<User>('/users', invalidData)

if (!response.ok) {
    const error = response.data as ApiError
    console.log(error.message)
}
```

## Generic Test Helpers

```typescript
async function expectSuccess<T>(
    response: ApiResponse<T>,
    expectedStatus = 200
): asserts response is ApiResponse<T> & { ok: true } {
    expect(response.status).toBe(expectedStatus)
    expect(response.ok).toBe(true)
}

async function expectError<T>(
    response: ApiResponse<T>,
    expectedStatus: number
): void {
    expect(response.status).toBe(expectedStatus)
    expect(response.ok).toBe(false)
}

// Usage
const response = await api.get<User>('/users/1')
expectSuccess(response)
// TypeScript now knows response.ok is true
console.log(response.data.name)
```

## tsconfig.json Recommendations

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "esModuleInterop": true,
        "strict": true,
        "skipLibCheck": true,
        "types": [
            "node",
            "@wdio/globals/types",
            "@wdio/mocha-framework"
        ]
    },
    "include": [
        "test/**/*.ts",
        "wdio.conf.ts"
    ]
}
```
