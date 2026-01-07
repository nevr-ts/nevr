// =============================================================================
// UTILITY FUNCTIONS
// Shared utilities used across the Nevr codebase
// =============================================================================

/**
 * Capitalize the first letter of a string
 * @example capitalize("hello") // "Hello"
 */
export function capitalize(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Convert string to PascalCase
 * @example pascalCase("hello-world") // "HelloWorld"
 * @example pascalCase("hello_world") // "HelloWorld"
 */
export function pascalCase(str: string): string {
  if (!str) return str
  return str
    .split(/[-_\s]+/)
    .map(word => capitalize(word))
    .join('')
}

/**
 * Convert string to camelCase
 * @example camelCase("hello-world") // "helloWorld"
 */
export function camelCase(str: string): string {
  const pascal = pascalCase(str)
  if (!pascal) return pascal
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

/**
 * Convert string to kebab-case
 * @example kebabCase("helloWorld") // "hello-world"
 */
export function kebabCase(str: string): string {
  if (!str) return str
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}

/**
 * Convert string to snake_case
 * @example snakeCase("helloWorld") // "hello_world"
 */
export function snakeCase(str: string): string {
  if (!str) return str
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
}

/**
 * Check if a string is a valid identifier (alphanumeric starting with letter)
 */
export function isValidIdentifier(str: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9]*$/.test(str)
}

/**
 * Check if a string is a valid entity name (lowercase starting with letter)
 */
export function isValidEntityName(str: string): boolean {
  return /^[a-z][a-zA-Z0-9]*$/.test(str)
}
