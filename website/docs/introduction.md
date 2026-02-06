---
sidebar_position: 1
slug: /
title: Introduction
description: Learn about wdio-api-runner, a WebdriverIO runner for blazing-fast API automation testing without browser overhead.
---

# Introduction

Welcome to **wdio-api-runner** — a specialized WebdriverIO runner designed for high-performance API automation testing. This runner eliminates the overhead of browser sessions, making your API tests faster, lighter, and easier to maintain.

## What is wdio-api-runner?

wdio-api-runner is a custom test runner for the [WebdriverIO](https://webdriver.io) test automation framework. While WebdriverIO is traditionally used for browser-based testing, many teams also need to test REST APIs, GraphQL endpoints, and backend services. Running these tests through a browser session is wasteful and slow.

**wdio-api-runner solves this problem** by providing a dedicated runner that:

- Skips browser initialization entirely
- Provides a built-in HTTP client optimized for API testing
- Maintains full compatibility with WebdriverIO's ecosystem (reporters, services, frameworks)
- Supports parallel test execution out of the box

## Why Choose wdio-api-runner?

### The Problem with Browser-Based API Testing

Traditional WebdriverIO testing spins up browser sessions for every test—even when you're just testing APIs. This creates significant overhead:

| Metric | Browser Runner | API Runner | Improvement |
|--------|---------------|------------|-------------|
| Startup time | ~2-5 seconds | **~50ms** | **40-100x faster** |
| Memory per worker | ~200-500MB | **~30MB** | **7-17x less memory** |
| Dependencies | Browser + Driver | **None** | **Zero external deps** |
| CI/CD complexity | High | **Minimal** | **Simpler pipelines** |
| Docker image size | ~1-2GB | **~200MB** | **5-10x smaller** |

### Real-World Impact

Consider a test suite with 500 API tests running on 10 parallel workers:

**With Browser Runner:**
- Startup: 10 workers × 3s = 30 seconds wasted
- Memory: 10 workers × 300MB = 3GB RAM required
- CI time: Additional browser installation steps

**With API Runner:**
- Startup: 10 workers × 50ms = 0.5 seconds
- Memory: 10 workers × 30MB = 300MB RAM required
- CI time: No browser installation needed

**Result:** Faster feedback loops, lower infrastructure costs, and simpler CI/CD pipelines.

## Key Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Zero Browser Overhead** | No WebDriver protocol, no browser binaries, no session management. Tests start instantly. |
| **Native Fetch API Client** | Modern, Promise-based HTTP client built on the Fetch API with full TypeScript support. |
| **Parallel Execution** | Full support for WebdriverIO's parallel worker architecture. Run hundreds of tests simultaneously. |
| **All Reporters Work** | Spec, Allure, JUnit, HTML—every WDIO reporter works without modification. |
| **All Frameworks Work** | Mocha, Jasmine, Cucumber—use your preferred test framework. |
| **Service Compatible** | Use WDIO services for setup/teardown, database seeding, mock servers, etc. |

### API Testing Features

| Feature | Description |
|---------|-------------|
| **Fluent Assertions** | Chain assertions for status codes, headers, body content, and JSON schema validation. |
| **Authentication Helpers** | Built-in support for Basic Auth, API Keys, Bearer/JWT tokens, and OAuth2 flows. |
| **Request Interceptors** | Add global middleware for authentication, logging, request modification, and more. |
| **Retry & Timeout** | Configurable request retries with exponential backoff and custom timeout handling. |
| **Response Timing** | Automatic request duration tracking for performance monitoring. |

### GraphQL Support

| Feature | Description |
|---------|-------------|
| **GraphQL Client** | Dedicated client for queries, mutations, and subscriptions with proper error handling. |
| **Query Builder** | Fluent API for building complex GraphQL operations programmatically. |
| **Real-time Subscriptions** | WebSocket and Server-Sent Events (SSE) support for GraphQL subscriptions. |
| **Type Safety** | Full TypeScript generics support for typed query responses. |

### Observability & Debugging

| Feature | Description |
|---------|-------------|
| **HAR Logging** | Record all HTTP traffic to HAR format for debugging, replay, and analysis. |
| **Performance Metrics** | Track p50/p95/p99 latency percentiles with threshold-based CI checks. |
| **Grouped Logs** | Optional log grouping by test spec for cleaner CI output. |
| **Verbose Mode** | Detailed request/response logging for debugging. |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Test Files                          │
│   describe('Users API', () => { ... })                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   wdio-api-runner                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ API Client  │  │  GraphQL    │  │   Auth      │        │
│  │  (Fetch)    │  │   Client    │  │  Helpers    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Assertions  │  │  Metrics    │  │ HAR Logger  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 WebdriverIO Core                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Reporters  │  │  Services   │  │  Parallel   │        │
│  │ (Spec,Allure│  │ (Custom)    │  │  Workers    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Your API Server                          │
│          https://api.example.com                            │
└─────────────────────────────────────────────────────────────┘
```

## Comparison with Alternatives

### vs. Browser-Based API Testing

| Aspect | wdio-api-runner | Browser Runner |
|--------|-----------------|----------------|
| Speed | ⚡ ~50ms startup | 🐢 ~2-5s startup |
| Memory | 💾 ~30MB | 💾 ~200-500MB |
| Dependencies | ✅ None | ❌ Browser + Driver |
| CORS | ✅ No restrictions | ❌ Browser rules apply |
| Cookies | 🔧 Manual | ✅ Automatic |
| CI Setup | ✅ Simple | ⚠️ Complex |

### vs. Standalone API Testing Tools

| Aspect | wdio-api-runner | Standalone Tools |
|--------|-----------------|------------------|
| WDIO Integration | ✅ Native | ❌ Separate tool |
| Parallel Execution | ✅ Built-in | ⚠️ Manual setup |
| Reporting | ✅ All WDIO reporters | ⚠️ Limited |
| Test Organization | ✅ Specs, suites | ⚠️ Varies |
| Learning Curve | ✅ Same as WDIO | ⚠️ New tool to learn |

## Use Cases

### Ideal For

- **Backend API Testing** — Test REST endpoints without browser overhead
- **Microservices Testing** — Validate service-to-service communication
- **GraphQL Testing** — Full support for queries, mutations, and subscriptions
- **Contract Testing** — Verify API contracts with schema validation
- **Performance Testing** — Track latency percentiles and set thresholds
- **CI/CD Pipelines** — Fast, lightweight tests for continuous integration

### Not Ideal For

- **End-to-End UI Testing** — Use standard WebdriverIO for browser testing
- **Visual Regression Testing** — Requires actual browser rendering
- **JavaScript-Heavy SPAs** — When you need to test client-side behavior

## Getting Started

Ready to start testing? Head to the [Installation Guide](/getting-started/installation) to set up wdio-api-runner in your project.

```bash
npm install wdio-api-runner --save-dev
```

Then configure your `wdio.conf.ts`:

```typescript
export const config: WebdriverIO.Config = {
    runner: 'api',
    specs: ['./test/api/**/*.spec.ts'],
    // ... rest of your config
}
```

## Next Steps

- [Installation](/getting-started/installation) — Install and configure wdio-api-runner
- [Quick Start](/getting-started/quick-start) — Write your first API test in minutes
- [Configuration](/getting-started/configuration) — Explore all configuration options
- [API Client](/core/api-client) — Learn the HTTP client API
