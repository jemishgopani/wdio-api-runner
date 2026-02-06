import { describe, it, expect } from 'vitest'
import {
    SHUTDOWN_TIMEOUT,
    BUFFER_OPTIONS,
    DEFAULT_API_TIMEOUT,
    DEFAULT_HEADERS,
    DEBUGGER_MESSAGES,
    API_RUNNER_FILTER_MESSAGES,
    WORKER_GROUPLOGS_MESSAGES,
} from '../src/shared/constants.js'

describe('constants', () => {
    describe('SHUTDOWN_TIMEOUT', () => {
        it('should be a positive number', () => {
            expect(SHUTDOWN_TIMEOUT).toBeGreaterThan(0)
        })

        it('should be 5000ms', () => {
            expect(SHUTDOWN_TIMEOUT).toBe(5000)
        })
    })

    describe('BUFFER_OPTIONS', () => {
        it('should have initialSize property', () => {
            expect(BUFFER_OPTIONS.initialSize).toBeDefined()
            expect(BUFFER_OPTIONS.initialSize).toBeGreaterThan(0)
        })

        it('should have incrementAmount property', () => {
            expect(BUFFER_OPTIONS.incrementAmount).toBeDefined()
            expect(BUFFER_OPTIONS.incrementAmount).toBeGreaterThan(0)
        })

        it('should have reasonable buffer sizes', () => {
            // 1MB initial
            expect(BUFFER_OPTIONS.initialSize).toBe(1000 * 1024)
            // 100KB increments
            expect(BUFFER_OPTIONS.incrementAmount).toBe(100 * 1024)
        })
    })

    describe('DEFAULT_API_TIMEOUT', () => {
        it('should be a positive number', () => {
            expect(DEFAULT_API_TIMEOUT).toBeGreaterThan(0)
        })

        it('should be 30000ms (30 seconds)', () => {
            expect(DEFAULT_API_TIMEOUT).toBe(30000)
        })
    })

    describe('DEFAULT_HEADERS', () => {
        it('should be an object', () => {
            expect(typeof DEFAULT_HEADERS).toBe('object')
        })

        it('should include Accept header', () => {
            expect(DEFAULT_HEADERS['Accept']).toBe('application/json')
        })
    })

    describe('DEBUGGER_MESSAGES', () => {
        it('should be an array', () => {
            expect(Array.isArray(DEBUGGER_MESSAGES)).toBe(true)
        })

        it('should contain debugger-related messages', () => {
            expect(DEBUGGER_MESSAGES).toContain('Debugger listening on')
            expect(DEBUGGER_MESSAGES).toContain('Debugger attached')
            expect(DEBUGGER_MESSAGES).toContain('Waiting for the debugger')
        })
    })

    describe('API_RUNNER_FILTER_MESSAGES', () => {
        it('should be an array', () => {
            expect(Array.isArray(API_RUNNER_FILTER_MESSAGES)).toBe(true)
        })

        it('should contain warning messages to filter', () => {
            expect(API_RUNNER_FILTER_MESSAGES).toContain('ExperimentalWarning')
            expect(API_RUNNER_FILTER_MESSAGES).toContain('DeprecationWarning')
        })
    })

    describe('WORKER_GROUPLOGS_MESSAGES', () => {
        it('should have normalExit function', () => {
            expect(typeof WORKER_GROUPLOGS_MESSAGES.normalExit).toBe('function')
        })

        it('should have exitWithError function', () => {
            expect(typeof WORKER_GROUPLOGS_MESSAGES.exitWithError).toBe('function')
        })

        it('normalExit should return string with worker ID', () => {
            const result = WORKER_GROUPLOGS_MESSAGES.normalExit('worker-1')
            expect(result).toContain('worker-1')
            expect(result).toContain('API Test Logs')
        })

        it('exitWithError should return string with worker ID and FAILED', () => {
            const result = WORKER_GROUPLOGS_MESSAGES.exitWithError('worker-2')
            expect(result).toContain('worker-2')
            expect(result).toContain('FAILED')
        })
    })
})
