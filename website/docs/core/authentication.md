---
sidebar_position: 4
title: Authentication
description: Built-in authentication helpers for common patterns including Basic Auth, Bearer tokens, API keys, and OAuth2 client credentials with automatic token refresh.
---

# Authentication

wdio-api-runner provides built-in authentication helpers for common authentication patterns. These helpers integrate seamlessly with the interceptor system, making it easy to authenticate all your API requests.

## Overview

The authentication module provides ready-to-use interceptors for:

| Auth Type | Use Case |
|-----------|----------|
| **Basic Auth** | Username/password authentication |
| **Bearer Token** | JWT and token-based authentication |
| **API Key** | Header or query parameter API keys |
| **OAuth2 Client Credentials** | Machine-to-machine authentication |

## Basic Authentication

HTTP Basic Authentication encodes username and password as a Base64 header.

### Setup

```typescript
import { basicAuth } from 'wdio-api-runner'

api.addRequestInterceptor(
    basicAuth({
        username: 'myuser',
        password: 'mypassword'
    }).interceptor
)
```

### With Environment Variables

```typescript
import { basicAuth } from 'wdio-api-runner'

api.addRequestInterceptor(
    basicAuth({
        username: process.env.API_USERNAME!,
        password: process.env.API_PASSWORD!
    }).interceptor
)
```

### How It Works

The helper generates an `Authorization` header with the format:

```
Authorization: Basic base64(username:password)
```

Example:
- Username: `admin`
- Password: `secret123`
- Header: `Authorization: Basic YWRtaW46c2VjcmV0MTIz`

## Bearer Token Authentication

Bearer token authentication is the most common pattern for JWT-based APIs.

### Static Token

For tokens that don't change during the test run:

```typescript
import { bearerAuth } from 'wdio-api-runner'

api.addRequestInterceptor(
    bearerAuth({
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    }).interceptor
)
```

### Dynamic Token

For tokens that need to be fetched or computed:

```typescript
import { bearerAuth } from 'wdio-api-runner'

api.addRequestInterceptor(
    bearerAuth({
        token: async () => {
            // Fetch token from storage, API, or compute it
            return await getTokenFromSecureStorage()
        }
    }).interceptor
)
```

### Token from Environment

```typescript
import { bearerAuth } from 'wdio-api-runner'

api.addRequestInterceptor(
    bearerAuth({
        token: process.env.API_TOKEN!
    }).interceptor
)
```

### Automatic Token Refresh

Handle token expiration automatically:

```typescript
import { bearerAuth } from 'wdio-api-runner'

api.addRequestInterceptor(
    bearerAuth({
        // Current token getter
        token: async () => await getAccessToken(),

        // Refresh logic when token expires
        refresh: async () => {
            const newToken = await refreshAccessToken()
            await saveToken(newToken)
            return newToken
        },

        // When to refresh (check response)
        shouldRefresh: (response) => response.status === 401
    }).interceptor
)
```

### Complete Token Management Example

```typescript
import { bearerAuth, MemoryStorage } from 'wdio-api-runner'

const tokenStorage = new MemoryStorage()

async function login(): Promise<string> {
    const response = await api.post('/auth/login', {
        username: process.env.API_USER,
        password: process.env.API_PASS
    })
    return response.data.accessToken
}

async function refreshToken(): Promise<string> {
    const refreshToken = await tokenStorage.get('refresh_token')
    const response = await api.post('/auth/refresh', { refreshToken })
    return response.data.accessToken
}

// Setup in before hook
before(async () => {
    // Get initial token
    const token = await login()
    await tokenStorage.set('access_token', token)

    // Add auth interceptor
    api.addRequestInterceptor(
        bearerAuth({
            token: async () => await tokenStorage.get('access_token'),
            refresh: async () => {
                const newToken = await refreshToken()
                await tokenStorage.set('access_token', newToken)
                return newToken
            },
            shouldRefresh: (response) => response.status === 401
        }).interceptor
    )
})
```

## API Key Authentication

API key authentication sends a key either in a header or query parameter.

### Header-Based API Key

The most common approach - send the key in a custom header:

```typescript
import { apiKeyAuth } from 'wdio-api-runner'

api.addRequestInterceptor(
    apiKeyAuth({
        key: process.env.API_KEY!,
        headerName: 'X-API-Key' // default
    }).interceptor
)
```

### Custom Header Name

Some APIs use different header names:

```typescript
import { apiKeyAuth } from 'wdio-api-runner'

// AWS-style
api.addRequestInterceptor(
    apiKeyAuth({
        key: process.env.API_KEY!,
        headerName: 'x-api-key'
    }).interceptor
)

// Custom header
api.addRequestInterceptor(
    apiKeyAuth({
        key: process.env.API_KEY!,
        headerName: 'Authorization-Key'
    }).interceptor
)
```

### Query Parameter-Based API Key

Some APIs require the key as a URL parameter:

```typescript
import { apiKeyAuth } from 'wdio-api-runner'

api.addRequestInterceptor(
    apiKeyAuth({
        key: process.env.API_KEY!,
        in: 'query',
        paramName: 'api_key'
    }).interceptor
)
```

This appends `?api_key=your-key` to every request URL.

### Multiple API Keys

For APIs requiring multiple keys:

```typescript
import { apiKeyAuth } from 'wdio-api-runner'

// Add primary key
api.addRequestInterceptor(
    apiKeyAuth({
        key: process.env.API_KEY!,
        headerName: 'X-API-Key'
    }).interceptor
)

// Add secondary key
api.addRequestInterceptor(
    apiKeyAuth({
        key: process.env.API_SECRET!,
        headerName: 'X-API-Secret'
    }).interceptor
)
```

## OAuth2 Client Credentials

For machine-to-machine authentication using OAuth2 client credentials flow.

### Basic Setup

```typescript
import { oauth2ClientCredentials } from 'wdio-api-runner'

const auth = oauth2ClientCredentials({
    tokenUrl: 'https://auth.example.com/oauth/token',
    clientId: 'my-client-id',
    clientSecret: 'my-client-secret'
})

api.addRequestInterceptor(auth.interceptor)
```

### With Scopes

Request specific permissions:

```typescript
import { oauth2ClientCredentials } from 'wdio-api-runner'

const auth = oauth2ClientCredentials({
    tokenUrl: 'https://auth.example.com/oauth/token',
    clientId: process.env.CLIENT_ID!,
    clientSecret: process.env.CLIENT_SECRET!,
    scope: 'read write users:admin'
})

api.addRequestInterceptor(auth.interceptor)
```

### With Custom Token Storage

Store tokens persistently:

```typescript
import { oauth2ClientCredentials, MemoryStorage } from 'wdio-api-runner'

const tokenStorage = new MemoryStorage()

const auth = oauth2ClientCredentials({
    tokenUrl: 'https://auth.example.com/oauth/token',
    clientId: process.env.CLIENT_ID!,
    clientSecret: process.env.CLIENT_SECRET!,
    scope: 'read write',
    storage: tokenStorage
})

api.addRequestInterceptor(auth.interceptor)

// Later: manually clear token if needed
await tokenStorage.clear()
```

### With Custom Headers

Some OAuth servers require additional headers:

```typescript
import { oauth2ClientCredentials } from 'wdio-api-runner'

const auth = oauth2ClientCredentials({
    tokenUrl: 'https://auth.example.com/oauth/token',
    clientId: process.env.CLIENT_ID!,
    clientSecret: process.env.CLIENT_SECRET!,
    headers: {
        'Accept': 'application/json',
        'X-Custom-Header': 'value'
    }
})

api.addRequestInterceptor(auth.interceptor)
```

### Token Lifecycle

The OAuth2 client credentials helper:

1. Requests a token before the first API call
2. Caches the token in storage
3. Automatically refreshes when the token expires
4. Uses the `expires_in` value from the token response

```typescript
// Token response from OAuth server
{
    "access_token": "eyJhbG...",
    "token_type": "Bearer",
    "expires_in": 3600  // Token valid for 1 hour
}
```

## Manual Authentication

For custom authentication flows or simple cases.

### Setup in Before Hook

```typescript
describe('API Tests', () => {
    let authToken: string

    before(async () => {
        // Login to get token
        const response = await api.post('/auth/login', {
            username: process.env.API_USER,
            password: process.env.API_PASS
        })

        authToken = response.data.token

        // Set as default header
        api.setHeader('Authorization', `Bearer ${authToken}`)
    })

    after(async () => {
        // Logout
        await api.post('/auth/logout')
        api.removeHeader('Authorization')
    })

    it('should access protected resource', async () => {
        // Auth header is automatically included
        const response = await api.get('/protected/resource')
        expect(response.status).toBe(200)
    })
})
```

### Per-Request Authentication

For tests that need different authentication:

```typescript
describe('Multi-User Tests', () => {
    it('should access as admin', async () => {
        const adminToken = await getAdminToken()

        const response = await api.get('/admin/dashboard', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        })

        expect(response.status).toBe(200)
    })

    it('should be forbidden as regular user', async () => {
        const userToken = await getUserToken()

        const response = await api.get('/admin/dashboard', {
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        })

        expect(response.status).toBe(403)
    })
})
```

## Token Storage

### Memory Storage (Default)

In-memory storage that persists for the test run:

```typescript
import { MemoryStorage } from 'wdio-api-runner'

const storage = new MemoryStorage()

// Store a token
await storage.set('access_token', 'token-value', { expiresIn: 3600 })

// Retrieve the token
const token = await storage.get('access_token')
// Returns: 'token-value'

// Check if token is still valid (not expired)
const isValid = await storage.isValid('access_token')
// Returns: true/false

// Clear all tokens
await storage.clear()
```

### Token Expiration

The storage automatically handles token expiration:

```typescript
import { MemoryStorage } from 'wdio-api-runner'

const storage = new MemoryStorage()

// Token expires in 1 hour
await storage.set('token', 'value', { expiresIn: 3600 })

// Immediately: token is valid
await storage.isValid('token') // true
await storage.get('token')     // 'value'

// After 1 hour: token is invalid
await storage.isValid('token') // false
await storage.get('token')     // null
```

### Custom Storage Implementation

Implement the `TokenStorage` interface for custom storage:

```typescript
import type { TokenStorage } from 'wdio-api-runner'

class RedisStorage implements TokenStorage {
    private redis: RedisClient

    constructor(redis: RedisClient) {
        this.redis = redis
    }

    async get(key: string): Promise<string | null> {
        return await this.redis.get(key)
    }

    async set(key: string, value: string, options?: { expiresIn?: number }): Promise<void> {
        if (options?.expiresIn) {
            await this.redis.setex(key, options.expiresIn, value)
        } else {
            await this.redis.set(key, value)
        }
    }

    async isValid(key: string): Promise<boolean> {
        return (await this.redis.exists(key)) === 1
    }

    async clear(): Promise<void> {
        // Clear all auth-related keys
        const keys = await this.redis.keys('auth:*')
        if (keys.length > 0) {
            await this.redis.del(...keys)
        }
    }
}

// Usage
const redisStorage = new RedisStorage(redisClient)
const auth = oauth2ClientCredentials({
    tokenUrl: 'https://auth.example.com/token',
    clientId: 'client',
    clientSecret: 'secret',
    storage: redisStorage
})
```

### File-Based Storage Example

```typescript
import type { TokenStorage } from 'wdio-api-runner'
import fs from 'fs/promises'
import path from 'path'

class FileStorage implements TokenStorage {
    private filePath: string

    constructor(filePath: string) {
        this.filePath = filePath
    }

    private async readData(): Promise<Record<string, { value: string; expiresAt?: number }>> {
        try {
            const content = await fs.readFile(this.filePath, 'utf-8')
            return JSON.parse(content)
        } catch {
            return {}
        }
    }

    private async writeData(data: Record<string, { value: string; expiresAt?: number }>): Promise<void> {
        await fs.writeFile(this.filePath, JSON.stringify(data, null, 2))
    }

    async get(key: string): Promise<string | null> {
        const data = await this.readData()
        const item = data[key]

        if (!item) return null
        if (item.expiresAt && Date.now() > item.expiresAt) {
            delete data[key]
            await this.writeData(data)
            return null
        }

        return item.value
    }

    async set(key: string, value: string, options?: { expiresIn?: number }): Promise<void> {
        const data = await this.readData()
        data[key] = {
            value,
            expiresAt: options?.expiresIn ? Date.now() + options.expiresIn * 1000 : undefined
        }
        await this.writeData(data)
    }

    async isValid(key: string): Promise<boolean> {
        const value = await this.get(key)
        return value !== null
    }

    async clear(): Promise<void> {
        await this.writeData({})
    }
}
```

## Multi-Tenant Authentication

Handle authentication for multiple tenants or users:

```typescript
const tenantTokens = new Map<string, string>()

async function getTokenForTenant(tenantId: string): Promise<string> {
    // Check cache
    if (tenantTokens.has(tenantId)) {
        return tenantTokens.get(tenantId)!
    }

    // Get new token for tenant
    const response = await api.post('/auth/tenant-login', {
        tenantId,
        apiKey: process.env.API_KEY
    })

    const token = response.data.token
    tenantTokens.set(tenantId, token)

    return token
}

describe('Multi-Tenant API', () => {
    it('should access tenant A resources', async () => {
        const token = await getTokenForTenant('tenant-a')

        const response = await api.get('/resources', {
            headers: { 'Authorization': `Bearer ${token}` }
        })

        expect(response.status).toBe(200)
        expect(response.data.tenantId).toBe('tenant-a')
    })

    it('should access tenant B resources', async () => {
        const token = await getTokenForTenant('tenant-b')

        const response = await api.get('/resources', {
            headers: { 'Authorization': `Bearer ${token}` }
        })

        expect(response.status).toBe(200)
        expect(response.data.tenantId).toBe('tenant-b')
    })
})
```

## Role-Based Testing

Test different permission levels:

```typescript
interface TestUser {
    username: string
    password: string
    role: string
}

const testUsers: Record<string, TestUser> = {
    admin: {
        username: 'admin@example.com',
        password: process.env.ADMIN_PASSWORD!,
        role: 'admin'
    },
    manager: {
        username: 'manager@example.com',
        password: process.env.MANAGER_PASSWORD!,
        role: 'manager'
    },
    user: {
        username: 'user@example.com',
        password: process.env.USER_PASSWORD!,
        role: 'user'
    }
}

async function loginAs(role: keyof typeof testUsers): Promise<string> {
    const user = testUsers[role]
    const response = await api.post('/auth/login', {
        username: user.username,
        password: user.password
    })
    return response.data.token
}

describe('Permission Tests', () => {
    it('admin can access admin panel', async () => {
        const token = await loginAs('admin')
        api.setHeader('Authorization', `Bearer ${token}`)

        const response = await api.get('/admin/panel')
        expect(response.status).toBe(200)
    })

    it('manager cannot access admin panel', async () => {
        const token = await loginAs('manager')
        api.setHeader('Authorization', `Bearer ${token}`)

        const response = await api.get('/admin/panel')
        expect(response.status).toBe(403)
    })

    it('user cannot access admin panel', async () => {
        const token = await loginAs('user')
        api.setHeader('Authorization', `Bearer ${token}`)

        const response = await api.get('/admin/panel')
        expect(response.status).toBe(403)
    })
})
```

## Best Practices

### 1. Never Hardcode Credentials

Always use environment variables:

```typescript
// Good
const auth = basicAuth({
    username: process.env.API_USER!,
    password: process.env.API_PASS!
})

// Never do this
const auth = basicAuth({
    username: 'admin',
    password: 'secret123'
})
```

### 2. Use the Right Auth Type

Choose authentication method based on your API:

| Scenario | Recommended Auth |
|----------|------------------|
| Internal APIs with service accounts | OAuth2 Client Credentials |
| Public APIs with API keys | API Key Auth |
| User-context testing | Bearer Token with login |
| Legacy systems | Basic Auth |

### 3. Handle Token Expiration

Always configure token refresh for long-running tests:

```typescript
bearerAuth({
    token: async () => getToken(),
    refresh: async () => refreshToken(),
    shouldRefresh: (response) => response.status === 401
})
```

### 4. Clear Credentials After Tests

Clean up authentication state:

```typescript
after(async () => {
    api.clearInterceptors()
    api.removeHeader('Authorization')
})
```

## Next Steps

- [Interceptors](/core/interceptors) — Learn more about request/response interceptors
- [API Client](/core/api-client) — Complete HTTP client reference
- [Configuration](/getting-started/configuration) — Configure authentication globally
