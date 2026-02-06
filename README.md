# wdio-api-runner

<div align="center">

<img src="./assets/banner.png" alt="API Runner" width="600">

**A WebdriverIO runner for blazing-fast API automation testing**

[![npm version](https://img.shields.io/npm/v/wdio-api-runner.svg)](https://www.npmjs.com/package/wdio-api-runner)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![WebdriverIO](https://img.shields.io/badge/WebdriverIO-v9-EA5906.svg)](https://webdriver.io)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933.svg)](https://nodejs.org)

[Documentation](https://jemishgopani.github.io/wdio-api-runner/) · [Report Bug](https://github.com/jemishgopani/wdio-api-runner/issues) · [Request Feature](https://github.com/jemishgopani/wdio-api-runner/issues)

</div>

---

## Why wdio-api-runner?

Traditional WebdriverIO testing spins up browser sessions for every test—even when you're just testing APIs. This creates unnecessary overhead:

| Metric | Browser Runner | API Runner |
|--------|---------------|------------|
| Startup time | ~2-5 seconds | **~50ms** |
| Memory per worker | ~200-500MB | **~30MB** |
| Dependencies | Browser + Driver | **None** |
| CI/CD complexity | High | **Minimal** |

**wdio-api-runner** bypasses browser session creation entirely, giving you the full power of WebdriverIO's test orchestration for pure API and backend testing.

---

## Features

- **Zero Browser Overhead** — No WebDriver, no browser binaries, no session management
- **Native Fetch API Client** — Modern, Promise-based HTTP client with full TypeScript support
- **Fluent Assertions** — Chain assertions for status, headers, body, and JSON schema validation
- **Authentication Helpers** — Built-in Basic, API Key, Bearer/JWT, and OAuth2 support
- **GraphQL Support** — Full support for queries, mutations, and subscriptions
- **HAR Logging** — Record requests to HAR format for debugging and replay
- **Performance Metrics** — p50/p95/p99 latency tracking with threshold checking
- **All WDIO Features** — Parallel execution, reporters, services, and frameworks work seamlessly

---

## Installation

```bash
npm install wdio-api-runner --save-dev
```

---

## Quick Start

### 1. Configure WebdriverIO

```typescript
// wdio.conf.ts
export const config: WebdriverIO.Config = {
    runner: 'api',
    specs: ['./test/api/**/*.spec.ts'],
    framework: 'mocha',
    reporters: ['spec'],
    baseUrl: 'https://api.example.com',

    apiRunner: {
        timeout: 30000,
        headers: {
            'Content-Type': 'application/json'
        }
    }
}
```

### 2. Write Your First Test

```typescript
describe('Users API', () => {
    it('should fetch user by ID', async () => {
        const response = await api.get('/users/1')

        expect(response.status).toBe(200)
        expect(response.data).toHaveProperty('id', 1)
        expect(response.data).toHaveProperty('email')
    })

    it('should create a new user', async () => {
        const response = await api.post('/users', {
            name: 'John Doe',
            email: 'john@example.com'
        })

        expect(response.status).toBe(201)
    })
})
```

### 3. Run Your Tests

```bash
npx wdio run wdio.conf.ts
```

---

## Documentation

**[View Full Documentation →](https://jemishgopani.github.io/wdio-api-runner/)**

| Guide | Description |
|-------|-------------|
| [Getting Started](https://jemishgopani.github.io/wdio-api-runner/getting-started/installation) | Installation and configuration |
| [API Client](https://jemishgopani.github.io/wdio-api-runner/core/api-client) | HTTP methods, headers, and options |
| [Assertions](https://jemishgopani.github.io/wdio-api-runner/core/assertions) | Fluent assertion helpers |
| [Authentication](https://jemishgopani.github.io/wdio-api-runner/core/authentication) | Basic, Bearer, API Key, OAuth2 |
| [GraphQL](https://jemishgopani.github.io/wdio-api-runner/graphql/client) | Queries, mutations, subscriptions |
| [Performance Metrics](https://jemishgopani.github.io/wdio-api-runner/observability/metrics) | Latency tracking and thresholds |
| [CI Integration](https://jemishgopani.github.io/wdio-api-runner/advanced/ci-integration) | GitHub Actions, GitLab CI, Jenkins |

---

## Example Usage

### Fluent Assertions

```typescript
import { assertResponse } from 'wdio-api-runner'

assertResponse(response)
    .toBeSuccess()
    .and.toHaveContentType('application/json')
    .and.toHaveBodyProperty('users')
    .and.toRespondWithin(500)
```

### Authentication

```typescript
import { bearerAuth, oauth2ClientCredentials } from 'wdio-api-runner'

// Bearer Token
api.addRequestInterceptor(bearerAuth({
    token: async () => await getToken()
}).interceptor)

// OAuth2 Client Credentials
api.addRequestInterceptor(oauth2ClientCredentials({
    tokenUrl: 'https://auth.example.com/token',
    clientId: 'my-client',
    clientSecret: 'secret'
}).interceptor)
```

### GraphQL

```typescript
import { createGraphQLClient } from 'wdio-api-runner'

const graphql = createGraphQLClient({
    endpoint: 'https://api.example.com/graphql'
})

const response = await graphql.query(`
    query GetUser($id: ID!) {
        user(id: $id) { id name email }
    }
`, { id: '123' })
```

---

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built for the WebdriverIO ecosystem**

</div>
