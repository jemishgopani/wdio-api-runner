---
sidebar_position: 2
title: Query Builder
description: Build GraphQL queries and mutations programmatically with a fluent API. Learn about field selection, variables, fragments, aliases, and directives.
---

# Query Builder

Build GraphQL queries and mutations programmatically with the fluent Query Builder API. This approach is useful when you need dynamic query construction, code reuse, or want to avoid string concatenation.

## Overview

The Query Builder provides a programmatic way to construct GraphQL operations:

| Feature | Description |
|---------|-------------|
| **Fluent API** | Chain methods for readable query construction |
| **Type Safe** | Full TypeScript support for variables and fields |
| **Reusable** | Build fragments and compose queries |
| **Dynamic** | Construct queries based on runtime conditions |

## Basic Usage

### Creating a Query

```typescript
import { createGraphQLClient } from 'wdio-api-runner'

const graphql = createGraphQLClient({
    endpoint: 'https://api.example.com/graphql'
})

// Build a query programmatically
const query = graphql.buildQuery('GetUsers')
    .select('users', {
        fields: ['id', 'name', 'email']
    })
    .build()

// Execute the built query
const response = await graphql.execute(query)
```

### Generated Query

The above produces:

```graphql
query GetUsers {
    users {
        id
        name
        email
    }
}
```

## Building Queries

### Simple Selection

Select fields from a root field:

```typescript
const query = graphql.buildQuery('GetUser')
    .addVariable('id', 'ID!')
    .select('user', {
        args: { id: '$id' },
        fields: ['id', 'name', 'email']
    })
    .build()

// Generates:
// query GetUser($id: ID!) {
//     user(id: $id) {
//         id
//         name
//         email
//     }
// }

// Execute with variables
const response = await graphql.execute(query, { id: '123' })
```

### Nested Selections

Select nested objects and their fields:

```typescript
const query = graphql.buildQuery('GetUserWithPosts')
    .addVariable('id', 'ID!')
    .select('user', {
        args: { id: '$id' },
        fields: [
            'id',
            'name',
            'email',
            {
                // Nested object
                posts: {
                    fields: ['id', 'title', 'content', 'publishedAt']
                }
            },
            {
                // Another nested object
                profile: {
                    fields: ['bio', 'avatar', 'website']
                }
            }
        ]
    })
    .build()

// Generates:
// query GetUserWithPosts($id: ID!) {
//     user(id: $id) {
//         id
//         name
//         email
//         posts {
//             id
//             title
//             content
//             publishedAt
//         }
//         profile {
//             bio
//             avatar
//             website
//         }
//     }
// }
```

### Deeply Nested Selections

Handle multiple levels of nesting:

```typescript
const query = graphql.buildQuery('GetOrganization')
    .addVariable('id', 'ID!')
    .select('organization', {
        args: { id: '$id' },
        fields: [
            'id',
            'name',
            {
                departments: {
                    fields: [
                        'id',
                        'name',
                        {
                            employees: {
                                fields: [
                                    'id',
                                    'name',
                                    {
                                        manager: {
                                            fields: ['id', 'name']
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
        ]
    })
    .build()
```

### Multiple Root Selections

Select multiple root fields in a single query:

```typescript
const query = graphql.buildQuery('Dashboard')
    .select('currentUser', {
        fields: ['id', 'name', 'avatar']
    })
    .select('notifications', {
        fields: ['id', 'message', 'read', 'createdAt']
    })
    .select('stats', {
        fields: ['totalUsers', 'activeUsers', 'newUsersToday']
    })
    .select('recentActivity', {
        fields: ['id', 'type', 'description', 'timestamp']
    })
    .build()

// Generates:
// query Dashboard {
//     currentUser { id name avatar }
//     notifications { id message read createdAt }
//     stats { totalUsers activeUsers newUsersToday }
//     recentActivity { id type description timestamp }
// }
```

## Building Mutations

### Basic Mutation

```typescript
const mutation = graphql.buildMutation('CreateUser')
    .addVariable('input', 'CreateUserInput!')
    .select('createUser', {
        args: { input: '$input' },
        fields: ['id', 'name', 'email', 'createdAt']
    })
    .build()

const response = await graphql.execute(mutation, {
    input: {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secure123'
    }
})

// Generates:
// mutation CreateUser($input: CreateUserInput!) {
//     createUser(input: $input) {
//         id
//         name
//         email
//         createdAt
//     }
// }
```

### Update Mutation

```typescript
const mutation = graphql.buildMutation('UpdateUser')
    .addVariable('id', 'ID!')
    .addVariable('input', 'UpdateUserInput!')
    .select('updateUser', {
        args: { id: '$id', input: '$input' },
        fields: ['id', 'name', 'email', 'updatedAt']
    })
    .build()

const response = await graphql.execute(mutation, {
    id: '123',
    input: {
        name: 'Jane Doe Updated'
    }
})
```

### Delete Mutation

```typescript
const mutation = graphql.buildMutation('DeleteUser')
    .addVariable('id', 'ID!')
    .select('deleteUser', {
        args: { id: '$id' },
        fields: ['success', 'message']
    })
    .build()

const response = await graphql.execute(mutation, { id: '123' })
```

## Variables

### Adding Variables

Define variables with their GraphQL types:

```typescript
const query = graphql.buildQuery('SearchUsers')
    .addVariable('query', 'String!')          // Required string
    .addVariable('limit', 'Int', 10)          // Int with default value
    .addVariable('offset', 'Int', 0)          // Int with default value
    .addVariable('sortBy', 'SortField')       // Optional enum
    .select('searchUsers', {
        args: {
            query: '$query',
            limit: '$limit',
            offset: '$offset',
            sortBy: '$sortBy'
        },
        fields: ['id', 'name', 'relevanceScore']
    })
    .build()

// Generates:
// query SearchUsers($query: String!, $limit: Int = 10, $offset: Int = 0, $sortBy: SortField) {
//     searchUsers(query: $query, limit: $limit, offset: $offset, sortBy: $sortBy) {
//         id
//         name
//         relevanceScore
//     }
// }
```

### Variable Types Reference

```typescript
// Required variable
.addVariable('id', 'ID!')

// Optional variable
.addVariable('name', 'String')

// With default value
.addVariable('limit', 'Int', 10)
.addVariable('status', 'Status', 'ACTIVE')

// Non-null list
.addVariable('ids', '[ID!]!')

// Nullable list with non-null items
.addVariable('tags', '[String!]')

// Input type
.addVariable('input', 'CreateUserInput!')

// Custom scalar
.addVariable('date', 'DateTime!')
```

## Arguments

### Static Arguments

Pass literal values as arguments:

```typescript
const query = graphql.buildQuery('GetActiveUsers')
    .select('users', {
        args: {
            limit: 10,
            status: 'ACTIVE',
            verified: true
        },
        fields: ['id', 'name']
    })
    .build()

// Generates:
// query GetActiveUsers {
//     users(limit: 10, status: "ACTIVE", verified: true) {
//         id
//         name
//     }
// }
```

### Variable Arguments

Reference variables in arguments:

```typescript
const query = graphql.buildQuery('GetUser')
    .addVariable('userId', 'ID!')
    .select('user', {
        args: { id: '$userId' },  // References the variable
        fields: ['id', 'name']
    })
    .build()
```

### Enum Arguments

Pass enum values (not quoted strings):

```typescript
const query = graphql.buildQuery('GetUsersByStatus')
    .select('users', {
        args: {
            status: { __enum: 'ACTIVE' },
            sortBy: { __enum: 'CREATED_AT' },
            sortOrder: { __enum: 'DESC' }
        },
        fields: ['id', 'name', 'status']
    })
    .build()

// Generates:
// query GetUsersByStatus {
//     users(status: ACTIVE, sortBy: CREATED_AT, sortOrder: DESC) {
//         id
//         name
//         status
//     }
// }
```

### Mixed Arguments

Combine static, variable, and enum arguments:

```typescript
const query = graphql.buildQuery('SearchProducts')
    .addVariable('searchTerm', 'String!')
    .addVariable('maxPrice', 'Float')
    .select('products', {
        args: {
            query: '$searchTerm',
            maxPrice: '$maxPrice',
            inStock: true,
            category: { __enum: 'ELECTRONICS' }
        },
        fields: ['id', 'name', 'price']
    })
    .build()
```

## Fragments

### Defining Fragments

Create reusable field sets:

```typescript
const query = graphql.buildQuery('GetUsers')
    .addFragment('UserFields', 'User', ['id', 'name', 'email', 'avatar'])
    .select('users', {
        fields: ['...UserFields', 'createdAt']
    })
    .select('admins', {
        fields: ['...UserFields', 'role', 'permissions']
    })
    .build()

// Generates:
// query GetUsers {
//     users { ...UserFields createdAt }
//     admins { ...UserFields role permissions }
// }
// fragment UserFields on User {
//     id
//     name
//     email
//     avatar
// }
```

### Fragments with Nested Fields

```typescript
const query = graphql.buildQuery('GetTeams')
    .addFragment('MemberInfo', 'User', [
        'id',
        'name',
        {
            profile: {
                fields: ['avatar', 'title']
            }
        }
    ])
    .select('teams', {
        fields: [
            'id',
            'name',
            {
                members: {
                    fields: ['...MemberInfo']
                }
            },
            {
                lead: {
                    fields: ['...MemberInfo']
                }
            }
        ]
    })
    .build()
```

### Multiple Fragments

```typescript
const query = graphql.buildQuery('GetDashboard')
    .addFragment('UserBasic', 'User', ['id', 'name'])
    .addFragment('PostPreview', 'Post', ['id', 'title', 'excerpt'])
    .addFragment('CommentSummary', 'Comment', ['id', 'text', 'author { ...UserBasic }'])
    .select('recentPosts', {
        fields: [
            '...PostPreview',
            { author: { fields: ['...UserBasic'] } },
            { comments: { fields: ['...CommentSummary'] } }
        ]
    })
    .build()
```

## Aliases

Use aliases to query the same field with different arguments:

```typescript
const query = graphql.buildQuery('GetMultipleUsers')
    .addVariable('id1', 'ID!')
    .addVariable('id2', 'ID!')
    .addVariable('id3', 'ID!')
    .select('user', {
        alias: 'firstUser',
        args: { id: '$id1' },
        fields: ['id', 'name', 'email']
    })
    .select('user', {
        alias: 'secondUser',
        args: { id: '$id2' },
        fields: ['id', 'name', 'email']
    })
    .select('user', {
        alias: 'thirdUser',
        args: { id: '$id3' },
        fields: ['id', 'name', 'email']
    })
    .build()

// Generates:
// query GetMultipleUsers($id1: ID!, $id2: ID!, $id3: ID!) {
//     firstUser: user(id: $id1) { id name email }
//     secondUser: user(id: $id2) { id name email }
//     thirdUser: user(id: $id3) { id name email }
// }

// Access response
const response = await graphql.execute(query, {
    id1: '1',
    id2: '2',
    id3: '3'
})
const { firstUser, secondUser, thirdUser } = response.data.data
```

## Directives

### Include Directive

Conditionally include fields:

```typescript
const query = graphql.buildQuery('GetUser')
    .addVariable('id', 'ID!')
    .addVariable('includeEmail', 'Boolean!')
    .addVariable('includePosts', 'Boolean!')
    .select('user', {
        args: { id: '$id' },
        fields: [
            'id',
            'name',
            { email: { directive: '@include(if: $includeEmail)' } },
            {
                posts: {
                    directive: '@include(if: $includePosts)',
                    fields: ['id', 'title']
                }
            }
        ]
    })
    .build()

// Generates:
// query GetUser($id: ID!, $includeEmail: Boolean!, $includePosts: Boolean!) {
//     user(id: $id) {
//         id
//         name
//         email @include(if: $includeEmail)
//         posts @include(if: $includePosts) {
//             id
//             title
//         }
//     }
// }

// Execute with directives
const response = await graphql.execute(query, {
    id: '123',
    includeEmail: true,
    includePosts: false
})
```

### Skip Directive

Conditionally skip fields:

```typescript
const query = graphql.buildQuery('GetUser')
    .addVariable('id', 'ID!')
    .addVariable('skipSensitive', 'Boolean!')
    .select('user', {
        args: { id: '$id' },
        fields: [
            'id',
            'name',
            { email: { directive: '@skip(if: $skipSensitive)' } },
            { phone: { directive: '@skip(if: $skipSensitive)' } }
        ]
    })
    .build()
```

### Multiple Directives

```typescript
const query = graphql.buildQuery('GetUser')
    .addVariable('id', 'ID!')
    .addVariable('includeDetails', 'Boolean!')
    .select('user', {
        args: { id: '$id' },
        fields: [
            'id',
            'name',
            {
                profile: {
                    directive: '@include(if: $includeDetails) @deprecated(reason: "Use details instead")',
                    fields: ['bio']
                }
            }
        ]
    })
    .build()
```

## Complex Examples

### Complete Dashboard Query

```typescript
const query = graphql.buildQuery('GetOrganizationDashboard')
    .addVariable('orgId', 'ID!')
    .addVariable('memberLimit', 'Int', 10)
    .addVariable('includeProjects', 'Boolean!')
    .addVariable('includeStats', 'Boolean!')
    .addFragment('MemberFields', 'User', ['id', 'name', 'role', 'avatar'])
    .addFragment('ProjectFields', 'Project', ['id', 'name', 'status', 'deadline'])
    .select('organization', {
        args: { id: '$orgId' },
        fields: [
            'id',
            'name',
            'createdAt',
            {
                members: {
                    args: { limit: '$memberLimit' },
                    fields: ['...MemberFields']
                }
            },
            {
                projects: {
                    directive: '@include(if: $includeProjects)',
                    fields: [
                        '...ProjectFields',
                        {
                            team: {
                                fields: ['...MemberFields']
                            }
                        }
                    ]
                }
            },
            {
                stats: {
                    directive: '@include(if: $includeStats)',
                    fields: ['totalMembers', 'activeProjects', 'completedProjects']
                }
            }
        ]
    })
    .build()

const response = await graphql.execute(query, {
    orgId: 'org-123',
    memberLimit: 5,
    includeProjects: true,
    includeStats: true
})
```

### Dynamic Query Building

Build queries based on runtime conditions:

```typescript
function buildUserQuery(options: {
    includePosts?: boolean
    includeComments?: boolean
    includeFollowers?: boolean
}) {
    const builder = graphql.buildQuery('GetUser')
        .addVariable('id', 'ID!')

    const fields: any[] = ['id', 'name', 'email']

    if (options.includePosts) {
        fields.push({
            posts: {
                fields: ['id', 'title', 'publishedAt']
            }
        })
    }

    if (options.includeComments) {
        fields.push({
            comments: {
                fields: ['id', 'text', 'createdAt']
            }
        })
    }

    if (options.includeFollowers) {
        fields.push({
            followers: {
                fields: ['id', 'name']
            }
        })
    }

    return builder
        .select('user', {
            args: { id: '$id' },
            fields
        })
        .build()
}

// Usage
const query = buildUserQuery({
    includePosts: true,
    includeFollowers: true
})
const response = await graphql.execute(query, { id: '123' })
```

### Pagination Query Builder

```typescript
function buildPaginatedQuery<T>(
    fieldName: string,
    itemFields: string[],
    options?: { sortable?: boolean }
) {
    const builder = graphql.buildQuery(`Get${fieldName}`)
        .addVariable('page', 'Int', 1)
        .addVariable('limit', 'Int', 20)

    if (options?.sortable) {
        builder
            .addVariable('sortBy', 'String')
            .addVariable('sortOrder', 'SortOrder')
    }

    const args: Record<string, string> = {
        page: '$page',
        limit: '$limit'
    }

    if (options?.sortable) {
        args.sortBy = '$sortBy'
        args.sortOrder = '$sortOrder'
    }

    return builder
        .select(fieldName.toLowerCase(), {
            args,
            fields: [
                {
                    items: {
                        fields: itemFields
                    }
                },
                'total',
                'hasMore',
                'currentPage'
            ]
        })
        .build()
}

// Usage
const usersQuery = buildPaginatedQuery('Users', ['id', 'name', 'email'], { sortable: true })
const response = await graphql.execute(usersQuery, {
    page: 1,
    limit: 10,
    sortBy: 'name',
    sortOrder: 'ASC'
})
```

## Testing with Query Builder

```typescript
describe('User Queries', () => {
    let query: string

    beforeAll(() => {
        query = graphql.buildQuery('GetUser')
            .addVariable('id', 'ID!')
            .select('user', {
                args: { id: '$id' },
                fields: ['id', 'name', 'email']
            })
            .build()
    })

    it('should fetch user with valid ID', async () => {
        const response = await graphql.execute(query, { id: '123' })

        expect(response.isSuccess).toBe(true)
        expect(response.data.data.user.id).toBe('123')
    })

    it('should return error for invalid ID', async () => {
        const response = await graphql.execute(query, { id: 'nonexistent' })

        expect(response.isError).toBe(true)
    })
})
```

## Best Practices

### 1. Name Your Operations

Always provide meaningful operation names:

```typescript
// Good
graphql.buildQuery('GetUserProfile')
graphql.buildMutation('UpdateUserSettings')

// Avoid
graphql.buildQuery('Query1')
```

### 2. Use Fragments for Reusability

Extract common field sets:

```typescript
// Define once
.addFragment('UserBasic', 'User', ['id', 'name', 'avatar'])

// Use everywhere
.select('author', { fields: ['...UserBasic'] })
.select('reviewer', { fields: ['...UserBasic'] })
```

### 3. Build Queries Once, Execute Many Times

```typescript
// Build once
const getUserQuery = graphql.buildQuery('GetUser')
    .addVariable('id', 'ID!')
    .select('user', { args: { id: '$id' }, fields: ['id', 'name'] })
    .build()

// Execute many times
const user1 = await graphql.execute(getUserQuery, { id: '1' })
const user2 = await graphql.execute(getUserQuery, { id: '2' })
```

### 4. Use TypeScript for Variable Types

```typescript
interface GetUserVars {
    id: string
}

const response = await graphql.execute<UserResponse, GetUserVars>(query, {
    id: '123' // TypeScript validates this
})
```

## Next Steps

- [GraphQL Client](/graphql/client) — Execute queries and mutations
- [Subscriptions](/graphql/subscriptions) — Real-time updates
- [API Client](/core/api-client) — REST API testing
