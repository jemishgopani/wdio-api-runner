/**
 * Utility functions for authentication helpers
 */

/**
 * Parse a JWT token to extract the expiration timestamp
 *
 * @param token - JWT token string
 * @returns Expiration timestamp in milliseconds, or null if not found/invalid
 *
 * @example
 * ```typescript
 * const expiry = parseJwtExpiry(token)
 * if (expiry && Date.now() > expiry) {
 *   console.log('Token has expired')
 * }
 * ```
 */
export function parseJwtExpiry(token: string): number | null {
    try {
        const parts = token.split('.')
        if (parts.length !== 3) {
            return null
        }

        const payload = parts[1]
        // Handle URL-safe base64
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
        const decoded = Buffer.from(base64, 'base64').toString('utf-8')
        const parsed = JSON.parse(decoded)

        if (typeof parsed.exp === 'number') {
            // exp is in seconds, convert to milliseconds
            return parsed.exp * 1000
        }

        return null
    } catch {
        return null
    }
}

/**
 * Check if a URL should be excluded from authentication
 *
 * @param url - The request URL
 * @param excludePaths - Array of string patterns or RegExp to match against
 * @returns True if the URL should be excluded from auth
 *
 * @example
 * ```typescript
 * const exclude = shouldExclude('/api/health', ['/health', /^\/public/])
 * // Returns true because '/api/health' contains '/health'
 * ```
 */
export function shouldExclude(url: string, excludePaths?: (string | RegExp)[]): boolean {
    if (!excludePaths || excludePaths.length === 0) {
        return false
    }

    return excludePaths.some((pattern) => {
        if (typeof pattern === 'string') {
            return url.includes(pattern)
        }
        return pattern.test(url)
    })
}

/**
 * Encode credentials for Basic Authentication
 *
 * @param username - Username
 * @param password - Password
 * @returns Base64 encoded credentials
 */
export function encodeBasicAuth(username: string, password: string): string {
    return Buffer.from(`${username}:${password}`).toString('base64')
}

/**
 * Check if a token is expired or will expire within the buffer period
 *
 * @param expiryMs - Token expiration timestamp in milliseconds
 * @param bufferSeconds - Buffer time before expiry to consider as expired
 * @returns True if token is expired or will expire within buffer
 */
export function isTokenExpired(expiryMs: number | null, bufferSeconds: number = 60): boolean {
    if (expiryMs === null) {
        return false // If no expiry, assume not expired
    }
    const bufferMs = bufferSeconds * 1000
    return Date.now() >= expiryMs - bufferMs
}

/**
 * Merge headers, handling both object and Headers instances
 *
 * @param existing - Existing headers from request options
 * @param newHeaders - New headers to add
 * @returns Merged headers as a plain object
 */
export function mergeHeaders(
    existing: HeadersInit | undefined,
    newHeaders: Record<string, string>
): Record<string, string> {
    const result: Record<string, string> = {}

    // Copy existing headers
    if (existing) {
        if (existing instanceof Headers) {
            existing.forEach((value, key) => {
                result[key] = value
            })
        } else if (Array.isArray(existing)) {
            for (const [key, value] of existing) {
                result[key] = value
            }
        } else {
            Object.assign(result, existing)
        }
    }

    // Add new headers
    Object.assign(result, newHeaders)

    return result
}
