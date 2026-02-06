import { createGraphQLClient, createQueryBuilder } from 'wdio-api-runner'
import { expect } from 'chai'
import type { Country, Language } from '../../support/types.js'

describe('GraphQL - Query Builder', () => {
    const client = createGraphQLClient({
        endpoint: 'https://countries.trevorblades.com/graphql',
    })

    describe('Basic Query Building', () => {
        it('should build simple query with fields', async () => {
            const operation = createQueryBuilder()
                .query('GetCountries')
                .select('countries')
                .selectWith('countries', (countries) => {
                    countries.field('code').field('name')
                })
                .build()

            expect(operation.query).to.include('query GetCountries')
            expect(operation.query).to.include('countries')
            expect(operation.query).to.include('code')
            expect(operation.query).to.include('name')

            const response = await client.query<{ countries: Country[] }>(operation)

            expect(response.isSuccess).to.equal(true)
            expect(response.data.data?.countries.length).to.be.above(0)
        })

        it('should build query with multiple root fields', async () => {
            const operation = createQueryBuilder()
                .query('GetCountriesAndContinents')
                .selectWith('countries', (countries) => {
                    countries.field('code').field('name')
                })
                .selectWith('continents', (continents) => {
                    continents.field('code').field('name')
                })
                .build()

            const response = await client.query<{
                countries: Country[]
                continents: { code: string; name: string }[]
            }>(operation)

            expect(response.isSuccess).to.equal(true)
            expect(response.data.data?.countries).to.exist
            expect(response.data.data?.continents).to.exist
        })
    })

    describe('Variables', () => {
        it('should build query with typed variable', async () => {
            const operation = createQueryBuilder<{ code: string }>()
                .query('GetCountry')
                .variable('code', 'ID!')
                .selectWith('country', (country) => {
                    country.args({ code: '$code' }).field('code').field('name').field('capital')
                })
                .build()

            expect(operation.query).to.include('$code: ID!')
            expect(operation.query).to.include('country(code: $code)')

            const response = await client.query<{ country: Country }>({
                ...operation,
                variables: { code: 'US' },
            })

            expect(response.isSuccess).to.equal(true)
            expect(response.data.data?.country.name).to.equal('United States')
        })

        it('should build query with multiple variables', async () => {
            const operation = createQueryBuilder<{ continentCode: string }>()
                .query('GetCountriesByContinent')
                .variable('continentCode', 'String!')
                .selectWith('countries', (countries) => {
                    countries
                        .args({ filter: { continent: { eq: '$continentCode' } } })
                        .field('code')
                        .field('name')
                })
                .build()

            // Note: The filter syntax for this API is specific
            // This demonstrates the builder pattern
            expect(operation.query).to.include('$continentCode: String!')
        })
    })

    describe('Nested Selections', () => {
        it('should build query with nested field selection', async () => {
            const operation = createQueryBuilder<{ code: string }>()
                .query('GetCountryDetails')
                .variable('code', 'ID!')
                .selectWith('country', (country) => {
                    country
                        .args({ code: '$code' })
                        .field('code')
                        .field('name')
                        .field('capital')
                        .field('currency')
                        .selectWith('languages', (languages) => {
                            languages.field('code').field('name')
                        })
                        .selectWith('continent', (continent) => {
                            continent.field('code').field('name')
                        })
                })
                .build()

            const response = await client.query<{
                country: {
                    code: string
                    name: string
                    capital: string
                    currency: string
                    languages: Language[]
                    continent: { code: string; name: string }
                }
            }>({
                ...operation,
                variables: { code: 'FR' },
            })

            expect(response.isSuccess).to.equal(true)
            expect(response.data.data?.country.name).to.equal('France')
            expect(response.data.data?.country.languages.length).to.be.above(0)
            expect(response.data.data?.country.continent.name).to.equal('Europe')
        })

        it('should build deeply nested selection', async () => {
            const operation = createQueryBuilder<{ code: string }>()
                .query('GetContinentWithCountries')
                .variable('code', 'ID!')
                .selectWith('continent', (continent) => {
                    continent
                        .args({ code: '$code' })
                        .field('code')
                        .field('name')
                        .selectWith('countries', (countries) => {
                            countries
                                .field('code')
                                .field('name')
                                .selectWith('languages', (languages) => {
                                    languages.field('code').field('name')
                                })
                        })
                })
                .build()

            const response = await client.query<{
                continent: {
                    code: string
                    name: string
                    countries: {
                        code: string
                        name: string
                        languages: Language[]
                    }[]
                }
            }>({
                ...operation,
                variables: { code: 'EU' },
            })

            expect(response.isSuccess).to.equal(true)
            expect(response.data.data?.continent.countries.length).to.be.above(0)
        })
    })

    describe('Field Aliases', () => {
        it('should build query with field alias', async () => {
            const operation = createQueryBuilder<{ usCode: string; deCode: string }>()
                .query('GetTwoCountries')
                .variable('usCode', 'ID!')
                .variable('deCode', 'ID!')
                .selectWith('usa: country', (country) => {
                    country.args({ code: '$usCode' }).field('name').field('capital')
                })
                .selectWith('germany: country', (country) => {
                    country.args({ code: '$deCode' }).field('name').field('capital')
                })
                .build()

            const response = await client.query<{
                usa: { name: string; capital: string }
                germany: { name: string; capital: string }
            }>({
                ...operation,
                variables: { usCode: 'US', deCode: 'DE' },
            })

            expect(response.isSuccess).to.equal(true)
            expect(response.data.data?.usa.name).to.equal('United States')
            expect(response.data.data?.germany.name).to.equal('Germany')
        })
    })

    describe('Operation Types', () => {
        it('should build anonymous query', async () => {
            const operation = createQueryBuilder()
                .query() // Anonymous query
                .selectWith('continents', (continents) => {
                    continents.field('code').field('name')
                })
                .build()

            // Anonymous queries still have 'query' keyword but no name
            expect(operation.query).to.include('query {')

            const response = await client.query<{
                continents: { code: string; name: string }[]
            }>(operation)

            expect(response.isSuccess).to.equal(true)
        })

        it('should build named query', async () => {
            const operation = createQueryBuilder()
                .query('NamedQuery')
                .selectWith('languages', (languages) => {
                    languages.field('code').field('name')
                })
                .build()

            expect(operation.query).to.include('query NamedQuery')

            const response = await client.query<{ languages: Language[] }>(operation)

            expect(response.isSuccess).to.equal(true)
        })
    })

    describe('Query String Output', () => {
        it('should generate valid GraphQL syntax', () => {
            const operation = createQueryBuilder<{ id: string }>()
                .query('TestQuery')
                .variable('id', 'ID!')
                .selectWith('country', (country) => {
                    country
                        .args({ code: '$id' })
                        .field('code')
                        .field('name')
                        .selectWith('continent', (continent) => {
                            continent.field('name')
                        })
                })
                .build()

            // Verify the query structure
            expect(operation.query).to.match(/query\s+TestQuery/)
            expect(operation.query).to.include('$id: ID!')
            expect(operation.query).to.include('country(code: $id)')
            expect(operation.query).to.include('code')
            expect(operation.query).to.include('name')
            expect(operation.query).to.include('continent')
        })
    })

    describe('Integration with Client', () => {
        it('should work seamlessly with GraphQL client', async () => {
            // Build the query
            const operation = createQueryBuilder<{ countryCode: string }>()
                .query('GetCountryInfo')
                .variable('countryCode', 'ID!')
                .selectWith('country', (country) => {
                    country
                        .args({ code: '$countryCode' })
                        .field('name')
                        .field('capital')
                        .field('currency')
                        .selectWith('languages', (lang) => {
                            lang.field('name')
                        })
                })
                .build()

            // Execute with the client
            const response = await client.query<{
                country: {
                    name: string
                    capital: string
                    currency: string
                    languages: { name: string }[]
                }
            }>({
                ...operation,
                variables: { countryCode: 'JP' },
            })

            expect(response.isSuccess).to.equal(true)
            expect(response.data.data?.country.name).to.equal('Japan')
            expect(response.data.data?.country.capital).to.equal('Tokyo')
        })
    })
})
