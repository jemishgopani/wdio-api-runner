import { describe, it, expect } from 'vitest'
import { PassThrough } from 'node:stream'
import runnerTransformStream from '../src/streams/TransformStream.js'

describe('transformStream', () => {
    /**
     * Helper to collect output from a readable stream with timeout
     */
    async function collectOutput(stream: NodeJS.ReadableStream, timeoutMs = 1000): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const chunks: string[] = []
            const timeout = setTimeout(() => {
                stream.removeAllListeners()
                resolve(chunks)
            }, timeoutMs)

            stream.on('data', (chunk) => {
                chunks.push(chunk.toString())
            })

            stream.on('end', () => {
                clearTimeout(timeout)
                resolve(chunks)
            })

            stream.on('error', (err) => {
                clearTimeout(timeout)
                reject(err)
            })
        })
    }

    describe('runnerTransformStream', () => {
        it('should prefix lines with worker ID', async () => {
            const input = new PassThrough()
            const output = runnerTransformStream('worker-1', input)

            const collectPromise = collectOutput(output, 500)

            input.write('Line 1\n')
            input.write('Line 2\n')
            input.end()

            const result = await collectPromise

            expect(result.some((line) => line.includes('[worker-1] Line 1'))).toBe(true)
            expect(result.some((line) => line.includes('[worker-1] Line 2'))).toBe(true)
        })

        it('should handle empty input', async () => {
            const input = new PassThrough()
            const output = runnerTransformStream('worker-1', input)

            const collectPromise = collectOutput(output, 500)
            input.end()

            const result = await collectPromise
            expect(result.length).toBe(0)
        })

        it('should handle multi-line input in single chunk', async () => {
            const input = new PassThrough()
            const output = runnerTransformStream('worker-1', input)

            const collectPromise = collectOutput(output, 500)

            input.write('Line 1\nLine 2\nLine 3\n')
            input.end()

            const result = await collectPromise

            expect(result.some((line) => line.includes('[worker-1] Line 1'))).toBe(true)
            expect(result.some((line) => line.includes('[worker-1] Line 2'))).toBe(true)
            expect(result.some((line) => line.includes('[worker-1] Line 3'))).toBe(true)
        })
    })

    describe('filtering', () => {
        it('should filter out debugger messages', async () => {
            const input = new PassThrough()
            const output = runnerTransformStream('worker-1', input)

            const collectPromise = collectOutput(output, 500)

            input.write('Normal line\n')
            input.write('Debugger listening on ws://127.0.0.1:9229\n')
            input.write('Another normal line\n')
            input.end()

            const result = await collectPromise

            expect(result.some((line) => line.includes('Normal line'))).toBe(true)
            expect(result.some((line) => line.includes('Another normal line'))).toBe(true)
            expect(result.some((line) => line.includes('Debugger listening'))).toBe(false)
        })

        it('should filter out "Debugger attached" messages', async () => {
            const input = new PassThrough()
            const output = runnerTransformStream('worker-1', input)

            const collectPromise = collectOutput(output, 500)

            input.write('Debugger attached.\n')
            input.write('Test output\n')
            input.end()

            const result = await collectPromise

            expect(result.some((line) => line.includes('Debugger attached'))).toBe(false)
            expect(result.some((line) => line.includes('Test output'))).toBe(true)
        })

        it('should filter out "Waiting for the debugger" messages', async () => {
            const input = new PassThrough()
            const output = runnerTransformStream('worker-1', input)

            const collectPromise = collectOutput(output, 500)

            input.write('Waiting for the debugger to disconnect...\n')
            input.write('Normal output\n')
            input.end()

            const result = await collectPromise

            expect(result.some((line) => line.includes('Waiting for the debugger'))).toBe(false)
            expect(result.some((line) => line.includes('Normal output'))).toBe(true)
        })

        it('should filter out ExperimentalWarning messages', async () => {
            const input = new PassThrough()
            const output = runnerTransformStream('worker-1', input)

            const collectPromise = collectOutput(output, 500)

            input.write('ExperimentalWarning: Some experimental feature\n')
            input.write('Normal output\n')
            input.end()

            const result = await collectPromise

            expect(result.some((line) => line.includes('ExperimentalWarning'))).toBe(false)
            expect(result.some((line) => line.includes('Normal output'))).toBe(true)
        })

        it('should filter out DeprecationWarning messages', async () => {
            const input = new PassThrough()
            const output = runnerTransformStream('worker-1', input)

            const collectPromise = collectOutput(output, 500)

            input.write('DeprecationWarning: This feature is deprecated\n')
            input.write('Normal output\n')
            input.end()

            const result = await collectPromise

            expect(result.some((line) => line.includes('DeprecationWarning'))).toBe(false)
            expect(result.some((line) => line.includes('Normal output'))).toBe(true)
        })
    })

    describe('aggregator', () => {
        it('should collect lines in aggregator array when provided', async () => {
            const aggregator: string[] = []
            const input = new PassThrough()
            const output = runnerTransformStream('worker-1', input, aggregator)

            const collectPromise = collectOutput(output, 500)

            input.write('Line 1\n')
            input.write('Line 2\n')
            input.end()

            await collectPromise

            expect(aggregator.length).toBeGreaterThan(0)
            expect(aggregator.some((line) => line.includes('[worker-1] Line 1'))).toBe(true)
            expect(aggregator.some((line) => line.includes('[worker-1] Line 2'))).toBe(true)
        })

        it('should not collect filtered messages in aggregator', async () => {
            const aggregator: string[] = []
            const input = new PassThrough()
            const output = runnerTransformStream('worker-1', input, aggregator)

            const collectPromise = collectOutput(output, 500)

            input.write('Normal line\n')
            input.write('Debugger listening on ws://127.0.0.1:9229\n')
            input.end()

            await collectPromise

            expect(aggregator.some((line) => line.includes('Normal line'))).toBe(true)
            expect(aggregator.some((line) => line.includes('Debugger listening'))).toBe(false)
        })

        it('should work without aggregator', async () => {
            const input = new PassThrough()
            const output = runnerTransformStream('worker-1', input)

            const collectPromise = collectOutput(output, 500)

            input.write('Line 1\n')
            input.end()

            const result = await collectPromise
            expect(result.some((line) => line.includes('[worker-1] Line 1'))).toBe(true)
        })
    })

    describe('edge cases', () => {
        it('should handle Windows-style line endings (CRLF)', async () => {
            const input = new PassThrough()
            const output = runnerTransformStream('worker-1', input)

            const collectPromise = collectOutput(output, 500)

            input.write('Line 1\r\nLine 2\r\n')
            input.end()

            const result = await collectPromise

            expect(result.some((line) => line.includes('[worker-1] Line 1'))).toBe(true)
            expect(result.some((line) => line.includes('[worker-1] Line 2'))).toBe(true)
        })

        it('should handle special characters in cid', async () => {
            const input = new PassThrough()
            const output = runnerTransformStream('worker-[special]', input)

            const collectPromise = collectOutput(output, 500)

            input.write('Test\n')
            input.end()

            const result = await collectPromise

            expect(result.some((line) => line.includes('[worker-[special]] Test'))).toBe(true)
        })
    })
})
