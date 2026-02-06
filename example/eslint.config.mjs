import eslint from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import prettier from 'eslint-plugin-prettier'
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
    // Ignore patterns
    {
        ignores: ['node_modules/**', 'build/**', 'dist/**', 'har-logs/**'],
    },

    // Base ESLint recommended rules
    eslint.configs.recommended,

    // TypeScript files configuration
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
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
                // Web APIs
                URL: 'readonly',
                URLSearchParams: 'readonly',
                fetch: 'readonly',
                Headers: 'readonly',
                Request: 'readonly',
                Response: 'readonly',
                FormData: 'readonly',
                // Test framework globals (Mocha)
                describe: 'readonly',
                it: 'readonly',
                before: 'readonly',
                after: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                // WebdriverIO globals
                browser: 'readonly',
                expect: 'readonly',
                $: 'readonly',
                $$: 'readonly',
                // wdio-api-runner globals
                api: 'readonly',
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
            // TypeScript specific rules
            ...tseslint.configs.recommended.rules,

            // Prettier integration
            'prettier/prettier': 'error',

            // TypeScript rules - relaxed for example/test code
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-namespace': 'off',

            // General rules
            'no-console': 'off',
            'no-debugger': 'warn',
            'no-unused-vars': 'off',
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: ['error', 'always'],
            curly: ['error', 'all'],

            // Allow Chai-style assertions (expect().to.be.true)
            '@typescript-eslint/no-unused-expressions': 'off',
            'no-unused-expressions': 'off',
        },
    },

    // Disable rules that conflict with Prettier
    eslintConfigPrettier,
]
