---
sidebar_position: 1
title: HAR Logging
description: Record HTTP requests to HAR (HTTP Archive) format for debugging, replay, and analysis. Learn configuration, filtering, sensitive data handling, and integration with analysis tools.
---

# HAR Logging

Record HTTP requests to HAR (HTTP Archive) format for debugging, replay, and analysis. HAR files are an industry-standard format that can be imported into Chrome DevTools, Postman, Charles Proxy, and many other tools.

## Overview

HAR logging provides complete visibility into your API test traffic:

| Feature | Description |
|---------|-------------|
| **Full Request Details** | URL, method, headers, body |
| **Full Response Details** | Status, headers, body, timing |
| **Timing Breakdown** | DNS, connect, send, wait, receive |
| **Industry Standard** | Compatible with browser devtools and analysis tools |

## Configuration

Enable HAR logging in your config:

```typescript
// wdio.conf.ts
export const config: WebdriverIO.Config = {
    runner: 'api',

    apiRunner: {
        logging: {
            enabled: true,
            outputDir: './har-logs',
            filename: 'api-requests.har'
        }
    }
}
```

## Recording Requests

### Automatic Recording

With logging enabled, all requests are automatically recorded:

```typescript
it('should create user', async () => {
    const response = await api.post('/users', {
        name: 'John',
        email: 'john@example.com'
    })

    expect(response.status).toBe(201)
    // Request is automatically logged to HAR file
})
```

### Manual Recording Control

```typescript
import { harLogger } from 'wdio-api-runner'

it('should record specific requests', async () => {
    harLogger.startRecording()

    await api.get('/users')
    await api.post('/users', { name: 'John' })

    const har = harLogger.stopRecording()
    await harLogger.saveToFile('./test-output/user-tests.har')
})
```

## HAR File Structure

The generated HAR file follows the HAR 1.2 specification:

```json
{
    "log": {
        "version": "1.2",
        "creator": {
            "name": "wdio-api-runner",
            "version": "1.0.0"
        },
        "entries": [
            {
                "startedDateTime": "2024-01-15T10:30:00.000Z",
                "time": 145,
                "request": {
                    "method": "POST",
                    "url": "https://api.example.com/users",
                    "headers": [...],
                    "postData": {
                        "mimeType": "application/json",
                        "text": "{\"name\":\"John\"}"
                    }
                },
                "response": {
                    "status": 201,
                    "statusText": "Created",
                    "headers": [...],
                    "content": {
                        "size": 256,
                        "mimeType": "application/json",
                        "text": "{\"id\":1,\"name\":\"John\"}"
                    }
                },
                "timings": {
                    "send": 5,
                    "wait": 130,
                    "receive": 10
                }
            }
        ]
    }
}
```

## Viewing HAR Files

### Chrome DevTools

1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Right-click → Import HAR file

### Online Viewers

- [HAR Viewer](http://www.softwareishard.com/har/viewer/)
- [Google HAR Analyzer](https://toolbox.googleapps.com/apps/har_analyzer/)

### Programmatic Access

```typescript
import { harLogger } from 'wdio-api-runner'

const har = harLogger.getHar()

for (const entry of har.log.entries) {
    console.log(`${entry.request.method} ${entry.request.url}`)
    console.log(`  Status: ${entry.response.status}`)
    console.log(`  Time: ${entry.time}ms`)
}
```

## Filtering

### By URL Pattern

```typescript
apiRunner: {
    logging: {
        enabled: true,
        filter: {
            includeUrls: ['/api/*'],
            excludeUrls: ['/api/health', '/api/metrics']
        }
    }
}
```

### By Status Code

```typescript
apiRunner: {
    logging: {
        enabled: true,
        filter: {
            statusCodes: [400, 401, 403, 404, 500] // Only log errors
        }
    }
}
```

## Sensitive Data

### Redact Headers

```typescript
apiRunner: {
    logging: {
        enabled: true,
        redact: {
            headers: ['Authorization', 'X-API-Key', 'Cookie']
        }
    }
}
```

### Redact Body Fields

```typescript
apiRunner: {
    logging: {
        enabled: true,
        redact: {
            bodyFields: ['password', 'token', 'secret']
        }
    }
}
```

## Per-Test HAR Files

```typescript
import { harLogger } from 'wdio-api-runner'

describe('User API', () => {
    beforeEach(() => {
        harLogger.startRecording()
    })

    afterEach(async function() {
        const testName = this.currentTest?.title.replace(/\s+/g, '-')
        await harLogger.saveToFile(`./har-logs/${testName}.har`)
        harLogger.clear()
    })

    it('should create user', async () => {
        await api.post('/users', { name: 'John' })
    })
})
```

## Use Cases

### Debugging Failed Tests

```typescript
afterEach(async function() {
    if (this.currentTest?.state === 'failed') {
        const testName = this.currentTest.title.replace(/\s+/g, '-')
        await harLogger.saveToFile(`./failed-tests/${testName}.har`)
    }
})
```

### Performance Analysis

```typescript
const har = harLogger.getHar()
const slowRequests = har.log.entries.filter(e => e.time > 1000)

console.log('Slow requests (>1s):')
for (const entry of slowRequests) {
    console.log(`  ${entry.request.url}: ${entry.time}ms`)
}
```

## Next Steps

- [Performance Metrics](/observability/metrics) — Track latency percentiles
- [Interceptors](/core/interceptors) — Custom logging with interceptors
