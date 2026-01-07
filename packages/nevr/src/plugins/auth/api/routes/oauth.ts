// =============================================================================
// ROUTE - OAUTH
// OAuth sign-in and link-social endpoints
// =============================================================================

import { z } from "zod"
import { endpoint, EndpointError, validateWithZod } from "../../../unified/endpoint.js"
import type { AuthPluginOptions, InternalAdapter } from "../../types.js"
import { AUTH_ERROR_CODES } from "../../error-codes.js"
import type { SessionCookieConfig } from "../../cookies/session-cookie.js"
import { createInternalAdapter } from "../internal-adapter.js"
import {
    getSessionFromCtx,
    type SessionMiddlewareConfig,
} from "./session.js"
import { generatePKCEPair } from "../../oauth/pkce.js"
import { generateState } from "../../oauth/state.js"
import type { OAuthProvider, SocialProvidersConfig } from "../../oauth/types.js"
import { createProviders } from "../../oauth/providers/index.js"

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

export const signInProviderSchema = z.object({
    callbackURL: z.string().optional(),
    errorURL: z.string().optional(),
    scopes: z.array(z.string()).optional(),
    loginHint: z.string().optional(),
})

export const linkSocialSchema = z.object({
    providerId: z.string().min(1, "Provider ID is required"),
    callbackURL: z.string().optional(),
})

// -----------------------------------------------------------------------------
// Route Configuration
// -----------------------------------------------------------------------------

export interface OAuthRouteConfig {
    options: AuthPluginOptions
    cookieConfig: SessionCookieConfig
    sessionConfig: {
        expiresIn: number
    }
}

// -----------------------------------------------------------------------------
// Provider Cache (WeakMap for proper GC, keyed by config object)
// -----------------------------------------------------------------------------

const providersCacheMap = new WeakMap<object, Map<string, OAuthProvider>>()

function getProviders(config: OAuthRouteConfig): Map<string, OAuthProvider> {
    const socialProviders = config.options.socialProviders
    if (!socialProviders) {
        return new Map()
    }

    // Use config.options as cache key (stable per plugin instance)
    let cached = providersCacheMap.get(config.options)
    if (!cached) {
        cached = createProviders(socialProviders)
        providersCacheMap.set(config.options, cached)
    }
    return cached
}

/**
 * Clear provider cache (for testing)
 */
export function clearProviderCache(): void {
    // WeakMap handles cleanup automatically, but for tests we can create fresh
}

// -----------------------------------------------------------------------------
// Sign In With Provider
// -----------------------------------------------------------------------------

/**
 * Create sign in with provider endpoint
 * Returns authorization URL for OAuth flow
 */
export function signInWithProvider(config: OAuthRouteConfig) {
    const { options, cookieConfig, sessionConfig } = config
    const secret = options.secret || process.env.AUTH_SECRET || process.env.NEVR_AUTH_SECRET || ""
    const baseURL = options.baseURL || ""

    return endpoint("/sign-in/:provider", {
        method: "POST",
        body: signInProviderSchema,
        meta: {
            summary: "Sign in with OAuth provider",
            description: "Initiate OAuth flow with a social provider",
            tags: ["OAuth"],
        },
        handler: async (ctx: any) => {
            const providerId = ctx.params?.provider
            if (!providerId) {
                throw new EndpointError("BAD_REQUEST", {
                    code: AUTH_ERROR_CODES.PROVIDER_NOT_FOUND,
                    message: "Provider is required",
                })
            }

            const providers = getProviders(config)
            const provider = providers.get(providerId)

            if (!provider) {
                throw new EndpointError("NOT_FOUND", {
                    code: AUTH_ERROR_CODES.PROVIDER_NOT_FOUND,
                    message: AUTH_ERROR_CODES.PROVIDER_NOT_FOUND,
                })
            }

            const rawBody = ctx.body || ctx.input || {}
            const body = validateWithZod(signInProviderSchema, rawBody)

            const callbackURL = body.callbackURL || "/"
            const errorURL = body.errorURL || callbackURL
            const redirectURI = `${baseURL}/auth/callback/${providerId}`

            // Generate PKCE pair
            const { codeVerifier, codeChallenge } = generatePKCEPair()

            // Generate encrypted state
            const state = generateState(providerId, callbackURL, secret, {
                errorURL,
                codeVerifier,
            })

            // Create authorization URL
            const authURL = await provider.createAuthorizationURL({
                state,
                scopes: body.scopes,
                codeVerifier,
                redirectURI,
                loginHint: body.loginHint,
            })

            return {
                status: 200,
                body: {
                    url: authURL.toString(),
                    redirect: true,
                },
            }
        },
    })
}

// -----------------------------------------------------------------------------
// Link Social Account
// -----------------------------------------------------------------------------

/**
 * Create link social account endpoint
 * Allows authenticated users to link additional OAuth providers
 */
export function linkSocial(config: OAuthRouteConfig) {
    const { options, cookieConfig, sessionConfig } = config
    const secret = options.secret || process.env.AUTH_SECRET || process.env.NEVR_AUTH_SECRET || ""
    const baseURL = options.baseURL || ""
    const sessionMwConfig: SessionMiddlewareConfig = {
        cookieConfig,
        sessionExpiresIn: sessionConfig.expiresIn,
    }

    return endpoint("/link-social", {
        method: "POST",
        body: linkSocialSchema,
        meta: {
            summary: "Link social account",
            description: "Link an OAuth provider to the current user account",
            tags: ["OAuth", "Account"],
        },
        handler: async (ctx: any) => {
            // Require authentication
            const session = await getSessionFromCtx(ctx, sessionMwConfig)
            if (!session) {
                throw new EndpointError("UNAUTHORIZED", {
                    code: AUTH_ERROR_CODES.UNAUTHORIZED,
                    message: "Authentication required",
                })
            }

            const rawBody = ctx.body || ctx.input || {}
            const body = validateWithZod(linkSocialSchema, rawBody)

            const providerId = body.providerId
            const providers = getProviders(config)
            const provider = providers.get(providerId)

            if (!provider) {
                throw new EndpointError("NOT_FOUND", {
                    code: AUTH_ERROR_CODES.PROVIDER_NOT_FOUND,
                    message: AUTH_ERROR_CODES.PROVIDER_NOT_FOUND,
                })
            }

            const driver = ctx.context?.driver || ctx.driver
            const adapter: InternalAdapter = createInternalAdapter(driver, {
                sessionExpiresIn: sessionConfig.expiresIn,
            })

            // Check if already linked
            const existingAccount = await adapter.findAccountByUserId(session.user.id, providerId)
            if (existingAccount) {
                throw new EndpointError("BAD_REQUEST", {
                    code: AUTH_ERROR_CODES.ACCOUNT_ALREADY_LINKED,
                    message: AUTH_ERROR_CODES.ACCOUNT_ALREADY_LINKED,
                })
            }

            const callbackURL = body.callbackURL || "/"
            const redirectURI = `${baseURL}/auth/callback/${providerId}`

            // Generate PKCE pair
            const { codeVerifier, codeChallenge } = generatePKCEPair()

            // Generate encrypted state with userId for linking
            const state = generateState(providerId, callbackURL, secret, {
                userId: session.user.id,
                email: session.user.email,
                codeVerifier,
            })

            // Create authorization URL
            const authURL = await provider.createAuthorizationURL({
                state,
                codeVerifier,
                redirectURI,
            })

            return {
                status: 200,
                body: {
                    url: authURL.toString(),
                    redirect: true,
                },
            }
        },
    })
}
