import logger from '@wdio/logger'
import { WritableStreamBuffer } from 'stream-buffers'
import type { Workers } from '@wdio/types'

import ApiWorkerInstance from './worker/WorkerInstance.js'
import { SHUTDOWN_TIMEOUT, BUFFER_OPTIONS, WORKER_GROUPLOGS_MESSAGES } from './shared/constants.js'
import type { ApiRunnerOptions, RunArgs } from './shared/types.js'

const log = logger('wdio-api-runner')

/**
 * ApiRunner is the main runner class that manages worker processes
 * for API-only testing without browser sessions.
 *
 * Usage in wdio.conf.ts:
 * ```
 * export const config = {
 *     runner: 'api',
 *     // ... rest of config
 * }
 * ```
 */
export default class ApiRunner {
    workerPool: Record<string, ApiWorkerInstance> = {}
    stdout = new WritableStreamBuffer(BUFFER_OPTIONS)
    stderr = new WritableStreamBuffer(BUFFER_OPTIONS)

    constructor(
        private options: ApiRunnerOptions,
        protected config: WebdriverIO.Config
    ) {
        log.info('Initializing API Runner - browser sessions will be skipped')
        log.debug('API Runner options:', JSON.stringify(options))
    }

    /**
     * Initialize the runner
     * Unlike browser runners, no Xvfb or display setup is needed
     */
    async initialize(): Promise<void> {
        log.info('API Runner initialized and ready')
    }

    /**
     * Get the current number of workers
     */
    getWorkerCount(): number {
        return Object.keys(this.workerPool).length
    }

    /**
     * Run a test spec in a worker process
     */
    async run(runArgs: RunArgs): Promise<ApiWorkerInstance> {
        const { command, args, ...workerOptions } = runArgs
        const workerCnt = this.getWorkerCount()

        log.debug(`Current worker count: ${workerCnt}`)

        // Adjust max listeners for stdout/stderr to avoid warnings
        if (workerCnt >= process.stdout.getMaxListeners() - 2) {
            process.stdout.setMaxListeners(workerCnt + 2)
            process.stderr.setMaxListeners(workerCnt + 2)
        }

        log.info(`Creating worker ${workerOptions.cid} for specs: ${workerOptions.specs?.join(', ')}`)

        const worker = new ApiWorkerInstance(this.config, workerOptions, this.stdout, this.stderr, this.options)

        this.workerPool[workerOptions.cid] = worker

        // Forward worker events
        worker.on('message', (payload: Workers.WorkerMessage & { cid: string }) => {
            this._handleWorkerMessage(payload)
        })

        worker.on('exit', (payload: { cid: string; exitCode: number }) => {
            this._handleWorkerExit(worker, payload)
        })

        worker.on('error', (payload: { cid: string; message: string }) => {
            log.error(`Worker ${payload.cid} error: ${payload.message}`)
        })

        // Send the run command to the worker
        await worker.postMessage(command, args)

        return worker
    }

    /**
     * Handle messages from workers
     */
    private _handleWorkerMessage(payload: Workers.WorkerMessage & { cid: string }): void {
        const { name, cid } = payload
        log.debug(`Worker ${cid} message: ${name}`)
    }

    /**
     * Handle worker exit
     */
    private _handleWorkerExit(worker: ApiWorkerInstance, payload: { cid: string; exitCode: number }): void {
        const { cid, exitCode } = payload
        log.debug(`Worker ${cid} exited with code ${exitCode}`)

        // Print grouped logs if enabled
        if (this.config.groupLogsByTestSpec) {
            this._printGroupedLogs(worker, exitCode)
        }

        // Clean up worker from pool
        if (this.workerPool[cid]) {
            delete this.workerPool[cid]
        }
    }

    /**
     * Print collected logs when worker exits (groupLogsByTestSpec mode)
     */
    private _printGroupedLogs(worker: ApiWorkerInstance, exitCode: number): void {
        const header =
            exitCode === 0
                ? WORKER_GROUPLOGS_MESSAGES.normalExit(worker.cid)
                : WORKER_GROUPLOGS_MESSAGES.exitWithError(worker.cid)

        console.log(header)

        // Print each collected log line
        for (const logLine of worker.logsAggregator) {
            console.log(logLine.replace(/\n$/, ''))
        }

        // Add separator for readability
        console.log('')
    }

    /**
     * Gracefully shutdown all workers
     */
    async shutdown(): Promise<boolean> {
        log.info('Shutting down API Runner workers')
        log.debug(`Workers to shutdown: ${Object.keys(this.workerPool).length}`)

        const workers = Object.entries(this.workerPool)

        if (workers.length === 0) {
            log.info('No active workers to shut down')
            return true
        }

        // Send endSession to all busy workers
        for (const [cid, worker] of workers) {
            if (!worker.isBusy) {
                delete this.workerPool[cid]
                continue
            }
            log.info(`Sending endSession to worker ${cid}`)
            await worker.postMessage('endSession', {})
        }

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                // Force kill remaining workers
                for (const [cid, worker] of Object.entries(this.workerPool)) {
                    if (worker.isBusy && !worker.isKilled) {
                        log.warn(`Worker ${cid} did not shut down gracefully, force killing`)
                        worker.kill('SIGKILL')
                    }
                }
                resolve(false)
            }, SHUTDOWN_TIMEOUT)

            const interval = setInterval(() => {
                const busyWorkers = Object.values(this.workerPool).filter((w) => w.isBusy).length

                log.debug(`Waiting for ${busyWorkers} busy worker(s) to finish`)

                if (busyWorkers === 0) {
                    clearTimeout(timeout)
                    clearInterval(interval)
                    log.info('All workers shut down successfully')
                    resolve(true)
                }
            }, 250)
        })
    }
}

// Export types for consumers
export type {
    ApiRunnerOptions,
    ApiClient,
    ApiResponse,
    RequestOptions,
    CustomApiClient,
    ApiClientFactory,
} from './shared/types.js'
export { createApiClient } from './client/ApiClient.js'
export { createStubBrowser, type StubBrowser } from './browser/StubBrowser.js'

// Assertions library
export {
    assertResponse,
    ApiResponseAssertions,
    apiMatchers,
    validateSchema,
    formatSchemaErrors,
    AssertionError,
    type ApiAssertions,
    type JsonSchema,
    type SchemaValidationResult,
    type ApiResponseMatchers,
} from './assertions/index.js'

// Auth helpers
export {
    basicAuth,
    apiKeyAuth,
    bearerAuth,
    oauth2ClientCredentials,
    MemoryStorage,
    parseJwtExpiry,
    shouldExclude,
    encodeBasicAuth,
    isTokenExpired,
    mergeHeaders,
    type TokenStorage,
    type BasicAuthConfig,
    type ApiKeyAuthConfig,
    type BearerAuthConfig,
    type OAuth2Config,
    type OAuth2Token,
    type AuthInterceptor,
} from './auth/index.js'

// Request logging (HAR export)
export {
    HarLogger,
    createLoggingInterceptors,
    createHar,
    createHarEntry,
    headersToHarHeaders,
    parseQueryString,
    parseCookies,
    truncateBody,
    maskSensitiveHeaders,
    type Har,
    type HarLog,
    type HarEntry,
    type HarRequest,
    type HarResponse,
    type HarHeader,
    type HarTimings,
    type LoggingConfig,
    type RequestLogger,
} from './logging/index.js'

// GraphQL Client
export {
    // Core client
    createGraphQLClient,

    // Query builder
    createQueryBuilder,
    gql,
    graphql,

    // ApiClient extension
    extendWithGraphQL,
    createApiClientWithGraphQL,

    // Error classes
    GraphQLClientError,
    GraphQLNetworkError,
    GraphQLExecutionError,
    GraphQLSubscriptionError,
    GraphQLQueryBuilderError,

    // Subscriptions
    createSubscriptionManager,
    createWebSocketSubscription,
    createSSESubscription,

    // Types
    type GraphQLClient,
    type GraphQLOperation,
    type GraphQLVariables,
    type GraphQLResponse,
    type GraphQLResponseData,
    type GraphQLError,
    type GraphQLClientConfig,
    type GraphQLRequestOptions,
    type GraphQLRunnerOptions,
    type QueryBuilder,
    type GraphQLTagResult,
    type ExtendedApiClient,
    type Subscription,
    type SubscriptionManager,
    type SubscriptionCallbacks,
    type WebSocketSubscriptionConfig,
    type SSESubscriptionConfig,
} from './graphql/index.js'

// Performance Metrics
export {
    // Core collector
    createMetricsCollector,

    // Interceptors
    createMetricsInterceptors,
    createMetricEntry,

    // Calculator functions
    calculatePercentile,
    calculateStats,
    calculateStatsFromEntries,
    groupByEndpoint,
    groupByMethod,
    calculateEndpointMetrics,
    calculateMethodStats,
    getSlowestRequests,
    getFailedRequests,

    // Reporter utilities
    formatConsoleReport,
    formatSummaryLine,
    exportMetricsJson,
    createReportSummary,
    checkThresholds,

    // Constants
    DEFAULT_PERCENTILES,
    DEFAULT_SLOW_THRESHOLD,
    DEFAULT_MAX_ENTRIES,
    DEFAULT_METRICS_CONFIG,
    EMPTY_PERCENTILE_STATS,

    // Types
    type MetricEntry,
    type PercentileStats,
    type EndpointMetrics,
    type MetricsReport,
    type MetricsConfig,
    type MetricsCollector,
    type MetricsContext,
    type MetricsInterceptors,
} from './metrics/index.js'
