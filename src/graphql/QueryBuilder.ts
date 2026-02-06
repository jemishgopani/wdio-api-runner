/**
 * GraphQL Query Builder
 *
 * Provides both a fluent builder API and tagged template literal support
 * for constructing GraphQL operations.
 */

import type {
    QueryBuilder,
    GraphQLOperation,
    GraphQLVariables,
    FieldSelection,
    VariableDefinition,
    FragmentDefinition,
    GraphQLTagResult,
} from './types.js'

/**
 * Internal state for query builder
 */
interface BuilderState {
    operationType: 'query' | 'mutation' | 'subscription'
    operationName?: string
    variables: VariableDefinition[]
    fields: FieldSelection[]
    fragments: Map<string, FragmentDefinition>
}

/**
 * Creates a new query builder for fluent query construction
 *
 * @example Basic query
 * ```typescript
 * const query = createQueryBuilder()
 *     .query('GetUser')
 *     .variable('id', 'ID!')
 *     .fieldWithArgs('user', { id: '$id' })
 *     .select('id', 'name', 'email')
 *     .build()
 * ```
 *
 * @example Nested fields
 * ```typescript
 * const query = createQueryBuilder()
 *     .query('GetUsers')
 *     .field('users')
 *     .selectWith('users', (b) => b
 *         .select('id', 'name')
 *         .selectWith('posts', (p) => p.select('id', 'title'))
 *     )
 *     .build()
 * ```
 */
export function createQueryBuilder<TVariables extends GraphQLVariables = GraphQLVariables>(): QueryBuilder<TVariables> {
    const state: BuilderState = {
        operationType: 'query',
        variables: [],
        fields: [],
        fragments: new Map(),
    }

    // Track current context for nested selections
    let currentFields: FieldSelection[] = state.fields
    // Track the current parent field for args() method
    let currentParentField: FieldSelection | null = null

    const builder: QueryBuilder<TVariables> = {
        query(name?: string) {
            state.operationType = 'query'
            state.operationName = name
            return builder
        },

        mutation(name?: string) {
            state.operationType = 'mutation'
            state.operationName = name
            return builder
        },

        subscription(name?: string) {
            state.operationType = 'subscription'
            state.operationName = name
            return builder
        },

        variable(name, type, defaultValue) {
            state.variables.push({ name, type, defaultValue })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return builder as any
        },

        field(name, alias) {
            currentFields.push({ name, alias })
            return builder
        },

        fieldWithArgs(name, args, alias) {
            currentFields.push({ name, alias, args })
            return builder
        },

        args(args) {
            // Add arguments to the current parent field (used inside selectWith callback)
            if (currentParentField) {
                currentParentField.args = { ...currentParentField.args, ...args }
            }
            return builder
        },

        select(...fields) {
            for (const fieldName of fields) {
                currentFields.push({ name: fieldName })
            }
            return builder
        },

        selectWith(fieldName, subBuilder) {
            // Handle alias syntax: "alias: fieldName"
            let name = fieldName
            let alias: string | undefined
            if (fieldName.includes(':')) {
                const parts = fieldName.split(':').map((s) => s.trim())
                alias = parts[0]
                name = parts[1]
            }

            // Find or create the field (match by both name and alias for aliases)
            let field = currentFields.find((f) => {
                if (alias) {
                    return f.alias === alias && f.name === name
                }
                return f.name === fieldName && !f.alias
            })
            if (!field) {
                field = { name, alias, fields: [] }
                currentFields.push(field)
            } else if (!field.fields) {
                field.fields = []
            }

            // Save current context
            const previousFields = currentFields
            const previousParentField = currentParentField
            currentFields = field.fields!
            currentParentField = field

            // Build nested fields
            subBuilder(builder)

            // Restore context
            currentFields = previousFields
            currentParentField = previousParentField

            return builder
        },

        fragment(name, onType, fragmentBuilder) {
            const fragmentFields: FieldSelection[] = []
            const previousFields = currentFields
            currentFields = fragmentFields

            fragmentBuilder(builder)

            currentFields = previousFields

            state.fragments.set(name, {
                name,
                onType,
                fields: fragmentFields,
            })

            return builder
        },

        useFragment(name) {
            currentFields.push({ name: `...${name}` })
            return builder
        },

        inlineFragment(onType, fragmentBuilder) {
            const fragmentFields: FieldSelection[] = []
            const previousFields = currentFields
            currentFields = fragmentFields

            fragmentBuilder(builder)

            currentFields = previousFields

            // Add inline fragment as a special field
            currentFields.push({
                name: `... on ${onType}`,
                fields: fragmentFields,
            })

            return builder
        },

        include(condition) {
            const lastField = currentFields[currentFields.length - 1]
            if (lastField) {
                lastField.directive = { name: 'include', args: { if: `$${condition}` } }
            }
            return builder
        },

        skip(condition) {
            const lastField = currentFields[currentFields.length - 1]
            if (lastField) {
                lastField.directive = { name: 'skip', args: { if: `$${condition}` } }
            }
            return builder
        },

        build(): GraphQLOperation<TVariables> {
            return {
                query: builder.toString(),
                operationName: state.operationName,
            }
        },

        toString() {
            return buildQueryString(state)
        },
    }

    return builder
}

/**
 * Build the query string from builder state
 */
function buildQueryString(state: BuilderState): string {
    const lines: string[] = []

    // Operation line
    let opLine = state.operationType
    if (state.operationName) {
        opLine += ` ${state.operationName}`
    }
    if (state.variables.length > 0) {
        const varDefs = state.variables.map((v) => {
            let def = `$${v.name}: ${v.type}`
            if (v.defaultValue !== undefined) {
                def += ` = ${formatValue(v.defaultValue)}`
            }
            return def
        })
        opLine += `(${varDefs.join(', ')})`
    }
    lines.push(opLine + ' {')

    // Fields
    for (const field of state.fields) {
        lines.push(buildFieldString(field, 1))
    }

    lines.push('}')

    // Fragment definitions
    for (const [, fragment] of state.fragments) {
        lines.push('')
        lines.push(`fragment ${fragment.name} on ${fragment.onType} {`)
        for (const field of fragment.fields) {
            lines.push(buildFieldString(field, 1))
        }
        lines.push('}')
    }

    return lines.join('\n')
}

/**
 * Build a field string with proper indentation
 */
function buildFieldString(field: FieldSelection, indentLevel: number): string {
    const indent = '  '.repeat(indentLevel)
    let line = indent

    // Handle fragment spreads
    if (field.name.startsWith('...')) {
        line += field.name
        if (field.fields && field.fields.length > 0) {
            line += ' {\n'
            for (const subField of field.fields) {
                line += buildFieldString(subField, indentLevel + 1) + '\n'
            }
            line += indent + '}'
        }
        return line
    }

    // Alias
    if (field.alias) {
        line += `${field.alias}: `
    }

    // Field name
    line += field.name

    // Arguments
    if (field.args && Object.keys(field.args).length > 0) {
        const args = Object.entries(field.args)
            .map(([k, v]) => `${k}: ${formatArgValue(v)}`)
            .join(', ')
        line += `(${args})`
    }

    // Directive
    if (field.directive) {
        line += ` @${field.directive.name}`
        if (field.directive.args && Object.keys(field.directive.args).length > 0) {
            const args = Object.entries(field.directive.args)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ')
            line += `(${args})`
        }
    }

    // Nested fields
    if (field.fields && field.fields.length > 0) {
        line += ' {\n'
        for (const subField of field.fields) {
            line += buildFieldString(subField, indentLevel + 1) + '\n'
        }
        line += indent + '}'
    }

    return line
}

/**
 * Format an argument value for GraphQL
 */
function formatArgValue(value: unknown): string {
    // Variable reference
    if (typeof value === 'string' && value.startsWith('$')) {
        return value
    }

    // Enum (unquoted string)
    if (typeof value === 'string' && /^[A-Z][A-Z0-9_]*$/i.test(value) && value === value.toUpperCase()) {
        return value
    }

    return formatValue(value)
}

/**
 * Format a value for GraphQL (JSON-like but with unquoted keys)
 */
function formatValue(value: unknown): string {
    if (value === null) {
        return 'null'
    }

    if (typeof value === 'string') {
        return JSON.stringify(value)
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value)
    }

    if (Array.isArray(value)) {
        return '[' + value.map(formatValue).join(', ') + ']'
    }

    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}: ${formatValue(v)}`)
        return '{' + entries.join(', ') + '}'
    }

    return String(value)
}

/**
 * Tagged template literal for GraphQL queries
 *
 * Provides syntax highlighting support in IDEs and a clean way to write queries.
 *
 * @example
 * ```typescript
 * const GET_USER = gql`
 *     query GetUser($id: ID!) {
 *         user(id: $id) {
 *             id
 *             name
 *             email
 *         }
 *     }
 * `
 *
 * const response = await graphql.query(GET_USER, { id: '123' })
 * ```
 *
 * @example With interpolation
 * ```typescript
 * const fields = 'id name email'
 * const query = gql`
 *     query GetUser($id: ID!) {
 *         user(id: $id) { ${fields} }
 *     }
 * `
 * ```
 */
export function gql<TVariables extends GraphQLVariables = GraphQLVariables>(
    strings: TemplateStringsArray,
    ...values: unknown[]
): GraphQLTagResult<TVariables> {
    // Combine template strings with interpolated values
    let query = ''
    for (let i = 0; i < strings.length; i++) {
        query += strings[i]
        if (i < values.length) {
            query += String(values[i])
        }
    }

    // Clean up the query (remove excessive whitespace but preserve structure)
    const cleanedQuery = query
        .trim()
        .replace(/\n\s*\n/g, '\n') // Remove empty lines
        .replace(/^\s+/gm, (match) => {
            // Normalize indentation
            const spaces = match.length
            return '  '.repeat(Math.floor(spaces / 2))
        })

    // Extract operation name from query
    const match = cleanedQuery.match(/(?:query|mutation|subscription)\s+(\w+)/)
    const operationName = match ? match[1] : undefined

    return {
        query: cleanedQuery,
        operationName,
        source: query,
    }
}

/**
 * Alias for gql - some projects prefer this naming
 */
export const graphql = gql
