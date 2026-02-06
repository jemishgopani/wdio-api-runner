# WebdriverIO API Runner - Implementation Plan

## Overview

This document outlines the plan to create `@wdio/api-runner`, a custom WebdriverIO runner that bypasses browser session creation for pure API/backend automation testing.

---

## Problem Statement

Currently, WebdriverIO requires a browser session even for API-only tests, which causes:

- Unnecessary browser startup overhead (~2-5 seconds per worker)
- WebDriver/ChromeDriver installation requirements
- Higher memory consumption
- Slower CI/CD pipelines
- Complex infrastructure needs (Xvfb on Linux)

---

## Solution

Create a new runner package that:

1. Skips browser session creation entirely
2. Provides a stub/mock browser object for compatibility
3. Injects API testing utilities (fetch, request helpers)
4. Maintains full compatibility with WDIO hooks, reporters, and services

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        wdio.conf.js                             │
│                     runner: 'api'                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      @wdio/api-runner                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    ApiRunner (main)                      │   │
│  │  - Manages worker pool                                   │   │
│  │  - No Xvfb/display management needed                     │   │
│  │  - Spawns worker processes                               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Worker Process                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   ApiWorkerInstance                      │   │
│  │  - Uses @wdio/runner with modifications                  │   │
│  │  - Skips _initSession() call                             │   │
│  │  - Keeps ProtocolStub as browser object                  │   │
│  │  - Injects API client globally                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Test Execution                               │
│  - Mocha/Jasmine/Cucumber frameworks work normally              │
│  - Hooks execute (beforeSession, before, after, afterSession)   │
│  - Reporters receive events                                     │
│  - API tests run without browser overhead                       │
└─────────────────────────────────────────────────────────────────┘
```

### Component Diagram

```
@wdio/api-runner/
├── src/
│   ├── index.ts           # Main ApiRunner class (entry point)
│   ├── worker.ts          # ApiWorkerInstance - manages child process
│   ├── run.ts             # Worker process entry point
│   ├── apiRunner.ts       # Modified runner that skips browser
│   ├── stubBrowser.ts     # Enhanced ProtocolStub for API testing
│   ├── apiClient.ts       # Global API client utilities
│   ├── constants.ts       # Configuration constants
│   ├── types.ts           # TypeScript type definitions
│   └── utils.ts           # Helper utilities
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
├── tsconfig.json
└── README.md
```

---

## Detailed Implementation Plan

### Phase 1: Core Runner Structure

#### 1.1 Package Setup

**File: `package.json`**

```json
{
  "name": "@wdio/api-runner",
  "version": "1.0.0",
  "description": "A WebdriverIO runner for API automation testing without browser sessions",
  "author": "WebdriverIO Team",
  "license": "MIT",
  "type": "module",
  "types": "./build/index.d.ts",
  "exports": {
    ".": {
      "types": "./build/index.d.ts",
      "import": "./build/index.js"
    },
    "./run": {
      "import": "./build/run.js"
    }
  },
  "dependencies": {
    "@wdio/config": "workspace:*",
    "@wdio/logger": "workspace:*",
    "@wdio/runner": "workspace:*",
    "@wdio/types": "workspace:*",
    "@wdio/utils": "workspace:*",
    "split2": "^4.1.0",
    "stream-buffers": "^3.0.2"
  },
  "devDependencies": {
    "@types/node": "^20.1.0"
  }
}
```

#### 1.2 Main Runner Class

**File: `src/index.ts`**

```typescript
import { fork, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import url from 'node:url'

import logger from '@wdio/logger'
import { WritableStreamBuffer } from 'stream-buffers'
import type { Workers } from '@wdio/types'

import ApiWorkerInstance from './worker.js'
import { SHUTDOWN_TIMEOUT, BUFFER_OPTIONS } from './constants.js'
import type { ApiRunnerOptions, RunArgs } from './types.js'

const log = logger('@wdio/api-runner')

export default class ApiRunner {
    workerPool: Record<string, ApiWorkerInstance> = {}
    stdout = new WritableStreamBuffer(BUFFER_OPTIONS)
    stderr = new WritableStreamBuffer(BUFFER_OPTIONS)

    constructor(
        private options: ApiRunnerOptions,
        protected config: WebdriverIO.Config
    ) {
        log.info('Initializing API Runner - browser sessions will be skipped')
    }

    async initialize(): Promise<void> {
        // No browser/Xvfb initialization needed
        log.info('API Runner ready')
    }

    getWorkerCount(): number {
        return Object.keys(this.workerPool).length
    }

    async run({ command, args, ...workerOptions }: RunArgs): Promise<ApiWorkerInstance> {
        const workerCnt = this.getWorkerCount()

        // Adjust max listeners for stdout/stderr
        if (workerCnt >= process.stdout.getMaxListeners() - 2) {
            process.stdout.setMaxListeners(workerCnt + 2)
            process.stderr.setMaxListeners(workerCnt + 2)
        }

        const worker = new ApiWorkerInstance(
            this.config,
            workerOptions,
            this.stdout,
            this.stderr,
            this.options
        )

        this.workerPool[workerOptions.cid] = worker
        await worker.postMessage(command, args)
        return worker
    }

    async shutdown(): Promise<boolean> {
        log.info('Shutting down API Runner workers')

        for (const [cid, worker] of Object.entries(this.workerPool)) {
            if (!worker.isBusy) {
                delete this.workerPool[cid]
                continue
            }
            await worker.postMessage('endSession', {})
        }

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                // Force kill remaining workers
                for (const [cid, worker] of Object.entries(this.workerPool)) {
                    if (worker.isBusy && !worker.isKilled) {
                        log.warn(`Worker ${cid} did not shut down, force killing`)
                        worker.kill('SIGKILL')
                    }
                }
                resolve(false)
            }, SHUTDOWN_TIMEOUT)

            const interval = setInterval(() => {
                const busyWorkers = Object.values(this.workerPool)
                    .filter(w => w.isBusy).length

                if (busyWorkers === 0) {
                    clearTimeout(timeout)
                    clearInterval(interval)
                    resolve(true)
                }
            }, 250)
        })
    }
}
```

#### 1.3 Worker Instance

**File: `src/worker.ts`**

```typescript
import { fork, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import url from 'node:url'

import logger from '@wdio/logger'
import type { WritableStreamBuffer } from 'stream-buffers'
import type { Workers } from '@wdio/types'

import type { ApiRunnerOptions } from './types.js'

const log = logger('@wdio/api-runner')
const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

export default class ApiWorkerInstance extends EventEmitter implements Workers.Worker {
    cid: string
    config: WebdriverIO.Config
    configFile: string
    caps: WebdriverIO.Capabilities
    capabilities: WebdriverIO.Capabilities
    specs: string[]
    execArgv: string[]
    retries: number
    stdout: WritableStreamBuffer
    stderr: WritableStreamBuffer
    childProcess?: ChildProcess

    isBusy = false
    isKilled = false
    isReady: Promise<boolean>
    isSetup: Promise<boolean>
    isReadyResolver: (value: boolean) => void = () => {}
    isSetupResolver: (value: boolean) => void = () => {}

    constructor(
        config: WebdriverIO.Config,
        { cid, configFile, caps, specs, execArgv, retries }: Workers.WorkerRunPayload,
        stdout: WritableStreamBuffer,
        stderr: WritableStreamBuffer,
        private apiOptions: ApiRunnerOptions
    ) {
        super()
        this.cid = cid
        this.config = config
        this.configFile = configFile
        this.caps = caps
        this.capabilities = caps
        this.specs = specs
        this.execArgv = execArgv
        this.retries = retries
        this.stdout = stdout
        this.stderr = stderr

        this.isReady = new Promise((resolve) => { this.isReadyResolver = resolve })
        this.isSetup = new Promise((resolve) => { this.isSetupResolver = resolve })
    }

    async startProcess(): Promise<ChildProcess> {
        const { cid, execArgv } = this
        const argv = process.argv.slice(2)

        const runnerEnv = {
            ...process.env,
            ...this.config.runnerEnv,
            WDIO_WORKER_ID: cid,
            WDIO_API_RUNNER: 'true',  // Flag to indicate API-only mode
            NODE_ENV: process.env.NODE_ENV || 'test',
            NODE_OPTIONS: '--enable-source-maps'
        }

        // Pass API runner options to worker
        if (this.apiOptions) {
            runnerEnv.WDIO_API_OPTIONS = JSON.stringify(this.apiOptions)
        }

        log.info(`Starting API worker ${cid}`)

        const childProcess = this.childProcess = fork(
            path.join(__dirname, 'run.js'),
            argv,
            {
                cwd: process.cwd(),
                env: runnerEnv,
                execArgv,
                stdio: ['inherit', 'pipe', 'pipe', 'ipc']
            }
        )

        childProcess.on('message', this._handleMessage.bind(this))
        childProcess.on('error', this._handleError.bind(this))
        childProcess.on('exit', this._handleExit.bind(this))

        return childProcess
    }

    private _handleMessage(payload: Workers.WorkerMessage): void {
        if (payload.name === 'finishedCommand') {
            this.isBusy = false
        }
        if (payload.name === 'ready') {
            this.isReadyResolver(true)
        }
        if (payload.name === 'sessionStarted') {
            this.isSetupResolver(true)
        }
        this.emit('message', { ...payload, cid: this.cid })
    }

    private _handleError(error: Error): void {
        this.emit('error', { ...error, cid: this.cid })
    }

    private _handleExit(exitCode: number): void {
        delete this.childProcess
        this.isBusy = false
        this.isKilled = true
        log.debug(`API Worker ${this.cid} exited with code ${exitCode}`)
        this.emit('exit', { cid: this.cid, exitCode, specs: this.specs, retries: this.retries })
    }

    kill(signal: NodeJS.Signals = 'SIGTERM'): void {
        if (!this.childProcess) return

        log.info(`Killing API worker ${this.cid} with ${signal}`)
        try {
            this.childProcess.kill(signal)
        } catch (err) {
            log.warn(`Failed to kill worker ${this.cid}:`, err)
        }
        delete this.childProcess
        this.isBusy = false
        this.isKilled = true
    }

    async postMessage(command: string, args: Workers.WorkerMessageArgs): Promise<void> {
        const { cid, configFile, capabilities, specs, retries, isBusy } = this

        if (isBusy && !['workerRequest', 'endSession'].includes(command)) {
            return log.info(`Worker ${cid} is busy`)
        }

        if (!this.childProcess) {
            this.childProcess = await this.startProcess()
        }

        const cmd: Workers.WorkerCommand = {
            cid, command, configFile, args,
            caps: capabilities, specs, retries
        }

        this.isReady.then(() => {
            this.childProcess!.send(cmd)
        })
        this.isBusy = true
    }
}
```

---

### Phase 2: API Runner (Modified @wdio/runner)

#### 2.1 Worker Entry Point

**File: `src/run.ts`**

```typescript
import logger from '@wdio/logger'
import type { Workers } from '@wdio/types'

import ApiTestRunner from './apiRunner.js'

const log = logger('@wdio/api-runner')

// Send ready signal
if (typeof process.send === 'function') {
    process.send({
        name: 'ready',
        origin: 'worker'
    } as Workers.WorkerMessage)
}

const runner = new ApiTestRunner()

runner.on('exit', (code = 0) => process.exit(code))
runner.on('error', ({ name, message, stack }) => {
    process.send!({
        origin: 'worker',
        name: 'error',
        content: { name, message, stack }
    })
})

process.on('message', async (m: Workers.WorkerCommand) => {
    if (!m?.command || typeof runner[m.command] !== 'function') {
        return
    }

    log.info(`Running API worker command: ${m.command}`)

    try {
        const result = await runner[m.command](m)
        process.send!({
            origin: 'worker',
            name: 'finishedCommand',
            content: { command: m.command, result }
        })
    } catch (error: any) {
        log.error(`Failed: ${error.stack}`)
        process.exit(1)
    }
})

process.once('SIGINT', () => process.exit(130))
```

#### 2.2 API Test Runner (Core - Skips Browser)

**File: `src/apiRunner.ts`**

```typescript
import { EventEmitter } from 'node:events'

import logger from '@wdio/logger'
import { initializeWorkerService, initializePlugin, executeHooksWithArgs } from '@wdio/utils'
import { ConfigParser } from '@wdio/config/node'
import { _setGlobal } from '@wdio/globals'
import type { Options, Capabilities } from '@wdio/types'

import { createStubBrowser } from './stubBrowser.js'
import { createApiClient } from './apiClient.js'
import BaseReporter from './reporter.js'
import type { RunParams, TestFramework } from './types.js'

const log = logger('@wdio/api-runner')

export default class ApiTestRunner extends EventEmitter {
    private _configParser?: ConfigParser
    private _config?: WebdriverIO.Config
    private _reporter?: BaseReporter
    private _framework?: TestFramework
    private _cid?: string
    private _specs?: string[]
    private _caps?: Capabilities.RequestedStandaloneCapabilities

    async run({ cid, args, specs, caps, configFile, retries }: RunParams) {
        this._cid = cid
        this._specs = specs
        this._caps = caps

        // Parse config
        this._configParser = new ConfigParser(configFile, args)
        try {
            await this._configParser.initialize(args)
        } catch (err: any) {
            log.error(`Failed to read config: ${err.stack}`)
            return this._shutdown(1, retries)
        }

        this._config = this._configParser.getConfig()
        logger.setLogLevelsConfig(this._config.logLevels, this._config.logLevel)

        // Initialize worker services
        const services = await initializeWorkerService(
            this._config,
            this._caps as WebdriverIO.Capabilities,
            args.ignoredWorkerServices
        )
        services.forEach(s => this._configParser!.addService(s))

        // Execute beforeSession hook (NO browser needed)
        await executeHooksWithArgs(
            'beforeSession',
            this._config.beforeSession,
            [this._config, this._caps, this._specs, this._cid]
        )

        // Initialize reporter
        this._reporter = new BaseReporter(this._config, this._cid!, { ...this._caps })
        await this._reporter.initReporters()

        // Initialize test framework
        this._framework = await this._initFramework(cid, this._config, this._caps!, this._reporter, specs)

        if (!this._framework.hasTests()) {
            return this._shutdown(0, retries)
        }

        // CREATE STUB BROWSER (NOT REAL BROWSER!)
        const stubBrowser = createStubBrowser(this._config, this._caps!)
        _setGlobal('browser', stubBrowser, this._config.injectGlobals)
        _setGlobal('driver', stubBrowser, this._config.injectGlobals)

        // Inject API client globally
        const apiClient = createApiClient(this._config)
        _setGlobal('api', apiClient, this._config.injectGlobals)

        // Notify session started (with stub info)
        process.send!({
            origin: 'worker',
            name: 'sessionStarted',
            content: {
                sessionId: `api-${cid}`,
                isW3C: false,
                isApi: true,
                capabilities: this._caps
            }
        })

        // Reporter start event
        this._reporter.emit('runner:start', {
            cid,
            specs,
            config: this._config,
            isMultiremote: false,
            capabilities: this._caps,
            sessionId: `api-${cid}`
        } as Options.RunnerStart)

        // Execute before hook (with stub browser)
        await executeHooksWithArgs(
            'before',
            this._config.before,
            [this._caps, this._specs, stubBrowser]
        )

        // RUN TESTS
        let failures = 0
        try {
            failures = await this._framework.run()
        } catch (err: any) {
            log.error(err)
            failures = 1
        }

        // Execute after hook
        await executeHooksWithArgs(
            'after',
            this._config.after,
            [failures, this._caps, this._specs]
        )

        return this._shutdown(failures, retries)
    }

    private async _initFramework(
        cid: string,
        config: WebdriverIO.Config,
        capabilities: Capabilities.RequestedStandaloneCapabilities,
        reporter: BaseReporter,
        specs: string[]
    ): Promise<TestFramework> {
        const framework = (await initializePlugin(
            config.framework as string,
            'framework'
        )).default as unknown as TestFramework

        return framework.init(cid, config, specs, capabilities, reporter)
    }

    private async _shutdown(failures: number, retries: number): Promise<number> {
        // Execute afterSession hook
        await executeHooksWithArgs(
            'afterSession',
            this._config!.afterSession,
            [this._config!, this._caps!, this._specs!]
        )

        this._reporter?.emit('runner:end', {
            failures,
            cid: this._cid,
            retries
        } as Options.RunnerEnd)

        await this._reporter?.waitForSync()
        this.emit('exit', failures === 0 ? 0 : 1)
        return failures
    }

    async endSession(): Promise<void> {
        // No browser session to end
        process.send!({
            origin: 'worker',
            name: 'sessionEnded',
            cid: this._cid
        })
    }
}
```

---

### Phase 3: Stub Browser & API Client

#### 3.1 Stub Browser

**File: `src/stubBrowser.ts`**

```typescript
import { EventEmitter } from 'node:events'
import type { Capabilities } from '@wdio/types'

export interface StubBrowser extends EventEmitter {
    sessionId: string
    capabilities: WebdriverIO.Capabilities
    options: WebdriverIO.Config
    isApi: boolean

    // Stub methods that throw helpful errors
    $: (selector: string) => never
    $$: (selector: string) => never
    url: (url: string) => never
    getUrl: () => never
    execute: <T>(script: string | Function) => never
}

export function createStubBrowser(
    config: WebdriverIO.Config,
    caps: Capabilities.RequestedStandaloneCapabilities
): StubBrowser {
    const emitter = new EventEmitter()

    const browserError = (method: string) => {
        throw new Error(
            `browser.${method}() is not available in API-only mode. ` +
            `Use the 'api' global for HTTP requests or switch to 'local' runner for browser tests.`
        )
    }

    const stubBrowser: StubBrowser = Object.assign(emitter, {
        sessionId: `api-stub-${Date.now()}`,
        capabilities: caps as WebdriverIO.Capabilities,
        options: config,
        isApi: true,

        // Commonly used browser methods - throw helpful errors
        $: (selector: string) => browserError('$'),
        $$: (selector: string) => browserError('$$'),
        url: (url: string) => browserError('url'),
        getUrl: () => browserError('getUrl'),
        execute: () => browserError('execute'),
        executeAsync: () => browserError('executeAsync'),
        click: () => browserError('click'),
        setValue: () => browserError('setValue'),
        getText: () => browserError('getText'),
        waitForExist: () => browserError('waitForExist'),
        waitForDisplayed: () => browserError('waitForDisplayed'),

        // Methods that can work in stub mode
        pause: async (ms: number) => new Promise(r => setTimeout(r, ms)),
        call: async <T>(fn: () => T) => fn(),
    })

    return stubBrowser
}
```

#### 3.2 API Client

**File: `src/apiClient.ts`**

```typescript
export interface ApiClientOptions {
    baseUrl?: string
    timeout?: number
    headers?: Record<string, string>
}

export interface ApiResponse<T = any> {
    status: number
    statusText: string
    headers: Headers
    data: T
    ok: boolean
}

export interface ApiClient {
    get: <T = any>(url: string, options?: RequestInit) => Promise<ApiResponse<T>>
    post: <T = any>(url: string, body?: any, options?: RequestInit) => Promise<ApiResponse<T>>
    put: <T = any>(url: string, body?: any, options?: RequestInit) => Promise<ApiResponse<T>>
    patch: <T = any>(url: string, body?: any, options?: RequestInit) => Promise<ApiResponse<T>>
    delete: <T = any>(url: string, options?: RequestInit) => Promise<ApiResponse<T>>
    request: <T = any>(url: string, options?: RequestInit) => Promise<ApiResponse<T>>
    setBaseUrl: (url: string) => void
    setHeader: (key: string, value: string) => void
    setHeaders: (headers: Record<string, string>) => void
}

export function createApiClient(config: WebdriverIO.Config): ApiClient {
    // Get API options from config or environment
    const apiOptions: ApiClientOptions = process.env.WDIO_API_OPTIONS
        ? JSON.parse(process.env.WDIO_API_OPTIONS)
        : {}

    let baseUrl = apiOptions.baseUrl || config.baseUrl || ''
    let defaultHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...apiOptions.headers
    }
    const timeout = apiOptions.timeout || 30000

    async function request<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
        const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        try {
            const response = await fetch(fullUrl, {
                ...options,
                headers: { ...defaultHeaders, ...options.headers },
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            let data: T
            const contentType = response.headers.get('content-type')

            if (contentType?.includes('application/json')) {
                data = await response.json()
            } else {
                data = await response.text() as unknown as T
            }

            return {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                data,
                ok: response.ok
            }
        } catch (error: any) {
            clearTimeout(timeoutId)
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms: ${fullUrl}`)
            }
            throw error
        }
    }

    return {
        get: <T>(url: string, options?: RequestInit) =>
            request<T>(url, { ...options, method: 'GET' }),

        post: <T>(url: string, body?: any, options?: RequestInit) =>
            request<T>(url, {
                ...options,
                method: 'POST',
                body: body ? JSON.stringify(body) : undefined
            }),

        put: <T>(url: string, body?: any, options?: RequestInit) =>
            request<T>(url, {
                ...options,
                method: 'PUT',
                body: body ? JSON.stringify(body) : undefined
            }),

        patch: <T>(url: string, body?: any, options?: RequestInit) =>
            request<T>(url, {
                ...options,
                method: 'PATCH',
                body: body ? JSON.stringify(body) : undefined
            }),

        delete: <T>(url: string, options?: RequestInit) =>
            request<T>(url, { ...options, method: 'DELETE' }),

        request,

        setBaseUrl: (url: string) => { baseUrl = url },
        setHeader: (key: string, value: string) => { defaultHeaders[key] = value },
        setHeaders: (headers: Record<string, string>) => {
            defaultHeaders = { ...defaultHeaders, ...headers }
        }
    }
}
```

---

### Phase 4: Type Definitions

**File: `src/types.ts`**

```typescript
import type { Workers, Options, Capabilities } from '@wdio/types'

export interface ApiRunnerOptions {
    /**
     * Base URL for API requests
     */
    baseUrl?: string

    /**
     * Default timeout for API requests (ms)
     * @default 30000
     */
    timeout?: number

    /**
     * Default headers for API requests
     */
    headers?: Record<string, string>

    /**
     * Enable request/response logging
     * @default false
     */
    verbose?: boolean
}

export interface RunArgs extends Workers.WorkerRunPayload {
    command: string
    args: Workers.WorkerMessageArgs
    cid: string
}

export interface RunParams {
    cid: string
    args: any
    specs: string[]
    caps: Capabilities.RequestedStandaloneCapabilities
    configFile: string
    retries: number
}

export interface TestFramework {
    init: (
        cid: string,
        config: WebdriverIO.Config,
        specs: string[],
        capabilities: Capabilities.RequestedStandaloneCapabilities,
        reporter: any
    ) => Promise<TestFramework>
    hasTests: () => boolean
    run: () => Promise<number>
}

// Extend WebdriverIO namespace
declare global {
    namespace WebdriverIO {
        interface Config {
            /**
             * API Runner specific options
             */
            apiRunner?: ApiRunnerOptions
        }
    }

    /**
     * Global API client available in tests
     */
    var api: import('./apiClient.js').ApiClient
}
```

---

### Phase 5: Constants & Utilities

**File: `src/constants.ts`**

```typescript
export const SHUTDOWN_TIMEOUT = 5000

export const BUFFER_OPTIONS = {
    initialSize: 100 * 1024,      // 100KB
    incrementAmount: 100 * 1024   // 100KB
}
```

---

## Usage Examples

### Basic Configuration

**wdio.conf.ts**

```typescript
export const config: WebdriverIO.Config = {
    runner: 'api',

    specs: ['./test/api/**/*.spec.ts'],

    // No browser capabilities needed
    capabilities: [{}],

    framework: 'mocha',
    mochaOpts: {
        timeout: 60000
    },

    // API runner options
    apiRunner: {
        baseUrl: 'https://api.example.com',
        timeout: 30000,
        headers: {
            'Authorization': 'Bearer token123'
        }
    },

    reporters: ['spec'],

    // Hooks work normally
    beforeSession: async () => {
        console.log('Setting up API test session')
    },

    before: async () => {
        // Set up test data, auth tokens, etc.
    }
}
```

### API Test Example

**test/api/users.spec.ts**

```typescript
describe('Users API', () => {
    describe('GET /users', () => {
        it('should return list of users', async () => {
            const response = await api.get('/users')

            expect(response.ok).toBe(true)
            expect(response.status).toBe(200)
            expect(response.data).toBeInstanceOf(Array)
        })

        it('should filter users by status', async () => {
            const response = await api.get('/users?status=active')

            expect(response.data.every(u => u.status === 'active')).toBe(true)
        })
    })

    describe('POST /users', () => {
        it('should create a new user', async () => {
            const newUser = {
                name: 'John Doe',
                email: 'john@example.com'
            }

            const response = await api.post('/users', newUser)

            expect(response.status).toBe(201)
            expect(response.data.id).toBeDefined()
            expect(response.data.name).toBe(newUser.name)
        })

        it('should validate required fields', async () => {
            const response = await api.post('/users', {})

            expect(response.status).toBe(400)
            expect(response.data.errors).toBeDefined()
        })
    })

    describe('Authentication', () => {
        it('should set auth header dynamically', async () => {
            api.setHeader('Authorization', 'Bearer new-token')

            const response = await api.get('/protected-resource')

            expect(response.ok).toBe(true)
        })
    })
})
```

### Mixed Testing (API + Browser)

For projects that need both API and browser tests:

**wdio.api.conf.ts** (API tests)
```typescript
export const config = {
    runner: 'api',
    specs: ['./test/api/**/*.spec.ts'],
    capabilities: [{}]
}
```

**wdio.e2e.conf.ts** (Browser tests)
```typescript
export const config = {
    runner: 'local',
    specs: ['./test/e2e/**/*.spec.ts'],
    capabilities: [{ browserName: 'chrome' }]
}
```

**package.json**
```json
{
    "scripts": {
        "test:api": "wdio run wdio.api.conf.ts",
        "test:e2e": "wdio run wdio.e2e.conf.ts",
        "test": "npm run test:api && npm run test:e2e"
    }
}
```

---

## Implementation Phases & Timeline

| Phase | Description | Deliverables |
|-------|-------------|--------------|
| **Phase 1** | Core Runner Structure | `index.ts`, `worker.ts`, `constants.ts`, `types.ts` |
| **Phase 2** | API Test Runner | `run.ts`, `apiRunner.ts` |
| **Phase 3** | Stub Browser & API Client | `stubBrowser.ts`, `apiClient.ts` |
| **Phase 4** | Testing & Documentation | Unit tests, integration tests, README |
| **Phase 5** | Integration | PR to main repo, documentation updates |

---

## Benefits Summary

| Metric | Local Runner | API Runner | Improvement |
|--------|--------------|------------|-------------|
| Startup time | ~3-5s per worker | ~0.1s per worker | **30-50x faster** |
| Memory usage | ~200MB per browser | ~50MB per worker | **4x less memory** |
| Dependencies | ChromeDriver, browser | None | **Simpler setup** |
| CI requirements | Display/Xvfb | None | **Easier CI/CD** |

---

## Open Questions

1. Should we support GraphQL client out of the box?
2. Should we integrate with popular API testing libraries (supertest, axios)?
3. Should we provide request/response mocking utilities?
4. Should we support WebSocket testing?
5. How should we handle authentication flows (OAuth, JWT refresh)?

---

## References

- WebdriverIO Runner Interface: `packages/wdio-types/src/Services.ts`
- Local Runner Implementation: `packages/wdio-local-runner/src/index.ts`
- Plugin Loading: `packages/wdio-utils/src/initializePlugin.ts`
- Protocol Stub: `packages/webdriverio/src/protocol-stub.ts`
