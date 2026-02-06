import { createStubBrowser, createApiClient, assertResponse } from 'wdio-api-runner'
import { expect } from 'chai'

/**
 * Stub Browser Examples
 *
 * The createStubBrowser function creates a mock browser object that works
 * in API-only testing mode. This is useful when:
 *
 * 1. You have shared test utilities that expect a browser object
 * 2. You want to gradually migrate from browser tests to API tests
 * 3. You need to check browser properties in conditional logic
 *
 * Note: Most browser methods throw helpful errors directing you to use
 * the API client instead. Only utility methods like pause() and call() work.
 */
describe('Browser - Stub Browser', () => {
    describe('Creating Stub Browser', () => {
        it('should create a stub browser with basic configuration', () => {
            const config: WebdriverIO.Config = {
                runner: 'api',
                specs: ['./test/specs/**/*.ts'],
            }

            const capabilities = {
                browserName: 'api',
            }

            const stubBrowser = createStubBrowser(config, capabilities)

            expect(stubBrowser).to.exist
            expect(stubBrowser.isApi).to.equal(true)
            expect(stubBrowser.isStub).to.equal(true)
        })

        it('should have a unique session ID', () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            expect(stubBrowser.sessionId).to.exist
            expect(stubBrowser.sessionId).to.include('api-')
        })

        it('should expose capabilities', () => {
            const capabilities = {
                browserName: 'api',
                platformName: 'any',
            }

            const stubBrowser = createStubBrowser({}, capabilities)

            expect(stubBrowser.capabilities).to.deep.equal(capabilities)
            expect(stubBrowser.requestedCapabilities).to.deep.equal(capabilities)
        })

        it('should expose config options', () => {
            const config: WebdriverIO.Config = {
                runner: 'api',
                baseUrl: 'https://api.example.com',
                waitforTimeout: 10000,
            }

            const stubBrowser = createStubBrowser(config, { browserName: 'api' })

            expect(stubBrowser.options).to.equal(config)
        })
    })

    describe('Working Methods', () => {
        it('should support pause() for delays', async () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            const start = Date.now()
            await stubBrowser.pause(100)
            const elapsed = Date.now() - start

            expect(elapsed).to.be.at.least(95) // Allow small timing variance
        })

        it('should support call() for async operations', async () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            const result = await stubBrowser.call(async () => {
                return 'async result'
            })

            expect(result).to.equal('async result')
        })

        it('should support call() with sync functions', async () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            const result = await stubBrowser.call(() => {
                return 42
            })

            expect(result).to.equal(42)
        })
    })

    describe('Browser Properties', () => {
        it('should have isMobile property set to false', () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            expect(stubBrowser.isMobile).to.equal(false)
        })

        it('should have isIOS property set to false', () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            expect(stubBrowser.isIOS).to.equal(false)
        })

        it('should have isAndroid property set to false', () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            expect(stubBrowser.isAndroid).to.equal(false)
        })

        it('should have isChrome property set to false', () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            expect(stubBrowser.isChrome).to.equal(false)
        })

        it('should have isFirefox property set to false', () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            expect(stubBrowser.isFirefox).to.equal(false)
        })

        it('should have isSauce property set to false', () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            expect(stubBrowser.isSauce).to.equal(false)
        })

        it('should have isBidi property set to false', () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            expect(stubBrowser.isBidi).to.equal(false)
        })
    })

    describe('Event Emitter Support', () => {
        it('should support event subscription', () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            let eventReceived = false
            stubBrowser.on('custom-event', () => {
                eventReceived = true
            })

            stubBrowser.emit('custom-event')

            expect(eventReceived).to.equal(true)
        })

        it('should support once() for single event', () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            let callCount = 0
            stubBrowser.once('single-event', () => {
                callCount++
            })

            stubBrowser.emit('single-event')
            stubBrowser.emit('single-event')

            expect(callCount).to.equal(1)
        })

        it('should pass event data to listeners', () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            let receivedData: unknown
            stubBrowser.on('data-event', (data) => {
                receivedData = data
            })

            stubBrowser.emit('data-event', { key: 'value' })

            expect(receivedData).to.deep.equal({ key: 'value' })
        })
    })

    describe('Browser Method Errors', () => {
        it('should throw error for url() method', async () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            try {
                await (stubBrowser as unknown as { url: (u: string) => Promise<void> }).url('https://example.com')
                expect.fail('Should have thrown an error')
            } catch (error) {
                expect((error as Error).message).to.include('browser.url() is not available in API runner mode')
            }
        })

        it('should throw error for $() selector', () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            // $ and $$ are sync stubs that throw immediately
            try {
                ;(stubBrowser as unknown as { $: (s: string) => void }).$('#element')
                expect.fail('Should have thrown an error')
            } catch (error) {
                expect((error as Error).message).to.include('browser.$() is not available in API runner mode')
            }
        })

        it('should throw error for $$() selector', () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            try {
                ;(stubBrowser as unknown as { $$: (s: string) => void }).$$('.elements')
                expect.fail('Should have thrown an error')
            } catch (error) {
                expect((error as Error).message).to.include('browser.$$() is not available in API runner mode')
            }
        })

        it('should provide helpful error message', () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            try {
                ;(stubBrowser as unknown as { $: (s: string) => void }).$('#test')
                expect.fail('Should have thrown an error')
            } catch (error) {
                expect((error as Error).message).to.include('API runner')
                expect((error as Error).message).to.include("Use the global 'api' client")
            }
        })
    })

    describe('Integration with API Client', () => {
        it('should demonstrate using stub browser alongside API client', async () => {
            // Create stub browser (would be provided by framework in real tests)
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            // Create API client for actual HTTP requests
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            // Check if we're in API mode
            if (stubBrowser.isApi) {
                // Make API request instead of browser automation
                const response = await api.get('/users/1')
                assertResponse(response).toBeOk()
            }

            expect(stubBrowser.isApi).to.equal(true)
        })

        it('should demonstrate conditional logic based on browser type', async () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            // This pattern is useful for shared test utilities
            const getData = async () => {
                if (stubBrowser.isApi) {
                    // API mode: fetch data directly
                    const response = await api.get<{ id: number; name: string }>('/users/1')
                    return response.data
                } else {
                    // Browser mode: would scrape from page
                    // return browser.$('#user-name').getText();
                    throw new Error('Browser mode not available')
                }
            }

            const data = await getData()
            expect(data.id).to.equal(1)
        })
    })

    describe('Real-world Usage Patterns', () => {
        it('should demonstrate delay pattern in API tests', async () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            // Create a resource
            const createResponse = await api.post('/posts', {
                title: 'Test Post',
                body: 'Test Content',
                userId: 1,
            })
            assertResponse(createResponse).toHaveStatus(201)

            // Wait a bit (simulating eventual consistency)
            await stubBrowser.pause(100)

            // Verify it exists
            const getResponse = await api.get('/posts/1')
            assertResponse(getResponse).toBeOk()
        })

        it('should demonstrate async helper pattern', async () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            // Use call() for complex async logic
            const result = await stubBrowser.call(async () => {
                const api = createApiClient({
                    baseUrl: 'https://jsonplaceholder.typicode.com',
                })

                // Perform multiple operations
                const users = await api.get<Array<{ id: number }>>('/users')
                const firstUserId = users.data[0].id

                const posts = await api.get<Array<{ userId: number }>>(`/posts?userId=${firstUserId}`)

                return {
                    userId: firstUserId,
                    postCount: posts.data.length,
                }
            })

            expect(result.userId).to.equal(1)
            expect(result.postCount).to.be.above(0)
        })

        it('should demonstrate migration helper pattern', () => {
            /**
             * Pattern: Creating a wrapper that works in both modes
             *
             * This is useful when migrating from browser tests to API tests.
             *
             * const testHelper = {
             *     async login(username: string, password: string) {
             *         if (browser.isApi) {
             *             // API mode: call auth endpoint
             *             return api.post('/auth/login', { username, password });
             *         } else {
             *             // Browser mode: fill form and submit
             *             await $('#username').setValue(username);
             *             await $('#password').setValue(password);
             *             await $('button[type=submit]').click();
             *         }
             *     }
             * };
             */
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })
            expect(stubBrowser.isApi).to.equal(true)
        })
    })

    describe('Testing Best Practices', () => {
        it('should check isApi before browser operations', () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            // Always check isApi to avoid errors
            if (!stubBrowser.isApi) {
                // This code won't run in API mode
                // browser.url('https://example.com');
            }

            expect(stubBrowser.isApi).to.equal(true)
        })

        it('should use type guards for safe browser access', () => {
            const stubBrowser = createStubBrowser({}, { browserName: 'api' })

            // Type guard for browser operations
            const isBrowserMode = (b: { isApi?: boolean }): boolean => {
                return b.isApi !== true
            }

            expect(isBrowserMode(stubBrowser)).to.equal(false)
        })
    })
})
