---
sidebar_position: 2
title: Quick Start
description: Write and run your first API test with wdio-api-runner in under 5 minutes. Learn the basics of configuration, test writing, and understanding responses.
---

# Quick Start

This guide will have you writing and running API tests in under 5 minutes. We'll cover the essential configuration, write a complete test file, and explain the response structure you'll work with.

## Prerequisites

Before starting, ensure you have:
- Completed the [Installation](/getting-started/installation) guide
- A running API endpoint to test against (we'll use `https://jsonplaceholder.typicode.com` for examples)
- Basic familiarity with async/await syntax

## Step 1: Configure WebdriverIO

The configuration file is the heart of your test setup. Create or update `wdio.conf.ts` in your project root:

```typescript
// wdio.conf.ts
export const config: WebdriverIO.Config = {
    // Use the API runner instead of browser runner
    runner: 'api',

    // Define where your test files are located
    specs: ['./test/api/**/*.spec.ts'],

    // Choose your test framework
    framework: 'mocha',

    // Configure reporters for test output
    reporters: ['spec'],

    // Base URL for all API requests
    // All relative paths in tests will be resolved against this URL
    baseUrl: 'https://jsonplaceholder.typicode.com',

    // API Runner specific options
    apiRunner: {
        // Request timeout in milliseconds
        timeout: 30000,

        // Number of retry attempts for failed requests
        retries: 2,

        // Delay between retries in milliseconds
        retryDelay: 1000,

        // Default headers sent with every request
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    },

    // Enable parallel execution with up to 10 workers
    maxInstances: 10,

    // Mocha-specific options
    mochaOpts: {
        timeout: 60000,
        ui: 'bdd'
    }
}
```

### Configuration Breakdown

| Option | Purpose |
|--------|---------|
| `runner: 'api'` | Tells WebdriverIO to use the API runner instead of launching browsers |
| `specs` | Glob pattern(s) to find your test files |
| `baseUrl` | Base URL prepended to all relative request paths |
| `apiRunner.timeout` | Maximum time to wait for a response |
| `apiRunner.retries` | Automatic retry count for failed requests |
| `maxInstances` | Number of parallel test workers |

## Step 2: Write Your First Test

Create a test file at `test/api/users.spec.ts`:

```typescript
// test/api/users.spec.ts
describe('Users API', () => {
    /**
     * Test fetching a single user by ID
     * GET /users/1 returns a user object
     */
    it('should fetch user by ID', async () => {
        const response = await api.get('/users/1')

        // Verify successful response
        expect(response.status).toBe(200)
        expect(response.ok).toBe(true)

        // Verify response body contains expected fields
        expect(response.data).toHaveProperty('id', 1)
        expect(response.data).toHaveProperty('name')
        expect(response.data).toHaveProperty('email')
        expect(response.data).toHaveProperty('username')
    })

    /**
     * Test creating a new user
     * POST /users with body creates a new user
     */
    it('should create a new user', async () => {
        const newUser = {
            name: 'John Doe',
            email: 'john@example.com',
            username: 'johndoe'
        }

        const response = await api.post('/users', newUser)

        // JSONPlaceholder returns 201 for created resources
        expect(response.status).toBe(201)
        expect(response.data.id).toBeDefined()
        expect(response.data.name).toBe(newUser.name)
    })

    /**
     * Test updating an existing user
     * PUT /users/1 with body updates the user
     */
    it('should update an existing user', async () => {
        const updates = {
            name: 'Jane Doe Updated',
            email: 'jane.updated@example.com'
        }

        const response = await api.put('/users/1', updates)

        expect(response.status).toBe(200)
        expect(response.data.name).toBe(updates.name)
    })

    /**
     * Test partial update with PATCH
     * PATCH /users/1 allows partial updates
     */
    it('should partially update a user', async () => {
        const partialUpdate = {
            email: 'newemail@example.com'
        }

        const response = await api.patch('/users/1', partialUpdate)

        expect(response.status).toBe(200)
        expect(response.data.email).toBe(partialUpdate.email)
    })

    /**
     * Test deleting a user
     * DELETE /users/1 removes the user
     */
    it('should delete a user', async () => {
        const response = await api.delete('/users/1')

        expect(response.status).toBe(200)
    })

    /**
     * Test handling non-existent resources
     * GET /users/99999 returns 404
     */
    it('should return 404 for non-existent user', async () => {
        const response = await api.get('/users/99999')

        expect(response.status).toBe(404)
        expect(response.ok).toBe(false)
    })
})
```

### Test Structure Explained

Each test follows a simple pattern:

1. **Arrange** — Set up any test data (request body, headers, etc.)
2. **Act** — Make the API request using `api.get()`, `api.post()`, etc.
3. **Assert** — Verify the response matches expectations

The `api` object is automatically available globally in your tests. It provides methods for all HTTP verbs:

| Method | Description |
|--------|-------------|
| `api.get(path, options?)` | GET request |
| `api.post(path, body?, options?)` | POST request with body |
| `api.put(path, body?, options?)` | PUT request with body |
| `api.patch(path, body?, options?)` | PATCH request with body |
| `api.delete(path, options?)` | DELETE request |
| `api.head(path, options?)` | HEAD request |
| `api.options(path, options?)` | OPTIONS request |

## Step 3: Run Your Tests

Execute your tests with the WebdriverIO CLI:

```bash
npx wdio run wdio.conf.ts
```

### Expected Output

```
Execution of 1 workers started at 2024-01-15T10:30:00.000Z

[0-0] RUNNING in api - /test/api/users.spec.ts
[0-0] Users API
[0-0]    ✓ should fetch user by ID (145ms)
[0-0]    ✓ should create a new user (203ms)
[0-0]    ✓ should update an existing user (178ms)
[0-0]    ✓ should partially update a user (156ms)
[0-0]    ✓ should delete a user (134ms)
[0-0]    ✓ should return 404 for non-existent user (123ms)
[0-0] PASSED in api - /test/api/users.spec.ts

Spec Files:      1 passed, 1 total
```

### Running Specific Tests

```bash
# Run a specific spec file
npx wdio run wdio.conf.ts --spec ./test/api/users.spec.ts

# Run tests matching a pattern
npx wdio run wdio.conf.ts --spec "**/users*.spec.ts"

# Run with a specific test grep pattern
npx wdio run wdio.conf.ts --mochaOpts.grep "should fetch"
```

## Understanding the Response

Every API request returns an `ApiResponse<T>` object with the following structure:

```typescript
interface ApiResponse<T> {
    // HTTP status code (200, 201, 400, 404, 500, etc.)
    status: number

    // HTTP status text ("OK", "Created", "Not Found", etc.)
    statusText: string

    // Response headers object
    headers: Headers

    // Parsed response body (automatically parsed JSON for JSON responses)
    data: T

    // true if status is in 200-299 range
    ok: boolean

    // Request duration in milliseconds (useful for performance testing)
    duration: number

    // The original request configuration
    request: RequestConfig
}
```

### Working with Response Data

```typescript
it('should work with response data', async () => {
    const response = await api.get('/users/1')

    // Access status information
    console.log(`Status: ${response.status} ${response.statusText}`)
    // Output: Status: 200 OK

    // Check if request was successful
    if (response.ok) {
        console.log('Request succeeded!')
    }

    // Access response headers
    const contentType = response.headers.get('content-type')
    console.log(`Content-Type: ${contentType}`)
    // Output: Content-Type: application/json; charset=utf-8

    // Access parsed response body
    console.log(`User name: ${response.data.name}`)
    // Output: User name: Leanne Graham

    // Check request performance
    console.log(`Request took ${response.duration}ms`)
    // Output: Request took 145ms
})
```

### Type-Safe Responses

For TypeScript users, you can define interfaces for your response data:

```typescript
interface User {
    id: number
    name: string
    email: string
    username: string
    phone: string
    website: string
}

it('should return typed user data', async () => {
    // Specify the expected response type
    const response = await api.get<User>('/users/1')

    // response.data is now typed as User
    const user: User = response.data
    expect(user.email).toContain('@')
})
```

## Adding Request Options

Customize individual requests with options:

```typescript
it('should send custom headers', async () => {
    const response = await api.get('/users/1', {
        headers: {
            'Authorization': 'Bearer my-token',
            'X-Custom-Header': 'custom-value'
        },
        timeout: 5000 // Override default timeout
    })

    expect(response.status).toBe(200)
})

it('should send query parameters', async () => {
    const response = await api.get('/users', {
        params: {
            _limit: 5,
            _page: 1
        }
    })

    // Request URL: /users?_limit=5&_page=1
    expect(response.data).toHaveLength(5)
})
```

## Common Patterns

### Testing Validation Errors

```typescript
it('should handle validation errors', async () => {
    const response = await api.post('/users', {
        name: '', // Invalid: empty name
        email: 'not-an-email' // Invalid: bad email format
    })

    expect(response.status).toBe(400)
    expect(response.ok).toBe(false)
    expect(response.data.errors).toBeDefined()
})
```

### Testing with Setup/Teardown

```typescript
describe('Posts API', () => {
    let createdPostId: number

    // Create a post before each test
    beforeEach(async () => {
        const response = await api.post('/posts', {
            title: 'Test Post',
            body: 'Test content',
            userId: 1
        })
        createdPostId = response.data.id
    })

    it('should update the created post', async () => {
        const response = await api.put(`/posts/${createdPostId}`, {
            title: 'Updated Title',
            body: 'Updated content',
            userId: 1
        })

        expect(response.status).toBe(200)
        expect(response.data.title).toBe('Updated Title')
    })

    // Clean up after each test
    afterEach(async () => {
        await api.delete(`/posts/${createdPostId}`)
    })
})
```

### Testing Response Time

```typescript
it('should respond within acceptable time', async () => {
    const response = await api.get('/users')

    // Verify response time is under 500ms
    expect(response.duration).toBeLessThan(500)
})
```

## Troubleshooting

### "api is not defined"

Ensure your configuration has `runner: 'api'` set. The global `api` object is only available when using the API runner.

### Timeout Errors

Increase the timeout in your request or configuration:

```typescript
// Per-request timeout
const response = await api.get('/slow-endpoint', { timeout: 60000 })

// Global timeout in wdio.conf.ts
apiRunner: {
    timeout: 60000
}
```

### SSL Certificate Errors

For development environments with self-signed certificates:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npx wdio run wdio.conf.ts
```

**Warning:** Never use this in production tests.

## Next Steps

Now that you've run your first tests, explore more features:

- [Configuration](/getting-started/configuration) — Full configuration reference
- [API Client](/core/api-client) — Complete HTTP client documentation
- [Assertions](/core/assertions) — Fluent assertion helpers for cleaner tests
- [Authentication](/core/authentication) — Handle API keys, tokens, and OAuth2
