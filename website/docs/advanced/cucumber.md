---
sidebar_position: 2
title: Cucumber Integration
description: BDD-style API testing with Cucumber. Learn step definitions, data tables, hooks, tags, and world context for behavior-driven API tests.
---

# Cucumber Integration

Use wdio-api-runner with Cucumber for BDD-style API testing. This enables writing tests in Gherkin syntax that non-technical stakeholders can read and understand.

## Configuration

```typescript
// wdio.conf.ts
export const config: WebdriverIO.Config = {
    runner: 'api',
    framework: 'cucumber',

    specs: ['./test/features/**/*.feature'],

    cucumberOpts: {
        require: ['./test/steps/**/*.ts'],
        tags: '@api'
    },

    baseUrl: 'https://api.example.com',

    apiRunner: {
        timeout: 30000
    }
}
```

## Feature Files

```gherkin
# test/features/users.feature
@api
Feature: Users API

  Background:
    Given I am authenticated as "admin"

  Scenario: Get user details
    When I request user with ID "1"
    Then the response status should be 200
    And the response should contain "email"

  Scenario: Create a new user
    When I create a user with:
      | name  | John Doe         |
      | email | john@example.com |
    Then the response status should be 201
    And the response should contain "id"

  Scenario: Update user name
    Given a user exists with ID "1"
    When I update user "1" with name "Jane Doe"
    Then the response status should be 200
    And the user name should be "Jane Doe"

  Scenario Outline: Validate email format
    When I create a user with email "<email>"
    Then the response status should be <status>

    Examples:
      | email            | status |
      | valid@email.com  | 201    |
      | invalid-email    | 400    |
      | @nodomain.com    | 400    |
```

## Step Definitions

```typescript
// test/steps/users.steps.ts
import { Given, When, Then } from '@wdio/cucumber-framework'
import { expect } from 'chai'

let response: any
let currentUser: any

Given('I am authenticated as {string}', async (role: string) => {
    const token = await getTokenForRole(role)
    api.setHeader('Authorization', `Bearer ${token}`)
})

Given('a user exists with ID {string}', async (id: string) => {
    const res = await api.get(`/users/${id}`)
    currentUser = res.data
})

When('I request user with ID {string}', async (id: string) => {
    response = await api.get(`/users/${id}`)
})

When('I create a user with:', async (dataTable: any) => {
    const data = dataTable.rowsHash()
    response = await api.post('/users', data)
})

When('I create a user with email {string}', async (email: string) => {
    response = await api.post('/users', {
        name: 'Test User',
        email: email
    })
})

When('I update user {string} with name {string}', async (id: string, name: string) => {
    response = await api.patch(`/users/${id}`, { name })
})

Then('the response status should be {int}', async (status: number) => {
    expect(response.status).to.equal(status)
})

Then('the response should contain {string}', async (field: string) => {
    expect(response.data).to.have.property(field)
})

Then('the user name should be {string}', async (name: string) => {
    expect(response.data.name).to.equal(name)
})
```

## Authentication Steps

```typescript
// test/steps/auth.steps.ts
import { Given, When, Then } from '@wdio/cucumber-framework'

const tokens = new Map<string, string>()

async function getTokenForRole(role: string): Promise<string> {
    if (!tokens.has(role)) {
        const credentials = {
            admin: { username: 'admin', password: 'admin123' },
            user: { username: 'user', password: 'user123' },
            guest: { username: 'guest', password: 'guest123' }
        }

        const cred = credentials[role]
        const response = await api.post('/auth/login', cred)
        tokens.set(role, response.data.token)
    }

    return tokens.get(role)!
}

Given('I am not authenticated', async () => {
    api.removeHeader('Authorization')
})

Given('I have an expired token', async () => {
    api.setHeader('Authorization', 'Bearer expired-token')
})

Given('I have an invalid token', async () => {
    api.setHeader('Authorization', 'Bearer invalid-token')
})
```

## Data Table Helpers

```typescript
// test/steps/helpers.ts
import { DataTable } from '@wdio/cucumber-framework'

export function tableToObject(dataTable: DataTable): Record<string, any> {
    return dataTable.rowsHash()
}

export function tableToArray(dataTable: DataTable): any[] {
    return dataTable.hashes()
}

// Usage in steps
When('I create users:', async (dataTable: DataTable) => {
    const users = tableToArray(dataTable)
    for (const user of users) {
        await api.post('/users', user)
    }
})
```

## World Context

Share state between steps:

```typescript
// test/support/world.ts
import { setWorldConstructor, World } from '@wdio/cucumber-framework'

export class CustomWorld extends World {
    response: any
    currentUser: any
    token: string

    async saveResponse(res: any) {
        this.response = res
    }
}

setWorldConstructor(CustomWorld)
```

```typescript
// test/steps/users.steps.ts
import { When, Then } from '@wdio/cucumber-framework'
import { CustomWorld } from '../support/world'

When('I request user with ID {string}', async function(this: CustomWorld, id: string) {
    this.response = await api.get(`/users/${id}`)
})

Then('the response status should be {int}', async function(this: CustomWorld, status: number) {
    expect(this.response.status).to.equal(status)
})
```

## Hooks

```typescript
// test/support/hooks.ts
import { Before, After, BeforeAll, AfterAll } from '@wdio/cucumber-framework'

BeforeAll(async () => {
    // Global setup
    console.log('Starting API test suite')
})

AfterAll(async () => {
    // Global teardown
    console.log('API test suite complete')
})

Before({ tags: '@auth' }, async () => {
    // Setup for authenticated scenarios
    const token = await getAdminToken()
    api.setHeader('Authorization', `Bearer ${token}`)
})

After(async function() {
    // Cleanup after each scenario
    api.removeHeader('Authorization')
})

Before({ tags: '@slow' }, async () => {
    // Increase timeout for slow tests
    api.setHeader('X-Test-Timeout', '60000')
})
```

## Tags

```gherkin
@api @smoke
Feature: Critical API Tests

  @auth
  Scenario: Admin can delete users
    Given I am authenticated as "admin"
    When I delete user "999"
    Then the response status should be 204

  @slow @integration
  Scenario: Bulk import users
    Given I have a CSV file with 1000 users
    When I import the users
    Then all users should be created
```

Run specific tags:

```bash
# Run only smoke tests
npx wdio run wdio.conf.ts --cucumberOpts.tags="@smoke"

# Run auth tests but not slow tests
npx wdio run wdio.conf.ts --cucumberOpts.tags="@auth and not @slow"
```
