---
sidebar_position: 1
title: Custom API Client
description: Integrate your own API client with wdio-api-runner. Use existing clients, factory functions, hybrid approaches, and popular libraries like Axios.
---

# Custom API Client

Integrate your own API client with wdio-api-runner. This is useful when you have an existing API client with custom authentication logic, specific response handling, or integration with other services.

## Using an Existing Client

If you already have an API client, you can use it directly:

```typescript
// wdio.conf.ts
import ApiClient from './helpers/api.helper.js'

export const config: WebdriverIO.Config = {
    runner: 'api',

    apiRunner: {
        client: ApiClient
    }
}
```

Your tests will use your client:

```typescript
// test/api/users.spec.ts
describe('Users API', () => {
    it('should fetch user', async () => {
        // Uses your ApiClient methods!
        const response = await api.get('/users/1', authToken)
        expect(response.status).toBe(200)
    })
})
```

## Using a Factory Function

For dynamic client creation based on config:

```typescript
// wdio.conf.ts
import { ApiClient } from './helpers/api.helper.js'

export const config: WebdriverIO.Config = {
    runner: 'api',

    apiRunner: {
        clientFactory: (config) => {
            const client = new ApiClient()
            client.setBaseUrl(config.baseUrl)
            client.setTimeout(config.apiRunner?.timeout || 30000)
            return client
        }
    }
}
```

## Integration with wdio-openapi-service

```typescript
// helpers/api.helper.js
import { apiClient } from 'wdio-openapi-service'

class ApiClient {
    async get(path, authToken, params = {}, options = {}) {
        const headers = authToken
            ? { Authorization: `Bearer ${authToken}` }
            : {}

        return apiClient.get(this.url(path), { headers, params })
    }

    async post(path, authToken, data = {}, options = {}) {
        const headers = authToken
            ? { Authorization: `Bearer ${authToken}` }
            : {}

        return apiClient.post(this.url(path), data, { headers })
    }

    url(path) {
        return `${this.baseUrl}${path}`
    }

    setBaseUrl(url) {
        this.baseUrl = url
    }
}

export default new ApiClient()
```

```typescript
// wdio.conf.ts
import ApiClient from './helpers/api.helper.js'

export const config: WebdriverIO.Config = {
    runner: 'api',
    apiRunner: {
        client: ApiClient
    }
}
```

## Custom Global Variable Name

```typescript
// wdio.conf.ts
export const config: WebdriverIO.Config = {
    runner: 'api',

    apiRunner: {
        client: ApiClient,
        globalName: 'apiClient' // Access via `apiClient` instead of `api`
    }
}
```

```typescript
// test/api/users.spec.ts
describe('Users API', () => {
    it('should fetch user', async () => {
        const response = await apiClient.get('/users/1', token)
        // `api` also works as an alias
    })
})
```

## Hybrid Approach

Use both the built-in client and your custom client:

```typescript
// wdio.conf.ts
import CustomApiClient from './helpers/api.helper.js'

export const config: WebdriverIO.Config = {
    runner: 'api',

    apiRunner: {
        // Built-in client config
        baseUrl: 'https://api.example.com',
        timeout: 30000
    }
}

// In your test setup
before(async () => {
    // Make custom client available alongside built-in
    global.customApi = CustomApiClient
})
```

```typescript
// test/api/mixed.spec.ts
describe('Mixed API Testing', () => {
    it('uses built-in client for simple requests', async () => {
        const response = await api.get('/health')
        expect(response.ok).toBe(true)
    })

    it('uses custom client for complex auth', async () => {
        const response = await customApi.hawkRequest(
            'GET',
            '/secure/resource',
            hawkCredentials
        )
        expect(response.status).toBe(200)
    })
})
```

## Client Interface

Your custom client should implement methods your tests need. There's no strict interface requirement:

```typescript
// Minimal example
class MinimalClient {
    async get(url: string): Promise<Response> {
        return fetch(url)
    }

    async post(url: string, data: any): Promise<Response> {
        return fetch(url, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        })
    }
}
```

## Axios-Based Client

```typescript
import axios, { AxiosInstance } from 'axios'

class AxiosApiClient {
    private client: AxiosInstance

    constructor(baseURL: string) {
        this.client = axios.create({
            baseURL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        })
    }

    async get<T>(url: string, config = {}) {
        const response = await this.client.get<T>(url, config)
        return {
            status: response.status,
            data: response.data,
            headers: response.headers,
            ok: response.status >= 200 && response.status < 300
        }
    }

    async post<T>(url: string, data?: any, config = {}) {
        const response = await this.client.post<T>(url, data, config)
        return {
            status: response.status,
            data: response.data,
            headers: response.headers,
            ok: response.status >= 200 && response.status < 300
        }
    }

    setHeader(name: string, value: string) {
        this.client.defaults.headers.common[name] = value
    }
}

export default new AxiosApiClient(process.env.API_BASE_URL || '')
```
