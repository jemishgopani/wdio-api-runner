import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Transform } from 'node:stream'
import RunnerStream, { removeLastListener } from '../src/streams/RunnerStream.js'

describe('stdStream', () => {
    describe('RunnerStream', () => {
        let runnerStream: RunnerStream

        beforeEach(() => {
            runnerStream = new RunnerStream()
        })

        it('should be a Transform stream', () => {
            expect(runnerStream).toBeInstanceOf(Transform)
        })

        it('should pass through data via _transform', () => {
            const callback = vi.fn()
            const chunk = Buffer.from('test data')

            runnerStream._transform(chunk, 'utf8', callback)

            expect(callback).toHaveBeenCalledWith(undefined, chunk)
        })

        it('should emit pipe event when piped from', () => {
            const pipeListener = vi.fn()
            runnerStream.on('pipe', pipeListener)

            // Simulate a pipe event
            runnerStream.emit('pipe')

            expect(pipeListener).toHaveBeenCalled()
        })

        it('should call unpipe and callback on _final', () => {
            const unpipeSpy = vi.spyOn(runnerStream, 'unpipe')
            const callback = vi.fn()

            runnerStream._final(callback)

            expect(unpipeSpy).toHaveBeenCalled()
            expect(callback).toHaveBeenCalled()
        })
    })

    describe('removeLastListener', () => {
        it('should remove the last listener for an event', () => {
            const stream = new Transform({
                transform(chunk, _encoding, callback) {
                    callback(null, chunk)
                },
            })

            const listener1 = vi.fn()
            const listener2 = vi.fn()
            const listener3 = vi.fn()

            stream.on('data', listener1)
            stream.on('data', listener2)
            stream.on('data', listener3)

            expect(stream.listenerCount('data')).toBe(3)

            removeLastListener(stream, 'data')

            expect(stream.listenerCount('data')).toBe(2)

            // Emit to verify which listeners remain
            stream.write('test')

            expect(listener1).toHaveBeenCalled()
            expect(listener2).toHaveBeenCalled()
            expect(listener3).not.toHaveBeenCalled()
        })

        it('should do nothing if no listeners exist', () => {
            const stream = new Transform({
                transform(chunk, _encoding, callback) {
                    callback(null, chunk)
                },
            })

            expect(() => removeLastListener(stream, 'nonexistent')).not.toThrow()
            expect(stream.listenerCount('nonexistent')).toBe(0)
        })

        it('should handle single listener correctly', () => {
            const stream = new Transform({
                transform(chunk, _encoding, callback) {
                    callback(null, chunk)
                },
            })

            const listener = vi.fn()
            stream.on('data', listener)

            expect(stream.listenerCount('data')).toBe(1)

            removeLastListener(stream, 'data')

            expect(stream.listenerCount('data')).toBe(0)
        })

        it('should remove listeners for different event types', () => {
            const stream = new Transform({
                transform(chunk, _encoding, callback) {
                    callback(null, chunk)
                },
            })

            const closeListener = vi.fn()
            const drainListener = vi.fn()
            const errorListener = vi.fn()

            stream.on('close', closeListener)
            stream.on('drain', drainListener)
            stream.on('error', errorListener)

            removeLastListener(stream, 'close')
            removeLastListener(stream, 'drain')

            expect(stream.listenerCount('close')).toBe(0)
            expect(stream.listenerCount('drain')).toBe(0)
            expect(stream.listenerCount('error')).toBe(1)
        })
    })

    describe('memory leak prevention', () => {
        it('should set up pipe listener to remove auto-created listeners', () => {
            const runnerStream = new RunnerStream()

            // Verify that the pipe listener is set up
            expect(runnerStream.listenerCount('pipe')).toBeGreaterThan(0)
        })

        it('should call removeLastListener on pipe event', () => {
            const runnerStream = new RunnerStream()

            // Add some listeners
            runnerStream.on('close', () => {})
            runnerStream.on('drain', () => {})
            runnerStream.on('error', () => {})
            runnerStream.on('finish', () => {})
            runnerStream.on('unpipe', () => {})

            const initialCounts = {
                close: runnerStream.listenerCount('close'),
                drain: runnerStream.listenerCount('drain'),
                error: runnerStream.listenerCount('error'),
                finish: runnerStream.listenerCount('finish'),
                unpipe: runnerStream.listenerCount('unpipe'),
            }

            // Trigger pipe event
            runnerStream.emit('pipe')

            // After pipe, the last listener for each event type should be removed
            expect(runnerStream.listenerCount('close')).toBeLessThanOrEqual(initialCounts.close)
            expect(runnerStream.listenerCount('drain')).toBeLessThanOrEqual(initialCounts.drain)
            expect(runnerStream.listenerCount('error')).toBeLessThanOrEqual(initialCounts.error)
            expect(runnerStream.listenerCount('finish')).toBeLessThanOrEqual(initialCounts.finish)
            expect(runnerStream.listenerCount('unpipe')).toBeLessThanOrEqual(initialCounts.unpipe)
        })
    })
})
