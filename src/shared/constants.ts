/**
 * Timeout for graceful shutdown of workers (ms)
 */
export const SHUTDOWN_TIMEOUT = 5000

/**
 * Buffer options for stdout/stderr streams
 */
export const BUFFER_OPTIONS = {
    initialSize: 1000 * 1024, // 1MB initial
    incrementAmount: 100 * 1024, // 100KB increments
}

/**
 * Default timeout for API requests (ms)
 */
export const DEFAULT_API_TIMEOUT = 30000

/**
 * Default headers for API requests
 */
export const DEFAULT_HEADERS: Record<string, string> = {
    Accept: 'application/json',
}

/**
 * Messages to filter from worker output (debugger related)
 */
export const DEBUGGER_MESSAGES = ['Debugger listening on', 'Debugger attached', 'Waiting for the debugger']

/**
 * API runner specific messages to filter
 */
export const API_RUNNER_FILTER_MESSAGES = ['ExperimentalWarning', 'DeprecationWarning']

/**
 * Messages for grouped logs output
 */
export const WORKER_GROUPLOGS_MESSAGES = {
    normalExit: (cid: string) => `\n***** API Test Logs for WorkerID=[${cid}] *****`,
    exitWithError: (cid: string) => `\n***** API Test Logs for WorkerID=[${cid}] (FAILED) *****`,
}
