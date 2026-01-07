// =============================================================================
// ENTITY GENERATOR
// Generates entity files from CLI arguments
// =============================================================================

import { writeFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"
import { capitalize, pascalCase, camelCase } from "../utils/index.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface GenerateEntityOptions {
  name: string
  fields?: string
  rules?: string
  output?: string
  withRelations?: boolean
  withActions?: boolean
}

interface ParsedField {
  name: string
  type: string
  optional: boolean
  unique: boolean
}

interface ParsedRule {
  operation: string
  rule: string
}

// -----------------------------------------------------------------------------
// Field Type Mapping
// -----------------------------------------------------------------------------

const FIELD_TYPE_MAP: Record<string, string> = {
  string: "string",
  text: "text",
  int: "int",
  float: "float",
  bool: "bool",
  boolean: "boolean",
  datetime: "datetime",
  json: "json",
  email: "email",
}

const RULE_MAP: Record<string, string> = {
  everyone: "everyone",
  authenticated: "authenticated",
  admin: "admin",
  owner: "owner",
  ownerOrAdmin: "ownerOrAdmin",
}

// -----------------------------------------------------------------------------
// Parsers
// -----------------------------------------------------------------------------

function parseFields(fieldsStr?: string): ParsedField[] {
  if (!fieldsStr) return []

  return fieldsStr.split(",").map((field) => {
    const trimmed = field.trim()
    let name = trimmed
    let type = "string"
    let optional = false
    let unique = false

    // Parse field:type format
    if (trimmed.includes(":")) {
      const parts = trimmed.split(":")
      name = parts[0].trim()
      type = parts[1].trim()
    }

    // Check for modifiers
    if (name.endsWith("?")) {
      optional = true
      name = name.slice(0, -1)
    }
    if (type.endsWith("!")) {
      unique = true
      type = type.slice(0, -1)
    }
    if (type.endsWith("?")) {
      optional = true
      type = type.slice(0, -1)
    }

    // Validate type
    if (!FIELD_TYPE_MAP[type]) {
      console.warn(`⚠️  Unknown field type "${type}" for field "${name}", using "string"`)
      type = "string"
    }

    return { name, type: FIELD_TYPE_MAP[type], optional, unique }
  })
}

function parseRules(rulesStr?: string): ParsedRule[] {
  if (!rulesStr) return []

  return rulesStr.split(",").map((rule) => {
    const trimmed = rule.trim()
    if (!trimmed.includes(":")) {
      console.warn(`⚠️  Invalid rule format "${trimmed}", expected "operation:rule"`)
      return { operation: trimmed, rule: "authenticated" }
    }

    const [operation, ruleType] = trimmed.split(":").map((s) => s.trim())

    if (!RULE_MAP[ruleType]) {
      console.warn(`⚠️  Unknown rule "${ruleType}" for operation "${operation}", using "authenticated"`)
      return { operation, rule: "authenticated" }
    }

    return { operation, rule: RULE_MAP[ruleType] }
  })
}

// -----------------------------------------------------------------------------
// Code Generation
// -----------------------------------------------------------------------------

function generateFieldCode(field: ParsedField): string {
  let code = field.type

  if (field.optional) {
    code += ".optional()"
  }
  if (field.unique) {
    code += ".unique()"
  }

  return code
}

function generateImports(
  fields: ParsedField[],
  rules: ParsedRule[],
  withRelations: boolean,
  withActions: boolean
): string {
  const fieldTypes = new Set(fields.map((f) => f.type))
  const ruleTypes = new Set(rules.map((r) => r.rule))

  // Build imports
  const nevrImports: string[] = ["entity"]

  // Add field types
  for (const type of fieldTypes) {
    if (!nevrImports.includes(type)) {
      nevrImports.push(type)
    }
  }

  // Add relation helpers if needed
  if (withRelations) {
    nevrImports.push("belongsTo", "hasMany")
  }

  // Add action helpers if needed
  if (withActions) {
    nevrImports.push("action", "step")
  }

  // Add rules
  for (const rule of ruleTypes) {
    if (!nevrImports.includes(rule)) {
      nevrImports.push(rule)
    }
  }

  // Always include authenticated if rules exist but specific rules weren't defined
  if (rules.length === 0) {
    nevrImports.push("everyone", "authenticated")
  }

  return `import { ${nevrImports.join(", ")} } from "nevr"`
}

function generateRulesCode(rules: ParsedRule[]): string {
  if (rules.length === 0) {
    return `{
    list: everyone,
    read: everyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  }`
  }

  const rulesMap: Record<string, string> = {
    list: "authenticated",
    read: "authenticated",
    create: "authenticated",
    update: "authenticated",
    delete: "authenticated",
  }

  for (const rule of rules) {
    rulesMap[rule.operation] = rule.rule
  }

  const entries = Object.entries(rulesMap)
    .map(([op, rule]) => `    ${op}: ${rule}`)
    .join(",\n")

  return `{\n${entries},\n  }`
}

function generateEntityCode(
  name: string,
  fields: ParsedField[],
  rules: ParsedRule[],
  withRelations: boolean,
  withActions: boolean
): string {
  // Convert name to valid identifiers
  const varName = camelCase(name)
  const typeName = pascalCase(name)

  const imports = generateImports(fields, rules, withRelations, withActions)
  const rulesCode = generateRulesCode(rules)

  // Generate fields section
  let fieldsCode = fields.map((f) => `  ${f.name}: ${generateFieldCode(f)}`).join(",\n")

  // Add example relations if requested
  if (withRelations) {
    if (fieldsCode) fieldsCode += ",\n"
    fieldsCode += `  // Example relations - uncomment and modify as needed
  // author: belongsTo(() => user),
  // comments: hasMany(() => comment)`
  }

  // Generate actions if requested
  let actionsCode = ""
  if (withActions) {
    actionsCode = `

// =============================================================================
// Custom Actions
// =============================================================================

// Example: Archive action
export const archive${typeName}Action = action("archive")
  .input<{ reason?: string }>()
  .output<{ archivedAt: Date }>()
  .steps([
    step("archive", async (ctx) => {
      // Update the record
      const result = await ctx.driver.update(ctx.entityName, ctx.id!, {
        archivedAt: new Date(),
        archiveReason: ctx.input?.reason,
      })
      return { archivedAt: new Date() }
    }),
  ])

// Example: Clone action
export const clone${typeName}Action = action("clone")
  .output<{ id: string }>()
  .steps([
    step("clone", async (ctx) => {
      const original = await ctx.driver.findById(ctx.entityName, ctx.id!)
      if (!original) throw new Error("Record not found")

      const { id, createdAt, updatedAt, ...data } = original as any
      const cloned = await ctx.driver.create(ctx.entityName, {
        ...data,
        name: \`\${data.name || "Copy"} (Copy)\`,
      })
      return { id: cloned.id }
    }),
  ])`
  }

  // Build the entity
  let entityCode = `// =============================================================================
// ${name.toUpperCase()} ENTITY
// Generated by: npx nevr generate:entity ${name}
// =============================================================================

${imports}

export const ${varName} = entity("${name}", {
${fieldsCode}
})
  .rules(${rulesCode})
  .build()

// Type inference
export type ${typeName} = typeof ${varName}["$Infer"]["Data"]
export type Create${typeName}Input = typeof ${varName}["$Infer"]["CreateInput"]
export type Update${typeName}Input = typeof ${varName}["$Infer"]["UpdateInput"]
${actionsCode}
`

  return entityCode
}

// -----------------------------------------------------------------------------
// Main Generator
// -----------------------------------------------------------------------------

export async function generateEntity(options: GenerateEntityOptions): Promise<void> {
  const { name, fields, rules, output, withRelations = false, withActions = false } = options

  // Parse fields and rules
  const parsedFields = parseFields(fields)
  const parsedRules = parseRules(rules)

  // Generate code
  const code = generateEntityCode(name, parsedFields, parsedRules, withRelations, withActions)

  // Determine output path
  const outputDir = output || join(process.cwd(), "src", "entities")
  const outputFile = join(outputDir, `${name}.ts`)

  // Create directory if needed
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  // Check if file exists
  if (existsSync(outputFile)) {
    console.error(`❌ File already exists: ${outputFile}`)
    console.log("   Use a different name or delete the existing file")
    process.exit(1)
  }

  // Write file
  writeFileSync(outputFile, code)

  console.log(`
✅ Entity generated successfully!

   File: ${outputFile}

   Fields: ${parsedFields.length > 0 ? parsedFields.map((f) => f.name).join(", ") : "(none)"}
   Rules: ${parsedRules.length > 0 ? parsedRules.map((r) => `${r.operation}:${r.rule}`).join(", ") : "(defaults)"}
${withRelations ? "   Relations: Example relations included (commented)\n" : ""}${withActions ? "   Actions: Example actions included\n" : ""}
   Next steps:
   1. Review and customize the generated entity
   2. Add it to your entities/index.ts
   3. Run \`npm run generate\` to update Prisma schema
   4. Run \`npm run db:push\` to sync database
`)
}
