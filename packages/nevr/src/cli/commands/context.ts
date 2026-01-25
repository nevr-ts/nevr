// =============================================================================
// CONTEXT COMMAND
// Generate AI-optimized context from nevr config
// =============================================================================

import { writeFileSync } from "fs"
import { join } from "path"
import { loadConfig } from "../utils/config-loader.js"
import {
  extractPluginEntities,
  getPluginSummary,
} from "../../generator/plugin-extractor.js"
import type { ConfigPlugin } from "../../config.js"
import type { Entity, EntityConfig, FieldDef } from "../../types.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ContextCommandOptions {
  /** Custom config file path */
  config?: string
  /** Output format */
  format?: "markdown" | "json"
  /** Output file path (if not specified, outputs to stdout) */
  output?: string
  /** Silent mode (no extra output) */
  silent?: boolean
}

// -----------------------------------------------------------------------------
// Context Generation (standalone, without NevrInstance)
// -----------------------------------------------------------------------------

interface ContextField {
  type: string
  required: boolean
  unique?: boolean
  searchable?: boolean
  embedding?: { provider: string; dimensions?: number }
  sensitive?: boolean
  instruction?: string
  options?: string[]
}

interface ContextEntity {
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

interface ContextPlugin {
  id: string
  name?: string
  endpoints: string[]
  entities?: string[]
}

interface AppContext {
  version: string
  generatedAt: string
  entities: ContextEntity[]
  plugins: ContextPlugin[]
  searchable: Array<{ entity: string; field: string }>
  embeddings: Array<{ entity: string; field: string; provider: string; dimensions?: number }>
}

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

  return ctx
}

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

function extractEntity(entity: Entity): ContextEntity {
  const config = entity.config as EntityConfig
  const fields: Record<string, ContextField> = {}

  for (const [fieldName, field] of Object.entries(config.fields)) {
    if (!field.relation) {
      fields[fieldName] = extractField(fieldName, field)
    }
  }

  const rules: Record<string, string[]> = {}
  for (const [op, ruleDefs] of Object.entries(config.rules || {})) {
    if (ruleDefs && ruleDefs.length > 0) {
      rules[op] = ruleDefs.map((r: any) => (typeof r === "string" ? r : "custom"))
    }
  }

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

function generateContextFromConfig(
  entities: Entity[],
  plugins: ConfigPlugin[]
): AppContext {
  const contextEntities: ContextEntity[] = []
  const searchable: AppContext["searchable"] = []
  const embeddings: AppContext["embeddings"] = []

  for (const entity of entities) {
    const ctx = extractEntity(entity)
    contextEntities.push(ctx)

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

  const contextPlugins: ContextPlugin[] = []
  for (const plugin of plugins) {
    const meta = (plugin as any).meta || plugin
    const endpoints = (plugin as any).endpoints ? Object.keys((plugin as any).endpoints) : []
    const schemaEntities = (plugin as any).schema?.entities
      ? Object.keys((plugin as any).schema.entities)
      : []

    contextPlugins.push({
      id: meta.id || meta.name || "unknown",
      name: meta.name,
      endpoints,
      entities: schemaEntities.length > 0 ? schemaEntities : undefined,
    })
  }

  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    entities: contextEntities,
    plugins: contextPlugins,
    searchable,
    embeddings,
  }
}

function contextToMarkdown(ctx: AppContext): string {
  const lines: string[] = []

  lines.push("# APP CONTEXT (Nevr)")
  lines.push("")
  lines.push(`Generated: ${ctx.generatedAt}`)
  lines.push("")

  lines.push("## Entities")
  lines.push("")

  for (const entity of ctx.entities) {
    lines.push(`### ${entity.name}${entity.namespace ? ` [${entity.namespace}]` : ""}`)
    if (entity.instruction) {
      lines.push(`> ${entity.instruction}`)
    }

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

    for (const rel of entity.relations) {
      const arrow = rel.type === "belongsTo" ? "→" : "←"
      lines.push(`${arrow} ${rel.field} (${rel.type} ${rel.target}${rel.required ? ", required" : ""})`)
    }

    if (entity.actions.length > 0) {
      lines.push(`Actions: ${entity.actions.join(", ")}`)
    }

    const ruleEntries = Object.entries(entity.rules)
    if (ruleEntries.length > 0) {
      const ruleStr = ruleEntries.map(([op, rules]) => `${op}:[${rules.join(",")}]`).join(" ")
      lines.push(`Rules: ${ruleStr}`)
    }

    lines.push("")
  }

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

  if (ctx.searchable.length > 0) {
    lines.push("## Searchable Fields")
    lines.push(ctx.searchable.map((s) => `${s.entity}.${s.field}`).join(", "))
    lines.push("")
  }

  if (ctx.embeddings.length > 0) {
    lines.push("## Embeddings (RAG)")
    for (const e of ctx.embeddings) {
      lines.push(`- ${e.entity}.${e.field} → ${e.provider}${e.dimensions ? `/${e.dimensions}dim` : ""}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

function contextToCompactJSON(ctx: AppContext): string {
  const compact = {
    v: ctx.version,
    t: ctx.generatedAt,
    e: ctx.entities.map((entity) => ({
      n: entity.name,
      i: entity.instruction,
      f: Object.fromEntries(
        Object.entries(entity.fields).map(([k, v]) => {
          let code = v.type.charAt(0)
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
  }

  return JSON.stringify(compact, null, 0)
}

// -----------------------------------------------------------------------------
// Context Command
// -----------------------------------------------------------------------------

export async function contextCommand(options: ContextCommandOptions = {}): Promise<void> {
  if (!options.silent) {
    console.log("\n🧠 nevr context\n")
  }

  try {
    // 1. Load config
    const config = await loadConfig({
      configPath: options.config,
      silent: true,
    })

    // 2. Collect all entities
    const userEntities = config.entities || []
    const plugins = (config.plugins || []) as ConfigPlugin[]
    const pluginEntities = extractPluginEntities(plugins)
    const allEntities = [...userEntities, ...pluginEntities]

    if (allEntities.length === 0 && plugins.length === 0) {
      console.log("⚠️  No entities or plugins found. Add them to your config first.")
      process.exit(0)
    }

    // 3. Generate context
    const ctx = generateContextFromConfig(allEntities, plugins)

    // 4. Format output
    const format = options.format || "markdown"
    const content = format === "json" ? contextToCompactJSON(ctx) : contextToMarkdown(ctx)

    // 5. Write or output
    if (options.output) {
      writeFileSync(join(process.cwd(), options.output), content)
      if (!options.silent) {
        console.log(`✅ Generated ${options.output}`)
        console.log(`
   Entities: ${ctx.entities.length}
   Plugins: ${ctx.plugins.length}
   Searchable fields: ${ctx.searchable.length}
   Embedding fields: ${ctx.embeddings.length}
`)
      }
    } else {
      // Output to stdout
      if (!options.silent) {
        console.log("---")
      }
      console.log(content)
    }
  } catch (error: any) {
    console.error(`\n❌ Context generation failed: ${error.message}`)
    if (process.env.DEBUG) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

export default contextCommand
