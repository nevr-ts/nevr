// =============================================================================
// OAUTH PROVIDERS - BARREL EXPORTS
// =============================================================================

export { google, type GoogleProfile } from "./google.js"
export { github, type GithubProfile } from "./github.js"
export { apple, type AppleProfile, type AppleNonConformUser } from "./apple.js"

import { google } from "./google.js"
import { github } from "./github.js"
import { apple } from "./apple.js"
import type { OAuthProviderOptions, OAuthProvider, SocialProvidersConfig } from "../types.js"

/**
 * All built-in social providers
 */
export const socialProviders = {
    google,
    github,
    apple,
}

export type SocialProviderList = keyof typeof socialProviders

/**
 * Create providers from configuration
 */
export function createProviders(
    config: SocialProvidersConfig
): Map<string, OAuthProvider> {
    const providers = new Map<string, OAuthProvider>()

    for (const [key, options] of Object.entries(config)) {
        if (!options || (options as { enabled?: boolean }).enabled === false) {
            continue
        }

        const factory = socialProviders[key as SocialProviderList]
        if (factory) {
            providers.set(key, factory(options as any))
        }
    }

    return providers
}
