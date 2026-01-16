// =============================================================================
// AUTH PLUGIN TYPES
// Type definitions aligned with Entity-First architecture
// =============================================================================

// -----------------------------------------------------------------------------
// Core Auth Types (matches entity schema)
// -----------------------------------------------------------------------------

/**
 * User entity type
 */
export interface AuthUser {
    id: string
    email: string
    name: string
    image?: string | null
    emailVerified: boolean
    createdAt: Date
    updatedAt: Date
}

/**
 * Session entity type
 */
export interface AuthSession {
    id: string
    token: string
    userId: string
    expiresAt: Date
    ipAddress?: string | null
    userAgent?: string | null
    createdAt: Date
    updatedAt: Date
}

/**
 * Account entity type (credential/OAuth)
 */
export interface AuthAccount {
    id: string
    userId: string
    providerId: string
    accountId: string
    password?: string | null
    accessToken?: string | null
    refreshToken?: string | null
    idToken?: string | null
    scope?: string | null
    expiresAt?: Date | null
    accessTokenExpiresAt?: Date | null
    refreshTokenExpiresAt?: Date | null
    createdAt: Date
    updatedAt: Date
}

/**
 * Verification token type
 */
export interface AuthVerification {
    id: string
    identifier: string
    value: string
    expiresAt: Date
}

// -----------------------------------------------------------------------------
// Plugin Options
// -----------------------------------------------------------------------------

export interface AuthPluginOptions {
    /**
     * Enable email/password authentication
     * @default { enabled: true }
     */
    emailAndPassword?: {
        enabled?: boolean
        minPasswordLength?: number
        maxPasswordLength?: number
        autoSignIn?: boolean
        requireEmailVerification?: boolean
        disableSignUp?: boolean
        /**
         * Token expiration time in seconds for password reset
         * @default 3600 (1 hour)
         */
        resetPasswordTokenExpiresIn?: number
        /**
         * Callback to send password reset email
         */
        sendResetPassword?: (
            data: { user: AuthUser; url: string; token: string },
            request?: Request
        ) => Promise<void>
        /**
         * Revoke all sessions when password is reset
         * @default false
         */
        revokeSessionsOnPasswordReset?: boolean
        /**
         * Callback after password is reset
         */
        onPasswordReset?: (
            data: { user: AuthUser },
            request?: Request
        ) => Promise<void> | void
    }

    /**
     * Session configuration
     */
    session?: {
        expiresIn?: number // seconds, default 7 days
        updateAge?: number // seconds before expiry to refresh
        freshAge?: number // seconds to consider session "fresh" for sensitive ops
        cookieName?: string
        cookie?: {
            secure?: boolean
            httpOnly?: boolean
            sameSite?: "strict" | "lax" | "none"
            path?: string
            domain?: string
        }
    }

    /**
     * Password hashing (supports custom hash/verify functions)
     */
    password?: {
        cost?: number // PBKDF2 cost factor
        hash?: (password: string, cost?: number) => Promise<string>
        verify?: (password: string, hash: string) => Promise<boolean>
    }

    /**
     * Secret for signing tokens/cookies
     */
    secret?: string

    /**
     * Base URL for callbacks
     */
    baseURL?: string

    /**
     * Email verification settings
     */
    emailVerification?: {
        enabled?: boolean
        expiresIn?: number
        sendOnSignUp?: boolean
        autoSignInAfterVerification?: boolean
        sendVerificationEmail?: (
            data: { user: AuthUser; url: string; token: string },
            request?: Request
        ) => Promise<void>
        onEmailVerification?: (user: AuthUser, request?: Request) => Promise<void>
        afterEmailVerification?: (user: AuthUser, request?: Request) => Promise<void>
    }

    /**
     * Additional user fields
     */
    user?: {
        additionalFields?: Record<string, {
            type: "string" | "number" | "boolean" | "date"
            required?: boolean
            input?: boolean
            returned?: boolean
        }>
    }

    /**
     * Plugin extension
     */
    extend?: {
        entities?: Record<string, any>
        endpoints?: Record<string, any>
    }

    /**
     * Social OAuth providers configuration
     */
    socialProviders?: {
        google?: {
            clientId: string
            clientSecret?: string
            scope?: string[]
            accessType?: "offline" | "online"
            hd?: string
        }
        github?: {
            clientId: string
            clientSecret?: string
            scope?: string[]
            allowSignup?: boolean
        }
        apple?: {
            clientId: string
            clientSecret?: string
            scope?: string[]
            appBundleIdentifier?: string
        }
        [key: string]: any
    }

    /**
     * Account management settings
     */
    account?: {
        accountLinking?: {
            enabled?: boolean
            trustedProviders?: string[]
            allowDifferentEmails?: boolean
        }
    }

    /**
     * Auth sub-plugins (magic-link, two-factor, anonymous, phone-number)
     * These extend auth with additional authentication methods
     *
     * @example
     * ```ts
     * import { auth } from "nevr/plugins/auth"
     * import { magicLink } from "nevr/plugins/auth/magic-link"
     * import { twoFactor } from "nevr/plugins/auth/two-factor"
     *
     * auth({
     *   plugins: [
     *     magicLink({ sendMagicLink: async ({ email, url }) => {...} }),
     *     twoFactor(),
     *   ]
     * })
     * ```
     */
    plugins?: AuthSubPlugin[]
}

/**
 * Auth sub-plugin interface
 * Sub-plugins extend auth with additional authentication methods
 */
export interface AuthSubPlugin {
    /** Unique plugin identifier */
    id: string
    /** Plugin name */
    name?: string
    /** Plugin description */
    description?: string
    /** Endpoints provided by this sub-plugin */
    endpoints?: Record<string, any>
    /** Schema extensions (additional fields for user, session, etc.) */
    schema?: Record<string, any>
    /** Initialize the sub-plugin */
    init?: (context: {
        options: AuthPluginOptions
        adapter: InternalAdapter
        secret: string
        baseURL?: string
    }) => void | Promise<void>
}

// -----------------------------------------------------------------------------
// Endpoint Input/Output Types
// -----------------------------------------------------------------------------

export interface SignUpEmailInput {
    name: string
    email: string
    password: string
    image?: string
    callbackURL?: string
    rememberMe?: boolean
}

export interface SignUpEmailOutput {
    token: string | null
    user: AuthUser
}

export interface SignInEmailInput {
    email: string
    password: string
    callbackURL?: string
    rememberMe?: boolean
}

export interface SignInEmailOutput {
    token: string
    user: AuthUser
    redirect: boolean
    url?: string
}

export interface GetSessionOutput {
    session: AuthSession
    user: AuthUser
}

export interface SignOutOutput {
    success: boolean
}

export interface ListSessionsOutput {
    sessions: AuthSession[]
}

export interface RevokeSessionInput {
    token: string
}

export interface RevokeSessionOutput {
    status: boolean
}

// -----------------------------------------------------------------------------
// Internal Adapter Types 
// -----------------------------------------------------------------------------

export interface InternalAdapter {
    findUserByEmail(email: string, options?: { includeAccounts?: boolean }): Promise<{
        user: AuthUser
        accounts: AuthAccount[]
    } | null>

    createUser(data: Omit<AuthUser, "id" | "createdAt" | "updatedAt">): Promise<AuthUser>

    updateUser(id: string, data: Partial<AuthUser>): Promise<AuthUser | null>

    linkAccount(data: Omit<AuthAccount, "id" | "createdAt" | "updatedAt">): Promise<AuthAccount>

    findAccountByUserId(userId: string, providerId: string): Promise<AuthAccount | null>

    findAccountByProviderId(providerId: string, accountId: string): Promise<AuthAccount | null>

    createSession(userId: string, dontRemember?: boolean): Promise<AuthSession>

    findSession(token: string): Promise<{ session: AuthSession; user: AuthUser } | null>

    updateSession(token: string, data: Partial<AuthSession>): Promise<AuthSession | null>

    deleteSession(token: string): Promise<void>

    listSessions(userId: string): Promise<AuthSession[]>

    deleteSessions(userId: string): Promise<void>

    createVerification(data: Omit<AuthVerification, "id">): Promise<AuthVerification>

    findVerification(identifier: string, value: string): Promise<AuthVerification | null>

    deleteVerification(id: string): Promise<void>
}

// -----------------------------------------------------------------------------
// Type Inference Helpers
// -----------------------------------------------------------------------------

/**
 * Infer user type with additional fields from options
 */
export type InferUser<O extends AuthPluginOptions> = AuthUser & (
    O["user"] extends { additionalFields: infer F }
    ? F extends Record<string, any>
    ? { [K in keyof F]?: F[K] extends { type: "string" } ? string
        : F[K] extends { type: "number" } ? number
        : F[K] extends { type: "boolean" } ? boolean
        : F[K] extends { type: "date" } ? Date
        : unknown }
    : {}
    : {}
)

/**
 * Type for plugin $Infer export 
 */
export interface AuthPluginInfer<O extends AuthPluginOptions = AuthPluginOptions> {
    user: InferUser<O>
    session: AuthSession
}
