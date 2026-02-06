# wdio-api-runner Examples

This directory contains comprehensive examples demonstrating all features of `wdio-api-runner`.

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific test categories
npm run test:api           # API client examples
npm run test:assertions    # Assertion examples
npm run test:auth          # Authentication examples
npm run test:graphql       # GraphQL examples
npm run test:observability # HAR logging and metrics
npm run test:browser       # Stub browser examples
npm run test:e2e           # End-to-end workflow
```

## Project Structure

```
example/
├── wdio.conf.ts                    # WebdriverIO configuration
├── test/
│   ├── specs/
│   │   ├── api/                    # API Client examples
│   │   │   ├── basic-requests.spec.ts
│   │   │   ├── headers-and-config.spec.ts
│   │   │   └── interceptors.spec.ts
│   │   ├── assertions/             # Assertion examples
│   │   │   ├── status-assertions.spec.ts
│   │   │   ├── body-assertions.spec.ts
│   │   │   ├── schema-validation.spec.ts
│   │   │   └── api-matchers.spec.ts      # Jest/Vitest matchers
│   │   ├── auth/                   # Authentication examples
│   │   │   ├── basic-auth.spec.ts
│   │   │   ├── api-key-auth.spec.ts
│   │   │   ├── bearer-auth.spec.ts
│   │   │   └── oauth2-auth.spec.ts       # OAuth2 Client Credentials
│   │   ├── graphql/                # GraphQL examples
│   │   │   ├── queries.spec.ts
│   │   │   ├── query-builder.spec.ts
│   │   │   ├── subscriptions.spec.ts     # WebSocket & SSE subscriptions
│   │   │   └── extended-client.spec.ts   # extendWithGraphQL
│   │   ├── browser/                # Stub Browser examples
│   │   │   └── stub-browser.spec.ts
│   │   ├── observability/          # Monitoring examples
│   │   │   ├── har-logging.spec.ts
│   │   │   └── metrics.spec.ts
│   │   └── e2e/                    # Complete workflows
│   │       └── user-workflow.spec.ts
│   └── support/
│       └── types.ts                # Shared type definitions
└── har-logs/                       # Generated HAR files
```

## Test Categories

### API Client (`test:api`)

Demonstrates core HTTP client functionality:
- GET, POST, PUT, PATCH, DELETE requests
- Custom headers and base URL configuration
- Request/response interceptors
- Query parameters and timeout handling

### Assertions (`test:assertions`)

Shows all available assertion methods:
- Status code assertions (toBeOk, toBeSuccess, toBeClientError)
- Body and property assertions (toHaveBody, toHaveBodyProperty)
- Header assertions (toHaveHeader, toHaveContentType)
- JSON Schema validation (toMatchSchema)
- Performance assertions (toRespondWithin)
- Fluent chaining and negation (.not, .and)
- **Jest/Vitest matchers** (`apiMatchers`) for native expect() integration

### Authentication (`test:auth`)

Covers authentication patterns:
- Basic authentication with Base64 encoding
- API Key in header, query parameter, or cookie
- Bearer/JWT token authentication
- **OAuth2 Client Credentials** flow for machine-to-machine auth
- Token management (set, get, clear, refresh)
- Path exclusion for public endpoints

### GraphQL (`test:graphql`)

GraphQL client usage:
- Simple queries with `gql` template tag
- Queries with variables
- Query builder fluent API
- **extendWithGraphQL** - Add GraphQL to existing REST client
- **Subscriptions** - WebSocket (graphql-ws) and SSE support
- Subscription lifecycle management
- Error handling

### Browser (`test:browser`)

Stub browser for API-only testing:
- `createStubBrowser` for mock browser object
- Working methods: `pause()`, `call()`
- Browser property stubs (isMobile, isChrome, etc.)
- Event emitter support
- Error handling for unavailable browser methods
- Migration patterns from browser to API tests

### Observability (`test:observability`)

Monitoring and debugging tools:
- HAR file recording for request/response capture
- Performance metrics collection
- Percentile statistics (p50, p95, p99)
- Threshold checking for SLA validation

### E2E Workflow (`test:e2e`)

Complete real-world example:
- Full CRUD operations
- User-posts-comments relationship testing
- Pagination and filtering
- Error handling scenarios
- Schema validation
- Performance verification

## Public APIs Used

| API | URL | Purpose |
|-----|-----|---------|
| JSONPlaceholder | https://jsonplaceholder.typicode.com | REST API examples |
| HTTPBin | https://httpbin.org | Auth and header testing |
| Countries GraphQL | https://countries.trevorblades.com/graphql | GraphQL examples |

## Configuration

The `wdio.conf.ts` file configures:

```typescript
{
    runner: ['api', {}],           // Use wdio-api-runner
    framework: 'mocha',            // Mocha test framework
    reporters: ['spec'],           // Spec reporter
    baseUrl: 'https://jsonplaceholder.typicode.com',
    maxInstances: 2,               // Parallel execution
}
```

## Writing Your Own Tests

```typescript
import { createApiClient, assertResponse } from 'wdio-api-runner';

describe('My API Tests', () => {
    const api = createApiClient({
        baseUrl: 'https://api.example.com',
    });

    it('should fetch data', async () => {
        const response = await api.get('/endpoint');

        assertResponse(response)
            .toBeOk()
            .toHaveBodyProperty('key', 'value')
            .toRespondWithin(1000);
    });
});
```

## Tips

1. **Use typed responses** for better IDE support:
   ```typescript
   const response = await api.get<MyType>('/endpoint');
   ```

2. **Chain assertions** for readable tests:
   ```typescript
   assertResponse(response)
       .toBeOk()
       .and.toHaveBody()
       .and.toMatchSchema(schema);
   ```

3. **Use interceptors** for cross-cutting concerns:
   ```typescript
   api.addRequestInterceptor((url, options) => {
       // Add auth, logging, etc.
       return { url, options };
   });
   ```

4. **Collect metrics** for performance monitoring:
   ```typescript
   const metrics = createMetricsCollector();
   // ... run tests ...
   console.log(formatConsoleReport(metrics.getReport()));
   ```

5. **Use OAuth2 for machine-to-machine auth**:
   ```typescript
   const auth = oauth2ClientCredentials({
       tokenUrl: 'https://auth.example.com/oauth/token',
       clientId: process.env.CLIENT_ID,
       clientSecret: process.env.CLIENT_SECRET,
   });
   api.addRequestInterceptor(auth.interceptor);
   ```

6. **Extend REST client with GraphQL**:
   ```typescript
   const api = createApiClient({ baseUrl: 'https://api.example.com' });
   const extendedApi = extendWithGraphQL(api, {
       endpoint: 'https://api.example.com/graphql'
   });
   // Use both: extendedApi.get('/users') and extendedApi.graphql.query(...)
   ```

7. **Use Jest/Vitest matchers** for native syntax:
   ```typescript
   // In setup file
   import { apiMatchers } from 'wdio-api-runner';
   expect.extend(apiMatchers);

   // In tests
   expect(response).toBeOk();
   expect(response).toHaveBodyProperty('id', 1);
   ```

8. **Subscribe to real-time GraphQL data**:
   ```typescript
   const manager = createSubscriptionManager();
   manager.configure({
       webSocket: { url: 'wss://api.example.com/graphql' }
   });
   const handle = await manager.subscribe(query, {
       onData: (data) => console.log(data)
   });
   ```
