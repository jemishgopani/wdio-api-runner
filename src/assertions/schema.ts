import Ajv, { type ErrorObject } from 'ajv'
import addFormats from 'ajv-formats'

import type { JsonSchema, SchemaValidationResult } from './types.js'

// Create Ajv instance with all errors enabled for detailed validation messages
const ajv = new Ajv.default({
    allErrors: true,
    verbose: true,
    strict: false,
})

// Add format validators (email, uri, date-time, etc.)
;(addFormats as unknown as (ajv: Ajv.default) => void)(ajv)

/**
 * Validates data against a JSON Schema
 *
 * @param data - The data to validate
 * @param schema - The JSON Schema to validate against
 * @returns Validation result with pass/fail and error messages
 *
 * @example
 * ```typescript
 * const schema = {
 *   type: 'object',
 *   required: ['id', 'email'],
 *   properties: {
 *     id: { type: 'number' },
 *     email: { type: 'string', format: 'email' }
 *   }
 * }
 *
 * const result = validateSchema({ id: 1, email: 'test@example.com' }, schema)
 * // { valid: true, errors: [] }
 *
 * const result2 = validateSchema({ id: 'not-a-number' }, schema)
 * // { valid: false, errors: ['data/id must be number', 'data must have required property email'] }
 * ```
 */
export function validateSchema(data: unknown, schema: JsonSchema): SchemaValidationResult {
    const validate = ajv.compile(schema)
    const valid = validate(data)

    if (valid) {
        return { valid: true, errors: [] }
    }

    // Format error messages
    const errors = (validate.errors || []).map((error: ErrorObject) => {
        const path = error.instancePath || 'data'
        const message = error.message || 'validation failed'

        // Handle specific error types for better messages
        switch (error.keyword) {
            case 'required':
                return `${path || 'data'} must have required property '${error.params.missingProperty}'`
            case 'type':
                return `${path} must be ${error.params.type}`
            case 'enum':
                return `${path} must be one of: ${(error.params.allowedValues as unknown[]).join(', ')}`
            case 'pattern':
                return `${path} must match pattern "${error.params.pattern}"`
            case 'format':
                return `${path} must be a valid ${error.params.format}`
            case 'minimum':
                return `${path} must be >= ${error.params.limit}`
            case 'maximum':
                return `${path} must be <= ${error.params.limit}`
            case 'minLength':
                return `${path} must have at least ${error.params.limit} characters`
            case 'maxLength':
                return `${path} must have at most ${error.params.limit} characters`
            case 'additionalProperties':
                return `${path} has unexpected property '${error.params.additionalProperty}'`
            default:
                return `${path} ${message}`
        }
    })

    return { valid: false, errors }
}

/**
 * Formats schema validation errors into a readable string
 *
 * @param errors - Array of error messages
 * @returns Formatted error string
 */
export function formatSchemaErrors(errors: string[]): string {
    if (errors.length === 0) {
        return 'No errors'
    }

    if (errors.length === 1) {
        return errors[0]
    }

    return `${errors.length} validation errors:\n  - ${errors.join('\n  - ')}`
}
