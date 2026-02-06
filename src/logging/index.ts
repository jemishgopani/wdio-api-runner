/**
 * Request logging module for wdio-api-runner
 *
 * Provides HAR (HTTP Archive) 1.2 format logging for debugging API requests.
 *
 * @example On-demand recording
 * ```typescript
 * import { HarLogger, createLoggingInterceptors } from 'wdio-api-runner'
 *
 * const logger = new HarLogger()
 * const { requestInterceptor, responseInterceptor } = createLoggingInterceptors(logger)
 *
 * api.addRequestInterceptor(requestInterceptor)
 * api.addResponseInterceptor(responseInterceptor)
 *
 * // Start recording
 * logger.startRecording('my-test')
 *
 * // Make requests
 * await api.get('/users')
 * await api.post('/users', { name: 'John' })
 *
 * // Stop and save
 * const filePath = await logger.stopRecording()
 * // -> ./har-logs/my-test.har
 * ```
 *
 * @example Always-on logging
 * ```typescript
 * const logger = new HarLogger({
 *   enabled: true,
 *   outputPath: './test-logs'
 * })
 * ```
 */

// Core logger
export { HarLogger } from './HarLogger.js'

// Interceptors
export { createLoggingInterceptors, cleanupStaleRequests, getPendingRequestCount } from './LoggingInterceptors.js'

// HAR builder utilities
export {
    createHar,
    createHarEntry,
    createHarRequest,
    createHarResponse,
    headersToHarHeaders,
    parseQueryString,
    parseCookies,
    createPostData,
    truncateBody,
    maskSensitiveHeaders,
} from './HarBuilder.js'

// Types
export type {
    Har,
    HarLog,
    HarEntry,
    HarRequest,
    HarResponse,
    HarHeader,
    HarCookie,
    HarQueryParam,
    HarPostData,
    HarContent,
    HarTimings,
    HarCache,
    HarCreator,
    LoggingConfig,
    RequestLogger,
    PendingRequest,
} from './types.js'
