import type { OAuth2Config, OAuth2Token, AuthInterceptor } from './types.js'
import { shouldExclude, mergeHeaders, isTokenExpired } from './utils.js'

/**
 * Default refresh buffer in seconds
 */
const DEFAULT_REFRESH_BUFFER = 60

/**
 * Creates an OAuth2 Client Credentials Authentication interceptor
 *
 * Automatically fetches tokens from the token endpoint and refreshes them
 * before expiration. Supports testing scenarios with expired or invalid tokens.
 *
 * @param config - OAuth2 configuration
 * @returns Auth interceptor with control methods for testing
 *
 * @example Basic usage
 * ```typescript
 * import { oauth2ClientCredentials } from 'wdio-api-runner'
 *
 * const auth = oauth2ClientCredentials({
 *   tokenUrl: 'https://auth.example.com/oauth/token',
 *   clientId: process.env.CLIENT_ID,
 *   clientSecret: process.env.CLIENT_SECRET
 * })
 *
 * api.addRequestInterceptor(auth.interceptor)
 * ```
 *
 * @example With scopes and audience
 * ```typescript
 * const auth = oauth2ClientCredentials({
 *   tokenUrl: 'https://auth.example.com/oauth/token',
 *   clientId: 'my-client',
 *   clientSecret: 'my-secret',
 *   scope: 'read:users write:users',
 *   audience: 'https://api.example.com',
 *   refreshBuffer: 120,  // Refresh 2 minutes before expiry
 *   onTokenRefresh: (token) => {
 *     console.log('New token expires in:', token.expires_in, 'seconds')
 *   }
 * })
 * ```
 *
 * @example Testing with expired token
 * ```typescript
 * const auth = oauth2ClientCredentials({
 *   tokenUrl: 'https://auth.example.com/oauth/token',
 *   clientId: 'client',
 *   clientSecret: 'secret',
 *   disableAutoRefresh: true  // Don't auto-refresh
 * })
 *
 * api.addRequestInterceptor(auth.interceptor)
 *
 * // After getting a valid token, inject an expired one
 * await api.get('/setup')  // Gets initial token
 * auth.setToken('expired-or-invalid-token')
 *
 * const response = await api.get('/protected')
 * expect(response.status).toBe(401)
 * ```
 */
export function oauth2ClientCredentials(config: OAuth2Config): AuthInterceptor {
    const {
        tokenUrl,
        clientId,
        clientSecret,
        scope,
        audience,
        refreshBuffer = DEFAULT_REFRESH_BUFFER,
        disableAutoRefresh = false,
        onTokenRefresh,
        extraParams,
        excludePaths,
    } = config

    // Token state
    let currentToken: OAuth2Token | null = null
    let tokenExpiry: number | null = null
    let isRefreshing = false
    let refreshPromise: Promise<void> | null = null

    /**
     * Fetch a new token from the token endpoint
     */
    const fetchToken = async (): Promise<OAuth2Token> => {
        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
        })

        if (scope) {
            body.set('scope', scope)
        }

        if (audience) {
            body.set('audience', audience)
        }

        // Add any extra parameters
        if (extraParams) {
            for (const [key, value] of Object.entries(extraParams)) {
                body.set(key, value)
            }
        }

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        })

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error')
            throw new Error(`OAuth2 token request failed: ${response.status} ${response.statusText}. ${errorText}`)
        }

        return response.json()
    }

    /**
     * Refresh the token
     */
    const doRefresh = async (): Promise<void> => {
        // Prevent concurrent refresh calls
        if (isRefreshing && refreshPromise) {
            return refreshPromise
        }

        isRefreshing = true
        refreshPromise = (async () => {
            try {
                currentToken = await fetchToken()
                tokenExpiry = currentToken.expires_in ? Date.now() + currentToken.expires_in * 1000 : null
                onTokenRefresh?.(currentToken)
            } finally {
                isRefreshing = false
                refreshPromise = null
            }
        })()

        return refreshPromise
    }

    /**
     * Get a valid access token, fetching/refreshing if necessary
     */
    const getAccessToken = async (): Promise<string> => {
        // Fetch initial token if not set
        if (currentToken === null) {
            await doRefresh()
        }
        // Check if we need to refresh (and auto-refresh is enabled)
        else if (!disableAutoRefresh && isTokenExpired(tokenExpiry, refreshBuffer)) {
            await doRefresh()
        }

        return currentToken!.access_token
    }

    /**
     * The request interceptor
     */
    const interceptor = async (url: string, options: RequestInit): Promise<RequestInit> => {
        // Skip auth for excluded paths
        if (shouldExclude(url, excludePaths)) {
            return options
        }

        const accessToken = await getAccessToken()

        return {
            ...options,
            headers: mergeHeaders(options.headers, {
                Authorization: `Bearer ${accessToken}`,
            }),
        }
    }

    return {
        interceptor,

        /**
         * Force a token refresh
         */
        forceRefresh: async (): Promise<void> => {
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
         * Set a specific access token (for testing with expired/invalid tokens)
         */
        setToken: (accessToken: string): void => {
            currentToken = {
                access_token: accessToken,
                token_type: 'Bearer',
            }
            // Clear expiry so auto-refresh won't trigger
            tokenExpiry = null
        },

        /**
         * Get the current access token value
         */
        getToken: (): string | null => {
            return currentToken?.access_token || null
        },
    }
}
