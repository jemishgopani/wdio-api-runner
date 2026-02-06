/**
 * HAR Logger - Core class for recording HTTP requests to HAR format
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Har, HarEntry, LoggingConfig, RequestLogger } from './types.js'
import { createHar } from './HarBuilder.js'

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<LoggingConfig> = {
    enabled: false,
    outputPath: './har-logs',
    includeRequestBody: true,
    includeResponseBody: true,
    maxBodySize: 1048576, // 1MB
    attachToTest: false,
}

/**
 * HAR Logger class for recording HTTP requests
 *
 * @example On-demand recording
 * ```typescript
 * const logger = new HarLogger()
 *
 * logger.startRecording('my-session')
 *
 * // ... make requests (entries added via addEntry) ...
 *
 * const filePath = await logger.stopRecording()
 * console.log(`HAR saved to: ${filePath}`)
 * ```
 *
 * @example Always-on logging
 * ```typescript
 * const logger = new HarLogger({
 *   enabled: true,
 *   outputPath: './logs'
 * })
 *
 * // Logger automatically records all requests
 * ```
 */
export class HarLogger implements RequestLogger {
    private entries: HarEntry[] = []
    private recording: boolean = false
    private filename: string | null = null
    private config: Required<LoggingConfig>

    constructor(config?: LoggingConfig) {
        this.config = { ...DEFAULT_CONFIG, ...config }

        // If always-on logging is enabled, start recording
        if (this.config.enabled) {
            this.startRecording()
        }
    }

    /**
     * Start recording HTTP requests
     * @param filename - Optional filename for the HAR file (without extension)
     */
    startRecording(filename?: string): void {
        if (this.recording) {
            // Already recording, just update filename if provided
            if (filename) {
                this.filename = filename
            }
            return
        }

        this.recording = true
        this.filename = filename || `har-${Date.now()}`
        this.entries = []
    }

    /**
     * Stop recording and save HAR file
     * @returns Path to the saved HAR file
     */
    async stopRecording(): Promise<string> {
        if (!this.recording) {
            throw new Error('Not currently recording')
        }

        const har = this.getHar()
        const filePath = await this.saveHar(har)

        this.recording = false
        this.entries = []
        this.filename = null

        return filePath
    }

    /**
     * Get the current HAR data without stopping recording
     */
    getHar(): Har {
        return createHar([...this.entries])
    }

    /**
     * Clear all recorded entries
     */
    clear(): void {
        this.entries = []
    }

    /**
     * Check if recording is currently active
     */
    isRecording(): boolean {
        return this.recording
    }

    /**
     * Get the number of recorded entries
     */
    getEntryCount(): number {
        return this.entries.length
    }

    /**
     * Add an entry to the log (called by interceptors)
     * @internal
     */
    addEntry(entry: HarEntry): void {
        if (!this.recording && !this.config.enabled) {
            return
        }

        this.entries.push(entry)
    }

    /**
     * Get the current configuration
     */
    getConfig(): Required<LoggingConfig> {
        return { ...this.config }
    }

    /**
     * Update configuration
     */
    setConfig(config: Partial<LoggingConfig>): void {
        this.config = { ...this.config, ...config }
    }

    /**
     * Set the filename for the current recording
     */
    setFilename(filename: string): void {
        this.filename = filename
    }

    /**
     * Save HAR data to file
     */
    private async saveHar(har: Har): Promise<string> {
        const outputDir = this.config.outputPath
        const filename = `${this.filename || `har-${Date.now()}`}.har`
        const filePath = path.join(outputDir, filename)

        // Ensure output directory exists
        await this.ensureDir(outputDir)

        // Write HAR file
        const harJson = JSON.stringify(har, null, 2)
        await fs.promises.writeFile(filePath, harJson, 'utf-8')

        return filePath
    }

    /**
     * Ensure directory exists
     */
    private async ensureDir(dir: string): Promise<void> {
        try {
            await fs.promises.access(dir)
        } catch {
            await fs.promises.mkdir(dir, { recursive: true })
        }
    }
}
