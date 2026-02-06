import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createStubBrowser, type StubBrowser } from '../src/browser/StubBrowser.js'

describe('stubBrowser', () => {
    let stubBrowser: StubBrowser
    const mockConfig: WebdriverIO.Config = {
        baseUrl: 'https://api.example.com',
    }
    const mockCaps = {
        browserName: 'api',
        platformName: 'API',
    }

    beforeEach(() => {
        process.env.WDIO_WORKER_ID = 'test-worker-1'
        stubBrowser = createStubBrowser(mockConfig, mockCaps)
    })

    describe('createStubBrowser', () => {
        it('should create stub browser with correct properties', () => {
            expect(stubBrowser.isApi).toBe(true)
            expect(stubBrowser.isStub).toBe(true)
            expect(stubBrowser.capabilities).toEqual(mockCaps)
            expect(stubBrowser.requestedCapabilities).toEqual(mockCaps)
            expect(stubBrowser.options).toEqual(mockConfig)
        })

        it('should generate sessionId with worker ID', () => {
            expect(stubBrowser.sessionId).toMatch(/^api-test-worker-1-\d+$/)
        })

        it('should use "unknown" if worker ID not set', () => {
            delete process.env.WDIO_WORKER_ID
            const browser = createStubBrowser(mockConfig, mockCaps)
            expect(browser.sessionId).toMatch(/^api-unknown-\d+$/)
        })
    })

    describe('utility methods', () => {
        describe('pause', () => {
            it('should pause for specified milliseconds', async () => {
                const start = Date.now()
                await stubBrowser.pause(50)
                const elapsed = Date.now() - start
                expect(elapsed).toBeGreaterThanOrEqual(45) // Allow some variance
            })
        })

        describe('call', () => {
            it('should execute sync function and return result', async () => {
                const result = await stubBrowser.call(() => 'test result')
                expect(result).toBe('test result')
            })

            it('should execute async function and return result', async () => {
                const result = await stubBrowser.call(async () => {
                    return Promise.resolve('async result')
                })
                expect(result).toBe('async result')
            })
        })
    })

    describe('event emitter', () => {
        it('should support on() method', () => {
            const listener = vi.fn()
            const result = stubBrowser.on('test', listener)
            expect(result).toBe(stubBrowser) // Chainable
        })

        it('should support once() method', () => {
            const listener = vi.fn()
            const result = stubBrowser.once('test', listener)
            expect(result).toBe(stubBrowser) // Chainable
        })

        it('should support emit() method', () => {
            const listener = vi.fn()
            stubBrowser.on('customEvent', listener)
            stubBrowser.emit('customEvent', 'arg1', 'arg2')
            expect(listener).toHaveBeenCalledWith('arg1', 'arg2')
        })
    })

    describe('browser method stubs', () => {
        const browserMethods = [
            'url',
            'getUrl',
            'getTitle',
            'back',
            'forward',
            'refresh',
            'keys',
            'action',
            'actions',
            'execute',
            'executeAsync',
            'switchToWindow',
            'closeWindow',
            'getWindowHandle',
            'getWindowHandles',
            'switchToFrame',
            'switchToParentFrame',
            'createWindow',
            'switchWindow',
            'newWindow',
            'getCookies',
            'setCookies',
            'deleteCookie',
            'deleteCookies',
            'acceptAlert',
            'dismissAlert',
            'getAlertText',
            'sendAlertText',
            'isAlertOpen',
            'takeScreenshot',
            'saveScreenshot',
            'reloadSession',
            'deleteSession',
            'setTimeout',
            'setTimeouts',
            'scroll',
            'scrollIntoView',
            'mock',
            'mockClearAll',
            'mockRestoreAll',
            'debug',
            'getPageSource',
            'throttle',
            'setGeoLocation',
            'getPuppeteer',
            'uploadFile',
        ]

        it.each(browserMethods)('browser.%s() should throw helpful error', async (method) => {
            const browserMethod = (stubBrowser as unknown as Record<string, () => Promise<unknown>>)[method]
            expect(browserMethod).toBeDefined()

            await expect(browserMethod()).rejects.toThrow(`browser.${method}() is not available in API runner mode`)
        })

        it('browser.$() should throw helpful error', () => {
            expect(() => stubBrowser.$('selector')).toThrow('browser.$() is not available in API runner mode')
        })

        it('browser.$$() should throw helpful error', () => {
            expect(() => stubBrowser.$$('selector')).toThrow('browser.$$() is not available in API runner mode')
        })

        it('error message should mention using api client', async () => {
            await expect((stubBrowser as unknown as Record<string, () => Promise<unknown>>).url()).rejects.toThrow(
                "Use the global 'api' client for HTTP requests"
            )
        })
    })

    describe('browser properties', () => {
        it('should return false for isMobile', () => {
            expect(stubBrowser.isMobile).toBe(false)
        })

        it('should return false for isIOS', () => {
            expect(stubBrowser.isIOS).toBe(false)
        })

        it('should return false for isAndroid', () => {
            expect(stubBrowser.isAndroid).toBe(false)
        })

        it('should return false for isChrome', () => {
            expect(stubBrowser.isChrome).toBe(false)
        })

        it('should return false for isFirefox', () => {
            expect(stubBrowser.isFirefox).toBe(false)
        })

        it('should return false for isSauce', () => {
            expect(stubBrowser.isSauce).toBe(false)
        })

        it('should return false for isBidi', () => {
            expect(stubBrowser.isBidi).toBe(false)
        })
    })

    describe('type safety', () => {
        it('should have StubBrowser interface properties', () => {
            // These should compile without errors
            const _sessionId: string = stubBrowser.sessionId
            const _capabilities: WebdriverIO.Capabilities = stubBrowser.capabilities
            const _isApi: true = stubBrowser.isApi
            const _isStub: true = stubBrowser.isStub

            expect(_sessionId).toBeDefined()
            expect(_capabilities).toBeDefined()
            expect(_isApi).toBe(true)
            expect(_isStub).toBe(true)
        })
    })
})
