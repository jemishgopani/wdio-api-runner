---
sidebar_position: 3
title: Configuration
description: Complete reference for all wdio-api-runner configuration options including API client settings, GraphQL options, environment variables, and framework integrations.
---

# Configuration

This page provides a complete reference for all wdio-api-runner configuration options. From basic setup to advanced customization, you'll find everything you need to configure your API testing environment.

## Overview

wdio-api-runner configuration lives in your `wdio.conf.ts` file alongside standard WebdriverIO options. The runner introduces two main configuration sections:

| Section | Purpose |
|---------|---------|
| `apiRunner` | HTTP client configuration (timeout, headers, retries) |
| `graphqlRunner` | GraphQL client configuration (endpoint, subscriptions) |

All standard WebdriverIO options (specs, reporters, services, etc.) work exactly as documented in the [WebdriverIO Configuration Reference](https://webdriver.io/docs/configuration).

## Complete Configuration Example

Here's a full configuration file demonstrating all available options:

```typescript
// wdio.conf.ts
import type { Options } from '@wdio/types'

export const config: Options.Testrunner = {
    //
    // ====================
    // Runner Configuration
    // ====================
    // Use the API runner (required)
    runner: 'api',

    //
    // ==================
    // Specify Test Files
    // ==================
    // Define locations of your test spec files
    specs: [
        './test/api/**/*.spec.ts'
    ],

    // Exclude specific files from test runs
    exclude: [
        './test/api/**/*.skip.ts',
        './test/api/helpers/**/*.ts'
    ],

    //
    // ============
    // Capabilities
    // ============
    // For proper reporter output, configure API capabilities
    capabilities: [{
        browserName: 'api',
        platformName: 'API Runner',
        browserVersion: 'stable',
    }],

    //
    // ===================
    // Test Configurations
    // ===================
    // Maximum parallel workers
    maxInstances: 10,

    // Test framework
    framework: 'mocha',
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000,
        retries: 1
    },

    // Reporters
    reporters: [
        'spec',
        ['allure', {
            outputDir: 'allure-results',
            disableWebdriverStepsReporting: true
        }],
        ['junit', {
            outputDir: './reports/junit',
            outputFileFormat: (options) => `results-${options.cid}.xml`
        }]
    ],

    //
    // =============
    // API Base URL
    // =============
    // Base URL for all relative API paths
    baseUrl: 'https://api.example.com',

    //
    // =================
    // API Runner Config
    // =================
    apiRunner: {
        // Request timeout in milliseconds
        timeout: 30000,

        // Retry configuration
        retries: 0,
        retryDelay: 1000,

        // Default headers for all requests
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-API-Version': '2024-01'
        },

        // Enable verbose request/response logging
        verbose: false,

        // Custom global variable name (default: 'api')
        globalName: 'api',
    },

    //
    // =====================
    // GraphQL Runner Config
    // =====================
    graphqlRunner: {
        endpoint: 'https://api.example.com/graphql',
        headers: {
            'Content-Type': 'application/json'
        },
        timeout: 30000,
        webSocket: {
            url: 'wss://api.example.com/graphql',
            connectionParams: {
                authToken: process.env.WS_TOKEN
            }
        }
    },

    //
    // =======
    // Logging
    // =======
    // Group logs by spec file for cleaner CI output
    groupLogsByTestSpec: true,

    // Output directory for logs
    outputDir: './logs',

    // Log level
    logLevel: 'info',

    //
    // =====
    // Hooks
    // =====
    onPrepare: async function (config, capabilities) {
        console.log('Starting test run...')
    },

    beforeSession: async function (config, capabilities, specs) {
        // Setup before each worker session
    },

    before: async function (capabilities, specs) {
        // Setup before tests in each worker
    },

    afterTest: async function (test, context, { error, result, duration, passed }) {
        // After each test
    },

    after: async function (result, capabilities, specs) {
        // Cleanup after tests in each worker
    },

    onComplete: async function (exitCode, config, capabilities, results) {
        console.log('Test run complete!')
    }
}
```

## API Runner Options

### `apiRunner.timeout`

Default timeout for all HTTP requests in milliseconds. If a request takes longer than this, it will be aborted and the test will fail.

```typescript
apiRunner: {
    timeout: 30000 // 30 seconds (default)
}
```

**Per-request override:**
```typescript
const response = await api.get('/slow-endpoint', {
    timeout: 120000 // 2 minutes for this specific request
})
```

### `apiRunner.retries`

Number of automatic retry attempts for failed requests. Useful for handling transient network issues or rate limiting.

```typescript
apiRunner: {
    retries: 3 // Retry up to 3 times on failure
}
```

**When retries occur:**
- Network errors (connection refused, timeout)
- HTTP 5xx server errors
- HTTP 429 Too Many Requests

**When retries do NOT occur:**
- HTTP 4xx client errors (except 429)
- Successful responses (any 2xx status)

### `apiRunner.retryDelay`

Delay between retry attempts in milliseconds. This helps avoid overwhelming a struggling server.

```typescript
apiRunner: {
    retries: 3,
    retryDelay: 1000 // Wait 1 second between retries
}
```

For exponential backoff, consider using request interceptors (see [Interceptors](/core/interceptors)).

### `apiRunner.headers`

Default headers sent with every request. These can be overridden on a per-request basis.

```typescript
apiRunner: {
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': process.env.API_KEY,
        'X-Client-Version': '1.0.0'
    }
}
```

**Dynamic headers:** For headers that need to be computed at runtime (like authentication tokens), use request interceptors:

```typescript
// In your test setup or beforeSession hook
api.addRequestInterceptor(async (config) => {
    config.headers.set('Authorization', `Bearer ${await getToken()}`)
    return config
})
```

### `apiRunner.verbose`

Enable detailed logging of all requests and responses. Helpful for debugging but can be noisy in CI.

```typescript
apiRunner: {
    verbose: true
}
```

**Output example:**
```
→ GET https://api.example.com/users/1
  Headers: { "Accept": "application/json" }

← 200 OK (145ms)
  Headers: { "Content-Type": "application/json" }
  Body: { "id": 1, "name": "John Doe" }
```

### `apiRunner.client`

Use a custom API client instead of the built-in one. Your client must implement the `ApiClient` interface.

```typescript
import CustomApiClient from './helpers/CustomApiClient'

apiRunner: {
    client: CustomApiClient
}
```

**Custom client interface:**
```typescript
interface ApiClient {
    get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>
    post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>>
    put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>>
    patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>>
    delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>
    // ... additional methods
}
```

### `apiRunner.clientFactory`

Factory function for creating API clients dynamically. Called once per worker with the current configuration.

```typescript
apiRunner: {
    clientFactory: (config) => {
        const client = new ApiClient()
        client.setBaseUrl(config.baseUrl)

        // Add environment-specific setup
        if (process.env.DEBUG) {
            client.enableVerboseLogging()
        }

        return client
    }
}
```

### `apiRunner.globalName`

Change the global variable name used to access the API client. Default is `api`.

```typescript
apiRunner: {
    globalName: 'http' // Access via `http.get()` instead of `api.get()`
}
```

**In your tests:**
```typescript
// With globalName: 'http'
const response = await http.get('/users/1')
```

## GraphQL Runner Options

### `graphqlRunner.endpoint`

The GraphQL endpoint URL for queries and mutations.

```typescript
graphqlRunner: {
    endpoint: 'https://api.example.com/graphql'
}
```

### `graphqlRunner.headers`

Default headers for GraphQL requests.

```typescript
graphqlRunner: {
    endpoint: 'https://api.example.com/graphql',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GRAPHQL_TOKEN}`
    }
}
```

### `graphqlRunner.timeout`

Timeout for GraphQL requests in milliseconds.

```typescript
graphqlRunner: {
    timeout: 30000
}
```

### `graphqlRunner.webSocket`

WebSocket configuration for GraphQL subscriptions.

```typescript
graphqlRunner: {
    endpoint: 'https://api.example.com/graphql',
    webSocket: {
        // WebSocket URL for subscriptions
        url: 'wss://api.example.com/graphql',

        // Connection parameters (sent on connection)
        connectionParams: {
            authToken: process.env.WS_AUTH_TOKEN
        },

        // Reconnection settings
        reconnect: true,
        reconnectAttempts: 5,
        reconnectInterval: 3000
    }
}
```

### `graphqlRunner.sse`

Server-Sent Events configuration for GraphQL subscriptions.

```typescript
graphqlRunner: {
    endpoint: 'https://api.example.com/graphql',
    sse: {
        url: 'https://api.example.com/graphql/stream',
        headers: {
            'Authorization': `Bearer ${process.env.SSE_TOKEN}`
        }
    }
}
```

## Environment Variables

Override configuration at runtime using environment variables. This is useful for CI/CD pipelines and multi-environment testing.

### `WDIO_API_OPTIONS`

JSON-formatted object to override apiRunner options.

```bash
# Override base URL and timeout
WDIO_API_OPTIONS='{"baseUrl":"https://staging.api.com","timeout":60000}'

# Run tests with overrides
WDIO_API_OPTIONS='{"baseUrl":"https://staging.api.com"}' npx wdio run wdio.conf.ts
```

### Common Environment Variables

```bash
# API base URL
API_BASE_URL=https://staging.api.example.com

# Authentication
API_KEY=your-api-key
API_TOKEN=your-bearer-token

# SSL handling (development only)
NODE_TLS_REJECT_UNAUTHORIZED=0

# Debug logging
DEBUG=wdio-api-runner:*
```

**Using in configuration:**
```typescript
baseUrl: process.env.API_BASE_URL || 'https://api.example.com',

apiRunner: {
    headers: {
        'X-API-Key': process.env.API_KEY || ''
    }
}
```

## Capabilities Configuration

For proper reporter output and test identification, configure capabilities:

```typescript
capabilities: [{
    browserName: 'api',
    platformName: 'API Runner',
    browserVersion: 'stable',
}]
```

For multi-environment testing:

```typescript
capabilities: [
    {
        browserName: 'api',
        platformName: 'Production',
        'custom:baseUrl': 'https://api.example.com'
    },
    {
        browserName: 'api',
        platformName: 'Staging',
        'custom:baseUrl': 'https://staging.api.example.com'
    }
]
```

## Framework Configuration

### Mocha (Default)

```typescript
framework: 'mocha',
mochaOpts: {
    // BDD-style (describe/it) or TDD-style (suite/test)
    ui: 'bdd',

    // Test timeout in milliseconds
    timeout: 60000,

    // Retry failed tests
    retries: 1,

    // Bail on first failure
    bail: false,

    // Grep pattern to filter tests
    grep: process.env.TEST_GREP || undefined,

    // Invert grep (run tests that DON'T match)
    invert: false
}
```

### Jasmine

```typescript
framework: 'jasmine',
jasmineOpts: {
    // Default timeout for async tests
    defaultTimeoutInterval: 60000,

    // Random execution order
    random: false,

    // Seed for random order
    seed: '12345',

    // Stop on first failure
    stopOnFailure: false,

    // Fail fast
    stopSpecOnExpectationFailure: false
}
```

### Cucumber

```typescript
framework: 'cucumber',
cucumberOpts: {
    // Step definition files
    require: ['./test/steps/**/*.ts'],

    // Support files
    requireModule: ['ts-node/register'],

    // Tag expression to filter scenarios
    tags: '@api and not @skip',

    // Fail on undefined steps
    failAmbiguousDefinitions: true,

    // Retry failed scenarios
    retry: 2,

    // Format for output
    format: ['pretty'],

    // Parallel scenarios
    parallel: 2
}
```

## Reporter Configuration

### Spec Reporter

Simple console output showing test results.

```typescript
reporters: ['spec']
```

### Allure Reporter

Rich HTML reports with attachments.

```typescript
reporters: [
    ['allure', {
        outputDir: 'allure-results',
        disableWebdriverStepsReporting: true,
        disableWebdriverScreenshotsReporting: true
    }]
]
```

### JUnit Reporter

XML reports for CI/CD integration.

```typescript
reporters: [
    ['junit', {
        outputDir: './reports/junit',
        outputFileFormat: (options) => `results-${options.cid}.xml`,
        suiteNameFormat: /[^/]+$/
    }]
]
```

### Multiple Reporters

Combine multiple reporters for different outputs.

```typescript
reporters: [
    'spec',
    ['allure', { outputDir: 'allure-results' }],
    ['junit', { outputDir: './reports/junit' }]
]
```

## Logging Configuration

### Log Levels

```typescript
// Available levels: trace, debug, info, warn, error, silent
logLevel: 'info'
```

### Log Grouping

Group logs by spec file for cleaner CI output (especially useful in GitHub Actions).

```typescript
groupLogsByTestSpec: true
```

### Output Directory

Directory for log files.

```typescript
outputDir: './logs'
```

## Hooks

WebdriverIO hooks let you run code at specific points in the test lifecycle.

### Common Hook Use Cases

```typescript
// Before the entire test run
onPrepare: async function (config, capabilities) {
    // Seed database, start mock server, etc.
    await seedDatabase()
},

// Before each worker session
beforeSession: async function (config, capabilities, specs) {
    // Worker-specific setup
},

// Before tests in each worker
before: async function (capabilities, specs) {
    // Add custom commands, interceptors, etc.
    api.addRequestInterceptor(authInterceptor)
},

// After each test
afterTest: async function (test, context, { error, result, duration, passed }) {
    if (!passed) {
        // Log request/response details on failure
        console.log('Failed test:', test.title)
    }
},

// After tests in each worker
after: async function (result, capabilities, specs) {
    // Worker-specific cleanup
},

// After the entire test run
onComplete: async function (exitCode, config, capabilities, results) {
    // Generate reports, cleanup resources, etc.
    await generateReport()
}
```

## Next Steps

Now that you understand the configuration options:

- [API Client](/core/api-client) — Learn the HTTP client API in detail
- [Assertions](/core/assertions) — Use fluent assertions for cleaner tests
- [Interceptors](/core/interceptors) — Add middleware for auth, logging, retries
- [CI Integration](/advanced/ci-integration) — Configure for GitHub Actions, GitLab CI, etc.
