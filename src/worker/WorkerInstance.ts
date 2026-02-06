import { fork, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import url from 'node:url'

import logger from '@wdio/logger'
import type { WritableStreamBuffer } from 'stream-buffers'
import type { Workers } from '@wdio/types'

import runnerTransformStream from '../streams/TransformStream.js'
import RunnerStream from '../streams/RunnerStream.js'
import type { ApiRunnerOptions } from '../shared/types.js'

const log = logger('wdio-api-runner:worker')
const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

// Create global output streams that pipe to main process stdout/stderr
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
    sessionId?: string

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
        workerOptions: Workers.WorkerRunPayload,
        stdout: WritableStreamBuffer,
        stderr: WritableStreamBuffer,
        private apiOptions: ApiRunnerOptions
    ) {
        super()
        this.cid = workerOptions.cid
        this.config = config
        this.configFile = workerOptions.configFile
        this.caps = workerOptions.caps
        this.capabilities = workerOptions.caps
        this.specs = workerOptions.specs
        this.execArgv = workerOptions.execArgv || []
        this.retries = workerOptions.retries
        this.stdout = stdout
        this.stderr = stderr

        this.isReady = new Promise((resolve) => {
            this.isReadyResolver = resolve
        })
        this.isSetup = new Promise((resolve) => {
            this.isSetupResolver = resolve
        })
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
        }

        // Preserve source maps for better error traces
        if (!runnerEnv.NODE_OPTIONS?.includes('--enable-source-maps')) {
            runnerEnv.NODE_OPTIONS = `${runnerEnv.NODE_OPTIONS || ''} --enable-source-maps`.trim()
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
        if (process.env.NODE_OPTIONS && !runnerEnv.NODE_OPTIONS?.includes(process.env.NODE_OPTIONS)) {
            runnerEnv.NODE_OPTIONS = `${process.env.NODE_OPTIONS} ${runnerEnv.NODE_OPTIONS || ''}`.trim()
        }

        log.info(`Starting API worker ${cid} with specs: ${this.specs.join(', ')}`)

        // Fork child process
        const childProcess = (this.childProcess = fork(path.join(__dirname, 'run.js'), argv, {
            cwd: process.cwd(),
            env: runnerEnv,
            execArgv,
            stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
        }))

        // Set up event handlers
        childProcess.on('message', this._handleMessage.bind(this))
        childProcess.on('error', this._handleError.bind(this))
        childProcess.on('exit', this._handleExit.bind(this))

        // Set up log streaming with transform stream
        if (childProcess.stdout !== null) {
            if (this.config.groupLogsByTestSpec) {
                // Collect logs in aggregator, print when worker exits
                log.debug(`Worker ${cid}: Collecting logs for grouped output`)
                runnerTransformStream(cid, childProcess.stdout, this.logsAggregator)
            } else {
                // Stream logs in real-time with [cid] prefix
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
        const { name, content } = payload

        log.debug(`Worker ${this.cid} received message: ${name}`)

        if (name === 'finishedCommand') {
            this.isBusy = false
        }

        if (name === 'ready') {
            log.debug(`Worker ${this.cid} is ready`)
            this.isReadyResolver(true)
        }

        if (name === 'sessionStarted') {
            log.debug(`Worker ${this.cid} session started`)
            this.isSetupResolver(true)
            if (content && typeof content === 'object' && 'sessionId' in content) {
                this.sessionId = (content as { sessionId: string }).sessionId
            }
        }

        this.emit('message', { ...payload, cid: this.cid })
    }

    private _handleError(error: Error): void {
        log.error(`Worker ${this.cid} error: ${error.message}`)
        this.emit('error', {
            cid: this.cid,
            name: error.name,
            message: error.message,
            stack: error.stack,
        })
    }

    private _handleExit(exitCode: number | null): void {
        const code = exitCode ?? 0
        log.debug(`API Worker ${this.cid} exited with code ${code}`)

        delete this.childProcess
        this.isBusy = false
        this.isKilled = true

        this.emit('exit', {
            cid: this.cid,
            exitCode: code,
            specs: this.specs,
            retries: this.retries,
        })
    }

    kill(signal: NodeJS.Signals = 'SIGTERM'): void {
        if (!this.childProcess) {
            log.debug(`Worker ${this.cid} has no child process to kill`)
            return
        }

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

        // Only block for run commands, allow endSession and workerRequest through
        if (isBusy && !['workerRequest', 'endSession'].includes(command)) {
            log.info(`Worker ${cid} is busy, cannot accept command: ${command}`)
            return
        }

        // Start process if not already running
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
            retries,
        }

        // Wait for worker to be ready before sending command
        await this.isReady

        log.debug(`Sending command '${command}' to worker ${cid}`)
        this.childProcess!.send(cmd)
        this.isBusy = true
    }
}
