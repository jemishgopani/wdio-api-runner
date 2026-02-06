import type { ApiKeyAuthConfig, AuthInterceptor } from './types.js'
import type { RequestInterceptor } from '../shared/types.js'
import { shouldExclude, mergeHeaders } from './utils.js'

/**
 * Default header name for API key
 */
const DEFAULT_HEADER_NAME = 'X-API-Key'

/**
 * Default query/cookie parameter name for API key
 */
const DEFAULT_PARAM_NAME = 'api_key'

/**
 * Creates an API Key Authentication interceptor
 *
 * Places the API key in a header, query parameter, or cookie based on configuration.
 *
 * @param config - API key auth configuration
 * @returns Auth interceptor with the request interceptor function
 *
 * @example Header-based API key
 * ```typescript
 * import { apiKeyAuth } from 'wdio-api-runner'
 *
 * const auth = apiKeyAuth({
 *   value: process.env.API_KEY,
 *   in: 'header',
 *   name: 'X-API-Key'  // optional, this is the default
 * })
 *
 * api.addRequestInterceptor(auth.interceptor)
 *
 * // Requests will include: X-API-Key: <your-key>
 * ```
 *
 * @example Query parameter API key
 * ```typescript
 * const auth = apiKeyAuth({
 *   value: 'my-secret-key',
 *   in: 'query',
 *   name: 'api_key'
 * })
 *
 * // Requests to /users will become /users?api_key=my-secret-key
 * ```
 *
 * @example Cookie-based API key
 * ```typescript
 * const auth = apiKeyAuth({
 *   value: 'my-secret-key',
 *   in: 'cookie',
 *   name: 'session_token'
 * })
 *
 * // Requests will include: Cookie: session_token=my-secret-key
 * ```
 */
export function apiKeyAuth(config: ApiKeyAuthConfig): AuthInterceptor {
    const { value, in: placement, excludePaths } = config

    // Determine the name based on placement
    const name = config.name || (placement === 'header' ? DEFAULT_HEADER_NAME : DEFAULT_PARAM_NAME)

    let interceptor: RequestInterceptor

    switch (placement) {
        case 'header':
            interceptor = (url: string, options: RequestInit): RequestInit => {
                if (shouldExclude(url, excludePaths)) {
                    return options
                }

                return {
                    ...options,
                    headers: mergeHeaders(options.headers, {
                        [name]: value,
                    }),
                }
            }
            break

        case 'query':
            interceptor = (url: string, options: RequestInit) => {
                if (shouldExclude(url, excludePaths)) {
                    return options
                }

                // Parse the URL and add the query parameter
                // Handle both absolute and relative URLs
                let modifiedUrl: string
                try {
                    const urlObj = new URL(url)
                    urlObj.searchParams.set(name, value)
                    modifiedUrl = urlObj.toString()
                } catch {
                    // Relative URL - parse with dummy base
                    const urlObj = new URL(url, 'http://localhost')
                    urlObj.searchParams.set(name, value)
                    // Return just the path + query + hash
                    modifiedUrl = urlObj.pathname + urlObj.search + urlObj.hash
                }

                return {
                    ...options,
                    url: modifiedUrl,
                }
            }
            break

        case 'cookie':
            interceptor = (url: string, options: RequestInit): RequestInit => {
                if (shouldExclude(url, excludePaths)) {
                    return options
                }

                // Get existing cookies
                const existingHeaders = options.headers || {}
                let existingCookie = ''

                if (existingHeaders instanceof Headers) {
                    existingCookie = existingHeaders.get('Cookie') || ''
                } else if (Array.isArray(existingHeaders)) {
                    const cookieEntry = existingHeaders.find(([key]) => key.toLowerCase() === 'cookie')
                    existingCookie = cookieEntry ? cookieEntry[1] : ''
                } else {
                    existingCookie =
                        (existingHeaders as Record<string, string>)['Cookie'] ||
                        (existingHeaders as Record<string, string>)['cookie'] ||
                        ''
                }

                // Append new cookie
                const newCookie = existingCookie ? `${existingCookie}; ${name}=${value}` : `${name}=${value}`

                return {
                    ...options,
                    headers: mergeHeaders(options.headers, {
                        Cookie: newCookie,
                    }),
                }
            }
            break
    }

    return { interceptor }
}
