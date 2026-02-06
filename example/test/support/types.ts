/**
 * Type definitions for test data
 */

// JSONPlaceholder User type
export interface User {
    id: number
    name: string
    username: string
    email: string
    address: {
        street: string
        suite: string
        city: string
        zipcode: string
        geo: {
            lat: string
            lng: string
        }
    }
    phone: string
    website: string
    company: {
        name: string
        catchPhrase: string
        bs: string
    }
}

// JSONPlaceholder Post type
export interface Post {
    id: number
    userId: number
    title: string
    body: string
}

// JSONPlaceholder Comment type
export interface Comment {
    id: number
    postId: number
    name: string
    email: string
    body: string
}

// GraphQL Countries API types
export interface Country {
    code: string
    name: string
    capital?: string
    currency?: string
    languages: Language[]
    continent: {
        code: string
        name: string
    }
}

export interface Language {
    code: string
    name: string
}

// New user for POST requests
export interface NewUser {
    name: string
    username: string
    email: string
}
