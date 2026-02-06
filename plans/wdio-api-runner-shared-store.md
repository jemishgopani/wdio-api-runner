# WebdriverIO API Runner - Shared Store Integration Guide

## Overview

This document explains how the Shared Store service works in WebdriverIO and how to implement similar state management in the API runner for sharing data between workers.

---

## Shared Store Architecture

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MAIN PROCESS                                    │
│                                                                              │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │                    SharedStoreLauncher                              │   │
│   │                                                                      │   │
│   │  onPrepare():                                                       │   │
│   │    1. Start HTTP server on random port                              │   │
│   │    2. Inject port into capabilities                                 │   │
│   │    3. Initialize store = {}                                         │   │
│   │                                                                      │   │
│   │  onComplete():                                                       │   │
│   │    1. Close HTTP server                                             │   │
│   └────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│                                     │ port number                            │
│                                     ▼                                        │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │                     Polka HTTP Server                               │   │
│   │                    (127.0.0.1:random_port)                          │   │
│   │                                                                      │   │
│   │  Routes:                                                             │   │
│   │    POST /           → Set key/value                                 │   │
│   │    GET /:key        → Get value by key                              │   │
│   │    GET /*           → Get all values                                │   │
│   │    POST /pool       → Create resource pool                          │   │
│   │    GET /pool/:key   → Get value from pool (removes it)              │   │
│   │    POST /pool/:key  → Add value to pool                             │   │
│   │                                                                      │   │
│   │  Storage:                                                            │   │
│   │    store = {}                    (key-value store)                  │   │
│   │    resourcePoolStore = Map()     (pool-based store)                 │   │
│   └────────────────────────────────────────────────────────────────────┘   │
│                                     ▲                                        │
└─────────────────────────────────────┼────────────────────────────────────────┘
                                      │ HTTP requests
     ┌────────────────────────────────┼────────────────────────────────┐
     │                                │                                 │
     ▼                                ▼                                 ▼
┌──────────────┐            ┌──────────────┐            ┌──────────────┐
│  Worker 0-0  │            │  Worker 0-1  │            │  Worker 0-2  │
│              │            │              │            │              │
│ SharedStore  │            │ SharedStore  │            │ SharedStore  │
│   Service    │            │   Service    │            │   Service    │
│              │            │              │            │              │
│ browser.     │            │ browser.     │            │ browser.     │
│ sharedStore  │            │ sharedStore  │            │ sharedStore  │
│  .get()      │            │  .get()      │            │  .get()      │
│  .set()      │            │  .set()      │            │  .set()      │
└──────────────┘            └──────────────┘            └──────────────┘
```

---

## Core Components

### 1. Server (`packages/wdio-shared-store-service/src/server.ts`)

The server provides a simple HTTP API for storing and retrieving values.

```typescript
import polka from 'polka'
import { json } from '@polka/parse'
import type { JsonCompatible, JsonPrimitive, JsonObject, JsonArray } from '@wdio/types'

// In-memory stores
const store: JsonObject = {}
const resourcePoolStore: Map<string, JsonArray> = new Map()

export const startServer = () => new Promise<{ port: number, app: PolkaInstance }>((resolve, reject) => {
    const app = polka()
        .use(json())  // Parse JSON body

        // Set a value
        .post('/', (req, res) => {
            const key = req.body.key as string
            if (key === '*') {
                throw new Error('Key "*" is reserved')
            }
            store[key] = req.body.value
            return res.end()
        })

        // Get a value (or all values with key='*')
        .get('/:key', (req, res) => {
            const key = req.params.key
            const value = key === '*' ? store : store[key]
            res.end(JSON.stringify({ value }))
        })

        // Create a resource pool
        .post('/pool', (req, res) => {
            const key = req.body.key
            const value = req.body.value
            if (!Array.isArray(value)) {
                return res.end(JSON.stringify({ error: 'Pool must be an array' }))
            }
            resourcePoolStore.set(key, value)
            return res.end()
        })

        // Get value from pool (removes it)
        .get('/pool/:key', async (req, res) => {
            const key = req.params.key
            const pool = resourcePoolStore.get(key) || []
            if (pool.length > 0) {
                return res.end(JSON.stringify({ value: pool.shift() }))
            }
            // Wait with timeout for value to be added
            // ...
        })

        // Add value to pool
        .post('/pool/:key', (req, res) => {
            const key = req.params.key
            const pool = resourcePoolStore.get(key)
            pool?.push(req.body.value)
            return res.end()
        })

    // Listen on random port
    app.listen(0, '127.0.0.1', (err: Error) => {
        if (err) return reject(err)
        resolve({ app, port: app.server.address().port })
    })
})
```

### 2. Client (`packages/wdio-shared-store-service/src/client.ts`)

The client provides functions to communicate with the server.

```typescript
let baseUrl: string

export const setPort = (port: number) => {
    baseUrl = `http://127.0.0.1:${port}`
}

export const getValue = async (key: string) => {
    const res = await fetch(`${baseUrl}/${key}`, { method: 'GET' })
    const body = await res.json()
    return body.value
}

export const setValue = async (key: string, value: any) => {
    await fetch(`${baseUrl}/`, {
        method: 'POST',
        body: JSON.stringify({ key, value }),
        headers: { 'Content-Type': 'application/json' }
    })
}

export const setResourcePool = async (key: string, value: any[]) => {
    await fetch(`${baseUrl}/pool`, {
        method: 'POST',
        body: JSON.stringify({ key, value }),
        headers: { 'Content-Type': 'application/json' }
    })
}

export const getValueFromPool = async (key: string, options?: { timeout: number }) => {
    const url = `${baseUrl}/pool/${key}${options?.timeout ? `?timeout=${options.timeout}` : ''}`
    const res = await fetch(url, { method: 'GET' })
    const body = await res.json()
    return body.value
}

export const addValueToPool = async (key: string, value: any) => {
    await fetch(`${baseUrl}/pool/${key}`, {
        method: 'POST',
        body: JSON.stringify({ value }),
        headers: { 'Content-Type': 'application/json' }
    })
}
```

### 3. Launcher (`packages/wdio-shared-store-service/src/launcher.ts`)

Starts the server in the main process before workers spawn.

```typescript
import { setPort } from './client.js'
import { CUSTOM_CAP } from './constants.js'

export default class SharedStoreLauncher {
    private _app?: PolkaInstance

    async onPrepare(_: never, capabilities: Capabilities) {
        const { startServer } = await import('./server.js')
        const { port, app } = await startServer()
        this._app = app
        setPort(port)

        // Inject port into all capabilities
        const capsList = Array.isArray(capabilities) ? capabilities : Object.values(capabilities)
        capsList.forEach((cap) => {
            cap['wdio:sharedStoreServicePort'] = port
        })
    }

    async onComplete() {
        if (this._app?.server.close) {
            await new Promise<void>((resolve) => {
                this._app.server.close(() => resolve())
            })
        }
    }
}
```

### 4. Service (`packages/wdio-shared-store-service/src/service.ts`)

Injects the `sharedStore` object into the browser instance in each worker.

```typescript
import { getValue, setValue, setPort, setResourcePool, getValueFromPool, addValueToPool } from './client.js'
import { CUSTOM_CAP } from './constants.js'

export default class SharedStoreService {
    constructor(_: never, caps: Capabilities) {
        const port = caps['wdio:sharedStoreServicePort']
        setPort(port)
    }

    before(caps: never, specs: never, browser: WebdriverIO.Browser) {
        browser.sharedStore = {
            get: (key: string) => getValue(key),
            set: (key: string, value: any) => setValue(key, value),
            setResourcePool: (key: string, value: any[]) => setResourcePool(key, value),
            getValueFromPool: (key: string, opts?: { timeout: number }) => getValueFromPool(key, opts),
            addValueToPool: (key: string, value: any) => addValueToPool(key, value)
        }
    }
}
```

---

## Usage in Tests

### Basic Key-Value Store

```javascript
// Worker 0-0: Set a value
await browser.sharedStore.set('authToken', 'abc123')

// Worker 0-1: Get the value
const token = await browser.sharedStore.get('authToken')
console.log(token) // 'abc123'

// Get all values
const allData = await browser.sharedStore.get('*')
console.log(allData) // { authToken: 'abc123', ... }
```

### Resource Pool (for Test Data Distribution)

```javascript
// In onPrepare or beforeSession: Create a pool of test users
await browser.sharedStore.setResourcePool('testUsers', [
    { id: 1, email: 'user1@test.com' },
    { id: 2, email: 'user2@test.com' },
    { id: 3, email: 'user3@test.com' }
])

// Worker 0-0: Get a unique user (removes from pool)
const user = await browser.sharedStore.getValueFromPool('testUsers')
console.log(user) // { id: 1, email: 'user1@test.com' }

// Worker 0-1: Get next user
const user2 = await browser.sharedStore.getValueFromPool('testUsers')
console.log(user2) // { id: 2, email: 'user2@test.com' }

// Return user to pool when done
await browser.sharedStore.addValueToPool('testUsers', user)
```

---

## Implementation for API Runner

### 1. Shared Store Server

**File: `src/store/server.ts`**

```typescript
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import type { JsonCompatible, JsonPrimitive, JsonObject, JsonArray } from '@wdio/types'

// In-memory stores
const store: JsonObject = {}
const resourcePoolStore: Map<string, JsonArray> = new Map()

const DEFAULT_TIMEOUT = 1000
const MAX_TIMEOUT = 15000

interface RequestBody {
    key?: string
    value?: JsonCompatible | JsonPrimitive | JsonArray
}

export const startServer = (): Promise<{ port: number; server: Server }> => {
    return new Promise((resolve, reject) => {
        const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
            // Parse JSON body
            let body: RequestBody = {}
            if (req.method === 'POST') {
                body = await parseBody(req)
            }

            // Set CORS headers
            res.setHeader('Content-Type', 'application/json')

            const url = new URL(req.url || '/', `http://${req.headers.host}`)
            const pathname = url.pathname

            try {
                // Route: POST / - Set value
                if (req.method === 'POST' && pathname === '/') {
                    if (body.key === '*') {
                        throw new Error('Key "*" is reserved')
                    }
                    store[body.key as string] = body.value as JsonCompatible | JsonPrimitive
                    res.statusCode = 200
                    res.end(JSON.stringify({ success: true }))
                    return
                }

                // Route: GET /:key - Get value
                if (req.method === 'GET' && pathname.startsWith('/') && !pathname.startsWith('/pool')) {
                    const key = pathname.slice(1)
                    const value = key === '*' ? store : store[key]
                    res.statusCode = 200
                    res.end(JSON.stringify({ value }))
                    return
                }

                // Route: POST /pool - Create resource pool
                if (req.method === 'POST' && pathname === '/pool') {
                    if (!Array.isArray(body.value)) {
                        res.statusCode = 400
                        res.end(JSON.stringify({ error: 'Pool value must be an array' }))
                        return
                    }
                    resourcePoolStore.set(body.key as string, body.value)
                    res.statusCode = 200
                    res.end(JSON.stringify({ success: true }))
                    return
                }

                // Route: GET /pool/:key - Get from pool
                if (req.method === 'GET' && pathname.startsWith('/pool/')) {
                    const key = pathname.slice(6)
                    const pool = resourcePoolStore.get(key)

                    if (!pool) {
                        res.statusCode = 404
                        res.end(JSON.stringify({ error: `Pool '${key}' not found` }))
                        return
                    }

                    if (pool.length > 0) {
                        res.statusCode = 200
                        res.end(JSON.stringify({ value: pool.shift() }))
                        return
                    }

                    // Wait for value with timeout
                    const timeout = Math.min(
                        parseInt(url.searchParams.get('timeout') || '') || DEFAULT_TIMEOUT,
                        MAX_TIMEOUT
                    )

                    await new Promise((resolve) => setTimeout(resolve, timeout))
                    const updatedPool = resourcePoolStore.get(key) || []

                    if (updatedPool.length > 0) {
                        res.statusCode = 200
                        res.end(JSON.stringify({ value: updatedPool.shift() }))
                    } else {
                        res.statusCode = 404
                        res.end(JSON.stringify({ error: `Pool '${key}' is empty` }))
                    }
                    return
                }

                // Route: POST /pool/:key - Add to pool
                if (req.method === 'POST' && pathname.startsWith('/pool/')) {
                    const key = pathname.slice(6)
                    const pool = resourcePoolStore.get(key)

                    if (!pool) {
                        res.statusCode = 404
                        res.end(JSON.stringify({ error: `Pool '${key}' not found` }))
                        return
                    }

                    pool.push(body.value as JsonCompatible | JsonPrimitive)
                    res.statusCode = 200
                    res.end(JSON.stringify({ success: true }))
                    return
                }

                // Not found
                res.statusCode = 404
                res.end(JSON.stringify({ error: 'Not found' }))
            } catch (error) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: (error as Error).message }))
            }
        })

        server.listen(0, '127.0.0.1', () => {
            const address = server.address()
            const port = typeof address === 'object' ? address?.port : 0
            resolve({ server, port: port || 0 })
        })

        server.on('error', reject)
    })
}

async function parseBody(req: IncomingMessage): Promise<RequestBody> {
    return new Promise((resolve) => {
        let data = ''
        req.on('data', (chunk) => { data += chunk })
        req.on('end', () => {
            try {
                resolve(JSON.parse(data))
            } catch {
                resolve({})
            }
        })
    })
}

// Export for testing
export const __store = store
export const __resourcePoolStore = resourcePoolStore
```

### 2. Shared Store Client

**File: `src/store/client.ts`**

```typescript
import type { JsonCompatible, JsonPrimitive, JsonArray } from '@wdio/types'

let baseUrl: string | null = null

const headers = {
    'Content-Type': 'application/json'
}

export const setPort = (port: number) => {
    baseUrl = `http://127.0.0.1:${port}`
}

export const isReady = () => baseUrl !== null

/**
 * Get a value from the store
 */
export const getValue = async (key: string): Promise<any> => {
    if (!baseUrl) {
        throw new Error('Shared store not initialized. Call setPort first.')
    }

    const res = await fetch(`${baseUrl}/${key}`, { method: 'GET', headers })
    const body = await res.json()
    return body.value
}

/**
 * Set a value in the store
 */
export const setValue = async (key: string, value: JsonCompatible | JsonPrimitive): Promise<void> => {
    if (!baseUrl) {
        throw new Error('Shared store not initialized. Call setPort first.')
    }

    await fetch(`${baseUrl}/`, {
        method: 'POST',
        body: JSON.stringify({ key, value }),
        headers
    })
}

/**
 * Create a resource pool
 */
export const setResourcePool = async (key: string, value: JsonArray): Promise<void> => {
    if (!baseUrl) {
        throw new Error('Shared store not initialized. Call setPort first.')
    }

    await fetch(`${baseUrl}/pool`, {
        method: 'POST',
        body: JSON.stringify({ key, value }),
        headers
    })
}

/**
 * Get a value from the pool (removes it)
 */
export const getValueFromPool = async (
    key: string,
    options?: { timeout: number }
): Promise<any> => {
    if (!baseUrl) {
        throw new Error('Shared store not initialized. Call setPort first.')
    }

    const url = `${baseUrl}/pool/${key}${options?.timeout ? `?timeout=${options.timeout}` : ''}`
    const res = await fetch(url, { method: 'GET', headers })
    const body = await res.json()
    return body.value
}

/**
 * Add a value to the pool
 */
export const addValueToPool = async (
    key: string,
    value: JsonCompatible | JsonPrimitive
): Promise<void> => {
    if (!baseUrl) {
        throw new Error('Shared store not initialized. Call setPort first.')
    }

    await fetch(`${baseUrl}/pool/${key}`, {
        method: 'POST',
        body: JSON.stringify({ value }),
        headers
    })
}
```

### 3. Shared Store for API Runner

**File: `src/store/index.ts`**

```typescript
import logger from '@wdio/logger'
import type { Server } from 'node:http'
import type { JsonCompatible, JsonPrimitive, JsonArray } from '@wdio/types'

import { startServer } from './server.js'
import {
    setPort,
    getValue,
    setValue,
    setResourcePool,
    getValueFromPool,
    addValueToPool
} from './client.js'

const log = logger('@wdio/api-runner:store')

let server: Server | null = null
let serverPort: number | null = null

/**
 * Initialize the shared store server
 * Call this in the launcher's onPrepare hook
 */
export async function initializeStore(): Promise<number> {
    if (server) {
        log.warn('Shared store already initialized')
        return serverPort!
    }

    const result = await startServer()
    server = result.server
    serverPort = result.port
    setPort(serverPort)

    log.info(`Shared store server started on port ${serverPort}`)
    return serverPort
}

/**
 * Stop the shared store server
 * Call this in the launcher's onComplete hook
 */
export async function stopStore(): Promise<void> {
    if (!server) {
        return
    }

    return new Promise((resolve) => {
        server!.close(() => {
            log.info('Shared store server stopped')
            server = null
            serverPort = null
            resolve()
        })
    })
}

/**
 * Get the server port (for passing to workers)
 */
export function getStorePort(): number | null {
    return serverPort
}

/**
 * Create the sharedStore object to inject into global scope
 */
export function createSharedStoreObject() {
    return {
        get: getValue,
        set: setValue,
        setResourcePool,
        getValueFromPool,
        addValueToPool
    }
}

// Re-export client functions for direct use
export {
    setPort,
    getValue,
    setValue,
    setResourcePool,
    getValueFromPool,
    addValueToPool
}
```

### 4. Integration with API Runner

**File: `src/index.ts`** (Main runner - relevant sections)

```typescript
import { initializeStore, stopStore, getStorePort } from './store/index.js'

export default class ApiRunner {
    private _storePort: number | null = null

    async initialize(): Promise<void> {
        // Initialize shared store
        this._storePort = await initializeStore()
        log.info('API Runner initialized with shared store')
    }

    async run({ command, args, ...workerOptions }: RunArgs): Promise<ApiWorkerInstance> {
        // Pass store port to worker via environment
        const worker = new ApiWorkerInstance(
            this.config,
            workerOptions,
            this.stdout,
            this.stderr,
            {
                ...this.options,
                storePort: this._storePort
            }
        )

        this.workerPool[workerOptions.cid] = worker
        await worker.postMessage(command, args)
        return worker
    }

    async shutdown(): Promise<boolean> {
        // ... shutdown workers ...

        // Stop shared store
        await stopStore()
        return true
    }
}
```

**File: `src/apiRunner.ts`** (Worker runner - relevant sections)

```typescript
import { setPort, createSharedStoreObject } from './store/index.js'
import { _setGlobal } from '@wdio/globals'

export default class ApiTestRunner extends EventEmitter {
    async run({ cid, args, specs, caps, configFile, retries }: RunParams) {
        // Initialize store client with port from environment
        const storePort = parseInt(process.env.WDIO_STORE_PORT || '0')
        if (storePort) {
            setPort(storePort)

            // Inject sharedStore into global scope
            const sharedStore = createSharedStoreObject()
            _setGlobal('sharedStore', sharedStore, this._config.injectGlobals)

            // Also add to stub browser if exists
            if (this._browser) {
                this._browser.sharedStore = sharedStore
            }
        }

        // ... rest of run logic ...
    }
}
```

---

## Usage in API Tests

### Basic Example

```typescript
// test/api/auth.spec.ts
describe('Authentication API', () => {
    it('should generate and share auth token', async () => {
        // Generate token via API
        const response = await api.post('/auth/login', {
            username: 'admin',
            password: 'secret'
        })

        // Share token with other workers
        await sharedStore.set('authToken', response.data.token)
        await sharedStore.set('userId', response.data.userId)
    })
})

// test/api/users.spec.ts (different worker)
describe('Users API', () => {
    it('should use shared auth token', async () => {
        // Get shared token
        const token = await sharedStore.get('authToken')

        // Use in request
        api.setHeader('Authorization', `Bearer ${token}`)
        const response = await api.get('/users/me')

        expect(response.ok).toBe(true)
    })
})
```

### Resource Pool for Test Data

```typescript
// hooks.ts (beforeSession)
export async function setupTestData() {
    // Create pool of test accounts
    await sharedStore.setResourcePool('testAccounts', [
        { email: 'test1@example.com', password: 'pass1' },
        { email: 'test2@example.com', password: 'pass2' },
        { email: 'test3@example.com', password: 'pass3' },
        { email: 'test4@example.com', password: 'pass4' }
    ])

    // Create pool of API keys
    await sharedStore.setResourcePool('apiKeys', [
        'key-001', 'key-002', 'key-003', 'key-004'
    ])
}

// test/api/parallel.spec.ts
describe('Parallel API Tests', () => {
    let testAccount: { email: string; password: string }
    let apiKey: string

    before(async () => {
        // Each worker gets a unique account and key
        testAccount = await sharedStore.getValueFromPool('testAccounts')
        apiKey = await sharedStore.getValueFromPool('apiKeys')

        // Login with unique account
        const response = await api.post('/auth/login', testAccount)
        api.setHeader('Authorization', `Bearer ${response.data.token}`)
        api.setHeader('X-API-Key', apiKey)
    })

    after(async () => {
        // Return resources to pool for reuse
        await sharedStore.addValueToPool('testAccounts', testAccount)
        await sharedStore.addValueToPool('apiKeys', apiKey)
    })

    it('should perform test with unique credentials', async () => {
        const response = await api.get('/protected-resource')
        expect(response.ok).toBe(true)
    })
})
```

### Coordination Between Workers

```typescript
// test/api/workflow.spec.ts
describe('Multi-step Workflow', () => {
    it('Worker 1: Create order', async () => {
        const response = await api.post('/orders', { item: 'Widget', qty: 10 })
        await sharedStore.set('orderId', response.data.id)
        await sharedStore.set('orderStatus', 'created')
    })

    it('Worker 2: Wait for order and process payment', async () => {
        // Wait for order to be created
        let orderId: string | undefined
        let attempts = 0

        while (!orderId && attempts < 10) {
            orderId = await sharedStore.get('orderId')
            if (!orderId) {
                await new Promise(r => setTimeout(r, 500))
                attempts++
            }
        }

        expect(orderId).toBeDefined()

        // Process payment
        const response = await api.post(`/orders/${orderId}/pay`, { method: 'card' })
        await sharedStore.set('orderStatus', 'paid')
    })

    it('Worker 3: Verify final status', async () => {
        const orderId = await sharedStore.get('orderId')
        const status = await sharedStore.get('orderStatus')

        expect(status).toBe('paid')

        const response = await api.get(`/orders/${orderId}`)
        expect(response.data.status).toBe('paid')
    })
})
```

---

## Configuration

```javascript
// wdio.conf.js
export const config = {
    runner: 'api',

    // Enable shared store (built into API runner)
    apiRunner: {
        sharedStore: {
            enabled: true,       // Enable shared store
            // timeout: 5000     // Optional: default timeout for pool operations
        }
    },

    // ... other config
}
```

---

## API Reference

### sharedStore.get(key)

Get a value from the store.

```typescript
const value = await sharedStore.get('myKey')
const allValues = await sharedStore.get('*')  // Get everything
```

### sharedStore.set(key, value)

Set a value in the store.

```typescript
await sharedStore.set('myKey', 'myValue')
await sharedStore.set('userData', { id: 1, name: 'John' })
await sharedStore.set('numbers', [1, 2, 3])
```

### sharedStore.setResourcePool(key, values)

Create a resource pool with initial values.

```typescript
await sharedStore.setResourcePool('users', [user1, user2, user3])
```

### sharedStore.getValueFromPool(key, options?)

Get and remove a value from the pool.

```typescript
const user = await sharedStore.getValueFromPool('users')
const userWithTimeout = await sharedStore.getValueFromPool('users', { timeout: 5000 })
```

### sharedStore.addValueToPool(key, value)

Add a value back to an existing pool.

```typescript
await sharedStore.addValueToPool('users', user)
```

---

## Summary

| Component | Purpose |
|-----------|---------|
| **Server** | HTTP server for storing/retrieving values |
| **Client** | Functions to communicate with server |
| **Launcher** | Starts server in main process |
| **Service** | Injects `sharedStore` into workers |

### Key Files to Implement

```
@wdio/api-runner/
├── src/
│   └── store/
│       ├── index.ts      # Main exports and initialization
│       ├── server.ts     # HTTP server implementation
│       └── client.ts     # Client functions
```

### Use Cases

- **Share authentication tokens** across workers
- **Distribute unique test data** via resource pools
- **Coordinate test workflows** between parallel workers
- **Aggregate test results** from multiple workers
- **Share dynamic configuration** during test run
