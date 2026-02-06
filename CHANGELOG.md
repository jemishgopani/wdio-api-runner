# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-02-06

### Added

#### Core Features
- **API Runner** - WebdriverIO runner for API-only testing without browser sessions
- **API Client** - Full-featured HTTP client with retry support, timeout handling, and interceptors
- **Parallel Execution** - Full support for WebdriverIO's parallel worker architecture
- **All Frameworks** - Compatible with Mocha, Jasmine, and Cucumber
- **All Reporters** - Works with Spec, Allure, JUnit, HTML, and all WDIO reporters

#### Assertions
- **Fluent Assertions** - `assertResponse()` with chainable API
- **Status Assertions** - `toHaveStatus()`, `toBeOk()`, `toBeSuccess()`, `toBeClientError()`, `toBeServerError()`
- **Header Assertions** - `toHaveHeader()`, `toHaveContentType()`
- **Body Assertions** - `toHaveBody()`, `toHaveBodyProperty()`, `toHaveBodyLength()`
- **Schema Validation** - `toMatchSchema()` with JSON Schema support
- **Performance Assertions** - `toRespondWithin()`
- **Vitest Matchers** - `apiMatchers` for use with `expect.extend()`

#### Authentication
- **Basic Auth** - `basicAuth()` helper with Base64 encoding
- **API Key Auth** - `apiKeyAuth()` supporting header, query, and cookie placement
- **Bearer/JWT Auth** - `bearerAuth()` with auto-refresh and token management
- **OAuth2 Client Credentials** - `oauth2ClientCredentials()` with automatic token acquisition

#### GraphQL
- **GraphQL Client** - `createGraphQLClient()` for queries and mutations
- **Query Builder** - `createQueryBuilder()` with fluent API for building operations
- **Tagged Templates** - `gql` template literal for syntax highlighting
- **Error Handling** - Proper handling of GraphQL errors vs network errors
- **Subscriptions** - Real-time subscription support via WebSocket and SSE

#### Observability
- **HAR Logging** - Record HTTP requests to HAR 1.2 format for debugging
- **Performance Metrics** - `createMetricsCollector()` with p50/p95/p99 percentile tracking
- **Threshold Checking** - `checkThresholds()` for CI/CD integration
- **Console Reporting** - `formatConsoleReport()` for human-readable output
- **JSON Export** - `exportMetricsJson()` for CI artifact storage

#### Developer Experience
- **Full TypeScript Support** - Complete type definitions for all APIs
- **Custom Interceptors** - Request and response interceptor support
- **Dynamic Configuration** - Runtime baseUrl and header management
- **Grouped Logs** - Optional log grouping by test spec for cleaner CI output

### Documentation
- Comprehensive documentation in `/docs` directory
- API reference for all modules
- Examples for REST API, GraphQL, and CI integration
- TypeScript integration guide

[1.0.0]: https://github.com/jemishgopani/wdio-api-runner/releases/tag/v1.0.0
