// =============================================================================
// UNIFIED PLUGIN HELPERS
// Helper functions for plugin interceptors and matching
// =============================================================================

// -----------------------------------------------------------------------------
// Matcher Helpers
// -----------------------------------------------------------------------------

/**
 * Create a path matcher for interceptors
 */
export function matchPath(pattern: string | RegExp | ((ctx: any) => boolean)) {
    if (typeof pattern === "string") {
        if (pattern.includes("*")) {
            // Glob pattern
            const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`)
            return (ctx: any) => regex.test(ctx.path)
        }
        // Exact match
        return (ctx: any) => ctx.path === pattern
    }

    if (pattern instanceof RegExp) {
        return (ctx: any) => pattern.test(ctx.path)
    }

    return pattern
}

/**
 * Match any path
 */
export function matchAny() {
    return () => true
}

/**
 * Match paths starting with prefix
 */
export function matchPrefix(prefix: string) {
    return (ctx: any) => ctx.path.startsWith(prefix)
}

/**
 * Match paths matching regex
 */
export function matchRegex(regex: RegExp) {
    return (ctx: any) => regex.test(ctx.path)
}

/**
 * Combine multiple matchers with AND
 */
export function matchAll(...matchers: Array<(ctx: any) => boolean>) {
    return (ctx: any) => matchers.every(m => m(ctx))
}

/**
 * Combine multiple matchers with OR
 */
export function matchAnyOf(...matchers: Array<(ctx: any) => boolean>) {
    return (ctx: any) => matchers.some(m => m(ctx))
}
