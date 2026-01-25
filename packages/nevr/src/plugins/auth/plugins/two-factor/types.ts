// =============================================================================
// TWO FACTOR - TYPES
// Type definitions for two-factor authentication
// =============================================================================

import type { AuthUser, AuthSession } from "../../index.js"

/**
 * Two factor plugin options
 */
export interface TwoFactorOptions {
    /**
     * Application name for TOTP issuer
     */
    issuer?: string

    /**
     * TOTP options
     */
    totp?: {
        digits?: number
        period?: number
        window?: number
    }

    /**
     * OTP options for email/sms based 2FA
     */
    otp?: {
        expiresIn?: number
        length?: number
        sendOTP?: (data: { email: string; code: string; userId: string }) => Promise<void>
    }

    /**
     * Backup codes options
     */
    backupCodes?: {
        count?: number
        length?: number
    }

    /**
     * Skip TOTP verification on enable
     * @default false
     */
    skipVerificationOnEnable?: boolean

    /**
     * Trust device duration in seconds
     * @default 2592000 (30 days)
     */
    trustDeviceDuration?: number

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

    /**
     * Rate limiting configuration
     * @default { window: 10000, max: 3 }
     */
    rateLimit?: false | {
        window?: number
        max?: number
    }
}

/**
 * Two factor database record
 */
export interface TwoFactorRecord {
    id: string
    userId: string
    secret: string
    backupCodes: string
    createdAt: Date
    updatedAt: Date
}

/**
 * User with two factor fields
 */
export interface UserWithTwoFactor extends AuthUser {
    twoFactorEnabled?: boolean
}

/**
 * Session config for two-factor
 */
export interface SessionConfig {
    expiresIn: number
    cookieName: string
    twoFactorCookieName: string
    trustDeviceCookieName: string
    cookie: {
        httpOnly: boolean
        secure: boolean
        sameSite: "strict" | "lax" | "none"
        path: string
        domain?: string
    }
}

/**
 * TOTP configuration
 */
export interface TOTPConfig {
    digits: number
    period: number
    window: number
}

/**
 * OTP configuration
 */
export interface OTPConfig {
    expiresIn: number
    length: number
}

/**
 * Backup codes configuration
 */
export interface BackupCodesConfig {
    count: number
    length: number
}
