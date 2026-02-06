import { createApiClient, assertResponse } from 'wdio-api-runner'
import { expect } from 'chai'
import * as fs from 'fs'
import * as path from 'path'

describe('Observability - HAR Logging', () => {
    const harLogsDir = path.join(process.cwd(), 'har-logs')

    // Ensure har-logs directory exists
    before(() => {
        if (!fs.existsSync(harLogsDir)) {
            fs.mkdirSync(harLogsDir, { recursive: true })
        }
    })

    describe('Basic HAR Recording', () => {
        it('should record requests to HAR file', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            // Start recording
            api.startRecording('basic-requests')

            // Make some requests
            await api.get('/users/1')
            await api.get('/posts/1')
            await api.post('/posts', { title: 'Test', body: 'Content', userId: 1 })

            // Stop recording and get file path (async)
            const harFilePath = await api.stopRecording()

            expect(harFilePath).to.exist
            expect(harFilePath).to.include('basic-requests')
            expect(harFilePath).to.include('.har')

            // Verify file was created
            expect(fs.existsSync(harFilePath!)).to.equal(true)

            // Read and verify HAR content
            const harContent = JSON.parse(fs.readFileSync(harFilePath!, 'utf-8'))
            expect(harContent.log).to.exist
            expect(harContent.log.entries).to.be.an('array')
            expect(harContent.log.entries.length).to.equal(3) // 3 requests
        })

        it('should record with auto-generated filename', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            api.startRecording() // No filename provided

            await api.get('/users/1')

            const harFilePath = await api.stopRecording()

            expect(harFilePath).to.exist
            expect(fs.existsSync(harFilePath!)).to.equal(true)
        })
    })

    describe('HAR Content Structure', () => {
        it('should capture request details', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            api.startRecording('request-details')

            await api.get('/users/1', {
                headers: { 'X-Custom-Header': 'test-value' },
            })

            const harFilePath = await api.stopRecording()
            const harContent = JSON.parse(fs.readFileSync(harFilePath!, 'utf-8'))

            const entry = harContent.log.entries[0]

            // Verify request structure exists
            expect(entry.request).to.exist
            expect(entry.request.method).to.exist
            expect(entry.request.url).to.exist
            expect(entry.request.headers).to.be.an('array')
        })

        it('should capture response details', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            api.startRecording('response-details')

            await api.get('/users/1')

            const harFilePath = await api.stopRecording()
            const harContent = JSON.parse(fs.readFileSync(harFilePath!, 'utf-8'))

            const entry = harContent.log.entries[0]

            // Verify response structure
            expect(entry.response).to.exist
            expect(entry.response.status).to.equal(200)
            expect(entry.response.statusText).to.equal('OK')
            expect(entry.response.headers).to.be.an('array')
        })

        it('should capture timing information', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            api.startRecording('timing-info')

            await api.get('/users/1')

            const harFilePath = await api.stopRecording()
            const harContent = JSON.parse(fs.readFileSync(harFilePath!, 'utf-8'))

            const entry = harContent.log.entries[0]

            // Verify timing
            expect(entry.time).to.be.above(0)
            expect(entry.startedDateTime).to.exist
        })
    })

    describe('Recording State Management', () => {
        it('should check if recording is active', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            expect(api.isRecording()).to.equal(false)

            api.startRecording('state-check')
            expect(api.isRecording()).to.equal(true)

            await api.stopRecording()
            expect(api.isRecording()).to.equal(false)
        })

        it('should get current HAR object', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            api.startRecording('get-har')

            await api.get('/users/1')
            await api.get('/users/2')

            // Get HAR without stopping
            const har = api.getHar()

            expect(har).to.exist
            expect(har?.log.entries.length).to.equal(2)

            // Still recording
            expect(api.isRecording()).to.equal(true)

            await api.stopRecording()
        })

        it('should handle multiple recording sessions', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            // First session
            api.startRecording('session-1')
            await api.get('/users/1')
            const path1 = await api.stopRecording()

            // Second session
            api.startRecording('session-2')
            await api.get('/posts/1')
            await api.get('/posts/2')
            const path2 = await api.stopRecording()

            // Verify both files exist and have correct entry counts
            const har1 = JSON.parse(fs.readFileSync(path1!, 'utf-8'))
            const har2 = JSON.parse(fs.readFileSync(path2!, 'utf-8'))

            expect(har1.log.entries.length).to.equal(1)
            expect(har2.log.entries.length).to.equal(2)
        })
    })

    describe('Recording with Different HTTP Methods', () => {
        it('should record multiple HTTP requests', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            api.startRecording('all-methods')

            await api.get('/users/1')
            await api.post('/users', { name: 'Test' })
            await api.put('/users/1', { name: 'Updated' })
            await api.patch('/users/1', { name: 'Patched' })
            await api.delete('/users/1')

            const harFilePath = await api.stopRecording()
            const harContent = JSON.parse(fs.readFileSync(harFilePath!, 'utf-8'))

            // Verify all 5 requests were recorded
            expect(harContent.log.entries.length).to.equal(5)

            // Verify each entry has a request object with method
            harContent.log.entries.forEach((entry: any) => {
                expect(entry.request).to.exist
                expect(entry.request.method).to.exist
            })
        })
    })

    describe('Integration with Assertions', () => {
        it('should work alongside assertions', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            api.startRecording('with-assertions')

            const response = await api.get('/users/1')

            // Assertions still work during recording
            assertResponse(response)
                .toBeOk()
                .toHaveBodyProperty('id', 1)
                .toHaveContentType('application/json; charset=utf-8')

            const harFilePath = await api.stopRecording()

            // HAR was still captured
            const harContent = JSON.parse(fs.readFileSync(harFilePath!, 'utf-8'))
            expect(harContent.log.entries.length).to.equal(1)
        })
    })

    describe('HAR Version and Creator', () => {
        it('should include HAR version and creator info', async () => {
            const api = createApiClient({
                baseUrl: 'https://jsonplaceholder.typicode.com',
            })

            api.startRecording('version-check')
            await api.get('/users/1')
            const harFilePath = await api.stopRecording()

            const harContent = JSON.parse(fs.readFileSync(harFilePath!, 'utf-8'))

            expect(harContent.log.version).to.equal('1.2')
            expect(harContent.log.creator).to.exist
            expect(harContent.log.creator.name).to.exist
        })
    })
})
