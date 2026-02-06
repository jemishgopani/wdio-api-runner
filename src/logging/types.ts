/**
 * HAR 1.2 Specification Types
 * @see http://www.softwareishard.com/blog/har-12-spec/
 */

/**
 * Root HAR object
 */
export interface Har {
    log: HarLog
}

/**
 * HAR Log object containing all entries
 */
export interface HarLog {
    /** Version of the HAR format (always '1.2') */
    version: '1.2'
    /** Information about the HAR creator application */
    creator: HarCreator
    /** Information about the browser (optional) */
    browser?: HarCreator
    /** List of pages (optional) */
    pages?: HarPage[]
    /** List of HTTP request/response entries */
    entries: HarEntry[]
    /** Comment (optional) */
    comment?: string
}

/**
 * Information about the HAR creator/browser
 */
export interface HarCreator {
    /** Name of the application */
    name: string
    /** Version of the application */
    version: string
    /** Comment (optional) */
    comment?: string
}

/**
 * Page information (optional)
 */
export interface HarPage {
    /** Unique page reference */
    id: string
    /** Start time of the page load */
    startedDateTime: string
    /** Page title */
    title: string
    /** Page timings */
    pageTimings: HarPageTimings
    /** Comment (optional) */
    comment?: string
}

/**
 * Page timing information
 */
export interface HarPageTimings {
    /** Content load time (DOMContentLoaded) */
    onContentLoad?: number
    /** Page load time */
    onLoad?: number
    /** Comment (optional) */
    comment?: string
}

/**
 * Single HTTP request/response entry
 */
export interface HarEntry {
    /** Reference to the page (optional) */
    pageref?: string
    /** Start time of the request (ISO 8601) */
    startedDateTime: string
    /** Total time for the request (ms) */
    time: number
    /** Request details */
    request: HarRequest
    /** Response details */
    response: HarResponse
    /** Cache information */
    cache: HarCache
    /** Timing information */
    timings: HarTimings
    /** Server IP address (optional) */
    serverIPAddress?: string
    /** Connection ID (optional) */
    connection?: string
    /** Comment (optional) */
    comment?: string
}

/**
 * HTTP request details
 */
export interface HarRequest {
    /** HTTP method */
    method: string
    /** Absolute URL */
    url: string
    /** HTTP version */
    httpVersion: string
    /** Cookies */
    cookies: HarCookie[]
    /** Headers */
    headers: HarHeader[]
    /** Query string parameters */
    queryString: HarQueryParam[]
    /** POST data (optional) */
    postData?: HarPostData
    /** Size of headers (bytes), -1 if unknown */
    headersSize: number
    /** Size of body (bytes), -1 if unknown */
    bodySize: number
    /** Comment (optional) */
    comment?: string
}

/**
 * HTTP response details
 */
export interface HarResponse {
    /** HTTP status code */
    status: number
    /** HTTP status text */
    statusText: string
    /** HTTP version */
    httpVersion: string
    /** Cookies */
    cookies: HarCookie[]
    /** Headers */
    headers: HarHeader[]
    /** Response content */
    content: HarContent
    /** Redirect URL (empty if no redirect) */
    redirectURL: string
    /** Size of headers (bytes), -1 if unknown */
    headersSize: number
    /** Size of body (bytes), -1 if unknown */
    bodySize: number
    /** Comment (optional) */
    comment?: string
}

/**
 * Cookie information
 */
export interface HarCookie {
    /** Cookie name */
    name: string
    /** Cookie value */
    value: string
    /** Cookie path (optional) */
    path?: string
    /** Cookie domain (optional) */
    domain?: string
    /** Expiration date (optional) */
    expires?: string
    /** HTTP only flag (optional) */
    httpOnly?: boolean
    /** Secure flag (optional) */
    secure?: boolean
    /** Comment (optional) */
    comment?: string
}

/**
 * Header information
 */
export interface HarHeader {
    /** Header name */
    name: string
    /** Header value */
    value: string
    /** Comment (optional) */
    comment?: string
}

/**
 * Query string parameter
 */
export interface HarQueryParam {
    /** Parameter name */
    name: string
    /** Parameter value */
    value: string
    /** Comment (optional) */
    comment?: string
}

/**
 * POST data information
 */
export interface HarPostData {
    /** MIME type */
    mimeType: string
    /** Plain text body (optional) */
    text?: string
    /** Form parameters (optional) */
    params?: HarParam[]
    /** Comment (optional) */
    comment?: string
}

/**
 * Form parameter
 */
export interface HarParam {
    /** Parameter name */
    name: string
    /** Parameter value (optional) */
    value?: string
    /** File name (optional) */
    fileName?: string
    /** Content type (optional) */
    contentType?: string
    /** Comment (optional) */
    comment?: string
}

/**
 * Response content
 */
export interface HarContent {
    /** Size of the response body (bytes) */
    size: number
    /** Number of bytes saved by compression (optional) */
    compression?: number
    /** MIME type */
    mimeType: string
    /** Response body text (optional) */
    text?: string
    /** Encoding (e.g., 'base64') (optional) */
    encoding?: string
    /** Comment (optional) */
    comment?: string
}

/**
 * Cache information
 */
export interface HarCache {
    /** Cache state before request (optional) */
    beforeRequest?: HarCacheState | null
    /** Cache state after request (optional) */
    afterRequest?: HarCacheState | null
    /** Comment (optional) */
    comment?: string
}

/**
 * Cache state
 */
export interface HarCacheState {
    /** Expiration time (optional) */
    expires?: string
    /** Last access time */
    lastAccess: string
    /** ETag */
    eTag: string
    /** Hit count */
    hitCount: number
    /** Comment (optional) */
    comment?: string
}

/**
 * Timing information for a request
 */
export interface HarTimings {
    /** Time spent in queue (optional, -1 if unknown) */
    blocked?: number
    /** DNS resolution time (optional, -1 if unknown) */
    dns?: number
    /** Time to establish connection (optional, -1 if unknown) */
    connect?: number
    /** Time to send the request */
    send: number
    /** Time waiting for response */
    wait: number
    /** Time to receive response */
    receive: number
    /** SSL/TLS negotiation time (optional, -1 if unknown) */
    ssl?: number
    /** Comment (optional) */
    comment?: string
}

/**
 * Logging configuration options
 */
export interface LoggingConfig {
    /**
     * Enable always-on logging
     * @default false
     */
    enabled?: boolean

    /**
     * Output directory path for HAR files
     * @default './har-logs'
     */
    outputPath?: string

    /**
     * Include request bodies in the log
     * @default true
     */
    includeRequestBody?: boolean

    /**
     * Include response bodies in the log
     * @default true
     */
    includeResponseBody?: boolean

    /**
     * Maximum body size to capture (bytes)
     * Bodies larger than this will be truncated
     * @default 1048576 (1MB)
     */
    maxBodySize?: number

    /**
     * Automatically name HAR files based on test name
     * @default false
     */
    attachToTest?: boolean
}

/**
 * Request logger control interface
 */
export interface RequestLogger {
    /**
     * Start recording HTTP requests
     * @param filename - Optional filename for the HAR file (without extension)
     */
    startRecording(filename?: string): void

    /**
     * Stop recording and save HAR file
     * @returns Path to the saved HAR file
     */
    stopRecording(): Promise<string>

    /**
     * Get the current HAR data without stopping recording
     */
    getHar(): Har

    /**
     * Clear all recorded entries
     */
    clear(): void

    /**
     * Check if recording is currently active
     */
    isRecording(): boolean

    /**
     * Get the number of recorded entries
     */
    getEntryCount(): number
}

/**
 * Internal request data for building HAR entries
 */
export interface PendingRequest {
    url: string
    method: string
    headers: Headers
    body?: string
    startTime: number
}
