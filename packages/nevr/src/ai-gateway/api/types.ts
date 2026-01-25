// =============================================================================
// AI GATEWAY API TYPES
// Types for route configuration and handlers
// =============================================================================

import type { AIProviderType, AIGatewayPluginOptions } from "../types.js"
import type { AIProviderInterface } from "../providers/types.js"

// -----------------------------------------------------------------------------
// Route Configuration
// -----------------------------------------------------------------------------

export interface AIGatewayRouteConfig {
    /** Plugin options */
    options: AIGatewayPluginOptions

    /** Get a provider instance by type */
    getProvider: (type: AIProviderType) => AIProviderInterface | null

    /** Get all configured providers */
    getProviders: () => Map<AIProviderType, AIProviderInterface>
}
