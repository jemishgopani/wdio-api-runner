import split from 'split2'
import type { Readable, TransformCallback } from 'node:stream'
import { Transform } from 'node:stream'

import { DEBUGGER_MESSAGES, API_RUNNER_FILTER_MESSAGES } from '../shared/constants.js'

const MESSAGES_TO_FILTER = [...DEBUGGER_MESSAGES, ...API_RUNNER_FILTER_MESSAGES]

/**
 * Transform stream that:
 * 1. Splits input by newlines
 * 2. Filters out debugger and warning messages
 * 3. Prefixes each line with worker ID [cid]
 * 4. Optionally collects lines in an aggregator array
 */
export default function runnerTransformStream(cid: string, inputStream: Readable, aggregator?: string[]): Readable {
    return inputStream
        .pipe(split(/\r?\n/, (line: string) => `${line}\n`))
        .pipe(ignore(MESSAGES_TO_FILTER))
        .pipe(
            map((line: string) => {
                const newLine = `[${cid}] ${line}`
                if (aggregator) {
                    aggregator.push(newLine)
                }
                return newLine
            })
        )
}

/**
 * Creates a transform stream that filters out lines starting with given patterns
 */
function ignore(patternsToIgnore: string[]): Transform {
    return new Transform({
        decodeStrings: false,
        transform(chunk: string, _encoding: BufferEncoding, next: TransformCallback) {
            // Check if chunk starts with any pattern to ignore
            if (patternsToIgnore.some((pattern) => chunk.startsWith(pattern))) {
                return next() // Skip this chunk
            }
            return next(null, chunk)
        },
        final(next: TransformCallback) {
            this.unpipe()
            next()
        },
    })
}

/**
 * Creates a transform stream that applies a mapper function to each chunk
 */
function map(mapper: (line: string) => string): Transform {
    return new Transform({
        decodeStrings: false,
        transform(chunk: string, _encoding: BufferEncoding, next: TransformCallback) {
            return next(null, mapper(chunk))
        },
        final(next: TransformCallback) {
            this.unpipe()
            next()
        },
    })
}
