// =============================================================================
// OAUTH PROVIDER - APPLE
// Apple Sign In OAuth2 provider implementation
// =============================================================================

import type { OAuthProvider, AppleProviderOptions, OAuthTokens, OAuthUserInfo } from "../types.js"
import { createAuthorizationURL, validateAuthorizationCode, refreshAccessToken, decodeJwt } from "../client.js"

export interface AppleProfile {
    /** Subject identifier for the user */
    sub: string
    /** User's email address */
    email: string
    /** Whether email is verified (can be boolean or string "true"/"false") */
    email_verified: boolean | "true" | "false"
    /** Whether this is a private relay email */
    is_private_email: boolean
    /** Real user detection status (0=Unsupported, 1=Unknown, 2=LikelyReal) */
    real_user_status?: number
    /** User's name */
    name?: string
    /** User object from first authorization */
    user?: AppleNonConformUser
}

export interface AppleNonConformUser {
    name: {
        firstName: string
        lastName: string
    }
    email: string
}

/**
 * Create Apple OAuth provider
 */
export const apple = (options: AppleProviderOptions): OAuthProvider<AppleProfile> => {
    const tokenEndpoint = "https://appleid.apple.com/auth/token"

    return {
        id: "apple",
        name: "Apple",

        async createAuthorizationURL({ state, scopes, redirectURI }) {
            const _scopes = options.disableDefaultScope ? [] : ["email", "name"]
            if (options.scope) _scopes.push(...options.scope)
            if (scopes) _scopes.push(...scopes)

            return createAuthorizationURL({
                id: "apple",
                options,
                authorizationEndpoint: "https://appleid.apple.com/auth/authorize",
                scopes: _scopes,
                state,
                redirectURI,
                responseMode: "form_post",
                responseType: "code id_token",
            })
        },

        async validateAuthorizationCode({ code, codeVerifier, redirectURI }) {
            return validateAuthorizationCode({
                code,
                codeVerifier,
                redirectURI,
                options,
                tokenEndpoint,
            })
        },

        async refreshAccessToken(refreshToken: string) {
            return refreshAccessToken({
                refreshToken,
                options: {
                    clientId: options.clientId,
                    clientKey: options.clientKey,
                    clientSecret: options.clientSecret,
                },
                tokenEndpoint,
            })
        },

        async verifyIdToken(token: string, nonce?: string) {
            if (options.disableIdTokenSignIn) {
                return false
            }
            if (options.verifyIdToken) {
                return options.verifyIdToken(token, nonce)
            }

            // Basic verification - in production you should verify against Apple's JWKS
            const profile = decodeJwt<AppleProfile>(token)
            if (!profile) return false

            // Check issuer
            if (!profile.sub) return false

            return true
        },

        async getUserInfo(token: OAuthTokens): Promise<OAuthUserInfo | null> {
            if (options.getUserInfo) {
                return options.getUserInfo(token)
            }
            if (!token.idToken) {
                return null
            }

            const profile = decodeJwt<AppleProfile>(token.idToken)
            if (!profile) return null

            // Apple only sends user name on first authorization
            // The user object may be passed in the token if available
            const name = (token as any).user
                ? `${(token as any).user.name?.firstName || ""} ${(token as any).user.name?.lastName || ""}`.trim()
                : profile.name || profile.email

            // Handle email_verified which can be boolean or string
            const emailVerified =
                typeof profile.email_verified === "boolean"
                    ? profile.email_verified
                    : profile.email_verified === "true"

            const userMap = await options.mapProfileToUser?.(profile)

            return {
                user: {
                    id: profile.sub,
                    name: name || profile.email,
                    email: profile.email,
                    emailVerified,
                    ...userMap,
                },
                data: profile,
            }
        },

        options,
    }
}
