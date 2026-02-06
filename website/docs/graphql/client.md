---
sidebar_position: 1
title: GraphQL Client
description: Full-featured GraphQL client for queries, mutations, and subscriptions with typed responses, error handling, and dynamic configuration.
---

# GraphQL Client

wdio-api-runner includes a full-featured GraphQL client that makes testing GraphQL APIs straightforward. The client supports queries, mutations, and subscriptions with full TypeScript support, error handling, and dynamic configuration.

## Overview

The GraphQL client provides:

| Feature | Description |
|---------|-------------|
| **Queries** | Fetch data with full variable support |
| **Mutations** | Modify data with input types |
| **Subscriptions** | Real-time updates via WebSocket/SSE |
| **Type Safety** | Full TypeScript generics support |
| **Error Handling** | Separate handling for GraphQL and network errors |
| **Dynamic Config** | Update headers and endpoint at runtime |

## Creating a Client

### Basic Setup

```typescript
import { createGraphQLClient } from 'wdio-api-runner'

const graphql = createGraphQLClient({
    endpoint: 'https://api.example.com/graphql'
})
```

### With Headers

Add authentication or custom headers:

```typescript
const graphql = createGraphQLClient({
    endpoint: 'https://api.example.com/graphql',
    headers: {
        'Authorization': `Bearer ${token}`,
        'X-Client-Version': '1.0.0',
        'X-Request-ID': crypto.randomUUID()
    }
})
```

### With Timeout

Configure request timeout:

```typescript
const graphql = createGraphQLClient({
    endpoint: 'https://api.example.com/graphql',
    headers: { 'Authorization': `Bearer ${token}` },
    timeout: 30000 // 30 seconds
})
```

### From Configuration

Use the client configured in `wdio.conf.ts`:

```typescript
// wdio.conf.ts
export const config = {
    runner: 'api',
    graphqlRunner: {
        endpoint: 'https://api.example.com/graphql',
        headers: {
            'Content-Type': 'application/json'
        }
    }
}

// In tests - graphql client is available globally
const response = await graphql.query(`{ users { id name } }`)
```

## Queries

### Basic Query

Execute a simple GraphQL query:

```typescript
const response = await graphql.query(`
    query {
        users {
            id
            name
            email
        }
    }
`)

if (response.isSuccess) {
    console.log('Users:', response.data.data.users)
}
```

### Query with Variables

Pass variables to your query:

```typescript
const response = await graphql.query(`
    query GetUser($id: ID!) {
        user(id: $id) {
            id
            name
            email
            createdAt
        }
    }
`, { id: '123' })

if (response.isSuccess) {
    console.log('User:', response.data.data.user)
}
```

### Complex Variables

Use complex input types:

```typescript
const response = await graphql.query(`
    query SearchUsers($filter: UserFilterInput!, $pagination: PaginationInput) {
        searchUsers(filter: $filter, pagination: $pagination) {
            users {
                id
                name
                email
            }
            total
            hasMore
        }
    }
`, {
    filter: {
        status: 'ACTIVE',
        roles: ['ADMIN', 'MANAGER'],
        createdAfter: '2024-01-01'
    },
    pagination: {
        page: 1,
        limit: 20
    }
})
```

### Typed Queries

Use TypeScript generics for type-safe responses:

```typescript
interface User {
    id: string
    name: string
    email: string
}

interface GetUserResponse {
    user: User
}

const response = await graphql.query<GetUserResponse>(`
    query GetUser($id: ID!) {
        user(id: $id) { id name email }
    }
`, { id: '123' })

if (response.isSuccess) {
    // TypeScript knows the exact shape of the response
    const user: User = response.data.data.user
    console.log(`Email: ${user.email}`)
}
```

### Typed Query Variables

Type both variables and response:

```typescript
interface GetUserVars {
    id: string
}

interface GetUserResponse {
    user: {
        id: string
        name: string
        email: string
    }
}

const response = await graphql.query<GetUserResponse, GetUserVars>(`
    query GetUser($id: ID!) {
        user(id: $id) { id name email }
    }
`, { id: '123' })
```

## Mutations

### Basic Mutation

Execute a mutation to modify data:

```typescript
const response = await graphql.mutate(`
    mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) {
            id
            name
            email
        }
    }
`, {
    input: {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secure123'
    }
})

if (response.isSuccess) {
    console.log('Created user:', response.data.data.createUser.id)
}
```

### Update Mutation

```typescript
const response = await graphql.mutate(`
    mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
        updateUser(id: $id, input: $input) {
            id
            name
            email
            updatedAt
        }
    }
`, {
    id: '123',
    input: {
        name: 'Jane Doe Updated'
    }
})
```

### Delete Mutation

```typescript
const response = await graphql.mutate(`
    mutation DeleteUser($id: ID!) {
        deleteUser(id: $id) {
            success
            message
        }
    }
`, { id: '123' })

if (response.isSuccess) {
    const result = response.data.data.deleteUser
    if (!result.success) {
        console.error('Delete failed:', result.message)
    }
}
```

### Mutation with Error Handling

Handle both success and failure cases:

```typescript
const response = await graphql.mutate(`
    mutation DeleteUser($id: ID!) {
        deleteUser(id: $id) {
            success
            message
        }
    }
`, { id: '123' })

if (response.isError) {
    // GraphQL-level errors (validation, authorization, etc.)
    console.error('GraphQL errors:', response.errors)
    for (const error of response.errors) {
        console.error(`  - ${error.message}`)
    }
} else if (response.isNetworkError) {
    // Network/HTTP errors
    console.error('Network error:', response.error)
} else if (response.isSuccess) {
    // Success
    const result = response.data.data.deleteUser
    console.log('Delete result:', result)
}
```

## Response Handling

### Response Structure

Every GraphQL operation returns a response object:

```typescript
interface GraphQLResponse<T> {
    // Response type flags
    isSuccess: boolean      // Has data, no errors
    isError: boolean        // Has GraphQL errors
    isNetworkError: boolean // Has network/HTTP error

    // Data (when successful)
    data?: {
        data: T                    // The actual response data
        errors?: GraphQLError[]    // Partial errors (some data + errors)
    }

    // Errors
    errors?: GraphQLError[] // GraphQL errors array
    error?: Error          // Network error

    // HTTP info
    status: number         // HTTP status code
    headers: Headers       // Response headers
}

interface GraphQLError {
    message: string
    path?: (string | number)[]
    locations?: { line: number; column: number }[]
    extensions?: Record<string, unknown>
}
```

### Checking Response Types

```typescript
const response = await graphql.query(`...`)

// Check response type
if (response.isSuccess) {
    // Has data, no errors
    console.log(response.data.data)
}

if (response.isError) {
    // Has GraphQL errors
    console.log(response.errors)
}

if (response.isNetworkError) {
    // Network/HTTP error
    console.log(response.error)
}
```

### Handling Partial Responses

GraphQL can return both data and errors:

```typescript
const response = await graphql.query(`
    query {
        user(id: "123") { id name }
        expensiveOperation { result }
    }
`)

// Check for partial success
if (response.data?.data && response.data?.errors) {
    console.log('Partial response')
    console.log('Data:', response.data.data.user)
    console.log('Errors:', response.data.errors)
}
```

### Working with Errors

```typescript
const response = await graphql.query(`
    query GetUser($id: ID!) {
        user(id: $id) { id name }
    }
`, { id: 'invalid' })

if (response.isError) {
    for (const error of response.errors) {
        // Error message
        console.error(`Error: ${error.message}`)

        // Path to the field that caused the error
        if (error.path) {
            console.error(`Path: ${error.path.join('.')}`)
        }

        // Location in the query
        if (error.locations) {
            for (const loc of error.locations) {
                console.error(`Location: line ${loc.line}, column ${loc.column}`)
            }
        }

        // Custom extensions (error codes, etc.)
        if (error.extensions) {
            console.error(`Code: ${error.extensions.code}`)
        }
    }
}
```

## Request Options

Override default options per-request:

```typescript
const response = await graphql.query(`...`, variables, {
    // Custom headers for this request
    headers: {
        'X-Custom-Header': 'value',
        'Authorization': 'Bearer different-token'
    },

    // Request timeout
    timeout: 10000
})
```

## Dynamic Configuration

### Update Headers

Change headers at runtime:

```typescript
// Set a single header
graphql.setHeader('Authorization', `Bearer ${newToken}`)

// Update after token refresh
const newToken = await refreshToken()
graphql.setHeader('Authorization', `Bearer ${newToken}`)
```

### Update Endpoint

Switch GraphQL endpoints:

```typescript
// Switch to a different server
graphql.setEndpoint('https://new-api.example.com/graphql')

// Switch between environments
const endpoint = process.env.USE_STAGING
    ? 'https://staging.api.example.com/graphql'
    : 'https://api.example.com/graphql'
graphql.setEndpoint(endpoint)
```

## Batching Queries

Execute multiple operations in a single request:

```typescript
// Multiple selections in one query
const response = await graphql.query(`
    query GetDashboardData {
        currentUser {
            id
            name
            avatar
        }
        notifications(unreadOnly: true) {
            id
            message
            createdAt
        }
        stats {
            totalUsers
            activeUsers
            revenue
        }
    }
`)

// Destructure the response
const { currentUser, notifications, stats } = response.data.data
```

## Testing Patterns

### Testing Query Responses

```typescript
describe('User API', () => {
    it('should fetch user by ID', async () => {
        const response = await graphql.query(`
            query GetUser($id: ID!) {
                user(id: $id) { id name email }
            }
        `, { id: '123' })

        expect(response.isSuccess).toBe(true)
        expect(response.status).toBe(200)
        expect(response.data.data.user).toMatchObject({
            id: '123',
            name: expect.any(String),
            email: expect.stringContaining('@')
        })
    })
})
```

### Testing Mutations

```typescript
describe('User Mutations', () => {
    it('should create a new user', async () => {
        const response = await graphql.mutate(`
            mutation CreateUser($input: CreateUserInput!) {
                createUser(input: $input) { id name email }
            }
        `, {
            input: {
                name: 'Test User',
                email: 'test@example.com'
            }
        })

        expect(response.isSuccess).toBe(true)
        expect(response.data.data.createUser.id).toBeDefined()
        expect(response.data.data.createUser.name).toBe('Test User')
    })
})
```

### Testing Error Handling

```typescript
describe('Error Handling', () => {
    it('should return error for invalid user ID', async () => {
        const response = await graphql.query(`
            query GetUser($id: ID!) {
                user(id: $id) { id name }
            }
        `, { id: 'nonexistent' })

        expect(response.isError).toBe(true)
        expect(response.errors).toHaveLength(1)
        expect(response.errors[0].message).toContain('not found')
    })

    it('should return validation errors', async () => {
        const response = await graphql.mutate(`
            mutation CreateUser($input: CreateUserInput!) {
                createUser(input: $input) { id }
            }
        `, {
            input: {
                name: '', // Invalid: empty name
                email: 'not-an-email' // Invalid: bad format
            }
        })

        expect(response.isError).toBe(true)
        expect(response.errors.some(e =>
            e.extensions?.code === 'VALIDATION_ERROR'
        )).toBe(true)
    })
})
```

### Testing with Fixtures

```typescript
describe('Product Queries', () => {
    beforeEach(async () => {
        // Seed test data via mutation
        await graphql.mutate(`
            mutation SeedData {
                seedTestProducts(count: 10) { success }
            }
        `)
    })

    afterEach(async () => {
        // Clean up test data
        await graphql.mutate(`
            mutation CleanUp {
                deleteTestProducts { success }
            }
        `)
    })

    it('should list products with pagination', async () => {
        const response = await graphql.query(`
            query ListProducts($page: Int!, $limit: Int!) {
                products(page: $page, limit: $limit) {
                    items { id name price }
                    total
                    hasMore
                }
            }
        `, { page: 1, limit: 5 })

        expect(response.isSuccess).toBe(true)
        expect(response.data.data.products.items).toHaveLength(5)
        expect(response.data.data.products.total).toBe(10)
        expect(response.data.data.products.hasMore).toBe(true)
    })
})
```

## Best Practices

### 1. Use Named Operations

Always name your queries and mutations:

```typescript
// Good - named operation
await graphql.query(`
    query GetUserProfile($id: ID!) {
        user(id: $id) { ... }
    }
`, { id })

// Avoid - anonymous operation
await graphql.query(`
    query {
        user(id: "123") { ... }
    }
`)
```

### 2. Use Type Parameters

Leverage TypeScript for type safety:

```typescript
interface UserResponse {
    user: {
        id: string
        name: string
    }
}

const response = await graphql.query<UserResponse>(`...`)
// response.data.data.user is now typed
```

### 3. Check Response Types Before Accessing Data

```typescript
const response = await graphql.query(`...`)

// Always check before accessing
if (response.isSuccess) {
    // Safe to access response.data.data
}
```

### 4. Handle All Error Cases

```typescript
if (response.isNetworkError) {
    // Network issues
} else if (response.isError) {
    // GraphQL errors
} else {
    // Success
}
```

## Next Steps

- [Query Builder](/graphql/query-builder) — Build queries programmatically
- [Subscriptions](/graphql/subscriptions) — Real-time GraphQL with WebSocket/SSE
- [API Client](/core/api-client) — REST API testing
