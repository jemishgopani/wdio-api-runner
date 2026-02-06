---
sidebar_position: 4
title: Authentication API
description: Complete API reference for authentication helpers including basicAuth, bearerAuth, apiKeyAuth, oauth2ClientCredentials, and token storage.
---

# Authentication API

Complete reference for authentication helpers.

## basicAuth

Creates Basic authentication interceptor.

```typescript
function basicAuth(options: BasicAuthOptions): AuthHelper
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.username` | `string` | Username |
| `options.password` | `string` | Password |

### Example

```typescript
import { basicAuth } from 'wdio-api-runner'

api.addRequestInterceptor(
    basicAuth({ username: 'user', password: 'pass' }).interceptor
)
```

---

## bearerAuth

Creates Bearer token authentication interceptor.

```typescript
function bearerAuth(options: BearerAuthOptions): AuthHelper
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.token` | `string \| () => Promise<string>` | Token or token provider |
| `options.refresh` | `() => Promise<string>` | Optional refresh function |
| `options.shouldRefresh` | `(response) => boolean` | When to refresh |

### Example

```typescript
import { bearerAuth } from 'wdio-api-runner'

api.addRequestInterceptor(
    bearerAuth({
        token: async () => await getToken(),
        refresh: async () => await refreshToken(),
        shouldRefresh: (res) => res.status === 401
    }).interceptor
)
```

---

## apiKeyAuth

Creates API Key authentication interceptor.

```typescript
function apiKeyAuth(options: ApiKeyAuthOptions): AuthHelper
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.key` | `string` | API key |
| `options.headerName` | `string` | Header name (default: 'X-API-Key') |
| `options.in` | `'header' \| 'query'` | Where to send key |
| `options.paramName` | `string` | Query param name (if in='query') |

### Examples

```typescript
import { apiKeyAuth } from 'wdio-api-runner'

// Header-based (default)
api.addRequestInterceptor(
    apiKeyAuth({ key: 'your-api-key' }).interceptor
)

// Query parameter
api.addRequestInterceptor(
    apiKeyAuth({
        key: 'your-api-key',
        in: 'query',
        paramName: 'api_key'
    }).interceptor
)
```

---

## oauth2ClientCredentials

Creates OAuth2 Client Credentials flow interceptor.

```typescript
function oauth2ClientCredentials(options: OAuth2Options): AuthHelper
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.tokenUrl` | `string` | Token endpoint URL |
| `options.clientId` | `string` | Client ID |
| `options.clientSecret` | `string` | Client secret |
| `options.scope` | `string` | Optional scope |
| `options.storage` | `TokenStorage` | Optional token storage |

### Example

```typescript
import { oauth2ClientCredentials } from 'wdio-api-runner'

const auth = oauth2ClientCredentials({
    tokenUrl: 'https://auth.example.com/token',
    clientId: 'my-client',
    clientSecret: 'secret',
    scope: 'read write'
})

api.addRequestInterceptor(auth.interceptor)
```

---

## MemoryStorage

In-memory token storage implementation.

```typescript
class MemoryStorage implements TokenStorage
```

### Methods

| Method | Description |
|--------|-------------|
| `get(key)` | Get stored value |
| `set(key, value, options?)` | Store value |
| `isValid(key)` | Check if value exists and is valid |
| `clear()` | Clear all stored values |

### Example

```typescript
import { MemoryStorage } from 'wdio-api-runner'

const storage = new MemoryStorage()

await storage.set('token', 'abc123', { expiresIn: 3600 })
const token = await storage.get('token')
const valid = await storage.isValid('token')
await storage.clear()
```

---

## Types

### AuthHelper

```typescript
interface AuthHelper {
    interceptor: RequestInterceptor
}
```

### BasicAuthOptions

```typescript
interface BasicAuthOptions {
    username: string
    password: string
}
```

### BearerAuthOptions

```typescript
interface BearerAuthOptions {
    token: string | (() => Promise<string>)
    refresh?: () => Promise<string>
    shouldRefresh?: (response: ApiResponse<any>) => boolean
}
```

### ApiKeyAuthOptions

```typescript
interface ApiKeyAuthOptions {
    key: string
    headerName?: string
    in?: 'header' | 'query'
    paramName?: string
}
```

### OAuth2Options

```typescript
interface OAuth2Options {
    tokenUrl: string
    clientId: string
    clientSecret: string
    scope?: string
    storage?: TokenStorage
}
```

### TokenStorage

```typescript
interface TokenStorage {
    get(key: string): Promise<string | null>
    set(key: string, value: string, options?: { expiresIn?: number }): Promise<void>
    isValid(key: string): Promise<boolean>
    clear(): Promise<void>
}
```
