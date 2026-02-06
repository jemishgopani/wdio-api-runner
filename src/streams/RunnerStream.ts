import type { TransformCallback } from 'node:stream'
import { Transform } from 'node:stream'

/**
 * Remove the last listener for a given event from a target
 * This prevents memory leaks from accumulated pipe listeners
 */
export function removeLastListener(target: Transform, eventName: string): void {
    const listeners = target.listeners(eventName)
    const lastListener = listeners[listeners.length - 1] as (() => void) | undefined
    if (lastListener) {
        target.removeListener(eventName, lastListener)
    }
}

/**
 * A pass-through transform stream that pipes to stdout/stderr
 * Handles cleanup of auto-created pipe listeners to prevent memory leaks
 */
export default class RunnerStream extends Transform {
    constructor() {
        super()

        // Remove auto-created listeners when a new pipe is added
        // This prevents "MaxListenersExceededWarning" when many workers are created
        this.on('pipe', () => {
            removeLastListener(this, 'close')
            removeLastListener(this, 'drain')
            removeLastListener(this, 'error')
            removeLastListener(this, 'finish')
            removeLastListener(this, 'unpipe')
        })
    }

    /**
     * Pass through the chunk unchanged
     */
    _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
        callback(undefined, chunk)
    }

    /**
     * Clean up when stream ends
     */
    _final(callback: (error?: Error) => void): void {
        this.unpipe()
        callback()
    }
}
