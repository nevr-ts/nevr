// =============================================================================
// MAGIC LINK PLUGIN ERROR CODES
// =============================================================================

export const MAGIC_LINK_ERROR_CODES = {
    INVALID_TOKEN: "Invalid or expired magic link token",
    EXPIRED_TOKEN: "Magic link has expired",
    TOKEN_ALREADY_USED: "Magic link has already been used",
    EMAIL_REQUIRED: "Email address is required",
    SEND_FAILED: "Failed to send magic link email",
    USER_NOT_FOUND: "User not found",
    SIGNUP_DISABLED: "New user registration is disabled",
    RATE_LIMITED: "Too many requests. Please try again later.",
    FAILED_TO_CREATE_USER: "Failed to create user account",
    FAILED_TO_CREATE_SESSION: "Failed to create session",
} as const

export type MagicLinkErrorCode = keyof typeof MAGIC_LINK_ERROR_CODES
