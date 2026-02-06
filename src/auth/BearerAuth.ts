import type { BearerAuthConfig, AuthInterceptor } from './types.js'
import { shouldExclude, mergeHeaders, parseJwtExpiry, isTokenExpired } from './utils.js'

/**
 * Default refresh buffer in seconds
 */
const DEFAULT_REFRESH_BUFFER = 60

/**
 * Creates a Bearer/JWT Authentication interceptor
 *
 * Supports static tokens, dynamic token functions, and automatic token refresh
 * before expiration. Includes methods for testing scenarios with expired or invalid tokens.
 *
 * @param config - Bearer auth configuration
 * @returns Auth interceptor with control methods for testing
 *
 * @example Static token
 * ```typescript
 * import { bearerAuth } from 'wdio-api-runner'
 *
 * const auth = bearerAuth({
 *   token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 * })
 *
 * api.addRequestInterceptor(auth.interceptor)
 * ```
 *
 * @example Dynamic token with refresh
 * ```typescript
 * const auth = bearerAuth({
 *   token: () => localStorage.getItem('access_token'),
 *   refresh: async () => {
 *     const response = await fetch('/auth/refresh', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({ refresh_token: localStorage.getItem('refresh_token') })
 *     })
 *     const data = await response.json()
 *     localStorage.setItem('access_token', data.access_token)
 *     return data.access_token
 *   },
 *   refreshBuffer: 120,  // Refresh 2 minutes before expiry
 *   onRefresh: (token) => console.log('Token refreshed')
 * })
 * ```
 *
 * @example Testing with expired token
 * ```typescript
 * const auth = bearerAuth({
 *   token: validToken,
 *   disableAutoRefresh: true  // Don't auto-refresh
 * })
 *
 * api.addRequestInterceptor(auth.interceptor)
 *
 * // Inject an expired token for negative testing
 * auth.setToken(expiredToken)
 *
 * const response = await api.get('/protected')
 * expect(response.status).toBe(401)
 * ```
 */
export function bearerAuth(config: BearerAuthConfig): AuthInterceptor {
    const {
        token: tokenConfig,
        refresh,
        refreshBuffer = DEFAULT_REFRESH_BUFFER,
        disableAutoRefresh = false,
        onRefresh,
        headerName = 'Authorization',
        prefix = 'Bearer',
        excludePaths,
    } = config

    // Token state
    let currentToken: string | null = null
    let tokenExpiry: number | null = null
    let isRefreshing = false
    let refreshPromise: Promise<void> | null = null

    /**
     * Get the initial token from config
     */
    const getInitialToken = async (): Promise<string> => {
        if (typeof tokenConfig === 'function') {
            return await tokenConfig()
        }
        return tokenConfig
    }

    /**
     * Refresh the token if a refresh function is provided
     */
    const doRefresh = async (): Promise<void> => {
        if (!refresh) {
            throw new Error('No refresh function provided')
        }

        // Prevent concurrent refresh calls
        if (isRefreshing && refreshPromise) {
            return refreshPromise
        }

        isRefreshing = true
        refreshPromise = (async () => {
            try {
                const newToken = await refresh()
                currentToken = newToken
                tokenExpiry = parseJwtExpiry(newToken)
                onRefresh?.(newToken)
            } finally {
                isRefreshing = false
                refreshPromise = null
            }
        })()

        return refreshPromise
    }

    /**
     * Get a valid token, refreshing if necessary
     */
    const getToken = async (): Promise<string> => {
        // Initialize token if not set
        if (currentToken === null) {
            currentToken = await getInitialToken()
            tokenExpiry = parseJwtExpiry(currentToken)
        }

        // Check if we need to refresh (and auto-refresh is enabled)
        if (!disableAutoRefresh && refresh && isTokenExpired(tokenExpiry, refreshBuffer)) {
            await doRefresh()
        }

        return currentToken!
    }

    /**
     * The request interceptor
     */
    const interceptor = async (url: string, options: RequestInit): Promise<RequestInit> => {
        // Skip auth for excluded paths
        if (shouldExclude(url, excludePaths)) {
            return options
        }

        const token = await getToken()

        return {
            ...options,
            headers: mergeHeaders(options.headers, {
                [headerName]: `${prefix} ${token}`,
            }),
        }
    }

    return {
        interceptor,

        /**
         * Force a token refresh
         */
        forceRefresh: async (): Promise<void> => {
            if (!refresh) {
                throw new Error('No refresh function configured')
            }
            await doRefresh()
        },

        /**
         * Clear the current token (for testing unauthenticated scenarios)
         */
        clearTokens: async (): Promise<void> => {
            currentToken = null
            tokenExpiry = null
        },

        /**
         * Set a specific token (for testing with expired/invalid tokens)
         */
        setToken: (token: string): void => {
            currentToken = token
            tokenExpiry = parseJwtExpiry(token)
        },

        /**
         * Get the current token value
         */
        getToken: (): string | null => {
            return currentToken
        },
    }
}
