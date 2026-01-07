// =============================================================================
// ROUTE - CALLBACK
// OAuth callback handler for all providers
// =============================================================================

import { z } from "zod"
import { endpoint, EndpointError } from "../../../unified/endpoint.js"
import type { AuthPluginOptions, AuthAccount, InternalAdapter } from "../../types.js"
import { AUTH_ERROR_CODES } from "../../error-codes.js"
import { setSessionCookie, type SessionCookieConfig } from "../../cookies/session-cookie.js"
import { createInternalAdapter } from "../internal-adapter.js"
import { parseState } from "../../oauth/state.js"
import type { OAuthProvider, SocialProvidersConfig } from "../../oauth/types.js"
import { createProviders } from "../../oauth/providers/index.js"
import { runHook, runBeforeCreateUser } from "../hooks.js"

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

export const callbackQuerySchema = z.object({
    code: z.string().optional(),
    state: z.string().optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
    // Apple sends user info as JSON in form_post
    user: z.string().optional(),
})

// -----------------------------------------------------------------------------
// Route Configuration
// -----------------------------------------------------------------------------

export interface CallbackRouteConfig {
    options: AuthPluginOptions
    cookieConfig: SessionCookieConfig
    sessionConfig: {
        expiresIn: number
    }
}

// Cache providers
let providersCache: Map<string, OAuthProvider> | null = null

function getProviders(socialProviders?: SocialProvidersConfig): Map<string, OAuthProvider> {
    if (!providersCache && socialProviders) {
        providersCache = createProviders(socialProviders)
    }
    return providersCache || new Map()
}

// -----------------------------------------------------------------------------
// OAuth Callback
// -----------------------------------------------------------------------------

/**
 * Create OAuth callback endpoint
 * Handles the redirect from OAuth providers after authorization
 */
export function oauthCallback(config: CallbackRouteConfig) {
    const { options, cookieConfig, sessionConfig } = config
    const secret = options.secret || process.env.AUTH_SECRET || process.env.NEVR_AUTH_SECRET || ""
    const baseURL = options.baseURL || ""

    return endpoint("/callback/:provider", {
        method: "GET",
        query: callbackQuerySchema,
        meta: {
            summary: "OAuth callback",
            description: "Handle OAuth provider callback after authorization",
            tags: ["OAuth"],
        },
        handler: async (ctx: any) => {
            const providerId = ctx.params?.provider
            const query = ctx.query || {}

            // Handle errors from provider
            if (query.error) {
                const errorURL = query.state
                    ? parseState(query.state, secret).valid
                        ? (parseState(query.state, secret) as any).state.errorURL
                        : "/"
                    : "/"
                return redirectWithError(errorURL || "/", query.error, query.error_description)
            }

            if (!query.code || !query.state) {
                return redirectWithError("/", "invalid_request", "Missing code or state")
            }

            // Parse state
            const stateResult = parseState(query.state, secret)
            if (!stateResult.valid) {
                return redirectWithError("/", "invalid_state", stateResult.error)
            }

            const state = stateResult.state

            // Verify provider matches
            if (state.provider !== providerId) {
                return redirectWithError(state.errorURL || "/", "invalid_state", "Provider mismatch")
            }

            const providers = getProviders(options.socialProviders)
            const provider = providers.get(providerId)

            if (!provider) {
                return redirectWithError(state.errorURL || "/", "provider_not_found", `Provider "${providerId}" not configured`)
            }

            const driver = ctx.context?.driver || ctx.driver
            if (!driver) {
                return redirectWithError(state.errorURL || "/", "internal_error", "Database not available")
            }
            const adapter: InternalAdapter = createInternalAdapter(driver, {
                sessionExpiresIn: sessionConfig.expiresIn,
            })

            const redirectURI = `${baseURL}/auth/callback/${providerId}`

            try {
                // Exchange code for tokens
                const tokens = await provider.validateAuthorizationCode({
                    code: query.code,
                    codeVerifier: state.codeVerifier,
                    redirectURI,
                })

                // For Apple, parse user data from form post
                if (providerId === "apple" && query.user) {
                    try {
                        (tokens as any).user = JSON.parse(query.user)
                    } catch {
                        // Ignore parse errors
                    }
                }

                // Get user info from provider
                const userInfo = await provider.getUserInfo(tokens)
                if (!userInfo || !userInfo.user.email) {
                    return redirectWithError(state.errorURL || "/", "user_info_failed", "Failed to get user info from provider")
                }

                const headers: Record<string, string> = {}

                // Check if this is an account linking flow
                if (state.userId) {
                    return handleAccountLink(
                        adapter, driver, provider, userInfo, tokens, state, cookieConfig, headers
                    )
                }

                // Check if account already exists
                const existingAccount = await adapter.findAccountByProviderId(providerId, userInfo.user.id)

                if (existingAccount) {
                    // Sign in existing user
                    const session = await adapter.createSession(existingAccount.userId)
                    setSessionCookie(headers, session.token, cookieConfig)

                    // Update tokens if needed
                    await driver.update("account", { id: existingAccount.id }, {
                        accessToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken || existingAccount.refreshToken,
                        idToken: tokens.idToken,
                        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
                        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
                        scope: tokens.scopes?.join(","),
                        updatedAt: new Date(),
                    })

                    return {
                        status: 302,
                        headers: { ...headers, Location: state.callbackURL },
                    }
                }

                // Check if user exists by email
                const existingUser = await adapter.findUserByEmail(userInfo.user.email)

                if (existingUser) {
                    // Check account linking settings
                    const accountLinkingEnabled = options.account?.accountLinking?.enabled !== false
                    const trustedProviders = options.account?.accountLinking?.trustedProviders || []
                    const isTrusted = trustedProviders.includes(providerId) || (userInfo.user.emailVerified && trustedProviders.length === 0)

                    if (accountLinkingEnabled && isTrusted) {
                        // Link account to existing user
                        await adapter.linkAccount({
                            userId: existingUser.user.id,
                            providerId,
                            accountId: userInfo.user.id,
                            accessToken: tokens.accessToken,
                            refreshToken: tokens.refreshToken,
                            idToken: tokens.idToken,
                            accessTokenExpiresAt: tokens.accessTokenExpiresAt,
                            refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
                            scope: tokens.scopes?.join(","),
                        })

                        const session = await adapter.createSession(existingUser.user.id)
                        setSessionCookie(headers, session.token, cookieConfig)

                        return {
                            status: 302,
                            headers: { ...headers, Location: state.callbackURL },
                        }
                    }

                    return redirectWithError(state.errorURL || "/", "email_exists", "An account with this email already exists")
                }

                // Create new user
                const userData = await runBeforeCreateUser({
                    email: userInfo.user.email,
                    name: userInfo.user.name,
                    image: userInfo.user.image,
                    emailVerified: userInfo.user.emailVerified,
                })

                const newUser = await adapter.createUser(userData as Omit<import("../../types.js").AuthUser, "id" | "createdAt" | "updatedAt">)
                if (!newUser) {
                    return redirectWithError(state.errorURL || "/", "user_creation_failed", "Failed to create user")
                }

                await runHook("afterCreateUser", newUser)

                // Link account
                await adapter.linkAccount({
                    userId: newUser.id,
                    providerId,
                    accountId: userInfo.user.id,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    idToken: tokens.idToken,
                    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
                    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
                    scope: tokens.scopes?.join(","),
                })

                // Create session
                const session = await adapter.createSession(newUser.id)
                setSessionCookie(headers, session.token, cookieConfig)

                await runHook("afterCreateSession", session)
                await runHook("afterSignIn", newUser, session)

                return {
                    status: 302,
                    headers: { ...headers, Location: state.callbackURL },
                }

            } catch (error: any) {
                return redirectWithError(
                    state.errorURL || "/",
                    "oauth_error",
                    error.message || "OAuth authentication failed"
                )
            }
        },
    })
}

/**
 * Handle account linking flow
 */
async function handleAccountLink(
    adapter: InternalAdapter,
    driver: any,
    provider: OAuthProvider,
    userInfo: any,
    tokens: any,
    state: any,
    cookieConfig: SessionCookieConfig,
    headers: Record<string, string>
): Promise<any> {
    // Verify the user still exists
    const userResult = await driver.findOne("user", { id: state.userId })
    if (!userResult) {
        return redirectWithError(state.errorURL || "/", "user_not_found", "User not found")
    }

    // Check if already linked
    const existingAccount = await adapter.findAccountByUserId(state.userId, provider.id)
    if (existingAccount) {
        return redirectWithError(state.errorURL || "/", "already_linked", `Already linked to ${provider.name}`)
    }

    // Check if provider account is linked to another user
    const otherAccount = await adapter.findAccountByProviderId(provider.id, userInfo.user.id)
    if (otherAccount && otherAccount.userId !== state.userId) {
        return redirectWithError(state.errorURL || "/", "account_in_use", "This account is already linked to another user")
    }

    // Link account
    await adapter.linkAccount({
        userId: state.userId,
        providerId: provider.id,
        accountId: userInfo.user.id,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        idToken: tokens.idToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
        scope: tokens.scopes?.join(","),
    })

    // Create new session
    const session = await adapter.createSession(state.userId)
    setSessionCookie(headers, session.token, cookieConfig)

    return {
        status: 302,
        headers: { ...headers, Location: state.callbackURL },
    }
}

/**
 * Helper to redirect with error
 */
function redirectWithError(callbackURL: string, error: string, description?: string): any {
    const url = new URL(callbackURL, "http://localhost")
    url.searchParams.set("error", error)
    if (description) {
        url.searchParams.set("error_description", description)
    }
    return {
        status: 302,
        headers: {
            Location: url.pathname + url.search,
        },
    }
}
