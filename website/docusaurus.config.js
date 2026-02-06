// @ts-check
import { themes as prismThemes } from 'prism-react-renderer'

/** @type {import('@docusaurus/types').Config} */
const config = {
    title: 'wdio-api-runner',
    tagline: 'A WebdriverIO runner for blazing-fast API automation testing',
    favicon: 'img/favicon.ico',

    url: 'https://jemishgopani.github.io',
    baseUrl: '/wdio-api-runner/',

    organizationName: 'jemishgopani',
    projectName: 'wdio-api-runner',

    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',

    i18n: {
        defaultLocale: 'en',
        locales: ['en'],
    },

    presets: [
        [
            'classic',
            /** @type {import('@docusaurus/preset-classic').Options} */
            ({
                docs: {
                    sidebarPath: './sidebars.js',
                    editUrl: 'https://github.com/jemishgopani/wdio-api-runner/tree/main/website/',
                    routeBasePath: '/', // Docs as homepage
                },
                blog: false,
                theme: {
                    customCss: './src/css/custom.css',
                },
            }),
        ],
    ],

    themeConfig:
        /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
        ({
            image: 'img/social-card.png',
            navbar: {
                title: 'wdio-api-runner',
                logo: {
                    alt: 'wdio-api-runner Logo',
                    src: 'img/logo.svg',
                },
                items: [
                    {
                        type: 'docSidebar',
                        sidebarId: 'docsSidebar',
                        position: 'left',
                        label: 'Documentation',
                    },
                    {
                        href: 'https://github.com/jemishgopani/wdio-api-runner',
                        label: 'GitHub',
                        position: 'right',
                    },
                ],
            },
            footer: {
                style: 'dark',
                links: [
                    {
                        title: 'Docs',
                        items: [
                            {
                                label: 'Getting Started',
                                to: '/getting-started/installation',
                            },
                            {
                                label: 'API Client',
                                to: '/core/api-client',
                            },
                            {
                                label: 'GraphQL',
                                to: '/graphql/client',
                            },
                        ],
                    },
                    {
                        title: 'Community',
                        items: [
                            {
                                label: 'GitHub Discussions',
                                href: 'https://github.com/jemishgopani/wdio-api-runner/discussions',
                            },
                            {
                                label: 'WebdriverIO',
                                href: 'https://webdriver.io',
                            },
                        ],
                    },
                    {
                        title: 'More',
                        items: [
                            {
                                label: 'GitHub',
                                href: 'https://github.com/jemishgopani/wdio-api-runner',
                            },
                            {
                                label: 'npm',
                                href: 'https://www.npmjs.com/package/wdio-api-runner',
                            },
                        ],
                    },
                ],
                copyright: `Copyright © ${new Date().getFullYear()} wdio-api-runner. Built with Docusaurus.`,
            },
            prism: {
                theme: prismThemes.github,
                darkTheme: prismThemes.dracula,
                additionalLanguages: ['bash', 'typescript', 'json', 'gherkin'],
            },
            colorMode: {
                defaultMode: 'light',
                disableSwitch: false,
                respectPrefersColorScheme: true,
            },
        }),
}

export default config
