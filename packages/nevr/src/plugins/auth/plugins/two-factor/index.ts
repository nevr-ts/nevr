// =============================================================================
// TWO FACTOR PLUGIN
// TOTP, OTP, and Backup Codes for enhanced security
// Modular architecture for maintainability
// =============================================================================

import { generateId } from "../../crypto/index.js"
import { createCookieHeader } from "../../cookies/index.js"
import { TWO_FACTOR_ERROR_CODES } from "./error-codes.js"
import { getTwoFactorSchema } from "./schema.js"

// Route imports
import { createEnableRoutes } from "./routes/enable.js"
import { createTOTPRoutes } from "./routes/totp.js"
import { createOTPRoutes } from "./routes/otp.js"
import { createBackupCodesRoutes } from "./routes/backup-codes.js"

// Re-exports
export * from "./error-codes.js"
export * from "./types.js"
export { getTwoFactorSchema } from "./schema.js"

// Client: import from "nevr/plugins/auth/two-factor/client" for frontend use

// Type imports
import type {
    TwoFactorOptions,
    TwoFactorRecord,
    UserWithTwoFactor,
    SessionConfig,
    TOTPConfig,
    OTPConfig,
    BackupCodesConfig,
} from "./types.js"

// =============================================================================
// Two Factor Plugin
// =============================================================================

export const twoFactor = (options: TwoFactorOptions = {}) => {
    // Configuration
    const totpConfig: TOTPConfig = {
        digits: options.totp?.digits ?? 6,
        period: options.totp?.period ?? 30,
        window: options.totp?.window ?? 1,
    }

    const otpConfig: OTPConfig = {
        expiresIn: options.otp?.expiresIn ?? 300,
        length: options.otp?.length ?? 6,
    }

    const backupConfig: BackupCodesConfig = {
        count: options.backupCodes?.count ?? 10,
        length: options.backupCodes?.length ?? 8,
    }

    const issuer = options.issuer ?? "Nevr"
    const encryptionSecret = process.env.NEVR_SECRET || "nevr-default-secret"

    // Session config
    const sessionConfig: SessionConfig = {
        expiresIn: options.session?.expiresIn ?? 60 * 60 * 24 * 7,
        cookieName: options.session?.cookieName ?? "nevr.session_token",
        twoFactorCookieName: "nevr.two_factor",
        trustDeviceCookieName: "nevr.trust_device",
        cookie: {
            httpOnly: options.session?.cookie?.httpOnly ?? true,
            secure: options.session?.cookie?.secure ?? process.env.NODE_ENV === "production",
            sameSite: options.session?.cookie?.sameSite ?? "lax" as const,
            path: options.session?.cookie?.path ?? "/",
            domain: options.session?.cookie?.domain,
        },
    }

    // Cookie helper
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

    // Create route endpoints
    const enableRoutes = createEnableRoutes(
        totpConfig,
        backupConfig,
        issuer,
        encryptionSecret,
        options.skipVerificationOnEnable
    )

    const totpRoutes = createTOTPRoutes(
        totpConfig,
        sessionConfig,
        setSessionCookie
    )

    const otpRoutes = createOTPRoutes(
        otpConfig,
        sessionConfig,
        options,
        setSessionCookie
    )

    const backupCodesRoutes = createBackupCodesRoutes(
        backupConfig,
        sessionConfig,
        encryptionSecret,
        setSessionCookie
    )

    return {
        id: "two-factor",

        schema: getTwoFactorSchema(),

        // Merged endpoints from all route modules
        endpoints: {
            ...enableRoutes,
            ...totpRoutes,
            ...otpRoutes,
            ...backupCodesRoutes,
        },

        // Request interceptors for sign-in interception (unified pattern)
        interceptors: {
            after: [
                {
                    matcher: (ctx: any) =>
                        ctx.path === "/sign-in/email" ||
                        ctx.path === "/sign-in/username" ||
                        ctx.path === "/sign-in/phone-number",
                    handler: async (ctx: any, response: any) => {
                        const driver = ctx.context?.driver || ctx.driver

                        if (!response?.body?.user?.twoFactorEnabled) {
                            return response
                        }

                        const user = response.body.user

                        // Delete the session that was just created
                        if (response.body.token) {
                            try {
                                await driver.delete("session", { token: response.body.token })
                            } catch {
                                // Ignore if session doesn't exist
                            }
                        }

                        // Create 2FA verification
                        const identifier = `2fa-${generateId()}`
                        const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

                        await driver.create("verification", {
                            id: generateId(),
                            identifier,
                            value: user.id,
                            expiresAt,
                            createdAt: new Date(),
                        })

                        // Set two factor cookie
                        const headers: Record<string, string> = {}
                        headers["Set-Cookie"] = createCookieHeader(sessionConfig.twoFactorCookieName, identifier, {
                            maxAge: 300,
                            path: sessionConfig.cookie.path,
                            domain: sessionConfig.cookie.domain,
                            secure: sessionConfig.cookie.secure,
                            httpOnly: sessionConfig.cookie.httpOnly,
                            sameSite: sessionConfig.cookie.sameSite,
                        })

                        return {
                            status: 200,
                            body: {
                                twoFactorRedirect: true,
                                message: TWO_FACTOR_ERROR_CODES.TWO_FACTOR_REQUIRED,
                            },
                            headers,
                        }
                    },
                },
            ],
        },

        $ERROR_CODES: TWO_FACTOR_ERROR_CODES,
        $Infer: {
            TwoFactorRecord: {} as TwoFactorRecord,
            UserWithTwoFactor: {} as UserWithTwoFactor,
        },

        // Rate limiting for two-factor endpoints (developer-configurable)
        rateLimit: options.rateLimit === false ? [] : [
            {
                pathMatcher: (path: string) => path.startsWith("/two-factor/"),
                window: options.rateLimit?.window ?? 10 * 1000, // 10 seconds
                max: options.rateLimit?.max ?? 3,
            },
        ],
    }
}

export default twoFactor
