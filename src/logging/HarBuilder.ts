/**
 * HAR format builder utilities
 */

import type {
    Har,
    HarEntry,
    HarRequest,
    HarResponse,
    HarHeader,
    HarQueryParam,
    HarCookie,
    HarPostData,
    HarContent,
    HarTimings,
    HarCache,
} from './types.js'

/**
 * Package version for HAR creator info
 */
const PACKAGE_VERSION = '1.0.0'

/**
 * Create a complete HAR object from entries
 */
export function createHar(entries: HarEntry[]): Har {
    return {
        log: {
            version: '1.2',
            creator: {
                name: 'wdio-api-runner',
                version: PACKAGE_VERSION,
            },
            entries,
        },
    }
}

/**
 * Create a HAR entry from request and response data
 */
export function createHarEntry(
    request: {
        url: string
        method: string
        headers: Headers
        body?: string
    },
    response: {
        status: number
        statusText: string
        headers: Headers
        body?: string
    },
    timing: {
        start: number
        end: number
    }
): HarEntry {
    const totalTime = timing.end - timing.start

    return {
        startedDateTime: new Date(timing.start).toISOString(),
        time: totalTime,
        request: createHarRequest(request.url, request.method, request.headers, request.body),
        response: createHarResponse(response.status, response.statusText, response.headers, response.body),
        cache: createEmptyCache(),
        timings: createTimings(totalTime),
    }
}

/**
 * Create HAR request object
 */
export function createHarRequest(url: string, method: string, headers: Headers, body?: string): HarRequest {
    const harHeaders = headersToHarHeaders(headers)
    const queryString = parseQueryString(url)
    const cookies = parseCookiesFromHeaders(headers)

    const headersSize = calculateHeadersSize(harHeaders)
    const bodySize = body ? new TextEncoder().encode(body).length : 0

    const request: HarRequest = {
        method: method.toUpperCase(),
        url,
        httpVersion: 'HTTP/1.1',
        cookies,
        headers: harHeaders,
        queryString,
        headersSize,
        bodySize,
    }

    // Add POST data if present
    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        const contentType = headers.get('content-type') || 'application/octet-stream'
        request.postData = createPostData(body, contentType)
    }

    return request
}

/**
 * Create HAR response object
 */
export function createHarResponse(status: number, statusText: string, headers: Headers, body?: string): HarResponse {
    const harHeaders = headersToHarHeaders(headers)
    const cookies = parseCookiesFromHeaders(headers)
    const contentType = headers.get('content-type') || 'application/octet-stream'

    const headersSize = calculateHeadersSize(harHeaders)
    const bodySize = body ? new TextEncoder().encode(body).length : 0

    return {
        status,
        statusText,
        httpVersion: 'HTTP/1.1',
        cookies,
        headers: harHeaders,
        content: createContent(body, contentType),
        redirectURL: headers.get('location') || '',
        headersSize,
        bodySize,
    }
}

/**
 * Convert Headers object to HAR headers array
 */
export function headersToHarHeaders(headers: Headers): HarHeader[] {
    const result: HarHeader[] = []

    headers.forEach((value, name) => {
        result.push({ name, value })
    })

    return result
}

/**
 * Parse query string from URL
 */
export function parseQueryString(url: string): HarQueryParam[] {
    try {
        const urlObj = new URL(url)
        const result: HarQueryParam[] = []

        urlObj.searchParams.forEach((value, name) => {
            result.push({ name, value })
        })

        return result
    } catch {
        // Invalid URL, return empty array
        return []
    }
}

/**
 * Parse cookies from Cookie header string
 */
export function parseCookies(cookieHeader: string): HarCookie[] {
    if (!cookieHeader) {
        return []
    }

    return cookieHeader
        .split(';')
        .map((cookie) => {
            const [name, ...valueParts] = cookie.trim().split('=')
            return {
                name: name.trim(),
                value: valueParts.join('=').trim(),
            }
        })
        .filter((cookie) => cookie.name)
}

/**
 * Parse cookies from Headers object
 */
function parseCookiesFromHeaders(headers: Headers): HarCookie[] {
    const cookieHeader = headers.get('cookie')
    if (cookieHeader) {
        return parseCookies(cookieHeader)
    }

    // Also check Set-Cookie for responses
    const setCookieHeader = headers.get('set-cookie')
    if (setCookieHeader) {
        return parseSetCookies(setCookieHeader)
    }

    return []
}

/**
 * Parse Set-Cookie header (response cookies)
 */
function parseSetCookies(setCookieHeader: string): HarCookie[] {
    // Set-Cookie can have multiple values separated by newlines or commas
    // For simplicity, we parse the basic format
    const cookies: HarCookie[] = []

    const parts = setCookieHeader.split(/,(?=\s*[^;=]+=[^;]*(?:;|$))/)

    for (const part of parts) {
        const [mainPart, ...attributes] = part.split(';')
        const [name, ...valueParts] = mainPart.trim().split('=')

        if (!name) continue

        const cookie: HarCookie = {
            name: name.trim(),
            value: valueParts.join('=').trim(),
        }

        // Parse attributes
        for (const attr of attributes) {
            const [attrName, attrValue] = attr.trim().split('=')
            const lowerAttrName = attrName.toLowerCase()

            switch (lowerAttrName) {
                case 'path':
                    cookie.path = attrValue
                    break
                case 'domain':
                    cookie.domain = attrValue
                    break
                case 'expires':
                    cookie.expires = attrValue
                    break
                case 'httponly':
                    cookie.httpOnly = true
                    break
                case 'secure':
                    cookie.secure = true
                    break
            }
        }

        cookies.push(cookie)
    }

    return cookies
}

/**
 * Create POST data object
 */
export function createPostData(body: string, contentType: string): HarPostData {
    const mimeType = contentType.split(';')[0].trim()

    // Check if it's form data
    if (mimeType === 'application/x-www-form-urlencoded') {
        try {
            const params = new URLSearchParams(body)
            const harParams: { name: string; value: string }[] = []

            params.forEach((value, name) => {
                harParams.push({ name, value })
            })

            return {
                mimeType,
                params: harParams,
                text: body,
            }
        } catch {
            // Fall through to text
        }
    }

    return {
        mimeType,
        text: body,
    }
}

/**
 * Create response content object
 */
function createContent(body: string | undefined, contentType: string): HarContent {
    const mimeType = contentType.split(';')[0].trim()
    const size = body ? new TextEncoder().encode(body).length : 0

    const content: HarContent = {
        size,
        mimeType,
    }

    if (body) {
        content.text = body
    }

    return content
}

/**
 * Create empty cache object
 */
function createEmptyCache(): HarCache {
    return {}
}

/**
 * Create timings object
 * Since we only have total time, we split it between wait and receive
 */
function createTimings(totalTime: number): HarTimings {
    // Estimate: most time is spent waiting for response
    const waitTime = Math.floor(totalTime * 0.9)
    const receiveTime = totalTime - waitTime

    return {
        blocked: -1,
        dns: -1,
        connect: -1,
        send: 0,
        wait: waitTime,
        receive: receiveTime,
        ssl: -1,
    }
}

/**
 * Calculate approximate size of headers in bytes
 */
function calculateHeadersSize(headers: HarHeader[]): number {
    let size = 0

    for (const header of headers) {
        // Format: "Name: Value\r\n"
        size += header.name.length + 2 + header.value.length + 2
    }

    // Add final \r\n
    size += 2

    return size
}

/**
 * Truncate body if it exceeds max size
 */
export function truncateBody(body: string, maxSize: number): string {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(body)

    if (bytes.length <= maxSize) {
        return body
    }

    // Truncate to max size
    const decoder = new TextDecoder('utf-8', { fatal: false })
    return decoder.decode(bytes.slice(0, maxSize)) + '\n[...truncated]'
}

/**
 * Mask sensitive header values (for security)
 */
export function maskSensitiveHeaders(headers: HarHeader[]): HarHeader[] {
    const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie', 'x-api-key']

    return headers.map((header) => {
        if (sensitiveHeaders.includes(header.name.toLowerCase())) {
            return {
                ...header,
                value: '***',
            }
        }
        return header
    })
}
