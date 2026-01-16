// =============================================================================
// ANONYMOUS PLUGIN
// Guest user authentication with account linking
// =============================================================================

import { endpoint, EndpointError } from "../../../unified/endpoint.js"
import { getInternalAdapter } from "../../index.js"
import { generateId } from "../../crypto/index.js"
import { createCookieHeader } from "../../cookies/index.js"
import { ANONYMOUS_ERROR_CODES } from "./error-codes.js"
import { getAnonymousSchema } from "./schema.js"

// Re-exports
export * from "./error-codes.js"
export { getAnonymousSchema } from "./schema.js"
export { anonymousClient } from "./client.js"

// =============================================================================
// Types
// =============================================================================

export interface AnonymousOptions {
    /**
     * Custom email domain for anonymous users
     * @default generates unique domain per user
     */
    emailDomainName?: string

    /**
     * Custom email generator
     */
    generateRandomEmail?: () => string | Promise<string>

    /**
     * Custom name generator for anonymous users
     * @default "Anonymous"
     */
    generateName?: (ctx: any) => string | Promise<string>

    /**
     * Called when anonymous user links to a real account
     */
    onLinkAccount?: (data: {
        anonymousUser: { user: any; session: any }
        newUser: { user: any; session: any }
    }) => Promise<void>

    /**
     * Disable automatic deletion of anonymous user after linking
     * @default false
     */
    disableDeleteAnonymousUser?: boolean

    /**
     * Session configuration
     */
    session?: {
        expiresIn?: number
        cookieName?: string
        cookie?: {
            secure?: boolean
            httpOnly?: boolean
            sameSite?: "strict" | "lax" | "none"
            path?: string
            domain?: string
        }
    }
}

// =============================================================================
// Anonymous Plugin
// =============================================================================

export const anonymous = (options?: AnonymousOptions) => {
    // Session config
    const sessionConfig = {
        expiresIn: options?.session?.expiresIn ?? 60 * 60 * 24 * 7,
        cookieName: options?.session?.cookieName ?? "nevr.session_token",
        cookie: {
            httpOnly: options?.session?.cookie?.httpOnly ?? true,
            secure: options?.session?.cookie?.secure ?? process.env.NODE_ENV === "production",
            sameSite: options?.session?.cookie?.sameSite ?? "lax" as const,
            path: options?.session?.cookie?.path ?? "/",
            domain: options?.session?.cookie?.domain,
        },
    }

    function setSessionCookie(headers: Record<string, string>, token: string): void {
        headers["Set-Cookie"] = createCookieHeader(sessionConfig.cookieName, token, {
            maxAge: sessionConfig.expiresIn,
            path: sessionConfig.cookie.path,
            domain: sessionConfig.cookie.domain,
            secure: sessionConfig.cookie.secure,
            httpOnly: sessionConfig.cookie.httpOnly,
            sameSite: sessionConfig.cookie.sameSite,
        })
    }

    async function getAnonEmail(): Promise<string> {
        if (options?.generateRandomEmail) {
            return await options.generateRandomEmail()
        }

        const id = generateId()
        if (options?.emailDomainName) {
            return `temp-${id}@${options.emailDomainName}`
        }
        return `temp@${id}.anonymous`
    }

    return {
        id: "anonymous",

        schema: getAnonymousSchema(),

        endpoints: {
            // =================================================================
            // Sign In Anonymous
            // POST /sign-in/anonymous
            // =================================================================
            signInAnonymous: endpoint("/sign-in/anonymous", {
                method: "POST",
                meta: {
                    summary: "Sign in as anonymous user",
                    tags: ["Authentication", "Anonymous"],
                },
                handler: async (ctx: any) => {
                    const driver = ctx.context?.driver || ctx.driver
                    const internalAdapter = getInternalAdapter(driver)

                    // Check if already anonymous
                    const existingSession = ctx.context?.session
                    if (existingSession?.user?.isAnonymous) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: ANONYMOUS_ERROR_CODES.ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY,
                        })
                    }

                    // Generate anonymous user data
                    const email = await getAnonEmail()
                    const name = options?.generateName
                        ? await options.generateName(ctx)
                        : "Anonymous"

                    // Create anonymous user
                    const user = await driver.create("user", {
                        id: generateId(),
                        email,
                        emailVerified: false,
                        isAnonymous: true,
                        name,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    })

                    if (!user) {
                        throw new EndpointError("INTERNAL_SERVER_ERROR", {
                            message: ANONYMOUS_ERROR_CODES.FAILED_TO_CREATE_USER,
                        })
                    }

                    // Create session
                    const session = await internalAdapter.createSession(user.id)

                    if (!session) {
                        throw new EndpointError("INTERNAL_SERVER_ERROR", {
                            message: ANONYMOUS_ERROR_CODES.COULD_NOT_CREATE_SESSION,
                        })
                    }

                    const headers: Record<string, string> = {}
                    setSessionCookie(headers, session.token)

                    return {
                        status: 200,
                        body: {
                            token: session.token,
                            user: {
                                id: user.id,
                                email: user.email,
                                emailVerified: user.emailVerified,
                                name: user.name,
                                isAnonymous: true,
                                createdAt: user.createdAt,
                                updatedAt: user.updatedAt,
                            },
                        },
                        headers,
                    }
                },
            }),
        },

        // Hook to handle account linking
        hooks: {
            after: [
                {
                    matcher: (ctx: any) => {
                        const path = ctx.path || ""
                        return (
                            path.startsWith("/sign-in") ||
                            path.startsWith("/sign-up") ||
                            path.startsWith("/callback") ||
                            path.startsWith("/magic-link/verify")
                        )
                    },
                    handler: async (ctx: any) => {
                        // Skip if this is anonymous sign-in
                        if (ctx.path === "/sign-in/anonymous") return

                        // Check if user was anonymous
                        const previousSession = ctx.context?.previousSession
                        if (!previousSession?.user?.isAnonymous) return

                        // Get new session
                        const newSession = ctx.context?.session
                        if (!newSession) return

                        // Call link callback if provided
                        if (options?.onLinkAccount) {
                            await options.onLinkAccount({
                                anonymousUser: previousSession,
                                newUser: newSession,
                            })
                        }

                        // Delete anonymous user unless disabled
                        if (!options?.disableDeleteAnonymousUser) {
                            const driver = ctx.context?.driver || ctx.driver
                            await driver.delete("user", { id: previousSession.user.id })
                        }
                    },
                },
            ],
        },

        $ERROR_CODES: ANONYMOUS_ERROR_CODES,
    }
}

export default anonymous
