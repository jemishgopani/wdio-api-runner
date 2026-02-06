import path from 'node:path'
import { EventEmitter } from 'node:events'

import logger from '@wdio/logger'
import DotReporter from '@wdio/dot-reporter'
import { initializePlugin } from '@wdio/utils'
import type { Options, Capabilities, Reporters } from '@wdio/types'

const log = logger('wdio-api-runner:reporter')

// Default reporter sync settings
const DEFAULT_REPORTER_SYNC_INTERVAL = 100
const DEFAULT_REPORTER_SYNC_TIMEOUT = 5000

interface ReporterPayload {
    cid?: string
    specs?: string[]
    uid?: string
    file?: string
    title?: string
    fullTitle?: string
    error?: Error | { message: string; stack?: string }
    sessionId?: string
    config?: unknown
    isMultiremote?: boolean
    capabilities?: unknown
    retry?: number
    failures?: number
    retries?: number
    duration?: number
    state?: string
    parent?: string
    [key: string]: unknown
}

interface ReporterMessage {
    origin: string
    name: string
    content: unknown
}

/**
 * BaseReporter manages test reporters for the API runner.
 * It initializes configured reporters, forwards events from the test framework,
 * and handles sync/async reporter coordination.
 */
export default class BaseReporter extends EventEmitter {
    private _reporters: Reporters.ReporterInstance[] = []
    private _listeners: ((ev: ReporterMessage) => void)[] = []

    constructor(
        private _config: Options.Testrunner,
        private _cid: string,
        public caps: Capabilities.RequestedStandaloneCapabilities
    ) {
        super()

        // Default to dot reporter if none specified
        this._config.reporters = this._config.reporters || []
        if (this._config.reporters.length === 0) {
            this._config.reporters.push([DotReporter as unknown as Reporters.ReporterClass, {}])
        }

        // Set default sync settings
        this._config.reporterSyncInterval = this._config.reporterSyncInterval || DEFAULT_REPORTER_SYNC_INTERVAL
        this._config.reporterSyncTimeout = this._config.reporterSyncTimeout || DEFAULT_REPORTER_SYNC_TIMEOUT
    }

    /**
     * Initialize all configured reporters
     */
    async initReporters(): Promise<void> {
        log.debug(`Initializing ${this._config.reporters!.length} reporter(s)`)

        const reporterPromises = this._config.reporters!.map((reporter) => this._loadReporter(reporter))

        this._reporters = await Promise.all(reporterPromises)

        const reporterNames = this._reporters.map((r) => r.constructor.name).join(', ')
        log.info(`Initialized reporters: ${reporterNames}`)
    }

    /**
     * Emit events to all registered reporters
     */
    emit(event: string, payload: ReporterPayload): boolean {
        // Always add cid to payload
        payload.cid = this._cid

        // Send failure messages to parent process for display
        const isTestError = event === 'test:fail'
        const isHookError = event === 'hook:end' && payload.error

        if (isTestError || isHookError) {
            this.#emitData({
                origin: 'reporter',
                name: 'printFailureMessage',
                content: payload,
            })
        }

        // Forward to all reporters
        for (const reporter of this._reporters) {
            try {
                reporter.emit(event, payload)
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err))
                log.error(`Reporter ${reporter.constructor.name} error: ${error.message}`)

                // Send reporter error to parent process
                this.#emitData({
                    origin: 'reporter',
                    name: 'printFailureMessage',
                    content: {
                        cid: this._cid,
                        error: { message: error.message, stack: error.stack },
                        fullTitle: `reporter ${reporter.constructor.name}`,
                    },
                })
            }
        }

        // Also emit on EventEmitter for internal listeners
        return super.emit(event, payload)
    }

    /**
     * Add listener for reporter messages (used in standalone mode)
     */
    onMessage(listener: (ev: ReporterMessage) => void): void {
        this._listeners.push(listener)
    }

    /**
     * Get log file path for a reporter
     */
    getLogFile(name: string): string | undefined {
        const options = { ...this._config } as Options.Testrunner & {
            cid: string
            capabilities: Capabilities.RequestedStandaloneCapabilities
        }

        let filename = `wdio-${this._cid}-${name}-reporter.log`

        // Check for custom file format in reporter options
        const reporterConfig = this._config.reporters!.find((reporter) => {
            if (Array.isArray(reporter)) {
                const [reporterRef] = reporter
                return reporterRef === name || (typeof reporterRef === 'function' && reporterRef.name === name)
            }
            return false
        })

        if (reporterConfig && Array.isArray(reporterConfig)) {
            const [, reporterOptions] = reporterConfig
            const fileformat = (reporterOptions as { outputFileFormat?: (opts: unknown) => string })?.outputFileFormat

            options.cid = this._cid
            options.capabilities = this.caps
            Object.assign(options, reporterOptions)

            if (fileformat && typeof fileformat === 'function') {
                filename = fileformat(options)
            }
        }

        if (!options.outputDir) {
            return undefined
        }

        return path.join(options.outputDir, filename)
    }

    /**
     * Create write stream object for reporter output
     * This allows reporters to write output that gets sent to parent process
     */
    getWriteStreamObject(reporter: string) {
        return {
            write: (content: unknown) =>
                this.#emitData({
                    origin: 'reporter',
                    name: reporter,
                    content,
                }),
        }
    }

    /**
     * Emit data to parent process or local listeners
     */
    #emitData(payload: ReporterMessage): boolean {
        // Send to parent process if available (worker mode)
        if (typeof process.send === 'function') {
            return process.send(payload)
        }

        // Otherwise notify local listeners (standalone mode)
        for (const listener of this._listeners) {
            listener(payload)
        }
        return true
    }

    /**
     * Wait for all async reporters to complete syncing
     */
    async waitForSync(): Promise<boolean> {
        const startTime = Date.now()
        const syncInterval = this._config.reporterSyncInterval!
        const syncTimeout = this._config.reporterSyncTimeout!

        return new Promise((resolve) => {
            const interval = setInterval(() => {
                const unsyncedReporters = this._reporters
                    .filter((reporter) => !reporter.isSynchronised)
                    .map((reporter) => reporter.constructor.name)

                // Check for timeout
                const elapsed = Date.now() - startTime
                if (elapsed > syncTimeout && unsyncedReporters.length > 0) {
                    clearInterval(interval)
                    log.warn(`Reporter sync timeout after ${elapsed}ms. Unsynced: ${unsyncedReporters.join(', ')}`)
                    return resolve(false)
                }

                // All synced
                if (unsyncedReporters.length === 0) {
                    clearInterval(interval)
                    log.debug('All reporters synchronized')
                    return resolve(true)
                }

                log.debug(
                    `Waiting for ${unsyncedReporters.length} reporter(s) to sync: ${unsyncedReporters.join(', ')}`
                )
            }, syncInterval)
        })
    }

    /**
     * Get all reporter instances
     */
    getReporters(): Reporters.ReporterInstance[] {
        return this._reporters
    }

    /**
     * Load a reporter plugin
     */
    private async _loadReporter(reporter: Reporters.ReporterEntry): Promise<Reporters.ReporterInstance> {
        let ReporterClass: Reporters.ReporterClass
        let options: Partial<Reporters.Options> = {}

        // Extract options if array format [ReporterClass, options]
        if (Array.isArray(reporter)) {
            options = { ...options, ...reporter[1] }
            reporter = reporter[0]
        }

        // Reporter passed as class
        if (typeof reporter === 'function') {
            ReporterClass = reporter as Reporters.ReporterClass
            const reporterName = ReporterClass.name

            options.logFile = options.setLogFile
                ? options.setLogFile(this._cid, reporterName)
                : typeof options.logFile === 'string'
                  ? options.logFile
                  : this.getLogFile(reporterName)

            options.writeStream = this.getWriteStreamObject(reporterName)

            log.debug(`Loading reporter class: ${reporterName}`)
            return new ReporterClass(options)
        }

        // Reporter passed as string (npm package name)
        if (typeof reporter === 'string') {
            log.debug(`Loading reporter plugin: ${reporter}`)

            const plugin = await initializePlugin(reporter, 'reporter')
            ReporterClass = ((plugin as { default?: unknown }).default || plugin) as Reporters.ReporterClass

            options.logFile = options.setLogFile
                ? options.setLogFile(this._cid, reporter)
                : typeof options.logFile === 'string'
                  ? options.logFile
                  : this.getLogFile(reporter)

            options.writeStream = this.getWriteStreamObject(reporter)

            return new ReporterClass(options)
        }

        throw new Error(`Invalid reporter config: ${typeof reporter}`)
    }
}
