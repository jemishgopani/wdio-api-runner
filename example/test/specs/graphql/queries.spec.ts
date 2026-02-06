import { createGraphQLClient, gql } from 'wdio-api-runner'
import { expect } from 'chai'
import type { Country, Language } from '../../support/types.js'

describe('GraphQL - Queries', () => {
    const client = createGraphQLClient({
        endpoint: 'https://countries.trevorblades.com/graphql',
    })

    describe('Simple Queries', () => {
        it('should query all countries', async () => {
            const query = gql`
                query {
                    countries {
                        code
                        name
                    }
                }
            `

            const response = await client.query<{ countries: Country[] }>({ query })

            expect(response.isSuccess).to.equal(true)
            expect(response.hasData).to.equal(true)
            expect(response.hasErrors).to.equal(false)
            expect(response.data.data?.countries.length).to.be.above(0)
        })

        it('should query continents', async () => {
            const query = gql`
                query {
                    continents {
                        code
                        name
                    }
                }
            `

            const response = await client.query<{
                continents: { code: string; name: string }[]
            }>({ query })

            expect(response.isSuccess).to.equal(true)
            expect(response.data.data?.continents).to.deep.include({
                code: 'EU',
                name: 'Europe',
            })
        })

        it('should query languages', async () => {
            const query = gql`
                query {
                    languages {
                        code
                        name
                    }
                }
            `

            const response = await client.query<{ languages: Language[] }>({ query })

            expect(response.isSuccess).to.equal(true)
            expect(response.data.data?.languages.length).to.be.above(0)
        })
    })

    describe('Queries with Variables', () => {
        it('should query single country by code', async () => {
            const query = gql`
                query GetCountry($code: ID!) {
                    country(code: $code) {
                        code
                        name
                        capital
                        currency
                    }
                }
            `

            const response = await client.query<{ country: Country }>({
                query,
                variables: { code: 'US' },
            })

            expect(response.isSuccess).to.equal(true)
            expect(response.data.data?.country.code).to.equal('US')
            expect(response.data.data?.country.name).to.equal('United States')
            expect(response.data.data?.country.capital).to.equal('Washington D.C.')
        })

        it('should query continent by code', async () => {
            const query = gql`
                query GetContinent($code: ID!) {
                    continent(code: $code) {
                        code
                        name
                        countries {
                            code
                            name
                        }
                    }
                }
            `

            const response = await client.query<{
                continent: {
                    code: string
                    name: string
                    countries: Country[]
                }
            }>({
                query,
                variables: { code: 'EU' },
            })

            expect(response.isSuccess).to.equal(true)
            expect(response.data.data?.continent.name).to.equal('Europe')
            expect(response.data.data?.continent.countries.length).to.be.above(0)
        })

        it('should query countries with filter', async () => {
            const query = gql`
                query GetCountriesByContinent($filter: CountryFilterInput) {
                    countries(filter: $filter) {
                        code
                        name
                        continent {
                            name
                        }
                    }
                }
            `

            const response = await client.query<{ countries: Country[] }>({
                query,
                variables: {
                    filter: {
                        continent: { eq: 'EU' },
                    },
                },
            })

            expect(response.isSuccess).to.equal(true)
            expect(response.data.data?.countries.length).to.be.above(0)
            // All countries should be in Europe
            response.data.data?.countries.forEach((country) => {
                expect(country.continent.name).to.equal('Europe')
            })
        })
    })

    describe('Nested Field Selection', () => {
        it('should query country with nested fields', async () => {
            const query = gql`
                query GetCountryDetails($code: ID!) {
                    country(code: $code) {
                        code
                        name
                        native
                        capital
                        currency
                        languages {
                            code
                            name
                            native
                        }
                        continent {
                            code
                            name
                        }
                        states {
                            code
                            name
                        }
                    }
                }
            `

            const response = await client.query<{
                country: {
                    code: string
                    name: string
                    native: string
                    capital: string
                    currency: string
                    languages: Language[]
                    continent: { code: string; name: string }
                    states: { code: string; name: string }[]
                }
            }>({
                query,
                variables: { code: 'DE' },
            })

            expect(response.isSuccess).to.equal(true)
            expect(response.data.data?.country.name).to.equal('Germany')
            expect(response.data.data?.country.continent.name).to.equal('Europe')
            expect(response.data.data?.country.languages.length).to.be.above(0)
        })
    })

    describe('Response Properties', () => {
        it('should include HTTP response details', async () => {
            const query = gql`
                query {
                    countries {
                        code
                    }
                }
            `

            const response = await client.query<{ countries: Country[] }>({ query })

            // HTTP response properties
            expect(response.status).to.equal(200)
            expect(response.ok).to.equal(true)
            expect(response.duration).to.be.above(0)

            // GraphQL response properties
            expect(response.isSuccess).to.equal(true)
            expect(response.hasData).to.equal(true)
            expect(response.hasErrors).to.equal(false)
        })

        it('should include headers', async () => {
            const query = gql`
                query {
                    continents {
                        code
                    }
                }
            `

            const response = await client.query<{
                continents: { code: string }[]
            }>({ query })

            expect(response.headers).to.exist
            expect(response.headers.get('content-type')).to.include('application/json')
        })
    })

    describe('Error Handling', () => {
        it('should handle invalid query gracefully', async () => {
            const query = gql`
                query {
                    invalidField {
                        code
                    }
                }
            `

            const response = await client.query<unknown>({ query })

            expect(response.hasErrors).to.equal(true)
            expect(response.data.errors).to.exist
            expect(response.data.errors!.length).to.be.above(0)
        })

        it('should handle missing required variable', async () => {
            const query = gql`
                query GetCountry($code: ID!) {
                    country(code: $code) {
                        name
                    }
                }
            `

            // Missing required variable
            const response = await client.query<{ country: Country }>({
                query,
                variables: {}, // code is missing
            })

            expect(response.hasErrors).to.equal(true)
        })
    })

    describe('Multiple Queries in Parallel', () => {
        it('should execute multiple queries concurrently', async () => {
            const countriesQuery = gql`
                query {
                    countries {
                        code
                        name
                    }
                }
            `

            const continentsQuery = gql`
                query {
                    continents {
                        code
                        name
                    }
                }
            `

            const [countriesResponse, continentsResponse] = await Promise.all([
                client.query<{ countries: Country[] }>({ query: countriesQuery }),
                client.query<{ continents: { code: string; name: string }[] }>({
                    query: continentsQuery,
                }),
            ])

            expect(countriesResponse.isSuccess).to.equal(true)
            expect(continentsResponse.isSuccess).to.equal(true)
            expect(countriesResponse.data.data?.countries.length).to.be.above(0)
            expect(continentsResponse.data.data?.continents.length).to.be.above(0)
        })
    })
})
