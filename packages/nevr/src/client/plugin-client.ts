// =============================================================================
// PLUGIN CLIENT
// Creates plugin-namespaced client methods: client.auth.signUp(), client.payment.checkout()
// =============================================================================

import type { Atom } from "nanostores"
import type {
    NevrFetch,
    NevrFetchOptions,
    NevrFetchResponse,
    NevrClientOptions,
} from "./types.js"
import type { EntityAction, FieldDef } from "../types.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Plugin client configuration
 */
export interface PluginClientConfig {
    /** Plugin namespace (e.g., "auth", "payment") */
    namespace: string
    /** Base path for plugin routes (e.g., "/auth", "/payment") */
    basePath: string
    /** Actions available in this plugin */
    actions: Record<string, PluginAction>
}

/**
 * Plugin action definition
 */
export interface PluginAction {
    /** HTTP method */
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    /** Route path (relative to basePath) */
    path: string
    /** Whether action requires a resource ID */
    requiresId?: boolean
    /** Input schema (for type inference) */
    input?: Record<string, FieldDef>
}

/**
 * Infer plugin actions as typed methods
 */
export type InferPluginMethods<TConfig extends PluginClientConfig> = {
    [K in keyof TConfig["actions"]]: TConfig["actions"][K] extends { requiresId: true }
    ? TConfig["actions"][K]["input"] extends Record<string, any>
    ? (id: string, input: InferInputType<TConfig["actions"][K]["input"]>) => Promise<NevrFetchResponse<unknown>>
    : (id: string) => Promise<NevrFetchResponse<unknown>>
    : TConfig["actions"][K]["input"] extends Record<string, any>
    ? (input: InferInputType<TConfig["actions"][K]["input"]>) => Promise<NevrFetchResponse<unknown>>
    : () => Promise<NevrFetchResponse<unknown>>
}

/**
 * Infer input type from field definitions
 */
type InferInputType<T extends Record<string, FieldDef>> = {
    [K in keyof T]: T[K]["type"] extends "string" | "text"
    ? string
    : T[K]["type"] extends "int" | "float"
    ? number
    : T[K]["type"] extends "boolean"
    ? boolean
    : unknown
}

// -----------------------------------------------------------------------------
// Plugin Client Factory
// -----------------------------------------------------------------------------

/**
 * Create methods for a plugin namespace
 * 
 * @example
 * ```typescript
 * const authMethods = createPluginMethods($fetch, {
 *   namespace: "auth",
 *   basePath: "/auth",
 *   actions: {
 *     signUp: { method: "POST", path: "/sign-up" },
 *     signIn: { method: "POST", path: "/sign-in" },
 *     signOut: { method: "POST", path: "/sign-out" },
 *   },
 * })
 * 
 * // Usage
 * await authMethods.signUp({ email, password })
 * ```
 */
export function createPluginMethods<TConfig extends PluginClientConfig>(
    $fetch: NevrFetch,
    config: TConfig
): InferPluginMethods<TConfig> {
    const methods: Record<string, Function> = {}

    for (const [actionName, action] of Object.entries(config.actions)) {
        methods[actionName] = async (...args: any[]) => {
            const path = config.basePath + action.path

            // Handle resource-level actions (require ID)
            if (action.requiresId) {
                const [id, input] = args
                const fullPath = path.replace(":id", id)
                return $fetch(fullPath, {
                    method: action.method,
                    body: input,
                })
            }

            // Handle collection-level actions
            const [input] = args
            return $fetch(path, {
                method: action.method,
                body: action.method === "GET" ? undefined : input,
                query: action.method === "GET" ? input : undefined,
            })
        }
    }

    return methods as InferPluginMethods<TConfig>
}

// -----------------------------------------------------------------------------
// Plugin Client Decorator
// Adds plugin namespace to existing client
// -----------------------------------------------------------------------------

/**
 * Plugin client plugin for createClient
 * Adds plugin namespace methods to the client
 * 
 * @deprecated Use unified plugins with `endpoints{}` instead. The client auto-wires
 * endpoints from server plugins. This function is only needed for consuming
 * 3rd-party APIs where you don't have access to the server plugin.
 * 
 * @example
 * ```typescript
 * // ❌ OLD: Manual pluginClient (deprecated)
 * pluginClient({
 *   namespace: "analytics",
 *   basePath: "/analytics",
 *   actions: { track: { method: "POST", path: "/track" } },
 * })
 * 
 * // ✅ NEW: Use unified plugin with endpoints
 * const analyticsPlugin = createPlugin({
 *   meta: { id: "analytics", basePath: "/analytics" },
 *   endpoints: {
 *     track: { method: "POST", path: "/track", handler: ... },
 *   },
 * })
 * 
 * // Client auto-wires to client.analytics.track()
 * const client = createClient({ plugins: [analyticsPlugin] })
 * ```
 */
export function pluginClient<TConfig extends PluginClientConfig>(config: TConfig) {
    return {
        id: `${config.namespace}-client` as const,

        getActions: ($fetch: NevrFetch) => {
            const methods = createPluginMethods($fetch, config)
            return {
                [config.namespace]: methods,
            }
        },

        // For type inference
        $InferNamespace: config.namespace as TConfig["namespace"],
        $InferActions: {} as InferPluginMethods<TConfig>,
    }
}

// -----------------------------------------------------------------------------
// Pre-built Plugin Client Helpers
// -----------------------------------------------------------------------------
// Type Inference Helpers
// -----------------------------------------------------------------------------

/**
 * Infer client type with plugin namespaces
 */
export type InferClientWithPlugins<TPlugins extends ReturnType<typeof pluginClient>[]> = {
    [P in TPlugins[number]as P["$InferNamespace"]]: P["$InferActions"]
}
