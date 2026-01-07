// =============================================================================
// OAUTH - TYPES
// Core types for OAuth providers
// =============================================================================

/**
 * OAuth tokens returned from provider
 */
export interface OAuthTokens {
    accessToken: string
    refreshToken?: string
    idToken?: string
    accessTokenExpiresAt?: Date
    refreshTokenExpiresAt?: Date
    scopes?: string[]
}

/**
 * User info returned from OAuth provider
 */
export interface OAuthUserInfo {
    user: {
        id: string
        email: string
        name: string
        image?: string
        emailVerified: boolean
    }
    data: Record<string, any>
}

/**
 * Common parameters for authorization URL
 */
export interface AuthorizationURLParams {
    state: string
    scopes?: string[]
    codeVerifier?: string
    redirectURI: string
    loginHint?: string
}

/**
 * Parameters for validating authorization code
 */
export interface ValidateCodeParams {
    code: string
    codeVerifier?: string
    redirectURI: string
}

/**
 * OAuth provider interface
 * Each provider (Google, Apple, GitHub) implements this
 */
export interface OAuthProvider<TProfile = any> {
    /** Unique provider ID (e.g., "google", "github") */
    id: string
    /** Display name (e.g., "Google", "GitHub") */
    name: string

    /**
     * Create authorization URL for OAuth flow
     */
    createAuthorizationURL(params: AuthorizationURLParams): Promise<URL>

    /**
     * Exchange authorization code for tokens
     */
    validateAuthorizationCode(params: ValidateCodeParams): Promise<OAuthTokens>

    /**
     * Get user info from provider using tokens
     */
    getUserInfo(tokens: OAuthTokens): Promise<OAuthUserInfo | null>

    /**
     * Refresh access token (optional)
     */
    refreshAccessToken?(refreshToken: string): Promise<OAuthTokens>

    /**
     * Verify ID token (optional, for Google/Apple)
     */
    verifyIdToken?(token: string, nonce?: string): Promise<boolean>

    /**
     * Provider options
     */
    options: OAuthProviderOptions<TProfile>
}

/**
 * Base provider options
 */
export interface OAuthProviderOptions<TProfile = any> {
    clientId: string
    clientSecret?: string
    clientKey?: string
    scope?: string[]
    disableDefaultScope?: boolean
    prompt?: "none" | "consent" | "select_account"

    /**
     * Custom function to get user info
     */
    getUserInfo?: (tokens: OAuthTokens) => Promise<OAuthUserInfo | null>

    /**
     * Custom function to map provider profile to user fields
     */
    mapProfileToUser?: (profile: TProfile) => Promise<Partial<OAuthUserInfo["user"]>> | Partial<OAuthUserInfo["user"]>

    /**
     * Custom function to refresh access token
     */
    refreshAccessToken?: (refreshToken: string) => Promise<OAuthTokens>

    /**
     * Disable ID token sign-in (for providers that support it)
     */
    disableIdTokenSignIn?: boolean

    /**
     * Custom ID token verifier
     */
    verifyIdToken?: (token: string, nonce?: string) => Promise<boolean>
}

/**
 * Social providers configuration
 */
export interface SocialProvidersConfig {
    google?: GoogleProviderOptions
    apple?: AppleProviderOptions
    github?: GithubProviderOptions
    [key: string]: OAuthProviderOptions | undefined
}

// Provider-specific options
export interface GoogleProviderOptions extends OAuthProviderOptions {
    accessType?: "offline" | "online"
    display?: "page" | "popup" | "touch" | "wap"
    hd?: string
}

export interface AppleProviderOptions extends OAuthProviderOptions {
    appBundleIdentifier?: string
    audience?: string | string[]
}

export interface GithubProviderOptions extends OAuthProviderOptions {
    allowSignup?: boolean
}

/**
 * OAuth state payload (encrypted in state parameter)
 */
export interface OAuthState {
    /** Random nonce for CSRF protection */
    nonce: string
    /** User ID if linking account */
    userId?: string
    /** Original email for verification */
    email?: string
    /** Callback URL after auth */
    callbackURL: string
    /** Error URL */
    errorURL?: string
    /** Provider ID */
    provider: string
    /** PKCE code verifier */
    codeVerifier?: string
    /** Timestamp for expiry check */
    timestamp: number
    /** Extra data */
    extra?: Record<string, any>
}
