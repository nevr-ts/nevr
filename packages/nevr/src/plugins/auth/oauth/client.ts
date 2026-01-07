// =============================================================================
// OAUTH - CLIENT
// OAuth2 client utilities for authorization and token exchange
// =============================================================================

import type { OAuthTokens, OAuthProviderOptions } from "./types.js"
import { generateCodeChallenge } from "./pkce.js"

/**
 * Create OAuth authorization URL
 */
export async function createAuthorizationURL(params: {
    id: string
    options: OAuthProviderOptions
    authorizationEndpoint: string
    scopes: string[]
    state: string
    codeVerifier?: string
    redirectURI: string
    prompt?: string
    accessType?: string
    display?: string
    loginHint?: string
    hd?: string
    responseMode?: string
    responseType?: string
    additionalParams?: Record<string, string>
}): Promise<URL> {
    const {
        options,
        authorizationEndpoint,
        scopes,
        state,
        codeVerifier,
        redirectURI,
        prompt,
        accessType,
        display,
        loginHint,
        hd,
        responseMode,
        responseType,
        additionalParams,
    } = params

    const url = new URL(authorizationEndpoint)

    url.searchParams.set("client_id", options.clientId)
    url.searchParams.set("redirect_uri", redirectURI)
    url.searchParams.set("response_type", responseType || "code")
    url.searchParams.set("state", state)

    if (scopes.length > 0) {
        url.searchParams.set("scope", scopes.join(" "))
    }

    // PKCE
    if (codeVerifier) {
        const codeChallenge = generateCodeChallenge(codeVerifier)
        url.searchParams.set("code_challenge", codeChallenge)
        url.searchParams.set("code_challenge_method", "S256")
    }

    // Optional params
    if (prompt) url.searchParams.set("prompt", prompt)
    if (accessType) url.searchParams.set("access_type", accessType)
    if (display) url.searchParams.set("display", display)
    if (loginHint) url.searchParams.set("login_hint", loginHint)
    if (hd) url.searchParams.set("hd", hd)
    if (responseMode) url.searchParams.set("response_mode", responseMode)

    // Additional provider-specific params
    if (additionalParams) {
        for (const [key, value] of Object.entries(additionalParams)) {
            url.searchParams.set(key, value)
        }
    }

    return url
}

/**
 * Exchange authorization code for tokens
 */
export async function validateAuthorizationCode(params: {
    code: string
    codeVerifier?: string
    redirectURI: string
    options: OAuthProviderOptions
    tokenEndpoint: string
}): Promise<OAuthTokens> {
    const { code, codeVerifier, redirectURI, options, tokenEndpoint } = params

    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectURI,
        client_id: options.clientId,
    })

    if (options.clientSecret) {
        body.set("client_secret", options.clientSecret)
    }

    if (codeVerifier) {
        body.set("code_verifier", codeVerifier)
    }

    const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
        },
        body: body.toString(),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()

    return parseTokenResponse(data)
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(params: {
    refreshToken: string
    options: Pick<OAuthProviderOptions, "clientId" | "clientSecret" | "clientKey">
    tokenEndpoint: string
}): Promise<OAuthTokens> {
    const { refreshToken, options, tokenEndpoint } = params

    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: options.clientId,
    })

    if (options.clientSecret) {
        body.set("client_secret", options.clientSecret)
    }

    const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
        },
        body: body.toString(),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Token refresh failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()

    return parseTokenResponse(data)
}

/**
 * Parse token response from OAuth provider
 */
function parseTokenResponse(data: any): OAuthTokens {
    const tokens: OAuthTokens = {
        accessToken: data.access_token,
    }

    if (data.refresh_token) {
        tokens.refreshToken = data.refresh_token
    }

    if (data.id_token) {
        tokens.idToken = data.id_token
    }

    if (data.expires_in) {
        tokens.accessTokenExpiresAt = new Date(Date.now() + data.expires_in * 1000)
    }

    if (data.refresh_token_expires_in) {
        tokens.refreshTokenExpiresAt = new Date(Date.now() + data.refresh_token_expires_in * 1000)
    }

    if (data.scope) {
        tokens.scopes = data.scope.split(" ")
    }

    return tokens
}

/**
 * Fetch JSON from URL with authorization
 */
export async function fetchWithAuth<T>(
    url: string,
    accessToken: string,
    options?: {
        headers?: Record<string, string>
        userAgent?: string
    }
): Promise<{ data: T | null; error: any }> {
    try {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
                "User-Agent": options?.userAgent || "Nevr-Auth",
                ...options?.headers,
            },
        })

        if (!response.ok) {
            return { data: null, error: await response.text() }
        }

        const data = await response.json()
        return { data, error: null }
    } catch (error) {
        return { data: null, error }
    }
}

/**
 * Decode JWT without verification (for id_token parsing)
 * Use this only after verifying the token signature elsewhere
 */
export function decodeJwt<T = any>(token: string): T | null {
    try {
        const parts = token.split(".")
        if (parts.length !== 3) return null

        const payload = Buffer.from(parts[1], "base64url").toString("utf8")
        return JSON.parse(payload) as T
    } catch {
        return null
    }
}
