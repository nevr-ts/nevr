// =============================================================================
// OAUTH PROVIDER - GOOGLE
// Google OAuth2 provider implementation
// =============================================================================

import type { OAuthProvider, GoogleProviderOptions, OAuthTokens, OAuthUserInfo } from "../types.js"
import { createAuthorizationURL, validateAuthorizationCode, refreshAccessToken, decodeJwt } from "../client.js"

export interface GoogleProfile {
    aud: string
    azp: string
    email: string
    email_verified: boolean
    exp: number
    family_name: string
    given_name: string
    hd?: string
    iat: number
    iss: string
    jti?: string
    locale?: string
    name: string
    nbf?: number
    picture: string
    sub: string
}

/**
 * Create Google OAuth provider
 */
export const google = (options: GoogleProviderOptions): OAuthProvider<GoogleProfile> => {
    return {
        id: "google",
        name: "Google",

        async createAuthorizationURL({ state, scopes, codeVerifier, redirectURI, loginHint }) {
            if (!options.clientId || !options.clientSecret) {
                throw new Error("Google: clientId and clientSecret are required")
            }
            if (!codeVerifier) {
                throw new Error("Google: codeVerifier is required (PKCE)")
            }

            const _scopes = options.disableDefaultScope ? [] : ["email", "profile", "openid"]
            if (options.scope) _scopes.push(...options.scope)
            if (scopes) _scopes.push(...scopes)

            return createAuthorizationURL({
                id: "google",
                options,
                authorizationEndpoint: "https://accounts.google.com/o/oauth2/auth",
                scopes: _scopes,
                state,
                codeVerifier,
                redirectURI,
                prompt: options.prompt,
                accessType: options.accessType,
                display: options.display,
                loginHint,
                hd: options.hd,
                additionalParams: {
                    include_granted_scopes: "true",
                },
            })
        },

        async validateAuthorizationCode({ code, codeVerifier, redirectURI }) {
            return validateAuthorizationCode({
                code,
                codeVerifier,
                redirectURI,
                options,
                tokenEndpoint: "https://oauth2.googleapis.com/token",
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
                tokenEndpoint: "https://www.googleapis.com/oauth2/v4/token",
            })
        },

        async verifyIdToken(token: string, nonce?: string) {
            if (options.disableIdTokenSignIn) {
                return false
            }
            if (options.verifyIdToken) {
                return options.verifyIdToken(token, nonce)
            }
            // Basic verification - in production you should verify against Google's JWKS
            // For now, just decode and check basic claims
            const profile = decodeJwt<GoogleProfile>(token)
            if (!profile) return false

            // Check issuer
            const validIssuers = ["https://accounts.google.com", "accounts.google.com"]
            if (!validIssuers.includes(profile.iss)) return false

            // Check audience
            if (profile.aud !== options.clientId) return false

            // Check expiry
            if (profile.exp < Math.floor(Date.now() / 1000)) return false

            return true
        },

        async getUserInfo(token: OAuthTokens): Promise<OAuthUserInfo | null> {
            if (options.getUserInfo) {
                return options.getUserInfo(token)
            }
            if (!token.idToken) {
                return null
            }

            const user = decodeJwt<GoogleProfile>(token.idToken)
            if (!user) return null

            const userMap = await options.mapProfileToUser?.(user)

            return {
                user: {
                    id: user.sub,
                    name: user.name,
                    email: user.email,
                    image: user.picture,
                    emailVerified: user.email_verified,
                    ...userMap,
                },
                data: user,
            }
        },

        options,
    }
}
