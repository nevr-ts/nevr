// =============================================================================
// OAUTH PROVIDER - GITHUB
// GitHub OAuth2 provider implementation
// =============================================================================

import type { OAuthProvider, GithubProviderOptions, OAuthTokens, OAuthUserInfo } from "../types.js"
import { createAuthorizationURL, validateAuthorizationCode, refreshAccessToken, fetchWithAuth } from "../client.js"

export interface GithubProfile {
    login: string
    id: string
    node_id: string
    avatar_url: string
    gravatar_id: string
    url: string
    html_url: string
    name: string
    company: string | null
    blog: string
    location: string | null
    email: string | null
    hireable: boolean | null
    bio: string | null
    twitter_username: string | null
    public_repos: number
    public_gists: number
    followers: number
    following: number
    created_at: string
    updated_at: string
    two_factor_authentication: boolean
}

interface GithubEmail {
    email: string
    primary: boolean
    verified: boolean
    visibility: "public" | "private" | null
}

/**
 * Create GitHub OAuth provider
 */
export const github = (options: GithubProviderOptions): OAuthProvider<GithubProfile> => {
    const tokenEndpoint = "https://github.com/login/oauth/access_token"

    return {
        id: "github",
        name: "GitHub",

        async createAuthorizationURL({ state, scopes, codeVerifier, redirectURI, loginHint }) {
            const _scopes = options.disableDefaultScope ? [] : ["read:user", "user:email"]
            if (options.scope) _scopes.push(...options.scope)
            if (scopes) _scopes.push(...scopes)

            return createAuthorizationURL({
                id: "github",
                options,
                authorizationEndpoint: "https://github.com/login/oauth/authorize",
                scopes: _scopes,
                state,
                codeVerifier,
                redirectURI,
                loginHint,
                prompt: options.prompt,
                additionalParams: options.allowSignup === false
                    ? { allow_signup: "false" }
                    : undefined,
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

        async getUserInfo(token: OAuthTokens): Promise<OAuthUserInfo | null> {
            if (options.getUserInfo) {
                return options.getUserInfo(token)
            }

            // Fetch user profile
            const { data: profile, error } = await fetchWithAuth<GithubProfile>(
                "https://api.github.com/user",
                token.accessToken,
                { userAgent: "Nevr-Auth" }
            )

            if (error || !profile) {
                return null
            }

            // Fetch user emails (for verified status)
            const { data: emails } = await fetchWithAuth<GithubEmail[]>(
                "https://api.github.com/user/emails",
                token.accessToken,
                { userAgent: "Nevr-Auth" }
            )

            // Get primary email if profile.email is null
            let email = profile.email
            if (!email && emails) {
                const primaryEmail = emails.find((e) => e.primary) || emails[0]
                email = primaryEmail?.email || null
            }

            // Check if email is verified
            const emailVerified = emails?.find((e) => e.email === email)?.verified ?? false

            const userMap = await options.mapProfileToUser?.(profile)

            return {
                user: {
                    id: profile.id,
                    name: profile.name || profile.login,
                    email: email || "",
                    image: profile.avatar_url,
                    emailVerified,
                    ...userMap,
                },
                data: profile,
            }
        },

        options,
    }
}
