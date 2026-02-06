/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
    docsSidebar: [
        'introduction',
        {
            type: 'category',
            label: 'Getting Started',
            items: ['getting-started/installation', 'getting-started/quick-start', 'getting-started/configuration'],
        },
        {
            type: 'category',
            label: 'Core Concepts',
            items: ['core/api-client', 'core/assertions', 'core/interceptors', 'core/authentication'],
        },
        {
            type: 'category',
            label: 'GraphQL',
            items: ['graphql/client', 'graphql/query-builder', 'graphql/subscriptions'],
        },
        {
            type: 'category',
            label: 'Observability',
            items: ['observability/har-logging', 'observability/metrics'],
        },
        {
            type: 'category',
            label: 'Advanced',
            items: ['advanced/custom-client', 'advanced/cucumber', 'advanced/typescript', 'advanced/ci-integration'],
        },
        {
            type: 'category',
            label: 'API Reference',
            items: [
                'api-reference/api-client-api',
                'api-reference/graphql-api',
                'api-reference/assertions-api',
                'api-reference/auth-api',
                'api-reference/types',
            ],
        },
    ],
}

export default sidebars
