import type { RequestInterceptor } from '../shared/types.js'

/**
 * Token storage interface for persisting auth tokens
 */
export interface TokenStorage {
    /**
     * Get a token by key
     */
    get(key: string): Promise<string | null>

    /**
     * Store a token with optional expiration
     * @param key - Storage key
     * @param value - Token value
     * @param expiresAt - Optional expiration timestamp (ms)
     */
    set(key: string, value: string, expiresAt?: number): Promise<void>

    /**
     * Remove a token by key
     */
    remove(key: string): Promise<void>

    /**
     * Clear all stored tokens
     */
    clear(): Promise<void>
}

/**
 * Base configuration shared by all auth strategies
 */
export interface BaseAuthConfig {
    /**
     * URL patterns to exclude from authentication
     * Requests matching these patterns will not have auth applied
     */
    excludePaths?: (string | RegExp)[]
}

/**
 * Basic Authentication configuration
 */
export interface BasicAuthConfig extends BaseAuthConfig {
    username: string
    password: string
}

/**
 * API Key Authentication configuration
 */
export interface ApiKeyAuthConfig extends BaseAuthConfig {
    /**
     * The API key value
     */
    value: string

    /**
     * Where to place the API key
     */
    in: 'header' | 'query' | 'cookie'

    /**
     * Header name, query parameter name, or cookie name
     * @default 'X-API-Key' for header, 'api_key' for query/cookie
     */
    name?: string
}

/**
 * Bearer/JWT Authentication configuration
 */
export interface BearerAuthConfig extends BaseAuthConfig {
    /**
     * Static token string or function that returns a token
     */
    token: string | (() => string | Promise<string>)

    /**
     * Function to refresh the token when it expires
     */
    refresh?: () => Promise<string>

    /**
     * Seconds before token expiry to trigger refresh
     * @default 60
     */
    refreshBuffer?: number

    /**
     * Disable automatic token refresh (useful for negative testing)
     * @default false
     */
    disableAutoRefresh?: boolean

    /**
     * Callback invoked when token is refreshed
     */
    onRefresh?: (newToken: string) => void

    /**
     * Authorization header name
     * @default 'Authorization'
     */
    headerName?: string

    /**
     * Token prefix in the header
     * @default 'Bearer'
     */
    prefix?: string

    /**
     * Custom token storage
     * @default MemoryStorage
     */
    storage?: TokenStorage
}

/**
 * OAuth2 token response structure
 */
export interface OAuth2Token {
    access_token: string
    token_type: string
    expires_in?: number
    refresh_token?: string
    scope?: string
}

/**
 * OAuth2 Client Credentials configuration
 */
export interface OAuth2Config extends BaseAuthConfig {
    /**
     * Token endpoint URL
     */
    tokenUrl: string

    /**
     * OAuth2 client ID
     */
    clientId: string

    /**
     * OAuth2 client secret
     */
    clientSecret: string

    /**
     * Requested scopes (space-separated)
     */
    scope?: string

    /**
     * Target audience for the token
     */
    audience?: string

    /**
     * Seconds before token expiry to trigger refresh
     * @default 60
     */
    refreshBuffer?: number

    /**
     * Disable automatic token refresh (useful for negative testing)
     * @default false
     */
    disableAutoRefresh?: boolean

    /**
     * Callback invoked when token is refreshed
     */
    onTokenRefresh?: (token: OAuth2Token) => void

    /**
     * Custom token storage
     * @default MemoryStorage
     */
    storage?: TokenStorage

    /**
     * Additional parameters to include in token request body
     */
    extraParams?: Record<string, string>
}

/**
 * Result of creating an auth interceptor
 * Contains the interceptor function and optional control methods
 */
export interface AuthInterceptor {
    /**
     * The request interceptor to add to the API client
     */
    interceptor: RequestInterceptor

    /**
     * Force a token refresh (for testing)
     */
    forceRefresh?: () => Promise<void>

    /**
     * Clear all stored tokens
     */
    clearTokens?: () => Promise<void>

    /**
     * Set a specific token (for testing with expired/invalid tokens)
     */
    setToken?: (token: string) => void

    /**
     * Get the current token value (for debugging)
     */
    getToken?: () => string | null
}
