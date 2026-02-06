---
sidebar_position: 2
title: Performance Metrics
description: Track p50/p95/p99 latency percentiles, error rates, and set performance thresholds for CI/CD pipelines. Monitor API performance over time.
---

# Performance Metrics

Track p50/p95/p99 latency, error rates, and set performance thresholds for CI/CD. The metrics collector provides comprehensive performance data to ensure your APIs meet performance requirements.

## Overview

The metrics system provides:

| Metric | Description |
|--------|-------------|
| **Percentiles** | p50, p75, p90, p95, p99 latency |
| **Error Rates** | Percentage of failed requests |
| **Timing Stats** | Mean, min, max, standard deviation |
| **Per-Endpoint** | Breakdown by API endpoint |
| **Thresholds** | CI/CD performance gates |

## Setup

```typescript
import {
    createMetricsCollector,
    createMetricsInterceptors
} from 'wdio-api-runner'

const metrics = createMetricsCollector()
const { requestInterceptor, responseInterceptor } = createMetricsInterceptors(metrics)

api.addRequestInterceptor(requestInterceptor)
api.addResponseInterceptor(responseInterceptor)
```

## Collecting Metrics

Metrics are automatically collected for all requests:

```typescript
describe('API Performance', () => {
    it('should handle multiple requests', async () => {
        for (let i = 0; i < 100; i++) {
            await api.get('/users')
        }
    })

    after(() => {
        const report = metrics.getReport()
        console.log('Performance Report:', report)
    })
})
```

## Metrics Report

```typescript
const report = metrics.getReport()

// Overall metrics
console.log('Total requests:', report.overall.count)
console.log('Error rate:', report.overall.errorRate)
console.log('Mean latency:', report.overall.mean)
console.log('P50:', report.overall.p50)
console.log('P95:', report.overall.p95)
console.log('P99:', report.overall.p99)
console.log('Min:', report.overall.min)
console.log('Max:', report.overall.max)

// Per-endpoint metrics
for (const [endpoint, stats] of Object.entries(report.endpoints)) {
    console.log(`\n${endpoint}:`)
    console.log(`  Count: ${stats.count}`)
    console.log(`  P95: ${stats.p95}ms`)
    console.log(`  Error rate: ${stats.errorRate}%`)
}
```

## Report Structure

```typescript
interface MetricsReport {
    overall: {
        count: number
        errorCount: number
        errorRate: number
        mean: number
        median: number
        p50: number
        p75: number
        p90: number
        p95: number
        p99: number
        min: number
        max: number
        stdDev: number
    }
    endpoints: {
        [endpoint: string]: {
            count: number
            errorCount: number
            errorRate: number
            mean: number
            p50: number
            p95: number
            p99: number
            min: number
            max: number
        }
    }
    byStatus: {
        [statusCode: number]: number
    }
    timeline: Array<{
        timestamp: number
        endpoint: string
        duration: number
        status: number
    }>
}
```

## Threshold Checking

Set performance thresholds for CI/CD pipelines:

```typescript
import { checkThresholds } from 'wdio-api-runner'

after(() => {
    const report = metrics.getReport()

    const result = checkThresholds(report, {
        p95: 500,        // P95 must be under 500ms
        p99: 1000,       // P99 must be under 1000ms
        errorRate: 1,    // Error rate must be under 1%
        mean: 200        // Mean must be under 200ms
    })

    if (!result.passed) {
        console.error('Performance thresholds exceeded:')
        for (const failure of result.failures) {
            console.error(`  - ${failure}`)
        }
        throw new Error('Performance requirements not met')
    }
})
```

## Per-Endpoint Thresholds

```typescript
const result = checkThresholds(report, {
    overall: {
        p95: 500,
        errorRate: 1
    },
    endpoints: {
        'GET /users': { p95: 200 },
        'POST /users': { p95: 500 },
        'GET /users/:id': { p95: 100 }
    }
})
```

## Grouping Metrics

### By Endpoint Pattern

```typescript
const metrics = createMetricsCollector({
    groupBy: 'pattern',
    patterns: {
        '/users/:id': /^\/users\/\d+$/,
        '/posts/:id': /^\/posts\/\d+$/
    }
})
```

### By Tag

```typescript
await api.get('/users', {
    headers: { 'X-Metrics-Tag': 'user-list' }
})

const report = metrics.getReportByTag()
console.log(report['user-list'])
```

## Metrics Reporter

Generate formatted reports:

```typescript
import { MetricsReporter } from 'wdio-api-runner'

const reporter = new MetricsReporter(metrics)

// Console report
reporter.printSummary()

// JSON export
await reporter.saveJson('./metrics/report.json')

// HTML report
await reporter.saveHtml('./metrics/report.html')

// CSV export
await reporter.saveCsv('./metrics/report.csv')
```

## Real-time Monitoring

```typescript
const metrics = createMetricsCollector({
    onMetric: (metric) => {
        if (metric.duration > 1000) {
            console.warn(`Slow request: ${metric.endpoint} took ${metric.duration}ms`)
        }
    }
})
```

## Comparison Reports

Compare performance between runs:

```typescript
import { compareReports } from 'wdio-api-runner'

const baselineReport = await loadReport('./baseline-metrics.json')
const currentReport = metrics.getReport()

const comparison = compareReports(baselineReport, currentReport)

console.log('P95 change:', comparison.overall.p95.change)
console.log('Regression:', comparison.hasRegression)

if (comparison.hasRegression) {
    console.error('Performance regression detected!')
    for (const regression of comparison.regressions) {
        console.error(`  ${regression.endpoint}: ${regression.message}`)
    }
}
```

## CI Integration

### GitHub Actions Example

```yaml
- name: Run API Tests
  run: npm test

- name: Check Performance
  run: |
    node -e "
    const { checkThresholds } = require('wdio-api-runner');
    const report = require('./metrics/report.json');
    const result = checkThresholds(report, { p95: 500, errorRate: 1 });
    if (!result.passed) {
      console.error('Performance check failed:', result.failures);
      process.exit(1);
    }
    "

- name: Upload Metrics
  uses: actions/upload-artifact@v3
  with:
    name: performance-metrics
    path: ./metrics/
```

## Reset Metrics

```typescript
// Clear all collected metrics
metrics.clear()

// Clear metrics for specific endpoint
metrics.clearEndpoint('GET /users')
```

## Next Steps

- [HAR Logging](/observability/har-logging) — Record requests for debugging
- [CI Integration](/advanced/ci-integration) — Integrate metrics into CI/CD
