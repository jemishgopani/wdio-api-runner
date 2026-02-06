# WebdriverIO API Runner - Logging Implementation Guide

## Overview

This document explains how logging works in the WebdriverIO local runner and how to implement the same logging capabilities in the API runner.

---

## Logging Architecture in Local Runner

### Component Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MAIN PROCESS                                       │
│                                                                              │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐    │
│  │  WritableStream  │     │  WritableStream  │     │   logsAggregator │    │
│  │     Buffer       │     │     Buffer       │     │     string[]     │    │
│  │    (stdout)      │     │    (stderr)      │     │  (grouped logs)  │    │
│  └────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘    │
│           │                        │                        │               │
│           ▼                        ▼                        ▼               │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         RunnerStream                                  │  │
│  │              (Transform stream → process.stdout/stderr)               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    ▲                                        │
│                                    │ pipe                                   │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                           WORKER PROCESS                                     │
│                                    │                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    runnerTransformStream                              │  │
│  │         (Prefixes each line with [cid], filters debug messages)       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    ▲                                        │
│                                    │ pipe                                   │
│  ┌─────────────────────┐     ┌─────────────────────┐                       │
│  │  childProcess       │     │  childProcess       │                       │
│  │     .stdout         │     │     .stderr         │                       │
│  └─────────────────────┘     └─────────────────────┘                       │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      @wdio/logger                                     │  │
│  │  - Colored output (chalk)                                             │  │
│  │  - Log levels (trace, debug, info, warn, error)                       │  │
│  │  - File logging (WDIO_LOG_PATH)                                       │  │
│  │  - Masking sensitive data                                             │  │
│  │  - Progress indicator                                                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. @wdio/logger (`packages/wdio-logger/src/index.ts`)

The core logging utility used throughout WebdriverIO.

#### Features:
- **Log Levels**: `trace`, `debug`, `info`, `warn`, `error`, `progress`
- **Colored Output**: Uses `chalk` for terminal colors
- **File Logging**: Writes to file when `WDIO_LOG_PATH` is set
- **Masking**: Can mask sensitive data (passwords, tokens)
- **Prefix Format**: `timestamp level name: message`

#### Usage:

```typescript
import logger from '@wdio/logger'

const log = logger('@wdio/api-runner')

log.trace('Very detailed info')      // cyan
log.debug('Debug information')       // green
log.info('General information')      // cyanBright
log.warn('Warning message')          // yellow
log.error('Error occurred')          // red
log.progress('Processing...')        // magenta (overwrites line)
```

#### Log Output Format:

```
2024-01-15T10:30:45.123Z INFO @wdio/api-runner: Starting API test
2024-01-15T10:30:45.456Z DEBUG @wdio/api-runner: Request sent to /users
2024-01-15T10:30:45.789Z ERROR @wdio/api-runner: Connection failed
```

---

### 2. Transform Stream (`packages/wdio-local-runner/src/transformStream.ts`)

Transforms child process output by:
1. Splitting lines using `split2`
2. Filtering out debugger messages
3. Prefixing each line with worker ID `[cid]`
4. Optionally collecting logs in aggregator array

#### Source Code:

```typescript
import split from 'split2'
import { Transform } from 'node:stream'

const DEBUGGER_MESSAGES = [
    'Debugger listening on',
    'Debugger attached',
    'Waiting for the debugger'
]

export default function runnerTransformStream(
    cid: string,
    inputStream: Readable,
    aggregator?: string[]
): Readable {
    return inputStream
        .pipe(split(/\r?\n/, line => `${line}\n`))  // Split by newlines
        .pipe(ignore(DEBUGGER_MESSAGES))             // Filter debugger msgs
        .pipe(map((line) => {
            const newLine = `[${cid}] ${line}`       // Prefix with [cid]
            aggregator?.push(newLine)                // Collect if aggregator provided
            return newLine
        }))
}

function ignore(patternsToIgnore: string[]) {
    return new Transform({
        decodeStrings: false,
        transform(chunk, encoding, next) {
            if (patternsToIgnore.some(m => chunk.startsWith(m))) {
                return next()  // Skip this chunk
            }
            return next(null, chunk)
        }
    })
}

function map(mapper: (line: Buffer) => string) {
    return new Transform({
        decodeStrings: false,
        transform(chunk, encoding, next) {
            return next(null, mapper(chunk))
        }
    })
}
```

---

### 3. Runner Stream (`packages/wdio-local-runner/src/stdStream.ts`)

A simple pass-through transform stream that pipes to process stdout/stderr.

```typescript
import { Transform } from 'node:stream'

export default class RunnerStream extends Transform {
    constructor() {
        super()
        // Remove auto-created listeners to prevent memory leaks
        this.on('pipe', () => {
            removeLastListener(this, 'close')
            removeLastListener(this, 'drain')
            removeLastListener(this, 'error')
            removeLastListener(this, 'finish')
            removeLastListener(this, 'unpipe')
        })
    }

    _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback) {
        callback(undefined, chunk)  // Pass through unchanged
    }

    _final(callback: (error?: Error) => void) {
        this.unpipe()
        callback()
    }
}
```

---

### 4. Worker Log Setup (`packages/wdio-local-runner/src/worker.ts`)

How the worker sets up logging streams:

```typescript
// Create global streams that pipe to main process stdout/stderr
const stdOutStream = new RunnerStream()
const stdErrStream = new RunnerStream()
stdOutStream.pipe(process.stdout)
stdErrStream.pipe(process.stderr)

// In startProcess():
async startProcess() {
    const runnerEnv = {
        ...process.env,
        WDIO_WORKER_ID: cid,
        NODE_ENV: process.env.NODE_ENV || 'test'
    }

    // Set up file logging path if outputDir configured
    if (this.config.outputDir) {
        let logFileRunner = `wdio-${cid}.log`
        if (this.specs.length && this.specs[0]) {
            const specBaseName = path.basename(this.specs[0], path.extname(this.specs[0]))
            logFileRunner = `${specBaseName}-${cid}.log`
        }
        runnerEnv.WDIO_LOG_PATH = path.join(this.config.outputDir, logFileRunner)
    }

    // Fork child process
    const childProcess = fork(runScript, argv, {
        cwd: process.cwd(),
        env: runnerEnv,
        stdio: ['inherit', 'pipe', 'pipe', 'ipc']
    })

    // Set up log streaming
    if (childProcess.stdout !== null) {
        if (this.config.groupLogsByTestSpec) {
            // Collect logs in array, print at end
            runnerTransformStream(cid, childProcess.stdout, this.logsAggregator)
        } else {
            // Stream logs in real-time
            runnerTransformStream(cid, childProcess.stdout).pipe(stdOutStream)
        }
    }

    if (childProcess.stderr !== null) {
        runnerTransformStream(cid, childProcess.stderr).pipe(stdErrStream)
    }
}
```

---

### 5. Grouped Logs Feature (`groupLogsByTestSpec`)

When enabled, logs are collected and printed after each worker completes.

#### Configuration:

```javascript
// wdio.conf.js
export const config = {
    groupLogsByTestSpec: true,  // Enable grouped logs
    // ...
}
```

#### How It Works (in launcher.ts):

```typescript
worker.on('exit', (code) => {
    if (!this.configParser.getConfig().groupLogsByTestSpec) {
        return
    }

    // Print header based on exit status
    if (code.exitCode === 0) {
        console.log(`\n***** List of steps of WorkerID=[${code.cid}] *****`)
    } else {
        console.log(`\n***** List of steps of WorkerID=[${code.cid}] that preceded the error above *****`)
    }

    // Print all collected logs
    worker.logsAggregator.forEach((logLine) => {
        console.log(logLine.replace(/\n$/, ''))
    })
})
```

#### Output Example:

```
***** List of steps of WorkerID=[0-0] *****
[0-0] 2024-01-15T10:30:45.123Z INFO @wdio/api-runner: Starting test
[0-0] 2024-01-15T10:30:45.456Z INFO @wdio/api-runner: GET /api/users
[0-0] 2024-01-15T10:30:45.789Z INFO @wdio/api-runner: Response: 200 OK
[0-0] 2024-01-15T10:30:46.123Z INFO @wdio/api-runner: Test passed

***** List of steps of WorkerID=[0-1] that preceded the error above *****
[0-1] 2024-01-15T10:30:45.200Z INFO @wdio/api-runner: Starting test
[0-1] 2024-01-15T10:30:45.500Z INFO @wdio/api-runner: POST /api/users
[0-1] 2024-01-15T10:30:45.800Z ERROR @wdio/api-runner: Response: 500 Internal Server Error
```

---

## Implementation for API Runner

### File Structure

```
@wdio/api-runner/
├── src/
│   ├── index.ts              # Main runner
│   ├── worker.ts             # Worker instance with logging
│   ├── run.ts                # Worker entry point
│   ├── transformStream.ts    # Log transformation (copy from local-runner)
│   ├── stdStream.ts          # Stream handler (copy from local-runner)
│   ├── constants.ts          # Include DEBUGGER_MESSAGES, BUFFER_OPTIONS
│   └── utils.ts              # Helper utilities
```

### 1. Constants (`src/constants.ts`)

```typescript
export const SHUTDOWN_TIMEOUT = 5000

export const DEBUGGER_MESSAGES = [
    'Debugger listening on',
    'Debugger attached',
    'Waiting for the debugger'
]

export const BUFFER_OPTIONS = {
    initialSize: 1000 * 1024,    // 1MB initial
    incrementAmount: 100 * 1024  // 100KB increments
}

// API-specific messages to filter (optional)
export const API_RUNNER_FILTER_MESSAGES = [
    'ExperimentalWarning',
    'DeprecationWarning'
]
```

### 2. Transform Stream (`src/transformStream.ts`)

```typescript
import split from 'split2'
import type { Readable, TransformCallback } from 'node:stream'
import { Transform } from 'node:stream'
import { DEBUGGER_MESSAGES, API_RUNNER_FILTER_MESSAGES } from './constants.js'

const MESSAGES_TO_FILTER = [...DEBUGGER_MESSAGES, ...API_RUNNER_FILTER_MESSAGES]

export default function runnerTransformStream(
    cid: string,
    inputStream: Readable,
    aggregator?: string[]
): Readable {
    return inputStream
        .pipe(split(/\r?\n/, line => `${line}\n`))
        .pipe(ignore(MESSAGES_TO_FILTER))
        .pipe(map((line) => {
            const newLine = `[${cid}] ${line}`
            aggregator?.push(newLine)
            return newLine
        }))
}

function ignore(patternsToIgnore: string[]) {
    return new Transform({
        decodeStrings: false,
        transform(chunk: string, encoding: BufferEncoding, next: TransformCallback) {
            if (patternsToIgnore.some(m => chunk.startsWith(m))) {
                return next()
            }
            return next(null, chunk)
        },
        final(next: TransformCallback) {
            this.unpipe()
            next()
        }
    })
}

function map(mapper: (line: string) => string) {
    return new Transform({
        decodeStrings: false,
        transform(chunk: string, encoding: BufferEncoding, next: TransformCallback) {
            return next(null, mapper(chunk))
        },
        final(next: TransformCallback) {
            this.unpipe()
            next()
        }
    })
}
```

### 3. Standard Stream (`src/stdStream.ts`)

```typescript
import type { TransformCallback } from 'node:stream'
import { Transform } from 'node:stream'

export function removeLastListener(target: Transform, eventName: string): void {
    const listener = target.listeners(eventName).reverse()[0] as () => void
    if (listener) {
        target.removeListener(eventName, listener)
    }
}

export default class RunnerStream extends Transform {
    constructor() {
        super()
        this.on('pipe', () => {
            removeLastListener(this, 'close')
            removeLastListener(this, 'drain')
            removeLastListener(this, 'error')
            removeLastListener(this, 'finish')
            removeLastListener(this, 'unpipe')
        })
    }

    _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
        callback(undefined, chunk)
    }

    _final(callback: (error?: Error) => void): void {
        this.unpipe()
        callback()
    }
}
```

### 4. Worker with Logging (`src/worker.ts`)

```typescript
import { fork, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import url from 'node:url'

import logger from '@wdio/logger'
import type { WritableStreamBuffer } from 'stream-buffers'
import type { Workers } from '@wdio/types'

import runnerTransformStream from './transformStream.js'
import RunnerStream from './stdStream.js'
import type { ApiRunnerOptions } from './types.js'

const log = logger('@wdio/api-runner')
const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

// Create global output streams
const stdOutStream = new RunnerStream()
const stdErrStream = new RunnerStream()
stdOutStream.pipe(process.stdout)
stdErrStream.pipe(process.stderr)

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

    // Log aggregator for groupLogsByTestSpec feature
    logsAggregator: string[] = []

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

        // Set up environment variables
        const runnerEnv: NodeJS.ProcessEnv = {
            ...process.env,
            ...this.config.runnerEnv,
            WDIO_WORKER_ID: cid,
            WDIO_API_RUNNER: 'true',
            NODE_ENV: process.env.NODE_ENV || 'test',
            NODE_OPTIONS: '--enable-source-maps'
        }

        // Set up file logging if outputDir is configured
        if (this.config.outputDir) {
            let logFileName = `wdio-api-${cid}.log`

            // Use spec file name in log file name if available
            if (this.specs.length && this.specs[0]) {
                const specBaseName = path.basename(this.specs[0], path.extname(this.specs[0]))
                logFileName = `${specBaseName}-${cid}.log`
            }

            runnerEnv.WDIO_LOG_PATH = path.join(this.config.outputDir, logFileName)
            log.debug(`Log file path: ${runnerEnv.WDIO_LOG_PATH}`)
        }

        // Pass API runner options to worker process
        if (this.apiOptions) {
            runnerEnv.WDIO_API_OPTIONS = JSON.stringify(this.apiOptions)
        }

        // Propagate NODE_OPTIONS from parent process
        if (process.env.NODE_OPTIONS) {
            runnerEnv.NODE_OPTIONS = `${process.env.NODE_OPTIONS} ${runnerEnv.NODE_OPTIONS || ''}`
        }

        log.info(`Starting API worker ${cid} with specs: ${this.specs.join(', ')}`)

        // Fork child process
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

        // Set up event handlers
        childProcess.on('message', this._handleMessage.bind(this))
        childProcess.on('error', this._handleError.bind(this))
        childProcess.on('exit', this._handleExit.bind(this))

        // Set up log streaming
        if (childProcess.stdout !== null) {
            if (this.config.groupLogsByTestSpec) {
                // Collect logs in aggregator, print when worker exits
                log.debug(`Worker ${cid}: Collecting logs for grouped output`)
                runnerTransformStream(cid, childProcess.stdout, this.logsAggregator)
            } else {
                // Stream logs in real-time
                runnerTransformStream(cid, childProcess.stdout).pipe(stdOutStream)
            }
        }

        if (childProcess.stderr !== null) {
            // Always stream stderr in real-time (errors should be visible immediately)
            runnerTransformStream(cid, childProcess.stderr).pipe(stdErrStream)
        }

        return childProcess
    }

    private _handleMessage(payload: Workers.WorkerMessage): void {
        const { cid } = this

        if (payload.name === 'finishedCommand') {
            this.isBusy = false
        }

        if (payload.name === 'ready') {
            log.debug(`Worker ${cid} is ready`)
            this.isReadyResolver(true)
        }

        if (payload.name === 'sessionStarted') {
            log.debug(`Worker ${cid} session started`)
            this.isSetupResolver(true)
        }

        this.emit('message', { ...payload, cid })
    }

    private _handleError(error: Error): void {
        log.error(`Worker ${this.cid} error: ${error.message}`)
        this.emit('error', { ...error, cid: this.cid })
    }

    private _handleExit(exitCode: number): void {
        const { cid, specs, retries } = this

        delete this.childProcess
        this.isBusy = false
        this.isKilled = true

        log.debug(`Worker ${cid} exited with code ${exitCode}`)
        this.emit('exit', { cid, exitCode, specs, retries })
    }

    kill(signal: NodeJS.Signals = 'SIGTERM'): void {
        if (!this.childProcess) {
            log.debug(`Worker ${this.cid} has no child process to kill`)
            return
        }

        log.info(`Killing worker ${this.cid} with ${signal}`)
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
            log.info(`Worker ${cid} is busy, cannot accept command: ${command}`)
            return
        }

        if (!this.childProcess) {
            this.childProcess = await this.startProcess()
        }

        const cmd: Workers.WorkerCommand = {
            cid,
            command,
            configFile,
            args,
            caps: capabilities,
            specs,
            retries
        }

        log.debug(`Sending command '${command}' to worker ${cid}`)

        this.isReady.then(() => {
            this.childProcess!.send(cmd)
        })

        this.isBusy = true
    }
}
```

### 5. Main Runner with Logging (`src/index.ts`)

```typescript
import logger from '@wdio/logger'
import { WritableStreamBuffer } from 'stream-buffers'
import type { Workers } from '@wdio/types'

import ApiWorkerInstance from './worker.js'
import { SHUTDOWN_TIMEOUT, BUFFER_OPTIONS } from './constants.js'
import type { ApiRunnerOptions, RunArgs } from './types.js'

const log = logger('@wdio/api-runner')

// Messages for grouped logs output
const WORKER_GROUPLOGS_MESSAGES = {
    normalExit: (cid: string) => `\n***** API Test Logs for WorkerID=[${cid}] *****`,
    exitWithError: (cid: string) => `\n***** API Test Logs for WorkerID=[${cid}] (FAILED) *****`
}

export default class ApiRunner {
    workerPool: Record<string, ApiWorkerInstance> = {}
    stdout = new WritableStreamBuffer(BUFFER_OPTIONS)
    stderr = new WritableStreamBuffer(BUFFER_OPTIONS)

    constructor(
        private options: ApiRunnerOptions,
        protected config: WebdriverIO.Config
    ) {
        log.info('Initializing API Runner')
        log.debug('API Runner options:', JSON.stringify(options))
    }

    async initialize(): Promise<void> {
        log.info('API Runner initialized - no browser sessions will be created')
    }

    getWorkerCount(): number {
        return Object.keys(this.workerPool).length
    }

    async run({ command, args, ...workerOptions }: RunArgs): Promise<ApiWorkerInstance> {
        const workerCnt = this.getWorkerCount()
        log.debug(`Current worker count: ${workerCnt}`)

        // Adjust max listeners
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

        // Set up grouped logs handler
        worker.on('exit', (exitInfo: { cid: string; exitCode: number }) => {
            if (this.config.groupLogsByTestSpec) {
                this._printGroupedLogs(worker, exitInfo.exitCode)
            }
        })

        await worker.postMessage(command, args)
        return worker
    }

    /**
     * Print collected logs when worker exits (groupLogsByTestSpec mode)
     */
    private _printGroupedLogs(worker: ApiWorkerInstance, exitCode: number): void {
        const header = exitCode === 0
            ? WORKER_GROUPLOGS_MESSAGES.normalExit(worker.cid)
            : WORKER_GROUPLOGS_MESSAGES.exitWithError(worker.cid)

        console.log(header)

        worker.logsAggregator.forEach((logLine) => {
            console.log(logLine.replace(/\n$/, ''))
        })

        // Add separator for readability
        console.log('')
    }

    async shutdown(): Promise<boolean> {
        log.info('Shutting down API Runner')
        log.debug(`Workers to shutdown: ${Object.keys(this.workerPool).length}`)

        for (const [cid, worker] of Object.entries(this.workerPool)) {
            if (!worker.isBusy) {
                delete this.workerPool[cid]
                continue
            }
            await worker.postMessage('endSession', {})
        }

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                for (const [cid, worker] of Object.entries(this.workerPool)) {
                    if (worker.isBusy && !worker.isKilled) {
                        log.warn(`Worker ${cid} did not shut down gracefully, force killing`)
                        worker.kill('SIGKILL')
                    }
                }
                resolve(false)
            }, SHUTDOWN_TIMEOUT)

            const interval = setInterval(() => {
                const busyWorkers = Object.values(this.workerPool).filter(w => w.isBusy).length
                log.debug(`Waiting for ${busyWorkers} workers to shut down`)

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
```

---

## Log Level Configuration

### Available Log Levels

| Level | Color | Usage |
|-------|-------|-------|
| `trace` | cyan | Very detailed debugging |
| `debug` | green | Debug information |
| `info` | cyanBright | General information |
| `warn` | yellow | Warnings |
| `error` | red | Errors |
| `progress` | magenta | Progress indicators (overwrites line) |

### Configuration in wdio.conf.js

```javascript
export const config = {
    // Global log level
    logLevel: 'info',

    // Per-package log levels
    logLevels: {
        '@wdio/api-runner': 'debug',
        '@wdio/cli': 'warn',
        'webdriver': 'silent'
    },

    // Output directory for log files
    outputDir: './logs',

    // Group logs by spec file
    groupLogsByTestSpec: true,

    // Mask sensitive data in logs
    maskingPatterns: [
        'Bearer [^\\s]+',           // Auth tokens
        'password=[^&]+',           // Passwords in URLs
        '"apiKey":"[^"]+"'          // API keys in JSON
    ]
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `WDIO_LOG_LEVEL` | Override global log level |
| `WDIO_LOG_PATH` | Path to log file |
| `WDIO_DEBUG` | Enable trace logging |
| `WDIO_LOG_MASKING_PATTERNS` | Comma-separated masking patterns |

---

## API-Specific Logging

### Request/Response Logging

Add custom logging for API requests in your API client:

```typescript
// src/apiClient.ts
import logger from '@wdio/logger'

const log = logger('@wdio/api-runner:client')

export async function request<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`
    const method = options.method || 'GET'

    // Log request
    log.info(`${method} ${fullUrl}`)
    if (options.body) {
        log.debug('Request body:', options.body)
    }

    const startTime = Date.now()

    try {
        const response = await fetch(fullUrl, options)
        const duration = Date.now() - startTime

        // Log response
        log.info(`${method} ${fullUrl} - ${response.status} (${duration}ms)`)

        if (!response.ok) {
            log.warn(`Request failed: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        log.debug('Response body:', JSON.stringify(data).substring(0, 500))

        return { status: response.status, data, ok: response.ok }
    } catch (error) {
        log.error(`Request failed: ${error.message}`)
        throw error
    }
}
```

### Output Example

```
[0-0] 2024-01-15T10:30:45.123Z INFO @wdio/api-runner: Starting API test suite
[0-0] 2024-01-15T10:30:45.200Z INFO @wdio/api-runner:client: GET https://api.example.com/users
[0-0] 2024-01-15T10:30:45.456Z INFO @wdio/api-runner:client: GET https://api.example.com/users - 200 (256ms)
[0-0] 2024-01-15T10:30:45.457Z DEBUG @wdio/api-runner:client: Response body: [{"id":1,"name":"John"},{"id":2,"name":"Jane"}]
[0-0] 2024-01-15T10:30:45.500Z INFO @wdio/api-runner:client: POST https://api.example.com/users
[0-0] 2024-01-15T10:30:45.501Z DEBUG @wdio/api-runner:client: Request body: {"name":"Bob"}
[0-0] 2024-01-15T10:30:45.700Z INFO @wdio/api-runner:client: POST https://api.example.com/users - 201 (199ms)
[0-0] 2024-01-15T10:30:45.750Z INFO @wdio/api-runner: Test suite completed - 2 passed, 0 failed
```

---

## Dependencies

Add these to your `package.json`:

```json
{
    "dependencies": {
        "@wdio/logger": "workspace:*",
        "@wdio/types": "workspace:*",
        "split2": "^4.1.0",
        "stream-buffers": "^3.0.2"
    },
    "devDependencies": {
        "@types/stream-buffers": "^3.0.4"
    }
}
```

---

## Summary

| Feature | Implementation |
|---------|----------------|
| **Logger** | Use `@wdio/logger` - same as local runner |
| **Stream Transform** | Copy `transformStream.ts` - adds `[cid]` prefix |
| **Stream Handler** | Copy `stdStream.ts` - pipes to stdout/stderr |
| **File Logging** | Set `WDIO_LOG_PATH` env var in worker |
| **Grouped Logs** | Collect in `logsAggregator[]`, print on exit |
| **Log Levels** | Configure via `logLevel` and `logLevels` in config |
| **Masking** | Configure via `maskingPatterns` in config |
