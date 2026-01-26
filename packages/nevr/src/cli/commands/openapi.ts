// =============================================================================
// OPENAPI COMMAND
// Generate OpenAPI specification from entities
// =============================================================================

import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { loadConfig } from "../utils/config-loader.js"
import {
  extractPluginEntities,
  extractPluginExtensions,
  applyExtensionsToEntities,
} from "../../generator/plugin-extractor.js"
import type { ConfigPlugin } from "../../config.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface OpenAPICommandOptions {
  /** Custom config file path */
  config?: string
  /** Output file path */
  output?: string
  /** Output format */
  format?: "json" | "yaml"
  /** API title */
  title?: string
  /** API version */
  version?: string
  /** Base path for API */
  basePath?: string
  /** Silent mode */
  silent?: boolean
}

// -----------------------------------------------------------------------------
// Zod → JSON Schema Helpers
// -----------------------------------------------------------------------------

/**
 * Map a Zod base type string to an OpenAPI type
 */
function zodTypeToOpenAPI(typeName: string): Record<string, unknown> {
  switch (typeName) {
    case "string":
      return { type: "string" }
    case "number":
      return { type: "number" }
    case "int":
    case "integer":
      return { type: "integer" }
    case "boolean":
      return { type: "boolean" }
    case "date":
      return { type: "string", format: "date-time" }
    case "literal":
      return { type: "string" }
    case "enum":
      return { type: "string" }
    case "array":
      return { type: "array", items: { type: "string" } }
    case "object":
      return { type: "object" }
    default:
      return { type: "string" }
  }
}

/**
 * Apply Zod validation checks to a JSON Schema property
 */
function applyZodChecks(schema: Record<string, unknown>, checks: any[]): void {
  if (!Array.isArray(checks)) return
  for (const check of checks) {
    switch (check.kind) {
      case "min":
        if (schema.type === "string") schema.minLength = check.value
        else schema.minimum = check.value
        break
      case "max":
        if (schema.type === "string") schema.maxLength = check.value
        else schema.maximum = check.value
        break
      case "email":
        schema.format = "email"
        break
      case "url":
        schema.format = "uri"
        break
      case "uuid":
        schema.format = "uuid"
        break
      case "int":
        schema.type = "integer"
        break
    }
  }
}

/**
 * Unwrap Zod wrapper types (optional, default, nullable) to get the base schema
 */
function unwrapZodField(field: any): { base: any; optional: boolean; defaultVal?: unknown } {
  let current = field
  let isOptional = false
  let defaultVal: unknown = undefined

  // Unwrap wrapper types
  for (let i = 0; i < 5; i++) { // Guard against infinite loops
    const type = current?._def?.type || current?._def?.typeName
    if (type === "optional" || type === "ZodOptional") {
      isOptional = true
      current = current._def.innerType
    } else if (type === "default" || type === "ZodDefault") {
      isOptional = true
      defaultVal = current._def.defaultValue
      current = current._def.innerType
    } else if (type === "nullable" || type === "ZodNullable") {
      isOptional = true
      current = current._def.innerType
    } else {
      break
    }
  }

  return { base: current, optional: isOptional, defaultVal }
}

/**
 * Convert a single Zod field to JSON Schema property
 */
function zodFieldToJsonSchema(field: any): Record<string, unknown> | null {
  if (!field || !field._def) return null

  const { base, defaultVal } = unwrapZodField(field)
  const typeName = base?._def?.type || base?._def?.typeName || "string"

  // Clean type name (strip "Zod" prefix if present)
  const cleanType = typeName.replace(/^Zod/, "").toLowerCase()
  const schema = zodTypeToOpenAPI(cleanType)

  // Apply checks (min, max, email, etc.)
  if (base?._def?.checks) {
    applyZodChecks(schema, base._def.checks)
  }

  // Handle enum values
  if (cleanType === "enum" && base?._def?.values) {
    schema.enum = base._def.values
  }

  // Handle literal
  if (cleanType === "literal" && base?._def?.value !== undefined) {
    schema.enum = [base._def.value]
  }

  // Handle arrays with element type
  if (cleanType === "array" && base?._def?.element) {
    const elementSchema = zodFieldToJsonSchema(base._def.element)
    if (elementSchema) {
      schema.items = elementSchema
    }
  }

  // Handle nested objects
  if (cleanType === "object" && base?.shape) {
    const nested = zodObjectToJsonSchema(base)
    if (nested) {
      Object.assign(schema, nested)
    }
  }

  if (defaultVal !== undefined) {
    schema.default = defaultVal
  }

  return schema
}

/**
 * Convert a Zod object schema to a JSON Schema object with properties + required
 */
function zodObjectToJsonSchema(zodSchema: any): Record<string, unknown> | null {
  // Check if it's a ZodObject with .shape
  const shape = zodSchema?.shape || zodSchema?._def?.shape?.()
  if (!shape || typeof shape !== "object") return null

  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const [fieldName, fieldValue] of Object.entries(shape)) {
    const fieldSchema = zodFieldToJsonSchema(fieldValue)
    if (fieldSchema) {
      properties[fieldName] = fieldSchema
    }

    // Check if required (not optional/default/nullable)
    const { optional } = unwrapZodField(fieldValue)
    if (!optional) {
      required.push(fieldName)
    }
  }

  if (Object.keys(properties).length === 0) return null

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  }
}

/**
 * Extract query parameters from a Zod object schema
 */
function zodSchemaToQueryParams(zodSchema: any): Array<Record<string, unknown>> {
  const shape = zodSchema?.shape || zodSchema?._def?.shape?.()
  if (!shape || typeof shape !== "object") return []

  const params: Array<Record<string, unknown>> = []
  for (const [fieldName, fieldValue] of Object.entries(shape)) {
    const { optional } = unwrapZodField(fieldValue)
    const fieldSchema = zodFieldToJsonSchema(fieldValue)

    params.push({
      name: fieldName,
      in: "query",
      required: !optional,
      ...(fieldSchema ? { schema: fieldSchema } : { schema: { type: "string" } }),
    })
  }

  return params
}

// -----------------------------------------------------------------------------
// Plugin Endpoint → OpenAPI Path Helpers
// -----------------------------------------------------------------------------

/**
 * Generate OpenAPI paths from plugin custom endpoints
 *
 * Reads each plugin's `endpoints` record and `basePath` to produce
 * OpenAPI path items with method, summary, tags, request/response schemas.
 */
function generatePluginEndpointPaths(
  plugins: ConfigPlugin[],
): {
  paths: Record<string, Record<string, unknown>>
  tags: Array<{ name: string; description?: string }>
} {
  const paths: Record<string, Record<string, unknown>> = {}
  const tags: Array<{ name: string; description?: string }> = []

  for (const plugin of plugins) {
    const meta = (plugin as any).meta || plugin
    const pluginName = meta.name || meta.id || "Plugin"
    const basePath = meta.basePath || ""
    const endpoints: Record<string, any> = (plugin as any).endpoints || {}

    const endpointKeys = Object.keys(endpoints)
    if (endpointKeys.length === 0) continue

    // Add plugin tag
    tags.push({
      name: pluginName,
      description: `${pluginName} plugin endpoints`,
    })

    for (const [key, ep] of Object.entries(endpoints)) {
      if (!ep || typeof ep !== "object") continue

      const method: string = (ep.method || "POST").toLowerCase()
      const epPath: string = ep.path || `/${key}`
      const epMeta: any = ep.meta || {}

      // Build full path: basePath + endpoint path
      // Convert :param to {param} for OpenAPI
      const fullPath = (basePath + epPath).replace(/:([a-zA-Z0-9_]+)/g, "{$1}")

      // Extract path parameters
      const parameters: Array<Record<string, unknown>> = []
      const paramMatches = epPath.match(/:([a-zA-Z0-9_]+)/g)
      if (paramMatches) {
        for (const match of paramMatches) {
          parameters.push({
            name: match.slice(1),
            in: "path",
            required: true,
            schema: { type: "string" },
          })
        }
      }

      // Extract query parameters from Zod query schema
      if (ep.query) {
        const queryParams = zodSchemaToQueryParams(ep.query)
        parameters.push(...queryParams)
      }

      const operation: Record<string, unknown> = {
        summary: epMeta.summary || key,
        description: epMeta.description,
        operationId: epMeta.openapi?.operationId || key,
        tags: epMeta.tags || [pluginName],
        ...(parameters.length > 0 ? { parameters } : {}),
        responses: epMeta.openapi?.responses || {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
        },
        ...(epMeta.deprecated ? { deprecated: true } : {}),
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      }

      // Add request body for POST/PUT/PATCH with Zod schema extraction
      if (["post", "put", "patch"].includes(method)) {
        if (epMeta.openapi?.requestBody) {
          operation.requestBody = epMeta.openapi.requestBody
        } else if (ep.body) {
          // Extract schema from Zod body definition
          const bodySchema = zodObjectToJsonSchema(ep.body)
          operation.requestBody = {
            required: true,
            content: {
              "application/json": {
                schema: bodySchema || { type: "object" },
              },
            },
          }
        }
      }

      if (!paths[fullPath]) {
        paths[fullPath] = {}
      }
      ;(paths[fullPath] as any)[method] = operation
    }
  }

  return { paths, tags }
}

// -----------------------------------------------------------------------------
// OpenAPI Command
// -----------------------------------------------------------------------------

export async function openapiCommand(options: OpenAPICommandOptions = {}): Promise<void> {
  if (!options.silent) {
    console.log("\n⚡ nevr openapi\n")
  }

  try {
    // 1. Load config
    const config = await loadConfig({
      configPath: options.config,
      silent: options.silent,
    })

    // 2. Collect all entities
    const userEntities = config.entities || []
    const plugins = (config.plugins || []) as ConfigPlugin[]
    const pluginEntities = extractPluginEntities(plugins)

    // 3. Apply extensions (e.g., username extends user, payment extends user)
    const extensions = extractPluginExtensions(plugins)
    applyExtensionsToEntities(userEntities, extensions)
    applyExtensionsToEntities(pluginEntities, extensions)

    // 4. Filter out internal entities (plugin entities like user, session are internal)
    // These use custom plugin endpoints, not CRUD routes
    const publicEntities = [...userEntities, ...pluginEntities].filter(
      (e) => !(e as any)._internal
    )

    if (publicEntities.length === 0 && plugins.length === 0) {
      console.log("\n⚠️  No public entities or plugins found.")
      process.exit(0)
    }

    // 5. Generate base OpenAPI spec from public entities (CRUD routes)
    const { generateOpenAPI } = await import("../../generator/core.js")

    const spec = generateOpenAPI(publicEntities, {
      info: {
        title: options.title || "Nevr API",
        version: options.version || "1.0.0",
        description: "API generated by Nevr",
      },
      basePath: options.basePath || "/api",
    })

    // 6. Generate plugin custom endpoint paths and merge into spec
    const { paths: pluginPaths, tags: pluginTags } = generatePluginEndpointPaths(plugins)

    for (const [pathKey, pathOps] of Object.entries(pluginPaths)) {
      if (!spec.paths[pathKey]) {
        spec.paths[pathKey] = {}
      }
      Object.assign(spec.paths[pathKey], pathOps)
    }

    spec.tags.push(...pluginTags)

    // 7. Format output
    const format = options.format || "json"
    let content: string

    if (format === "yaml") {
      content = jsonToYaml(spec)
    } else {
      content = JSON.stringify(spec, null, 2)
    }

    // 8. Write file
    const outputPath = options.output || `openapi.${format}`
    const fullPath = join(process.cwd(), outputPath)

    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, content)

    if (!options.silent) {
      const pluginEndpointCount = Object.values(pluginPaths).reduce(
        (sum, methods) => sum + Object.keys(methods).length,
        0
      )
      console.log(`   📄 Public entities: ${publicEntities.length}`)
      console.log(`   📄 Plugins: ${plugins.length} (${pluginEndpointCount} endpoints)`)
      console.log(`   📄 Format: ${format.toUpperCase()}`)
      console.log(`\n✅ Generated ${outputPath}`)
      console.log(`
Next steps:
   • Import into Swagger UI, Postman, or Insomnia
   • Use with OpenAPI generators for client SDKs
   • Host on your API docs page
`)
    }
  } catch (error: any) {
    console.error(`\n❌ OpenAPI generation failed: ${error.message}`)
    if (process.env.DEBUG) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// -----------------------------------------------------------------------------
// Simple JSON to YAML converter
// -----------------------------------------------------------------------------

function jsonToYaml(obj: any, indent = 0): string {
  const spaces = "  ".repeat(indent)
  const lines: string[] = []

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === "object" && item !== null) {
        lines.push(`${spaces}-`)
        const nested = jsonToYaml(item, indent + 1)
        lines.push(nested)
      } else {
        lines.push(`${spaces}- ${formatYamlValue(item)}`)
      }
    }
  } else if (typeof obj === "object" && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue

      if (typeof value === "object" && value !== null) {
        if (Array.isArray(value) && value.length === 0) {
          lines.push(`${spaces}${key}: []`)
        } else if (!Array.isArray(value) && Object.keys(value).length === 0) {
          lines.push(`${spaces}${key}: {}`)
        } else {
          lines.push(`${spaces}${key}:`)
          lines.push(jsonToYaml(value, indent + 1))
        }
      } else {
        lines.push(`${spaces}${key}: ${formatYamlValue(value)}`)
      }
    }
  }

  return lines.join("\n")
}

function formatYamlValue(value: any): string {
  if (value === null) return "null"
  if (value === true) return "true"
  if (value === false) return "false"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") {
    // Quote strings that need it
    if (value === "" || /[:#{}[\],&*!|>'"%@`]/.test(value) || /^\s|\s$/.test(value)) {
      return `"${value.replace(/"/g, '\\"')}"`
    }
    return value
  }
  return String(value)
}

export default openapiCommand
