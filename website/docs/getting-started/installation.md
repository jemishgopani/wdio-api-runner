---
sidebar_position: 1
title: Installation
description: Step-by-step guide to installing wdio-api-runner in your WebdriverIO project, including prerequisites, package installation, and verification.
---

# Installation

This guide walks you through installing wdio-api-runner in your project. Whether you're adding it to an existing WebdriverIO project or starting fresh, you'll be up and running in minutes.

## Prerequisites

Before installing wdio-api-runner, ensure your environment meets these requirements:

### System Requirements

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | ≥ 18.0.0 | LTS versions recommended |
| **npm** | ≥ 8.0.0 | Comes with Node.js |
| **WebdriverIO** | ≥ 9.0.0 | Peer dependency |

### Check Your Environment

Verify your Node.js and npm versions:

```bash
node --version
# Should output v18.x.x or higher

npm --version
# Should output 8.x.x or higher
```

If you need to upgrade Node.js, we recommend using [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager):

```bash
# Install the latest LTS version
nvm install --lts
nvm use --lts
```

## Installation Methods

### New Project Setup

If you're starting a new project, first initialize a WebdriverIO project:

```bash
# Create project directory
mkdir my-api-tests
cd my-api-tests

# Initialize npm project
npm init -y

# Install WebdriverIO CLI
npm install @wdio/cli --save-dev

# Run WebdriverIO configuration wizard
npx wdio config
```

During the configuration wizard:
- Select **"On my local machine"** for where to run tests
- Choose your preferred test framework (Mocha, Jasmine, or Cucumber)
- Select reporters you want (Spec reporter is a good start)
- Skip browser selection (we won't need browsers)

Then install wdio-api-runner:

```bash
npm install wdio-api-runner --save-dev
```

### Existing Project

If you already have a WebdriverIO project, simply add wdio-api-runner:

```bash
npm install wdio-api-runner --save-dev
```

### Package Managers

#### npm (recommended)

```bash
npm install wdio-api-runner --save-dev
```

#### Yarn

```bash
yarn add wdio-api-runner --dev
```

#### pnpm

```bash
pnpm add wdio-api-runner --save-dev
```

## Verify Installation

After installation, verify the package is correctly installed:

```bash
# Check if package is in node_modules
npm ls wdio-api-runner
```

Expected output:
```
my-project@1.0.0
└── wdio-api-runner@1.0.0
```

You can also verify by checking your `package.json`:

```json
{
    "devDependencies": {
        "wdio-api-runner": "^1.0.0",
        "@wdio/cli": "^9.0.0"
    }
}
```

## Project Structure

After installation, we recommend organizing your project like this:

```
my-api-tests/
├── test/
│   └── api/
│       ├── users.spec.ts      # User API tests
│       ├── products.spec.ts   # Product API tests
│       └── auth.spec.ts       # Authentication tests
├── wdio.conf.ts               # WebdriverIO configuration
├── tsconfig.json              # TypeScript configuration
└── package.json
```

### TypeScript Setup (Recommended)

If you're using TypeScript, create or update your `tsconfig.json`:

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "esModuleInterop": true,
        "strict": true,
        "skipLibCheck": true,
        "resolveJsonModule": true,
        "types": [
            "node",
            "@wdio/globals/types",
            "@wdio/mocha-framework"
        ]
    },
    "include": [
        "test/**/*.ts",
        "wdio.conf.ts"
    ]
}
```

Install TypeScript dependencies:

```bash
npm install typescript ts-node @types/node --save-dev
```

## Basic Configuration

Update your `wdio.conf.ts` to use the API runner:

```typescript
export const config: WebdriverIO.Config = {
    // Use the API runner instead of browser runner
    runner: 'api',

    // Specify your test files
    specs: ['./test/api/**/*.spec.ts'],

    // Choose your test framework
    framework: 'mocha',
    mochaOpts: {
        timeout: 60000
    },

    // Configure reporters
    reporters: ['spec'],

    // Base URL for your API
    baseUrl: 'https://api.example.com',

    // API Runner specific options
    apiRunner: {
        timeout: 30000,
        headers: {
            'Content-Type': 'application/json'
        }
    },

    // Parallel execution
    maxInstances: 10
}
```

## Troubleshooting

### Common Installation Issues

#### "Cannot find module 'wdio-api-runner'"

**Cause:** Package not installed or incorrect import path.

**Solution:**
```bash
# Reinstall the package
npm uninstall wdio-api-runner
npm install wdio-api-runner --save-dev

# Clear npm cache if issues persist
npm cache clean --force
```

#### "Peer dependency not met: webdriverio"

**Cause:** WebdriverIO version is too old or not installed.

**Solution:**
```bash
# Install or upgrade WebdriverIO
npm install webdriverio@latest --save-dev
npm install @wdio/cli@latest --save-dev
```

#### TypeScript Compilation Errors

**Cause:** Missing type definitions or incorrect tsconfig.

**Solution:**
```bash
# Install required type definitions
npm install @types/node @wdio/globals --save-dev
```

## What's Installed

When you install wdio-api-runner, you get:

| Component | Description |
|-----------|-------------|
| **API Client** | HTTP client with GET, POST, PUT, PATCH, DELETE methods |
| **GraphQL Client** | Client for queries, mutations, and subscriptions |
| **Assertion Helpers** | Fluent assertion chains for API responses |
| **Auth Helpers** | Basic, Bearer, API Key, and OAuth2 authentication |
| **Metrics Collector** | Performance tracking and threshold checking |
| **HAR Logger** | HTTP Archive recording for debugging |

## Next Steps

Now that wdio-api-runner is installed, you're ready to write your first test:

- [Quick Start](/getting-started/quick-start) — Write and run your first API test
- [Configuration](/getting-started/configuration) — Explore all configuration options
- [API Client](/core/api-client) — Learn the HTTP client API in detail
