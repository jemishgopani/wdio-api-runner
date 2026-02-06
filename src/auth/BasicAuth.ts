import type { BasicAuthConfig, AuthInterceptor } from './types.js'
import { shouldExclude, encodeBasicAuth, mergeHeaders } from './utils.js'

/**
 * Creates a Basic Authentication interceptor
 *
 * Encodes username and password as Base64 and adds the Authorization header
 * to all requests (except excluded paths).
 *
 * @param config - Basic auth configuration
 * @returns Auth interceptor with the request interceptor function
 *
 * @example
 * ```typescript
 * import { basicAuth } from 'wdio-api-runner'
 *
 * const auth = basicAuth({
 *   username: 'myuser',
 *   password: 'mypassword'
 * })
 *
 * api.addRequestInterceptor(auth.interceptor)
 *
 * // All requests will now include:
 * // Authorization: Basic bXl1c2VyOm15cGFzc3dvcmQ=
 * ```
 *
 * @example Exclude certain paths
 * ```typescript
 * const auth = basicAuth({
 *   username: 'user',
 *   password: 'pass',
 *   excludePaths: ['/health', '/public', /^\/api\/v1\/docs/]
 * })
 * ```
 */
export function basicAuth(config: BasicAuthConfig): AuthInterceptor {
    const { username, password, excludePaths } = config
    const credentials = encodeBasicAuth(username, password)

    const interceptor = (url: string, options: RequestInit): RequestInit => {
        // Skip auth for excluded paths
        if (shouldExclude(url, excludePaths)) {
            return options
        }

        return {
            ...options,
            headers: mergeHeaders(options.headers, {
                Authorization: `Basic ${credentials}`,
            }),
        }
    }

    return { interceptor }
}
