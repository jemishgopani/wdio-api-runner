import logger from '@wdio/logger'
import type { Workers } from '@wdio/types'

import ApiTestRunner from '../runner/ApiTestRunner.js'

const log = logger('wdio-api-runner:run')

log.info('API Runner worker process starting')

// Send ready signal to parent process
if (typeof process.send === 'function') {
    process.send({
        name: 'ready',
        origin: 'worker',
    })
}

const runner = new ApiTestRunner()

// Handle runner exit
runner.on('exit', (code: number = 0) => {
    log.info(`Runner exiting with code ${code}`)
    process.exit(code)
})

// Handle runner errors
runner.on('error', ({ name, message, stack }: { name: string; message: string; stack?: string }) => {
    log.error(`Runner error: ${name} - ${message}`)
    if (process.send) {
        process.send({
            origin: 'worker',
            name: 'error',
            content: { name, message, stack },
        })
    }
})

// Handle messages from parent process
process.on('message', async (message: Workers.WorkerCommand) => {
    if (!message?.command) {
        log.warn('Received message without command:', message)
        return
    }

    const { command } = message

    // Check if the runner has a method for this command
    if (typeof runner[command] !== 'function') {
        log.warn(`Unknown command received: ${command}`)
        return
    }

    log.info(`Executing command: ${command}`)

    try {
        const result = await (runner[command] as (params: Workers.WorkerCommand) => Promise<unknown>)(message)

        if (process.send) {
            process.send({
                origin: 'worker',
                name: 'finishedCommand',
                content: { command, result },
            })
        }
    } catch (error: unknown) {
        const err = error as Error
        log.error(`Command '${command}' failed:`, err.stack)

        if (process.send) {
            process.send({
                origin: 'worker',
                name: 'error',
                content: {
                    name: err.name,
                    message: err.message,
                    stack: err.stack,
                },
            })
        }

        process.exit(1)
    }
})

// Handle process signals
process.once('SIGINT', () => {
    log.info('Received SIGINT, exiting...')
    process.exit(130)
})

process.once('SIGTERM', () => {
    log.info('Received SIGTERM, exiting...')
    process.exit(143)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
    log.error('Uncaught exception:', error.stack)
    if (process.send) {
        process.send({
            origin: 'worker',
            name: 'error',
            content: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
        })
    }
    process.exit(1)
})

// Handle unhandled rejections
process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason))
    log.error('Unhandled rejection:', error.stack)
    if (process.send) {
        process.send({
            origin: 'worker',
            name: 'error',
            content: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
        })
    }
    process.exit(1)
})
