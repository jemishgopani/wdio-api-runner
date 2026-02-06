import { EventEmitter } from 'node:events'

import logger from '@wdio/logger'
import { initializeWorkerService, initializePlugin, executeHooksWithArgs } from '@wdio/utils'
import { ConfigParser } from '@wdio/config/node'
import { _setGlobal } from '@wdio/globals'
import type { Options, Capabilities, Workers } from '@wdio/types'

import { createStubBrowser } from '../browser/StubBrowser.js'
import { createApiClient } from '../client/ApiClient.js'
import BaseReporter from '../reporter/BaseReporter.js'
import type { RunParams, TestFramework } from '../shared/types.js'

const log = logger('wdio-api-runner:runner')

// Type for the _setGlobal function to accept 'api'
type SetGlobalFn = (name: string, value: unknown, injectGlobals?: boolean) => void

/**
 * ApiTestRunner is the core runner that executes tests without browser sessions.
 * It manages the test lifecycle, hooks, and reporter integration.
 */
export default class ApiTestRunner extends EventEmitter {
    private _configParser?: ConfigParser
    private _config?: WebdriverIO.Config
    private _reporter?: BaseReporter
    private _framework?: TestFramework
    private _cid?: string
    private _specs?: string[]
    private _caps?: Capabilities.RequestedStandaloneCapabilities;

    [key: string]: unknown

    /**
     * Main entry point - runs the test specs
     */
    async run(params: Workers.WorkerCommand): Promise<number> {
        const { cid, args, specs, caps, configFile, retries } = params as unknown as RunParams
        this._cid = cid
        this._specs = specs
        this._caps = caps

        log.info(`API Runner starting for worker ${cid}`)
        log.info(`Specs: ${specs.join(', ')}`)

        // Parse configuration
        this._configParser = new ConfigParser(configFile, args as Record<string, unknown>)
        try {
            await this._configParser.initialize(args as Record<string, unknown>)
        } catch (err: unknown) {
            const error = err as Error
            log.error(`Failed to read config: ${error.stack}`)
            return this._shutdown(1, retries, true)
        }

        const config = this._configParser.getConfig()
        this._config = config

        if (config.logLevels || config.logLevel) {
            logger.setLogLevelsConfig(config.logLevels, config.logLevel)
        }

        // Initialize worker services
        const ignoredWorkerServices = (args as Record<string, unknown>)?.ignoredWorkerServices as string[] | undefined
        try {
            const services = await initializeWorkerService(
                config,
                this._caps as WebdriverIO.Capabilities,
                ignoredWorkerServices
            )
            for (const service of services) {
                this._configParser.addService(service as Parameters<typeof this._configParser.addService>[0])
            }
        } catch (err: unknown) {
            const error = err as Error
            log.error(`Failed to initialize services: ${error.message}`)
        }

        // Execute beforeSession hook (NO browser session created)
        log.info('Executing beforeSession hook')
        await executeHooksWithArgs('beforeSession', config.beforeSession, [config, this._caps, this._specs, this._cid])

        // Initialize reporter (cast config to Options.Testrunner for reporter)
        this._reporter = new BaseReporter(config as Options.Testrunner, this._cid, {
            ...this._caps,
        } as Capabilities.RequestedStandaloneCapabilities)
        await this._reporter.initReporters()

        // Initialize test framework (mocha, jasmine, cucumber)
        try {
            this._framework = await this._initFramework(cid, config, this._caps!, this._reporter, specs)
        } catch (err: unknown) {
            const error = err as Error
            log.error(`Failed to initialize framework: ${error.message}`)
            return this._shutdown(1, retries, true)
        }

        // Check if there are any tests to run
        if (!this._framework.hasTests()) {
            log.warn('No tests found in specs')
            return this._shutdown(0, retries, false)
        }

        // CREATE STUB BROWSER (NOT A REAL BROWSER!)
        const stubBrowser = createStubBrowser(config, this._caps!)
        _setGlobal('browser', stubBrowser, config.injectGlobals)
        _setGlobal('driver', stubBrowser, config.injectGlobals)

        // Inject API client globally
        const apiRunnerConfig = config.apiRunner || {}
        const globalName = apiRunnerConfig.globalName || 'api'

        let apiClient: unknown

        if (apiRunnerConfig.client) {
            // Use provided custom client instance
            log.info(`Using custom API client (global: ${globalName})`)
            apiClient = apiRunnerConfig.client
        } else if (apiRunnerConfig.clientFactory) {
            // Use factory function to create client
            log.info(`Creating API client via factory (global: ${globalName})`)
            apiClient = await apiRunnerConfig.clientFactory(config)
        } else {
            // Use built-in fetch-based client
            log.info(`Using built-in API client (global: ${globalName})`)
            apiClient = createApiClient(config)
        }

        ;(_setGlobal as SetGlobalFn)(globalName, apiClient, config.injectGlobals)
        // Also set on globalThis for direct access
        ;(globalThis as Record<string, unknown>)[globalName] = apiClient

        // Always set 'api' as alias if using a different global name
        if (globalName !== 'api') {
            ;(_setGlobal as SetGlobalFn)('api', apiClient, config.injectGlobals)
            ;(globalThis as Record<string, unknown>).api = apiClient
        }

        // Notify that session has started (with stub info)
        const sessionId = `api-${cid}-${Date.now()}`
        if (process.send) {
            process.send({
                origin: 'worker',
                name: 'sessionStarted',
                content: {
                    sessionId,
                    isW3C: false,
                    isApi: true,
                    capabilities: this._caps,
                },
            })
        }

        // Emit runner:start event to reporters
        this._reporter.emit('runner:start', {
            cid,
            specs,
            config,
            isMultiremote: false,
            instanceOptions: {},
            capabilities: this._caps,
            sessionId,
            retry: retries,
        } as unknown as Parameters<typeof this._reporter.emit>[1])

        // Execute before hook (with stub browser)
        log.info('Executing before hook')
        await executeHooksWithArgs('before', config.before, [this._caps, this._specs, stubBrowser])

        // RUN THE TESTS
        log.info('Running tests...')
        let failures = 0
        try {
            failures = await this._framework.run()
            log.info(`Tests completed with ${failures} failure(s)`)
        } catch (err: unknown) {
            const error = err as Error
            log.error(`Test execution error: ${error.stack}`)
            failures = 1
        }

        // Execute after hook
        log.info('Executing after hook')
        await executeHooksWithArgs('after', config.after, [failures, this._caps, this._specs])

        return this._shutdown(failures, retries, false)
    }

    /**
     * Initialize the test framework (mocha, jasmine, cucumber)
     */
    private async _initFramework(
        cid: string,
        config: WebdriverIO.Config,
        capabilities: Capabilities.RequestedStandaloneCapabilities,
        reporter: BaseReporter,
        specs: string[]
    ): Promise<TestFramework> {
        const frameworkName = config.framework as string

        if (!frameworkName) {
            throw new Error(
                'No test framework specified in config. Set config.framework to "mocha", "jasmine", or "cucumber".'
            )
        }

        log.info(`Initializing ${frameworkName} framework`)

        const frameworkModule = (await initializePlugin(frameworkName, 'framework')) as {
            default?: unknown
            init?: (
                cid: string,
                config: WebdriverIO.Config,
                specs: string[],
                capabilities: Capabilities.RequestedStandaloneCapabilities,
                reporter: BaseReporter
            ) => Promise<TestFramework>
        }

        // Handle different module export styles
        const FrameworkAdapter = frameworkModule.default || frameworkModule

        if (typeof (FrameworkAdapter as { init?: unknown }).init === 'function') {
            // Framework exports an init function
            return (
                FrameworkAdapter as {
                    init: (
                        cid: string,
                        config: WebdriverIO.Config,
                        specs: string[],
                        capabilities: Capabilities.RequestedStandaloneCapabilities,
                        reporter: BaseReporter
                    ) => Promise<TestFramework>
                }
            ).init(cid, config, specs, capabilities, reporter)
        } else if (typeof FrameworkAdapter === 'function') {
            // Framework exports a class
            const instance = new (FrameworkAdapter as new (
                cid: string,
                config: WebdriverIO.Config,
                specs: string[],
                capabilities: Capabilities.RequestedStandaloneCapabilities,
                reporter: BaseReporter
            ) => TestFramework)(cid, config, specs, capabilities, reporter)
            return instance
        }

        throw new Error(`Invalid framework adapter for '${frameworkName}'`)
    }

    /**
     * Shutdown the runner and clean up
     */
    private async _shutdown(failures: number, retries: number, earlyExit: boolean): Promise<number> {
        // Execute afterSession hook
        if (this._config && !earlyExit) {
            log.info('Executing afterSession hook')
            await executeHooksWithArgs('afterSession', this._config.afterSession, [
                this._config,
                this._caps!,
                this._specs!,
            ])
        }

        // Emit runner:end event to reporters
        if (this._reporter) {
            this._reporter.emit('runner:end', {
                failures,
                cid: this._cid,
                retries,
            } as unknown as Parameters<typeof this._reporter.emit>[1])

            // Wait for reporters to sync
            await this._reporter.waitForSync()
        }

        log.info(`API Runner finished with ${failures} failure(s)`)
        this.emit('exit', failures === 0 ? 0 : 1)
        return failures
    }

    /**
     * Handle endSession command
     */
    async endSession(): Promise<void> {
        log.info('Ending API runner session')
        // No browser session to end, just send notification
        if (process.send) {
            process.send({
                origin: 'worker',
                name: 'sessionEnded',
                content: { cid: this._cid },
            })
        }
    }

    /**
     * Handle workerRequest command (for custom communication)
     */
    async workerRequest(params: Workers.WorkerCommand): Promise<unknown> {
        const { args } = params
        log.debug('Received worker request:', args)
        // Handle custom worker requests if needed
        return { received: true }
    }
}
