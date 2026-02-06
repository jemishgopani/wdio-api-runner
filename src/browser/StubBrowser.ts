import { EventEmitter } from 'node:events'
import type { Capabilities } from '@wdio/types'

export interface StubBrowser {
    sessionId: string
    capabilities: WebdriverIO.Capabilities
    requestedCapabilities: Capabilities.RequestedStandaloneCapabilities
    options: WebdriverIO.Config
    isApi: true
    isStub: true

    // Utility methods that work in stub mode
    pause: (ms: number) => Promise<void>
    call: <T>(fn: () => T | Promise<T>) => Promise<T>

    // Event emitter methods
    on: (event: string, listener: (...args: unknown[]) => void) => StubBrowser
    once: (event: string, listener: (...args: unknown[]) => void) => StubBrowser
    emit: (event: string, ...args: unknown[]) => boolean

    // All browser methods throw helpful errors
    [key: string]: unknown
}

const BROWSER_METHODS = [
    // Navigation
    'url',
    'getUrl',
    'getTitle',
    'back',
    'forward',
    'refresh',
    // Elements
    '$',
    '$$',
    'custom$',
    'custom$$',
    'react$',
    'react$$',
    // Actions
    'keys',
    'action',
    'actions',
    // Execute
    'execute',
    'executeAsync',
    'call',
    // Windows/Frames
    'switchToWindow',
    'closeWindow',
    'getWindowHandle',
    'getWindowHandles',
    'switchToFrame',
    'switchToParentFrame',
    'createWindow',
    'switchWindow',
    'newWindow',
    // Cookies
    'getCookies',
    'setCookies',
    'deleteCookie',
    'deleteCookies',
    // Alerts
    'acceptAlert',
    'dismissAlert',
    'getAlertText',
    'sendAlertText',
    'isAlertOpen',
    // Screenshots
    'takeScreenshot',
    'saveScreenshot',
    // Session
    'reloadSession',
    'deleteSession',
    // Timeouts
    'setTimeout',
    'setTimeouts',
    // Scroll
    'scroll',
    'scrollIntoView',
    // Other
    'mock',
    'mockClearAll',
    'mockRestoreAll',
    'debug',
    'getPageSource',
    'throttle',
    'setGeoLocation',
    'getPuppeteer',
    'uploadFile',
] as const

/**
 * Creates a stub browser object for API-only testing.
 * Browser methods throw helpful errors directing users to use the API client.
 */
export function createStubBrowser(
    config: WebdriverIO.Config,
    caps: Capabilities.RequestedStandaloneCapabilities
): StubBrowser {
    const emitter = new EventEmitter()
    const cid = process.env.WDIO_WORKER_ID || 'unknown'

    const createBrowserError = (method: string): never => {
        throw new Error(
            `browser.${method}() is not available in API runner mode. ` +
                `The API runner is designed for HTTP/REST API testing without browser automation. ` +
                `Use the global 'api' client for HTTP requests, or switch to runner: 'local' for browser tests.`
        )
    }

    // Create async stub that throws error
    const createAsyncStub = (method: string) => {
        return async (..._args: unknown[]): Promise<never> => {
            return createBrowserError(method)
        }
    }

    // Create sync stub that throws error
    const createSyncStub = (method: string) => {
        return (..._args: unknown[]): never => {
            return createBrowserError(method)
        }
    }

    const stubBrowser = Object.assign(emitter, {
        sessionId: `api-${cid}-${Date.now()}`,
        capabilities: caps as WebdriverIO.Capabilities,
        requestedCapabilities: caps,
        options: config,
        isApi: true as const,
        isStub: true as const,

        // Methods that actually work in stub mode
        pause: async (ms: number): Promise<void> => {
            return new Promise((resolve) => setTimeout(resolve, ms))
        },

        call: async <T>(fn: () => T | Promise<T>): Promise<T> => {
            return await fn()
        },
    }) as unknown as StubBrowser & Record<string, unknown>

    // Add all browser methods as stubs that throw helpful errors
    for (const method of BROWSER_METHODS) {
        if (!(method in stubBrowser)) {
            // $ and $$ are commonly used synchronously in chaining, make them sync
            if (method === '$' || method === '$$') {
                ;(stubBrowser as Record<string, unknown>)[method] = createSyncStub(method)
            } else {
                ;(stubBrowser as Record<string, unknown>)[method] = createAsyncStub(method)
            }
        }
    }

    // Add commonly accessed properties
    Object.defineProperties(stubBrowser, {
        isMobile: {
            get: () => false,
            configurable: true,
        },
        isIOS: {
            get: () => false,
            configurable: true,
        },
        isAndroid: {
            get: () => false,
            configurable: true,
        },
        isChrome: {
            get: () => false,
            configurable: true,
        },
        isFirefox: {
            get: () => false,
            configurable: true,
        },
        isSauce: {
            get: () => false,
            configurable: true,
        },
        isBidi: {
            get: () => false,
            configurable: true,
        },
    })

    return stubBrowser
}
