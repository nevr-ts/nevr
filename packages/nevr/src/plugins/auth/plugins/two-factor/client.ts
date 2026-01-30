// =============================================================================
// TWO FACTOR CLIENT PLUGIN
// =============================================================================

import type { NevrClientPlugin, NevrFetch, ClientStore, ClientAtomListener, NevrFetchResponse } from "../../../../client/types.js"
import { TWO_FACTOR_ERROR_CODES } from "./error-codes.js"
import type { AuthResponse } from "../../client.js"

export interface TwoFactorClientOptions {
    basePath?: string
    /**
     * Callback when two-factor verification is required
     */
    onTwoFactorRedirect?: () => void | Promise<void>
}

export interface EnableTwoFactorInput {
    password: string
    issuer?: string
}

export interface VerifyTOTPInput {
    code: string
}

export interface VerifyBackupCodeInput {
    code: string
}

export interface DisableTwoFactorInput {
    password: string
}

export interface GenerateBackupCodesInput {
    password: string
}

export interface EnableTwoFactorResponse {
    totpUri: string
    secret: string
    backupCodes: string[]
}

/**
 * Two-factor auth methods (inside auth namespace)
 */
export interface TwoFactorAuthMethods {
    twoFactor: {
        enable: (input: EnableTwoFactorInput) => Promise<NevrFetchResponse<EnableTwoFactorResponse>>
        verifySetup: (input: VerifyTOTPInput) => Promise<NevrFetchResponse<{ success: boolean }>>
        disable: (input: DisableTwoFactorInput) => Promise<NevrFetchResponse<{ success: boolean }>>
        verifyTotp: (input: VerifyTOTPInput) => Promise<NevrFetchResponse<AuthResponse>>
        verifyBackupCode: (input: VerifyBackupCodeInput) => Promise<NevrFetchResponse<AuthResponse>>
        generateBackupCodes: (input: GenerateBackupCodesInput) => Promise<NevrFetchResponse<{ backupCodes: string[] }>>
        sendOtp: () => Promise<NevrFetchResponse<{ success: boolean }>>
        verifyOtp: (input: VerifyTOTPInput) => Promise<NevrFetchResponse<AuthResponse>>
    }
}

/**
 * Two-factor client methods - namespaced under `client.auth.*`
 */
export interface TwoFactorClientMethods {
    auth: TwoFactorAuthMethods
}

export type TwoFactorClientPlugin = NevrClientPlugin & {
    readonly $InferTypes: {
        $ERROR_CODES: typeof TWO_FACTOR_ERROR_CODES
    }
    readonly $InferActions: TwoFactorClientMethods
}

/**
 * Create two-factor client plugin
 *
 * @example
 * ```typescript
 * const client = createClient({
 *   plugins: [
 *     authClient(),
 *     twoFactorClient({
 *       onTwoFactorRedirect: () => {
 *         // Navigate to 2FA verification page
 *         router.push('/verify-2fa')
 *       }
 *     })
 *   ]
 * })
 *
 * // Enable 2FA
 * const { data } = await client.twoFactor.enable({ password: "..." })
 * console.log(data.totpUri) // QR code URI
 * console.log(data.backupCodes) // Save these!
 *
 * // Verify TOTP setup
 * await client.twoFactor.verifySetup({ code: "123456" })
 *
 * // During sign-in with 2FA enabled:
 * // 1. Sign in returns { twoFactorRedirect: true }
 * // 2. onTwoFactorRedirect callback is called
 * // 3. User enters TOTP code
 * await client.twoFactor.verifyTotp({ code: "123456" })
 *
 * // Or use backup code
 * await client.twoFactor.verifyBackupCode({ code: "ABCD1234" })
 *
 * // Generate new backup codes
 * const { data } = await client.twoFactor.generateBackupCodes({ password: "..." })
 *
 * // Disable 2FA
 * await client.twoFactor.disable({ password: "..." })
 * ```
 */
export function twoFactorClient(options?: TwoFactorClientOptions): TwoFactorClientPlugin {
    const basePath = options?.basePath || "/auth"

    return {
        id: "two-factor-client",

        pathMethods: {
            [`${basePath}/two-factor/enable`]: "POST",
            [`${basePath}/two-factor/verify-setup`]: "POST",
            [`${basePath}/two-factor/disable`]: "POST",
            [`${basePath}/two-factor/verify-totp`]: "POST",
            [`${basePath}/two-factor/verify-backup-code`]: "POST",
            [`${basePath}/two-factor/generate-backup-codes`]: "POST",
            [`${basePath}/two-factor/send-otp`]: "POST",
            [`${basePath}/two-factor/verify-otp`]: "POST",
        },

        atomListeners: [
            {
                matcher: (path: string) => path.startsWith(`${basePath}/two-factor/`),
                signal: "$sessionSignal",
            },
        ] as ClientAtomListener[],

        fetchPlugins: [
            {
                id: "two-factor-redirect",
                name: "two-factor-redirect",
                hooks: {
                    async onSuccess(context: any) {
                        if (context.data?.twoFactorRedirect) {
                            if (options?.onTwoFactorRedirect) {
                                await options.onTwoFactorRedirect()
                            }
                        }
                    },
                },
            },
        ],

        getActions($fetch: NevrFetch, $store: ClientStore) {
            return {
                auth: {
                    twoFactor: {
                    /**
                     * Enable two-factor authentication
                     * Returns TOTP URI (for QR code) and backup codes
                     */
                    enable: async (input: EnableTwoFactorInput) => {
                        return $fetch(`${basePath}/two-factor/enable`, {
                            method: "POST",
                            body: input,
                        })
                    },

                    /**
                     * Verify TOTP setup with code from authenticator app
                     */
                    verifySetup: async (input: VerifyTOTPInput) => {
                        return $fetch(`${basePath}/two-factor/verify-setup`, {
                            method: "POST",
                            body: input,
                        })
                    },

                    /**
                     * Disable two-factor authentication
                     */
                    disable: async (input: DisableTwoFactorInput) => {
                        return $fetch(`${basePath}/two-factor/disable`, {
                            method: "POST",
                            body: input,
                        })
                    },

                    /**
                     * Verify TOTP code during sign-in
                     */
                    verifyTotp: async (input: VerifyTOTPInput) => {
                        return $fetch(`${basePath}/two-factor/verify-totp`, {
                            method: "POST",
                            body: input,
                        })
                    },

                    /**
                     * Verify backup code during sign-in
                     */
                    verifyBackupCode: async (input: VerifyBackupCodeInput) => {
                        return $fetch(`${basePath}/two-factor/verify-backup-code`, {
                            method: "POST",
                            body: input,
                        })
                    },

                    /**
                     * Generate new backup codes (invalidates old ones)
                     */
                    generateBackupCodes: async (input: GenerateBackupCodesInput) => {
                        return $fetch(`${basePath}/two-factor/generate-backup-codes`, {
                            method: "POST",
                            body: input,
                        })
                    },

                    /**
                     * Send OTP via email (if OTP 2FA is enabled)
                     */
                    sendOtp: async () => {
                        return $fetch(`${basePath}/two-factor/send-otp`, {
                            method: "POST",
                        })
                    },

                    /**
                     * Verify OTP code during sign-in
                     */
                    verifyOtp: async (input: VerifyTOTPInput) => {
                        return $fetch(`${basePath}/two-factor/verify-otp`, {
                            method: "POST",
                            body: input,
                        })
                    },
                    },
                }
            }
        },

        $InferTypes: {
            $ERROR_CODES: TWO_FACTOR_ERROR_CODES,
        },

        $InferActions: {} as TwoFactorClientMethods,
    } as unknown as TwoFactorClientPlugin
}

export default twoFactorClient
