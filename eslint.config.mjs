import eslint from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import prettier from 'eslint-plugin-prettier'
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
    // Ignore patterns
    {
        ignores: ['node_modules/**', 'build/**', 'dist/**', 'coverage/**', 'example/**', '*.js', '*.mjs', '*.cjs'],
    },

    // Base ESLint recommended rules
    eslint.configs.recommended,

    // TypeScript source files configuration
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
                project: './tsconfig.json',
            },
            globals: {
                // Node.js globals
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                global: 'readonly',
                globalThis: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
                // Web APIs
                URL: 'readonly',
                URLSearchParams: 'readonly',
                fetch: 'readonly',
                Headers: 'readonly',
                Request: 'readonly',
                Response: 'readonly',
                AbortController: 'readonly',
                AbortSignal: 'readonly',
                EventSource: 'readonly',
                WebSocket: 'readonly',
                // TypeScript globals
                NodeJS: 'readonly',
                BufferEncoding: 'readonly',
                // WebdriverIO global namespace (declared in types)
                WebdriverIO: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
            prettier: prettier,
        },
        rules: {
            // TypeScript specific rules
            ...tseslint.configs.recommended.rules,

            // Prettier integration
            'prettier/prettier': 'error',

            // TypeScript rules
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/no-namespace': 'off', // Allow WebdriverIO namespace extension
            '@typescript-eslint/no-require-imports': 'off', // Allow require for dynamic imports
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    prefer: 'type-imports',
                    disallowTypeAnnotations: false,
                },
            ],

            // General rules
            'no-console': 'off',
            'no-debugger': 'error',
            'no-duplicate-imports': 'off', // TypeScript handles this better with type imports
            'no-unused-vars': 'off', // Use TypeScript's rule instead
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: ['error', 'always'],
            curly: ['error', 'all'],
        },
    },

    // Test files - no project reference needed, more relaxed rules
    {
        files: ['test/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
                // No project reference for test files
            },
            globals: {
                // Node.js globals
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                global: 'readonly',
                globalThis: 'readonly',
                // Web APIs
                URL: 'readonly',
                URLSearchParams: 'readonly',
                fetch: 'readonly',
                Headers: 'readonly',
                Request: 'readonly',
                Response: 'readonly',
                FormData: 'readonly',
                Event: 'readonly',
                MessageEvent: 'readonly',
                CloseEvent: 'readonly',
                RequestInit: 'readonly',
                // Test framework globals
                describe: 'readonly',
                it: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                vi: 'readonly',
                // TypeScript globals
                NodeJS: 'readonly',
                WebdriverIO: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
            prettier: prettier,
        },
        rules: {
            ...tseslint.configs.recommended.rules,
            'prettier/prettier': 'error',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'no-unused-vars': 'off',
        },
    },

    // Disable rules that conflict with Prettier
    eslintConfigPrettier,
]
