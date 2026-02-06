---
sidebar_position: 4
title: CI/CD Integration
description: Integrate wdio-api-runner into CI/CD pipelines including GitHub Actions, GitLab CI, Jenkins, CircleCI, and Azure DevOps with performance thresholds and parallel execution.
---

# CI/CD Integration

Integrate wdio-api-runner into your CI/CD pipelines for automated API testing. This guide covers configuration for popular CI platforms with examples for performance monitoring, parallel execution, and artifact management.

## GitHub Actions

```yaml
# .github/workflows/api-tests.yml
name: API Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run API tests
        run: npm test
        env:
          API_BASE_URL: ${{ secrets.API_BASE_URL }}
          API_KEY: ${{ secrets.API_KEY }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: |
            ./logs/
            ./allure-results/
```

### With Performance Thresholds

```yaml
- name: Run API tests
  run: npm test

- name: Check performance thresholds
  run: |
    node -e "
    const { checkThresholds } = require('wdio-api-runner');
    const report = require('./metrics/report.json');
    const result = checkThresholds(report, {
      p95: 500,
      errorRate: 1
    });
    if (!result.passed) {
      console.error('Performance check failed:', result.failures);
      process.exit(1);
    }
    "
```

### Matrix Testing

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [staging, production]

    steps:
      - uses: actions/checkout@v4

      - name: Run tests against ${{ matrix.environment }}
        run: npm test
        env:
          API_BASE_URL: ${{ matrix.environment == 'staging' && secrets.STAGING_URL || secrets.PROD_URL }}
```

## GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - test

api-tests:
  stage: test
  image: node:20
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/
  script:
    - npm ci
    - npm test
  artifacts:
    when: always
    paths:
      - logs/
      - allure-results/
    expire_in: 1 week
  variables:
    API_BASE_URL: ${API_BASE_URL}
    API_KEY: ${API_KEY}
```

## Jenkins

```groovy
// Jenkinsfile
pipeline {
    agent {
        docker {
            image 'node:20'
        }
    }

    environment {
        API_BASE_URL = credentials('api-base-url')
        API_KEY = credentials('api-key')
    }

    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
            post {
                always {
                    archiveArtifacts artifacts: 'logs/**/*', allowEmptyArchive: true
                    junit 'junit-results/*.xml'
                }
            }
        }
    }
}
```

## CircleCI

```yaml
# .circleci/config.yml
version: 2.1

jobs:
  api-tests:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - restore_cache:
          keys:
            - v1-deps-{{ checksum "package-lock.json" }}
      - run: npm ci
      - save_cache:
          key: v1-deps-{{ checksum "package-lock.json" }}
          paths:
            - node_modules
      - run:
          name: Run API Tests
          command: npm test
      - store_artifacts:
          path: logs
      - store_test_results:
          path: junit-results

workflows:
  test:
    jobs:
      - api-tests
```

## Azure DevOps

```yaml
# azure-pipelines.yml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'

  - script: npm ci
    displayName: 'Install dependencies'

  - script: npm test
    displayName: 'Run API tests'
    env:
      API_BASE_URL: $(API_BASE_URL)
      API_KEY: $(API_KEY)

  - task: PublishTestResults@2
    condition: always()
    inputs:
      testResultsFiles: 'junit-results/*.xml'
      testRunTitle: 'API Tests'

  - task: PublishBuildArtifacts@1
    condition: always()
    inputs:
      pathtoPublish: 'logs'
      artifactName: 'test-logs'
```

## Environment Variables

Common environment variables for CI:

```bash
# API Configuration
API_BASE_URL=https://api.staging.example.com
API_KEY=your-api-key
API_TIMEOUT=30000

# Test Configuration
WDIO_LOG_LEVEL=info
MAX_INSTANCES=5

# Override via environment
WDIO_API_OPTIONS='{"baseUrl":"https://staging.api.com","timeout":60000}'
```

## Reporters for CI

### JUnit Reporter

```typescript
// wdio.conf.ts
reporters: [
    'spec',
    ['junit', {
        outputDir: './junit-results',
        outputFileFormat: function(options) {
            return `results-${options.cid}.xml`
        }
    }]
]
```

### Allure Reporter

```typescript
reporters: [
    'spec',
    ['allure', {
        outputDir: './allure-results',
        disableWebdriverStepsReporting: true,
        disableWebdriverScreenshotsReporting: true
    }]
]
```

Generate report:

```bash
npx allure generate allure-results --clean -o allure-report
npx allure open allure-report
```

## Parallel Execution

Optimize CI time with parallel workers:

```typescript
// wdio.conf.ts
export const config = {
    runner: 'api',
    maxInstances: process.env.CI ? 10 : 5,
    // ...
}
```

## Retry Configuration

Handle flaky tests in CI:

```typescript
// wdio.conf.ts
export const config = {
    runner: 'api',

    // Retry failed specs
    specFileRetries: process.env.CI ? 2 : 0,
    specFileRetriesDelay: 1000,

    // Retry failed tests
    mochaOpts: {
        retries: process.env.CI ? 1 : 0
    }
}
```

## Caching

### GitHub Actions

```yaml
- uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

### GitLab

```yaml
cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
```
