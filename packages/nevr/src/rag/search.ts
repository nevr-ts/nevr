// =============================================================================
// FULL-TEXT SEARCH
// Helpers for .searchable() fields - enables text search across entities
// =============================================================================

import type { Entity, FieldDef } from "../types.js"

/**
 * Search result from full-text search
 */
export interface TextSearchResult {
    /** Entity name */
    entity: string
    /** Record ID */
    recordId: string
    /** Relevance score (higher = more relevant) */
    score: number
    /** Matched fields */
    matches: Array<{
        field: string
        snippet?: string
    }>
}

/**
 * Full-text search options
 */
export interface TextSearchOptions {
    /** Entities to search (default: all with searchable fields) */
    entities?: string[]
    /** Maximum results */
    limit?: number
    /** Highlight matches in results */
    highlight?: boolean
    /** Fuzzy matching tolerance (0-1) */
    fuzzy?: number
}

/**
 * Get searchable fields from an entity
 */
export function getSearchableFields(entity: Entity): Map<string, FieldDef> {
    const fields = new Map<string, FieldDef>()

    for (const [fieldName, fieldDef] of Object.entries(entity.config.fields)) {
        if (fieldDef.semantic?.searchable) {
            fields.set(fieldName, fieldDef)
        }
    }

    return fields
}

/**
 * Check if entity has any searchable fields
 */
export function hasSearchableFields(entity: Entity): boolean {
    return Object.values(entity.config.fields).some(f => f.semantic?.searchable)
}

/**
 * Build a full-text search query for PostgreSQL
 * Uses ts_query for proper tokenization
 */
export function buildPostgresSearchQuery(
    query: string,
    fields: string[],
    options: { fuzzy?: number } = {}
): { sql: string; values: unknown[] } {
    // Escape special characters and convert to tsquery format
    const sanitized = query
        .replace(/[&|!():*]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map(term => `${term}:*`) // Prefix matching
        .join(" & ")

    if (!sanitized) {
        return { sql: "FALSE", values: [] }
    }

    // Build the search expression
    const fieldExpressions = fields.map(f => `coalesce("${f}", '')`).join(" || ' ' || ")

    return {
        sql: `to_tsvector('english', ${fieldExpressions}) @@ to_tsquery('english', $1)`,
        values: [sanitized],
    }
}

/**
 * Build a search query for SQLite using LIKE
 */
export function buildSqliteSearchQuery(
    query: string,
    fields: string[]
): { sql: string; values: unknown[] } {
    const terms = query
        .split(/\s+/)
        .filter(Boolean)
        .map(term => `%${term}%`)

    if (terms.length === 0) {
        return { sql: "0", values: [] }
    }

    const conditions = fields.flatMap((field, fi) =>
        terms.map((_, ti) => `"${field}" LIKE $${fi * terms.length + ti + 1}`)
    )

    return {
        sql: `(${conditions.join(" OR ")})`,
        values: terms.flatMap(term => fields.map(() => term)),
    }
}

/**
 * Simple in-memory text search (for development)
 * Supports basic term matching with scoring
 */
export function inMemoryTextSearch<T extends Record<string, unknown>>(
    records: T[],
    query: string,
    fields: string[],
    options: TextSearchOptions = {}
): Array<T & { _searchScore: number }> {
    const { limit = 100, fuzzy = 0 } = options

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length === 0) return []

    const results: Array<T & { _searchScore: number }> = []

    for (const record of records) {
        let score = 0

        for (const field of fields) {
            const value = record[field]
            if (typeof value !== "string") continue

            const fieldValue = value.toLowerCase()

            for (const term of terms) {
                // Exact match
                if (fieldValue.includes(term)) {
                    score += 10
                } else if (fuzzy > 0) {
                    // Fuzzy match using simple Levenshtein approximation
                    const words = fieldValue.split(/\s+/)
                    for (const word of words) {
                        if (similarityScore(term, word) >= fuzzy) {
                            score += 5
                        }
                    }
                }
            }
        }

        if (score > 0) {
            results.push({ ...record, _searchScore: score })
        }
    }

    return results
        .sort((a, b) => b._searchScore - a._searchScore)
        .slice(0, limit)
}

/**
 * Simple similarity score (Jaccard-like)
 */
function similarityScore(a: string, b: string): number {
    if (a === b) return 1
    if (a.length === 0 || b.length === 0) return 0

    const aSet = new Set(a.split(""))
    const bSet = new Set(b.split(""))

    let intersection = 0
    for (const char of aSet) {
        if (bSet.has(char)) intersection++
    }

    return intersection / (aSet.size + bSet.size - intersection)
}

/**
 * Highlight search terms in text
 */
export function highlightMatches(
    text: string,
    query: string,
    options: { tag?: string } = {}
): string {
    const { tag = "mark" } = options
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)

    let result = text
    for (const term of terms) {
        const regex = new RegExp(`(${escapeRegex(term)})`, "gi")
        result = result.replace(regex, `<${tag}>$1</${tag}>`)
    }

    return result
}

/**
 * Extract snippets around matches
 */
export function extractSnippets(
    text: string,
    query: string,
    options: { maxLength?: number; contextWords?: number } = {}
): string[] {
    const { maxLength = 150, contextWords = 5 } = options
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    const snippets: string[] = []

    const words = text.split(/\s+/)

    for (let i = 0; i < words.length; i++) {
        const word = words[i].toLowerCase()
        if (terms.some(term => word.includes(term))) {
            const start = Math.max(0, i - contextWords)
            const end = Math.min(words.length, i + contextWords + 1)
            const snippet = (start > 0 ? "..." : "") +
                words.slice(start, end).join(" ") +
                (end < words.length ? "..." : "")

            if (snippet.length <= maxLength) {
                snippets.push(snippet)
            }
        }
    }

    return [...new Set(snippets)].slice(0, 3)
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
