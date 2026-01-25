// =============================================================================
// PHONE NUMBER CLIENT PLUGIN
// =============================================================================

import type { NevrClientPlugin, NevrFetch, ClientStore, ClientAtomListener } from "../../../../client/types.js"
import { PHONE_NUMBER_ERROR_CODES } from "./error-codes.js"

export interface PhoneNumberClientOptions {
    basePath?: string
}

export interface SignInPhoneInput {
    phoneNumber: string
    password: string
    rememberMe?: boolean
}

export interface SendOTPInput {
    phoneNumber: string
}

export interface VerifyPhoneInput {
    phoneNumber: string
    code: string
}

export type PhoneNumberClientPlugin = NevrClientPlugin & {
    readonly $InferTypes: {
        $ERROR_CODES: typeof PHONE_NUMBER_ERROR_CODES
    }
}

/**
 * Create phone number client plugin
 *
 * @example
 * ```typescript
 * const client = createClient({
 *   plugins: [authClient(), phoneNumberClient()]
 * })
 *
 * // Send OTP
 * await client.phoneNumber.sendOTP({ phoneNumber: "+1234567890" })
 *
 * // Verify phone
 * await client.phoneNumber.verify({ phoneNumber: "+1234567890", code: "123456" })
 *
 * // Sign in with phone
 * await client.signIn.phoneNumber({ phoneNumber: "+1234567890", password: "..." })
 * ```
 */
export function phoneNumberClient(options?: PhoneNumberClientOptions): PhoneNumberClientPlugin {
    const basePath = options?.basePath || "/auth"

    return {
        id: "phone-number-client",

        pathMethods: {
            [`${basePath}/sign-in/phone-number`]: "POST",
            [`${basePath}/phone-number/send-otp`]: "POST",
            [`${basePath}/phone-number/verify`]: "POST",
            [`${basePath}/phone-number/request-password-reset`]: "POST",
            [`${basePath}/phone-number/reset-password`]: "POST",
        },

        atomListeners: [
            {
                matcher: (path: string) => path === `${basePath}/sign-in/phone-number`,
                signal: "$sessionSignal",
            },
        ] as ClientAtomListener[],

        getActions($fetch: NevrFetch, $store: ClientStore) {
            return {
                signIn: {
                    phoneNumber: async (input: SignInPhoneInput) => {
                        return $fetch(`${basePath}/sign-in/phone-number`, {
                            method: "POST",
                            body: input,
                        })
                    },
                },

                phoneNumber: {
                    sendOTP: async (input: SendOTPInput) => {
                        return $fetch(`${basePath}/phone-number/send-otp`, {
                            method: "POST",
                            body: input,
                        })
                    },

                    verify: async (input: VerifyPhoneInput) => {
                        return $fetch(`${basePath}/phone-number/verify`, {
                            method: "POST",
                            body: input,
                        })
                    },

                    requestPasswordReset: async (input: SendOTPInput) => {
                        return $fetch(`${basePath}/phone-number/request-password-reset`, {
                            method: "POST",
                            body: input,
                        })
                    },

                    resetPassword: async (input: { phoneNumber: string; otp: string; newPassword: string }) => {
                        return $fetch(`${basePath}/phone-number/reset-password`, {
                            method: "POST",
                            body: input,
                        })
                    },
                },
            }
        },

        $InferTypes: {
            $ERROR_CODES: PHONE_NUMBER_ERROR_CODES,
        },
    } as unknown as PhoneNumberClientPlugin
}

export default phoneNumberClient
