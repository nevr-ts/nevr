// =============================================================================
// INTROSPECTION MODULE
// Generate AI-optimized context from Nevr application
// Enables "self-aware codebase" for AI agents
// =============================================================================

import type { Entity, FieldDef, EntityConfig, EntityAction } from "./types.js"
import type { NevrInstance } from "./types.js"

// -----------------------------------------------------------------------------
// Context Types
// -----------------------------------------------------------------------------

/**
 * Compact field representation for context
 */
export interface ContextField {
    type: string
    required: boolean
    unique?: boolean
    searchable?: boolean
    embedding?: { provider: string; dimensions?: number }
    sensitive?: boolean
    instruction?: string
    options?: string[]
    label?: string
    description?: string
}

/**
 * Compact entity representation for context
 */
export interface ContextEntity {
    name: string
    instruction?: string
    fields: Record<string, ContextField>
    relations: Array<{
        field: string
        target: string
        type: "belongsTo" | "hasMany" | "hasOne"
        required: boolean
    }>
    actions: string[]
    rules: Record<string, string[]>
    namespace?: string
}

/**
 * Compact plugin representation for context
 */
export interface ContextPlugin {
    id: string
    name?: string
    endpoints: string[]
    entities?: string[]
}

/**
 * Compact service representation for context
 */
export interface ContextService {
    id: string
    lifecycle: string
    tags?: string[]
}

/**
 * Complete application context
 */
export interface AppContext {
    version: string
    generatedAt: string
    entities: ContextEntity[]
    plugins: ContextPlugin[]
    services: ContextService[]
    /** Fields marked for full-text search */
    searchable: Array<{ entity: string; field: string }>
    /** Fields marked for vector embedding */
    embeddings: Array<{ entity: string; field: string; provider: string; dimensions?: number }>
}

// -----------------------------------------------------------------------------
// Field Extraction
// -----------------------------------------------------------------------------

/**
 * Extract context-relevant info from a FieldDef
 */
function extractField(fieldName: string, field: FieldDef): ContextField {
    const ctx: ContextField = {
        type: field.type,
        required: !field.optional && !field.hasDefault,
    }

    if (field.unique) ctx.unique = true
    if (field.semantic?.searchable) ctx.searchable = true
    if (field.semantic?.sensitive) ctx.sensitive = true
    if (field.semantic?.instruction) ctx.instruction = field.semantic.instruction
    if (field.semantic?.embedding) {
        ctx.embedding = {
            provider: field.semantic.embedding.provider || "openai",
            dimensions: field.semantic.embedding.dimensions,
        }
    }
    if (field.options) ctx.options = field.options
    if (field.meta?.label) ctx.label = field.meta.label
    if (field.meta?.description) ctx.description = field.meta.description

    return ctx
}

/**
 * Extract relations from entity fields
 */
function extractRelations(fields: Record<string, FieldDef>): ContextEntity["relations"] {
    const relations: ContextEntity["relations"] = []

    for (const [fieldName, field] of Object.entries(fields)) {
        if (field.relation) {
            const targetEntity = field.relation.entity()
            relations.push({
                field: fieldName,
                target: targetEntity.name,
                type: field.relation.type,
                required: !field.optional,
            })
        }
    }

    return relations
}

// -----------------------------------------------------------------------------
// Entity Extraction
// -----------------------------------------------------------------------------

/**
 * Extract context-relevant info from an Entity
 */
function extractEntity(entity: Entity): ContextEntity {
    const config = entity.config as EntityConfig
    const fields: Record<string, ContextField> = {}

    // Extract non-relation fields
    for (const [fieldName, field] of Object.entries(config.fields)) {
        if (!field.relation) {
            fields[fieldName] = extractField(fieldName, field)
        }
    }

    // Extract rules as simple string arrays
    const rules: Record<string, string[]> = {}
    for (const [op, ruleDefs] of Object.entries(config.rules || {})) {
        if (ruleDefs && ruleDefs.length > 0) {
            rules[op] = ruleDefs.map((r) => (typeof r === "string" ? r : "custom"))
        }
    }

    // Extract action names
    const actions = config.actions ? Object.keys(config.actions) : []

    return {
        name: entity.name,
        instruction: config.instruction,
        fields,
        relations: extractRelations(config.fields),
        actions,
        rules,
        namespace: config.namespace,
    }
}

// -----------------------------------------------------------------------------
// Context Generation
// -----------------------------------------------------------------------------

/**
 * Generate complete application context from a Nevr instance
 */
export function generateContext(instance: NevrInstance): AppContext {
    const entities: ContextEntity[] = []
    const searchable: AppContext["searchable"] = []
    const embeddings: AppContext["embeddings"] = []

    // Extract entities
    const entityMap = (instance as any)._entities as Map<string, Entity> | undefined
    if (entityMap) {
        for (const [_, entity] of entityMap) {
            const ctx = extractEntity(entity)
            entities.push(ctx)

            // Collect searchable and embedding fields
            const config = entity.config as EntityConfig
            for (const [fieldName, field] of Object.entries(config.fields)) {
                if (field.semantic?.searchable) {
                    searchable.push({ entity: entity.name, field: fieldName })
                }
                if (field.semantic?.embedding) {
                    embeddings.push({
                        entity: entity.name,
                        field: fieldName,
                        provider: field.semantic.embedding.provider || "openai",
                        dimensions: field.semantic.embedding.dimensions,
                    })
                }
            }
        }
    }

    // Extract plugins
    const plugins: ContextPlugin[] = []
    const pluginList = (instance as any)._plugins as any[] | undefined
    if (pluginList) {
        for (const plugin of pluginList) {
            const meta = plugin.meta || plugin
            const endpoints = plugin.endpoints ? Object.keys(plugin.endpoints) : []
            const schemaEntities = plugin.schema?.entities ? Object.keys(plugin.schema.entities) : []

            plugins.push({
                id: meta.id || meta.name || "unknown",
                name: meta.name,
                endpoints,
                entities: schemaEntities.length > 0 ? schemaEntities : undefined,
            })
        }
    }

    // Extract services
    const services: ContextService[] = []
    const container = (instance as any).container
    if (container?.getServiceIds) {
        const serviceIds = container.getServiceIds() as string[]
        for (const id of serviceIds) {
            services.push({
                id,
                lifecycle: "singleton", // Default, could be enhanced
            })
        }
    }

    return {
        version: "1.0.0",
        generatedAt: new Date().toISOString(),
        entities,
        plugins,
        services,
        searchable,
        embeddings,
    }
}

// -----------------------------------------------------------------------------
// Output Formatters
// -----------------------------------------------------------------------------

/**
 * Convert context to high-density markdown for AI consumption
 */
export function contextToMarkdown(ctx: AppContext): string {
    const lines: string[] = []

    lines.push("# APP CONTEXT (Nevr)")
    lines.push("")
    lines.push(`Generated: ${ctx.generatedAt}`)
    lines.push("")

    // Entities
    lines.push("## Entities")
    lines.push("")

    for (const entity of ctx.entities) {
        lines.push(`### ${entity.name}${entity.namespace ? ` [${entity.namespace}]` : ""}`)
        if (entity.instruction) {
            lines.push(`> ${entity.instruction}`)
        }

        // Fields
        for (const [fieldName, field] of Object.entries(entity.fields)) {
            const attrs: string[] = []
            if (field.required) attrs.push("required")
            if (field.unique) attrs.push("unique")
            if (field.searchable) attrs.push("searchable")
            if (field.embedding) attrs.push(`embedding:${field.embedding.provider}`)
            if (field.sensitive) attrs.push("sensitive")
            if (field.options) attrs.push(`options:[${field.options.join(",")}]`)

            let line = `- ${fieldName} (${field.type})`
            if (attrs.length > 0) line += ` [${attrs.join(", ")}]`
            if (field.instruction) line += ` AI: "${field.instruction}"`
            lines.push(line)
        }

        // Relations
        for (const rel of entity.relations) {
            const arrow = rel.type === "belongsTo" ? "→" : "←"
            lines.push(`${arrow} ${rel.field} (${rel.type} ${rel.target}${rel.required ? ", required" : ""})`)
        }

        // Actions
        if (entity.actions.length > 0) {
            lines.push(`Actions: ${entity.actions.join(", ")}`)
        }

        // Rules
        const ruleEntries = Object.entries(entity.rules)
        if (ruleEntries.length > 0) {
            const ruleStr = ruleEntries.map(([op, rules]) => `${op}:[${rules.join(",")}]`).join(" ")
            lines.push(`Rules: ${ruleStr}`)
        }

        lines.push("")
    }

    // Plugins
    if (ctx.plugins.length > 0) {
        lines.push("## Plugins")
        lines.push("")
        for (const plugin of ctx.plugins) {
            lines.push(`### ${plugin.name || plugin.id}`)
            if (plugin.endpoints.length > 0) {
                lines.push(`Endpoints: ${plugin.endpoints.join(", ")}`)
            }
            if (plugin.entities && plugin.entities.length > 0) {
                lines.push(`Entities: ${plugin.entities.join(", ")}`)
            }
            lines.push("")
        }
    }

    // Services
    if (ctx.services.length > 0) {
        lines.push("## Services")
        lines.push(ctx.services.map((s) => s.id).join(", "))
        lines.push("")
    }

    // AI Search Indexes
    if (ctx.searchable.length > 0) {
        lines.push("## Searchable Fields")
        lines.push(ctx.searchable.map((s) => `${s.entity}.${s.field}`).join(", "))
        lines.push("")
    }

    // Embeddings
    if (ctx.embeddings.length > 0) {
        lines.push("## Embeddings (RAG)")
        for (const e of ctx.embeddings) {
            lines.push(`- ${e.entity}.${e.field} → ${e.provider}${e.dimensions ? `/${e.dimensions}dim` : ""}`)
        }
        lines.push("")
    }

    return lines.join("\n")
}

/**
 * Convert context to compact JSON for machine parsing
 * Uses abbreviated keys for minimal token usage
 */
export function contextToJSON(ctx: AppContext): string {
    // Compact representation
    const compact = {
        v: ctx.version,
        t: ctx.generatedAt,
        e: ctx.entities.map((entity) => ({
            n: entity.name,
            i: entity.instruction,
            f: Object.fromEntries(
                Object.entries(entity.fields).map(([k, v]) => {
                    // Compact field encoding: type + flags
                    let code = v.type.charAt(0) // s=string, t=text, i=int, etc.
                    code += v.required ? "!" : "?"
                    if (v.searchable) code += "S"
                    if (v.embedding) code += "E"
                    if (v.sensitive) code += "X"
                    if (v.unique) code += "U"
                    if (v.options) code += `[${v.options.join(",")}]`
                    return [k, v.instruction ? { c: code, i: v.instruction } : code]
                })
            ),
            r: entity.relations.map(
                (r) => `${r.field}→${r.target}${r.required ? "!" : ""}`
            ),
            a: entity.actions.length > 0 ? entity.actions : undefined,
            ru: Object.keys(entity.rules).length > 0 ? entity.rules : undefined,
        })),
        p: ctx.plugins.map((p) => ({
            id: p.id,
            e: p.endpoints.length > 0 ? p.endpoints : undefined,
        })),
        s: ctx.services.map((s) => s.id),
    }

    return JSON.stringify(compact, null, 0) // No indentation for compactness
}

/**
 * Generate context as a string (default: markdown)
 */
export function generateContextString(
    instance: NevrInstance,
    format: "markdown" | "json" = "markdown"
): string {
    const ctx = generateContext(instance)
    return format === "json" ? contextToJSON(ctx) : contextToMarkdown(ctx)
}
