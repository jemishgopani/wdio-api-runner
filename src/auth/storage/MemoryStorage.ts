import type { TokenStorage } from '../types.js'

/**
 * Storage entry with optional expiration
 */
interface StorageEntry {
    value: string
    expiresAt?: number
}

/**
 * In-memory token storage implementation
 *
 * Tokens are stored in memory and lost when the process restarts.
 * This is the default storage for auth helpers and is suitable for most testing scenarios.
 *
 * @example
 * ```typescript
 * const storage = new MemoryStorage()
 *
 * // Store a token with expiration
 * await storage.set('access_token', 'abc123', Date.now() + 3600000)
 *
 * // Retrieve the token
 * const token = await storage.get('access_token')
 *
 * // Clear all tokens
 * await storage.clear()
 * ```
 */
export class MemoryStorage implements TokenStorage {
    private store = new Map<string, StorageEntry>()

    /**
     * Get a token by key
     * Returns null if the token doesn't exist or has expired
     */
    async get(key: string): Promise<string | null> {
        const entry = this.store.get(key)

        if (!entry) {
            return null
        }

        // Check if expired
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.store.delete(key)
            return null
        }

        return entry.value
    }

    /**
     * Store a token with optional expiration
     * @param key - Storage key
     * @param value - Token value
     * @param expiresAt - Optional expiration timestamp in milliseconds
     */
    async set(key: string, value: string, expiresAt?: number): Promise<void> {
        this.store.set(key, { value, expiresAt })
    }

    /**
     * Remove a token by key
     */
    async remove(key: string): Promise<void> {
        this.store.delete(key)
    }

    /**
     * Clear all stored tokens
     */
    async clear(): Promise<void> {
        this.store.clear()
    }

    /**
     * Get the number of stored tokens (for testing/debugging)
     */
    get size(): number {
        return this.store.size
    }

    /**
     * Check if a key exists (without checking expiration)
     */
    has(key: string): boolean {
        return this.store.has(key)
    }
}
