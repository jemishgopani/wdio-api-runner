/**
 * Authentication helpers for wdio-api-runner
 *
 * Provides pre-built request interceptors for common authentication patterns.
 *
 * @example Basic Authentication
 * ```typescript
 * import { basicAuth } from 'wdio-api-runner'
 *
 * const auth = basicAuth({
 *   username: 'user',
 *   password: 'pass'
 * })
 * api.addRequestInterceptor(auth.interceptor)
 * ```
 *
 * @example API Key Authentication
 * ```typescript
 * import { apiKeyAuth } from 'wdio-api-runner'
 *
 * const auth = apiKeyAuth({
 *   value: process.env.API_KEY,
 *   in: 'header',
 *   name: 'X-API-Key'
 * })
 * api.addRequestInterceptor(auth.interceptor)
 * ```
 *
 * @example Bearer/JWT Authentication
 * ```typescript
 * import { bearerAuth } from 'wdio-api-runner'
 *
 * const auth = bearerAuth({
 *   token: () => getStoredToken(),
 *   refresh: () => refreshToken(),
 *   refreshBuffer: 60
 * })
 * api.addRequestInterceptor(auth.interceptor)
 * ```
 *
 * @example OAuth2 Client Credentials
 * ```typescript
 * import { oauth2ClientCredentials } from 'wdio-api-runner'
 *
 * const auth = oauth2ClientCredentials({
 *   tokenUrl: 'https://auth.example.com/oauth/token',
 *   clientId: process.env.CLIENT_ID,
 *   clientSecret: process.env.CLIENT_SECRET,
 *   scope: 'read write'
 * })
 * api.addRequestInterceptor(auth.interceptor)
 * ```
 */

// Auth strategies
export { basicAuth } from './BasicAuth.js'
export { apiKeyAuth } from './ApiKeyAuth.js'
export { bearerAuth } from './BearerAuth.js'
export { oauth2ClientCredentials } from './OAuth2Auth.js'

// Storage
export { MemoryStorage } from './storage/index.js'

// Utilities
export { parseJwtExpiry, shouldExclude, encodeBasicAuth, isTokenExpired, mergeHeaders } from './utils.js'

// Types
export type {
    TokenStorage,
    BaseAuthConfig,
    BasicAuthConfig,
    ApiKeyAuthConfig,
    BearerAuthConfig,
    OAuth2Config,
    OAuth2Token,
    AuthInterceptor,
} from './types.js'
