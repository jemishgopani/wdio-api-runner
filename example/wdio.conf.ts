import type { Options } from '@wdio/types'

export const config: Options.Testrunner = {
    // ============================================================================
    // WDIO-API-RUNNER CONFIGURATION
    // ============================================================================
    // Use wdio-api-runner for API-only testing (no browser automation)
    runner: ['api', {}],

    // ============================================================================
    // API RUNNER OPTIONS (config.apiRunner)
    // ============================================================================
    // All options below are optional and have sensible defaults
    //
    // apiRunner: {
    //     // ---- Base Configuration ----
    //
    //     // Base URL for API requests (can also use config.baseUrl)
    //     // baseUrl: 'https://api.example.com',
    //
    //     // Default timeout for API requests (ms)
    //     // @default 30000
    //     // timeout: 30000,
    //
    //     // Default headers for all API requests
    //     // headers: {
    //     //     'Content-Type': 'application/json',
    //     //     'X-Custom-Header': 'value',
    //     // },
    //
    //     // Enable verbose request/response logging
    //     // @default false
    //     // verbose: true,
    //
    //     // ---- Retry Configuration ----
    //
    //     // Number of retries for failed requests
    //     // @default 0
    //     // retries: 3,
    //
    //     // Delay between retries (ms)
    //     // @default 1000
    //     // retryDelay: 1000,
    //
    //     // ---- Custom Client ----
    //
    //     // Use a custom API client instead of the built-in fetch client
    //     // Useful for integrating existing API clients (e.g., from wdio-openapi-service)
    //     // client: MyCustomApiClient,
    //
    //     // Factory function to create a custom API client
    //     // Called with the WebdriverIO config for dynamic client creation
    //     // clientFactory: (config) => {
    //     //     const client = new MyApiClient();
    //     //     client.setBaseUrl(config.baseUrl);
    //     //     return client;
    //     // },
    //
    //     // ---- Global Variable ----
    //
    //     // Global variable name for the API client
    //     // @default 'api'
    //     // Change to access via different name: `apiClient.get(...)` instead of `api.get(...)`
    //     // globalName: 'apiClient',
    //
    //     // ---- HAR Logging Configuration ----
    //
    //     // logging: {
    //     //     // Enable always-on logging (auto-record all requests)
    //     //     // @default false
    //     //     enabled: true,
    //     //
    //     //     // Output directory for HAR files
    //     //     // @default './har-logs'
    //     //     outputPath: './har-logs',
    //     //
    //     //     // Include request bodies in the log
    //     //     // @default true
    //     //     includeRequestBody: true,
    //     //
    //     //     // Include response bodies in the log
    //     //     // @default true
    //     //     includeResponseBody: true,
    //     //
    //     //     // Maximum body size to capture (bytes), larger bodies are truncated
    //     //     // @default 1048576 (1MB)
    //     //     maxBodySize: 1048576,
    //     //
    //     //     // Automatically name HAR files based on test name
    //     //     // @default false
    //     //     attachToTest: false,
    //     // },
    // },

    // ============================================================================
    // GRAPHQL RUNNER OPTIONS (config.graphqlRunner)
    // ============================================================================
    // Optional GraphQL-specific configuration (creates global `graphql` client)
    //
    // graphqlRunner: {
    //     // GraphQL endpoint URL (required for global graphql client)
    //     // endpoint: 'https://api.example.com/graphql',
    //
    //     // Default headers for GraphQL requests
    //     // headers: {
    //     //     'Authorization': 'Bearer token',
    //     // },
    //
    //     // Request timeout (ms)
    //     // @default 30000
    //     // timeout: 30000,
    //
    //     // Number of retries for failed requests
    //     // @default 0
    //     // retries: 0,
    //
    //     // Delay between retries (ms)
    //     // @default 1000
    //     // retryDelay: 1000,
    //
    //     // Enable verbose logging
    //     // @default false
    //     // verbose: false,
    //
    //     // ---- Subscription Configuration ----
    //
    //     // subscriptions: {
    //     //     // Default protocol for subscriptions
    //     //     // @default 'websocket'
    //     //     defaultProtocol: 'websocket', // or 'sse'
    //     //
    //     //     // WebSocket endpoint (if different from HTTP endpoint)
    //     //     webSocketUrl: 'wss://api.example.com/graphql',
    //     //
    //     //     // SSE endpoint (if different from HTTP endpoint)
    //     //     sseUrl: 'https://api.example.com/graphql/stream',
    //     // },
    // },

    // ============================================================================
    // STANDARD WEBDRIVERIO CONFIGURATION
    // ============================================================================

    // Test specs location
    specs: ['./test/specs/**/*.spec.ts'],

    // Exclude patterns
    exclude: [],

    // Max parallel instances
    maxInstances: 2,

    // Capabilities for API testing
    // These values are displayed in the spec reporter output
    capabilities: [
        {
            browserName: 'api',
            platformName: 'API Runner',
            browserVersion: 'stable',
        },
    ],

    // Log level: trace | debug | info | warn | error | silent
    logLevel: 'info',

    // Base URL for API requests (used by apiRunner if apiRunner.baseUrl not set)
    baseUrl: 'https://jsonplaceholder.typicode.com',

    // Test timeout
    waitforTimeout: 10000,

    // Connection retry settings
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,

    // Framework: mocha | jasmine | cucumber
    framework: 'mocha',

    // Reporters: spec | dot | allure | junit | etc.
    reporters: ['spec'],

    // Mocha options
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000,
    },

    // TypeScript support
    autoCompileOpts: {
        autoCompile: true,
        tsNodeOpts: {
            transpileOnly: true,
            project: './tsconfig.json',
        },
    },

    // ============================================================================
    // HOOKS (Optional)
    // ============================================================================
    // WebdriverIO hooks work normally with API runner
    //
    // onPrepare: async function (config, capabilities) {
    //     // Runs once before all workers start
    // },
    //
    // beforeSession: async function (config, capabilities, specs) {
    //     // Runs before each worker session starts
    // },
    //
    // before: async function (capabilities, specs) {
    //     // Runs before test execution begins
    //     // Global `api` client is available here
    // },
    //
    // beforeTest: async function (test, context) {
    //     // Runs before each test
    // },
    //
    // afterTest: async function (test, context, result) {
    //     // Runs after each test
    // },
    //
    // after: async function (result, capabilities, specs) {
    //     // Runs after all tests complete
    // },
    //
    // afterSession: async function (config, capabilities, specs) {
    //     // Runs after each worker session ends
    // },
    //
    // onComplete: async function (exitCode, config, capabilities, results) {
    //     // Runs once after all workers finish
    // },
}
