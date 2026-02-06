# WebdriverIO API Runner - Reporter Integration Guide

## Overview

This document explains how reporters work in WebdriverIO and how to integrate them into the API runner for proper test result reporting.

---

## Reporter Architecture

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TEST FRAMEWORK                                  │
│                         (Mocha/Jasmine/Cucumber)                            │
│                                                                              │
│   Emits events: suite:start, test:start, test:pass, test:fail, etc.        │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BaseReporter                                      │
│                    (packages/wdio-runner/src/reporter.ts)                   │
│                                                                              │
│   - Loads and initializes reporter plugins                                  │
│   - Receives events from framework                                          │
│   - Forwards events to all registered reporters                             │
│   - Handles sync/async reporter coordination                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
           ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
           │ Spec Reporter│  │ Dot Reporter │  │ Allure       │
           │              │  │              │  │ Reporter     │
           └──────────────┘  └──────────────┘  └──────────────┘
                    │                │                │
                    ▼                ▼                ▼
           ┌──────────────────────────────────────────────────┐
           │                 Output Streams                    │
           │   - Console (stdout)                              │
           │   - Log files                                     │
           │   - External services (Allure, ReportPortal)      │
           └──────────────────────────────────────────────────┘
```

---

## Core Components

### 1. BaseReporter (`packages/wdio-runner/src/reporter.ts`)

The BaseReporter is responsible for:
- Loading reporter plugins
- Receiving events from the test framework
- Forwarding events to all registered reporters
- Coordinating sync/async operations

```typescript
import path from 'node:path'
import logger from '@wdio/logger'
import DotReporter from '@wdio/dot-reporter'
import { initializePlugin } from '@wdio/utils'
import type { Options, Capabilities, Reporters } from '@wdio/types'

const log = logger('@wdio/runner')

export default class BaseReporter {
    private _reporters: Reporters.ReporterInstance[] = []
    private listeners: ((ev: unknown) => void)[] = []

    constructor(
        private _config: Options.Testrunner,
        private _cid: string,
        public caps: Capabilities.RequestedStandaloneCapabilities
    ) {
        // Default to dot reporter if none specified
        this._config.reporters = this._config.reporters || []
        if (this._config.reporters.length === 0) {
            this._config.reporters.push([DotReporter, {}])
        }
    }

    async initReporters() {
        this._reporters = await Promise.all(
            this._config.reporters!.map(this._loadReporter.bind(this))
        )
    }

    emit(e: string, payload: ReporterPayload) {
        payload.cid = this._cid

        // Handle failure messages
        if (e === 'test:fail' || (e === 'hook:end' && payload.error)) {
            this.#emitData({
                origin: 'reporter',
                name: 'printFailureMessage',
                content: payload
            })
        }

        // Forward to all reporters
        this._reporters.forEach((reporter) => {
            try {
                reporter.emit(e, payload)
            } catch (err) {
                // Log error but continue with other reporters
                log.error(`Reporter error: ${err.message}`)
            }
        })
    }

    async waitForSync() {
        // Wait for all async reporters to complete
        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                const unsyncedReporter = this._reporters
                    .filter((reporter) => !reporter.isSynchronised)
                    .map((reporter) => reporter.constructor.name)

                if (unsyncedReporter.length === 0) {
                    clearInterval(interval)
                    return resolve(true)
                }
            }, this._config.reporterSyncInterval)
        })
    }
}
```

### 2. WDIOReporter Base Class (`packages/wdio-reporter/src/index.ts`)

All reporters extend this base class which provides:
- Event handling infrastructure
- Stats tracking (suites, tests, hooks)
- Output stream management
- State management

#### Key Properties:

| Property | Type | Description |
|----------|------|-------------|
| `suites` | `Record<string, SuiteStats>` | All test suites |
| `tests` | `Record<string, TestStats>` | All tests |
| `hooks` | `Record<string, HookStats>` | All hooks |
| `counts` | `object` | Pass/fail/skip counts |
| `runnerStat` | `RunnerStats` | Runner information |
| `outputStream` | `WriteStream` | Output destination |

#### Lifecycle Events:

```typescript
// Runner lifecycle
onRunnerStart(runnerStats: RunnerStats) { }
onRunnerEnd(runnerStats: RunnerStats) { }

// Suite lifecycle
onSuiteStart(suiteStats: SuiteStats) { }
onSuiteEnd(suiteStats: SuiteStats) { }
onSuiteRetry(suiteStats: SuiteStats) { }

// Hook lifecycle
onHookStart(hookStats: HookStats) { }
onHookEnd(hookStats: HookStats) { }

// Test lifecycle
onTestStart(testStats: TestStats) { }
onTestPass(testStats: TestStats) { }
onTestFail(testStats: TestStats) { }
onTestSkip(testStats: TestStats) { }
onTestPending(testStats: TestStats) { }
onTestRetry(testStats: TestStats) { }
onTestEnd(testStats: TestStats) { }

// Command lifecycle (browser commands)
onBeforeCommand(commandArgs: BeforeCommandArgs) { }
onAfterCommand(commandArgs: AfterCommandArgs) { }

// Assertion lifecycle
onBeforeAssertion(assertionArgs: unknown) { }
onAfterAssertion(assertionArgs: unknown) { }
```

---

## Event Flow

### Event Types

| Event | Description | Payload |
|-------|-------------|---------|
| `runner:start` | Test run started | `RunnerStats` |
| `runner:end` | Test run completed | `RunnerStats` |
| `suite:start` | Suite started | `SuiteStats` |
| `suite:end` | Suite completed | `SuiteStats` |
| `suite:retry` | Suite being retried | `SuiteStats` |
| `hook:start` | Hook started | `HookStats` |
| `hook:end` | Hook completed | `HookStats` |
| `test:start` | Test started | `TestStats` |
| `test:pass` | Test passed | `TestStats` |
| `test:fail` | Test failed | `TestStats` |
| `test:skip` | Test skipped | `TestStats` |
| `test:pending` | Test pending | `TestStats` |
| `test:retry` | Test being retried | `TestStats` |
| `test:end` | Test completed | `TestStats` |
| `client:beforeCommand` | Before browser command | `CommandArgs` |
| `client:afterCommand` | After browser command | `CommandArgs` |

### Event Sequence

```
runner:start
├── suite:start (root)
│   ├── suite:start (describe block)
│   │   ├── hook:start (beforeEach)
│   │   ├── hook:end
│   │   ├── test:start
│   │   ├── test:pass | test:fail | test:skip
│   │   ├── test:end
│   │   ├── hook:start (afterEach)
│   │   └── hook:end
│   └── suite:end
└── suite:end (root)
runner:end
```

---

## Stats Classes

### RunnerStats

```typescript
class RunnerStats {
    cid: string                    // Worker ID (e.g., "0-0")
    capabilities: Capabilities     // Browser/API capabilities
    config: Options.Testrunner     // Test configuration
    specs: string[]                // Spec files being run
    sessionId: string              // Session identifier
    isMultiremote: boolean         // Multi-browser mode
    failures?: number              // Total failures
    retries?: number               // Retry count
    error?: string                 // Error message if failed
}
```

### SuiteStats

```typescript
class SuiteStats {
    uid: string                    // Unique identifier
    cid: string                    // Worker ID
    title: string                  // Suite title
    fullTitle: string              // Full title including parents
    file?: string                  // Spec file path
    tests: TestStats[]             // Tests in this suite
    hooks: HookStats[]             // Hooks in this suite
    suites: SuiteStats[]           // Nested suites
    hooksAndTests: (HookStats | TestStats)[]  // Ordered execution
}
```

### TestStats

```typescript
class TestStats {
    uid: string                    // Unique identifier
    cid: string                    // Worker ID
    title: string                  // Test title
    fullTitle: string              // Full title
    state: 'pending' | 'passed' | 'skipped' | 'failed'
    duration?: number              // Execution time (ms)
    output: Output[]               // Command outputs
    errors?: Error[]               // Test errors
    error?: Error                  // Primary error
    retries?: number               // Retry count
    parent: string                 // Parent suite title
}
```

### HookStats

```typescript
class HookStats {
    uid: string                    // Unique identifier
    cid: string                    // Worker ID
    title: string                  // Hook title (e.g., "before all")
    duration?: number              // Execution time (ms)
    errors?: Error[]               // Hook errors
    error?: Error                  // Primary error
    state?: string                 // Hook state
}
```

---

## Implementation for API Runner

### 1. BaseReporter for API Runner

**File: `src/reporter.ts`**

```typescript
import path from 'node:path'
import logger from '@wdio/logger'
import DotReporter from '@wdio/dot-reporter'
import { initializePlugin } from '@wdio/utils'
import type { Options, Capabilities, Reporters } from '@wdio/types'

const log = logger('@wdio/api-runner')

interface ReporterPayload {
    cid?: string
    specs?: string[]
    uid?: string
    file?: string
    title?: string
    error?: string
    sessionId?: string
    config?: unknown
    isMultiremote?: boolean
    capabilities?: unknown
    retry?: number
}

export default class BaseReporter {
    private _reporters: Reporters.ReporterInstance[] = []
    private listeners: ((ev: unknown) => void)[] = []

    constructor(
        private _config: Options.Testrunner,
        private _cid: string,
        public caps: Capabilities.RequestedStandaloneCapabilities
    ) {
        // Ensure at least one reporter (dot is default)
        this._config.reporters = this._config.reporters || []
        if (this._config.reporters.length === 0) {
            this._config.reporters.push([DotReporter, {}])
        }
    }

    async initReporters(): Promise<void> {
        log.debug(`Initializing ${this._config.reporters!.length} reporters`)
        this._reporters = await Promise.all(
            this._config.reporters!.map(this._loadReporter.bind(this))
        )
        log.info(`Initialized reporters: ${this._reporters.map(r => r.constructor.name).join(', ')}`)
    }

    /**
     * Emit events to all registered reporters
     */
    emit(e: string, payload: ReporterPayload): void {
        payload.cid = this._cid

        // Send failure messages to parent process
        const isTestError = e === 'test:fail'
        const isHookError = e === 'hook:end' && payload.error

        if (isTestError || isHookError) {
            this.#emitData({
                origin: 'reporter',
                name: 'printFailureMessage',
                content: payload
            })
        }

        // Forward to all reporters
        this._reporters.forEach((reporter) => {
            try {
                reporter.emit(e, payload)
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err))
                log.error(`Reporter ${reporter.constructor.name} error: ${error.message}`)

                // Send error to parent process
                this.#emitData({
                    origin: 'reporter',
                    name: 'printFailureMessage',
                    content: {
                        cid: this._cid,
                        error: { message: error.message, stack: error.stack },
                        fullTitle: `reporter ${reporter.constructor.name}`
                    }
                })
            }
        })
    }

    /**
     * Add listener for reporter events
     */
    onMessage(listener: (ev: unknown) => void): void {
        this.listeners.push(listener)
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
        const reporterOptions = this._config.reporters!.find((reporter) => (
            Array.isArray(reporter) &&
            (reporter[0] === name || (typeof reporter[0] === 'function' && reporter[0].name === name))
        ))

        if (reporterOptions && Array.isArray(reporterOptions)) {
            const fileformat = reporterOptions[1].outputFileFormat
            options.cid = this._cid
            options.capabilities = this.caps
            Object.assign(options, reporterOptions[1])

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
     * Create write stream for reporter output
     */
    getWriteStreamObject(reporter: string) {
        return {
            write: (content: unknown) => this.#emitData({
                origin: 'reporter',
                name: reporter,
                content
            })
        }
    }

    /**
     * Emit data to parent process or listeners
     */
    #emitData(payload: unknown): boolean {
        if (typeof process.send === 'function') {
            return process.send!(payload)
        }

        this.listeners.forEach((fn) => fn(payload))
        return true
    }

    /**
     * Wait for all async reporters to complete
     */
    async waitForSync(): Promise<boolean> {
        const startTime = Date.now()

        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                const unsyncedReporter = this._reporters
                    .filter((reporter) => !reporter.isSynchronised)
                    .map((reporter) => reporter.constructor.name)

                // Timeout check
                if ((Date.now() - startTime) > this._config.reporterSyncTimeout! && unsyncedReporter.length) {
                    clearInterval(interval)
                    return reject(new Error(`Reporters still unsynced: ${unsyncedReporter.join(', ')}`))
                }

                // All synced
                if (unsyncedReporter.length === 0) {
                    clearInterval(interval)
                    return resolve(true)
                }

                log.info(`Waiting for ${unsyncedReporter.length} reporters to sync`)
            }, this._config.reporterSyncInterval)
        })
    }

    /**
     * Load a reporter plugin
     */
    private async _loadReporter(reporter: Reporters.ReporterEntry): Promise<Reporters.ReporterInstance> {
        let ReporterClass: Reporters.ReporterClass
        let options: Partial<Reporters.Options> = {}

        // Extract options if array format
        if (Array.isArray(reporter)) {
            options = { ...options, ...reporter[1] }
            reporter = reporter[0]
        }

        // Reporter passed as class
        if (typeof reporter === 'function') {
            ReporterClass = reporter as Reporters.ReporterClass
            options.logFile = options.setLogFile
                ? options.setLogFile(this._cid, ReporterClass.name)
                : typeof options.logFile === 'string'
                    ? options.logFile
                    : this.getLogFile(ReporterClass.name)
            options.writeStream = this.getWriteStreamObject(ReporterClass.name)
            return new ReporterClass(options)
        }

        // Reporter passed as string (npm package name)
        if (typeof reporter === 'string') {
            ReporterClass = (await initializePlugin(reporter, 'reporter')).default as Reporters.ReporterClass
            options.logFile = options.setLogFile
                ? options.setLogFile(this._cid, reporter)
                : typeof options.logFile === 'string'
                    ? options.logFile
                    : this.getLogFile(reporter)
            options.writeStream = this.getWriteStreamObject(reporter)
            return new ReporterClass(options)
        }

        throw new Error('Invalid reporters config')
    }
}
```

### 2. Using Reporter in API Runner

**File: `src/apiRunner.ts`** (relevant sections)

```typescript
import BaseReporter from './reporter.js'
import type { Options } from '@wdio/types'

export default class ApiTestRunner extends EventEmitter {
    private _reporter?: BaseReporter

    async run({ cid, args, specs, caps, configFile, retries }: RunParams) {
        // ... config parsing ...

        // Initialize reporter
        this._reporter = new BaseReporter(this._config, cid, caps)
        await this._reporter.initReporters()

        // Emit runner:start event
        this._reporter.emit('runner:start', {
            cid,
            specs,
            config: this._config,
            isMultiremote: false,
            instanceOptions: {},
            sessionId: `api-${cid}`,
            capabilities: caps,
            retry: 0
        } as Options.RunnerStart)

        // Run framework (Mocha/Jasmine) - framework emits test events
        let failures = 0
        try {
            failures = await this._framework.run()
        } catch (err) {
            log.error(err)
            failures = 1
        }

        // Emit runner:end event
        this._reporter.emit('runner:end', {
            failures,
            cid,
            retries
        } as Options.RunnerEnd)

        // Wait for async reporters
        await this._reporter.waitForSync()

        return failures
    }
}
```

### 3. Emitting API-Specific Events

For API testing, you may want to emit custom events for request/response tracking:

```typescript
// In your API client or test hooks

// Before API request
this._reporter.emit('client:beforeCommand', {
    sessionId: `api-${cid}`,
    method: 'GET',
    endpoint: '/api/users',
    body: { limit: 10 }
})

// After API request
this._reporter.emit('client:afterCommand', {
    sessionId: `api-${cid}`,
    method: 'GET',
    endpoint: '/api/users',
    result: {
        status: 200,
        data: [{ id: 1, name: 'John' }]
    }
})
```

---

## Creating a Custom API Reporter

### Example: API Request Reporter

**File: `src/reporters/apiReporter.ts`**

```typescript
import WDIOReporter, { RunnerStats, SuiteStats, TestStats, HookStats } from '@wdio/reporter'

interface ApiReporterOptions {
    outputDir?: string
    logFile?: string
    stdout?: boolean
    showRequestDetails?: boolean
    showResponseDetails?: boolean
}

interface ApiRequestInfo {
    method: string
    endpoint: string
    status?: number
    duration?: number
    body?: unknown
    response?: unknown
}

export default class ApiReporter extends WDIOReporter {
    private _requests: ApiRequestInfo[] = []
    private _options: ApiReporterOptions

    constructor(options: ApiReporterOptions) {
        super({ stdout: true, ...options })
        this._options = options
    }

    onRunnerStart(runner: RunnerStats) {
        this.write('\n')
        this.write('╔══════════════════════════════════════════════════════════════╗\n')
        this.write('║                    API Test Run Started                       ║\n')
        this.write('╠══════════════════════════════════════════════════════════════╣\n')
        this.write(`║ Worker: ${runner.cid.padEnd(53)}║\n`)
        this.write(`║ Specs: ${runner.specs.length.toString().padEnd(54)}║\n`)
        this.write('╚══════════════════════════════════════════════════════════════╝\n')
        this.write('\n')
    }

    onSuiteStart(suite: SuiteStats) {
        this.write(`\n  ${suite.title}\n`)
    }

    onTestStart(test: TestStats) {
        this._requests = []
    }

    onTestPass(test: TestStats) {
        this.write(`    ✓ ${test.title} (${test._duration}ms)\n`)
        this._printRequests()
    }

    onTestFail(test: TestStats) {
        this.write(`    ✖ ${test.title} (${test._duration}ms)\n`)
        if (test.error) {
            this.write(`      Error: ${test.error.message}\n`)
        }
        this._printRequests()
    }

    onTestSkip(test: TestStats) {
        this.write(`    - ${test.title} [SKIPPED]\n`)
    }

    onBeforeCommand(command: any) {
        if (command.method && command.endpoint) {
            this._requests.push({
                method: command.method,
                endpoint: command.endpoint,
                body: command.body
            })
        }
    }

    onAfterCommand(command: any) {
        const lastRequest = this._requests[this._requests.length - 1]
        if (lastRequest && command.result) {
            lastRequest.status = command.result.status
            lastRequest.response = command.result.data
            lastRequest.duration = command.result.duration
        }
    }

    onRunnerEnd(runner: RunnerStats) {
        this.write('\n')
        this.write('╔══════════════════════════════════════════════════════════════╗\n')
        this.write('║                    API Test Run Summary                       ║\n')
        this.write('╠══════════════════════════════════════════════════════════════╣\n')
        this.write(`║ Passed:  ${this.counts.passes.toString().padEnd(52)}║\n`)
        this.write(`║ Failed:  ${this.counts.failures.toString().padEnd(52)}║\n`)
        this.write(`║ Skipped: ${this.counts.skipping.toString().padEnd(52)}║\n`)
        this.write(`║ Total:   ${this.counts.tests.toString().padEnd(52)}║\n`)
        this.write('╚══════════════════════════════════════════════════════════════╝\n')
    }

    private _printRequests() {
        if (!this._options.showRequestDetails || this._requests.length === 0) {
            return
        }

        this.write('      Requests:\n')
        for (const req of this._requests) {
            const status = req.status ? `[${req.status}]` : ''
            const duration = req.duration ? `(${req.duration}ms)` : ''
            this.write(`        → ${req.method} ${req.endpoint} ${status} ${duration}\n`)

            if (this._options.showResponseDetails && req.response) {
                const responseStr = JSON.stringify(req.response).substring(0, 100)
                this.write(`          Response: ${responseStr}...\n`)
            }
        }
    }
}
```

### Using Custom Reporter

```javascript
// wdio.conf.js
import ApiReporter from './src/reporters/apiReporter.js'

export const config = {
    runner: 'api',
    reporters: [
        'spec',
        [ApiReporter, {
            showRequestDetails: true,
            showResponseDetails: true,
            outputDir: './reports'
        }]
    ]
}
```

---

## Configuration Options

### Reporter Configuration

```javascript
// wdio.conf.js
export const config = {
    // Reporter plugins
    reporters: [
        'dot',                              // Simple dot reporter
        'spec',                             // Detailed spec reporter
        ['allure', {                        // Allure with options
            outputDir: './allure-results'
        }],
        [CustomReporter, { /* options */ }] // Custom reporter class
    ],

    // Reporter sync settings
    reporterSyncInterval: 100,    // Check interval (ms)
    reporterSyncTimeout: 5000,    // Max wait time (ms)

    // Output directory for reporter logs
    outputDir: './logs'
}
```

### Available Built-in Reporters

| Reporter | Package | Description |
|----------|---------|-------------|
| `dot` | `@wdio/dot-reporter` | Minimal dot output |
| `spec` | `@wdio/spec-reporter` | Detailed spec output |
| `junit` | `@wdio/junit-reporter` | JUnit XML format |
| `allure` | `@wdio/allure-reporter` | Allure report |
| `json` | `@wdio/json-reporter` | JSON output |
| `concise` | `@wdio/concise-reporter` | Concise output |

---

## API Runner Reporter Events

### Standard Events (Same as Browser Tests)

```typescript
// These events work the same for API tests
'runner:start'    // Test run started
'runner:end'      // Test run completed
'suite:start'     // Suite started
'suite:end'       // Suite completed
'test:start'      // Test started
'test:pass'       // Test passed
'test:fail'       // Test failed
'test:skip'       // Test skipped
'test:pending'    // Test pending
'hook:start'      // Hook started
'hook:end'        // Hook completed
```

### API-Specific Events (Custom)

```typescript
// Custom events for API request tracking
'api:request'     // API request sent
'api:response'    // API response received
'api:error'       // API error occurred

// Example emission
this._reporter.emit('api:request', {
    cid: this._cid,
    method: 'POST',
    url: 'https://api.example.com/users',
    headers: { 'Content-Type': 'application/json' },
    body: { name: 'John' },
    timestamp: Date.now()
})

this._reporter.emit('api:response', {
    cid: this._cid,
    status: 201,
    headers: { 'Content-Type': 'application/json' },
    body: { id: 1, name: 'John' },
    duration: 156,
    timestamp: Date.now()
})
```

---

## Sample Output

### Spec Reporter Output (API Tests)

```
------------------------------------------------------------------
[API #0-0] Running: API Tests
[API #0-0] Session ID: api-0-0
[API #0-0]
[API #0-0] » /test/api/users.spec.ts
[API #0-0] Users API
[API #0-0]    GET /users
[API #0-0]       ✓ should return list of users
[API #0-0]       ✓ should filter by status
[API #0-0]    POST /users
[API #0-0]       ✓ should create new user
[API #0-0]       ✖ should validate required fields
[API #0-0]
[API #0-0] 3 passing (1.2s)
[API #0-0] 1 failing
[API #0-0]
[API #0-0] 1) Users API POST /users should validate required fields
[API #0-0]    Expected status 400 but got 500
[API #0-0]    at Context.<anonymous> (/test/api/users.spec.ts:45:12)
```

### Custom API Reporter Output

```
╔══════════════════════════════════════════════════════════════╗
║                    API Test Run Started                       ║
╠══════════════════════════════════════════════════════════════╣
║ Worker: 0-0                                                   ║
║ Specs: 3                                                      ║
╚══════════════════════════════════════════════════════════════╝

  Users API
    ✓ should return list of users (156ms)
      Requests:
        → GET /api/users [200] (145ms)

    ✓ should create new user (89ms)
      Requests:
        → POST /api/users [201] (78ms)
          Response: {"id":1,"name":"John"}...

    ✖ should validate required fields (45ms)
      Error: Expected status 400 but got 500
      Requests:
        → POST /api/users [500] (34ms)

╔══════════════════════════════════════════════════════════════╗
║                    API Test Run Summary                       ║
╠══════════════════════════════════════════════════════════════╣
║ Passed:  2                                                    ║
║ Failed:  1                                                    ║
║ Skipped: 0                                                    ║
║ Total:   3                                                    ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Summary

| Component | Purpose |
|-----------|---------|
| **BaseReporter** | Loads and coordinates reporters |
| **WDIOReporter** | Base class for custom reporters |
| **Stats Classes** | Track test/suite/runner statistics |
| **Events** | Communication between framework and reporters |
| **Output Streams** | Console, files, external services |

### Key Files to Implement

```
@wdio/api-runner/
├── src/
│   ├── reporter.ts           # BaseReporter implementation
│   └── reporters/
│       └── apiReporter.ts    # Custom API reporter (optional)
```

### Dependencies

```json
{
    "dependencies": {
        "@wdio/reporter": "workspace:*",
        "@wdio/dot-reporter": "workspace:*",
        "@wdio/types": "workspace:*",
        "@wdio/utils": "workspace:*"
    }
}
```
