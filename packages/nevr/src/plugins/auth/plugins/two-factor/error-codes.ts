// =============================================================================
// TWO FACTOR PLUGIN ERROR CODES
// =============================================================================

export const TWO_FACTOR_ERROR_CODES = {
    OTP_NOT_ENABLED: "OTP not enabled",
    OTP_EXPIRED: "OTP has expired",
    TOTP_NOT_ENABLED: "TOTP not enabled",
    TWO_FACTOR_NOT_ENABLED: "Two factor authentication is not enabled",
    TWO_FACTOR_ALREADY_ENABLED: "Two factor authentication is already enabled",
    BACKUP_CODES_NOT_ENABLED: "Backup codes are not enabled",
    INVALID_BACKUP_CODE: "Invalid backup code",
    INVALID_CODE: "Invalid verification code",
    INVALID_TOTP_CODE: "Invalid TOTP code",
    TOO_MANY_ATTEMPTS: "Too many attempts. Please request a new code.",
    INVALID_TWO_FACTOR_COOKIE: "Invalid two factor verification cookie",
    INVALID_PASSWORD: "Invalid password",
    TWO_FACTOR_REQUIRED: "Two factor verification required",
    UNEXPECTED_ERROR: "An unexpected error occurred",
} as const

export type TwoFactorErrorCode = keyof typeof TWO_FACTOR_ERROR_CODES
