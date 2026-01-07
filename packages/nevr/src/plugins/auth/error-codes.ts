// =============================================================================
// AUTH PLUGIN ERROR CODES
// Standardized error codes for authentication operations
// =============================================================================

export const AUTH_ERROR_CODES = {
    // Sign-up errors
    USER_ALREADY_EXISTS: "User already exists",
    FAILED_TO_CREATE_USER: "Failed to create user",
    INVALID_EMAIL: "Invalid email address",
    PASSWORD_TOO_SHORT: "Password is too short",
    PASSWORD_TOO_LONG: "Password is too long",
    EMAIL_AND_PASSWORD_NOT_ENABLED: "Email and password sign-up is not enabled",

    // Sign-in errors
    INVALID_EMAIL_OR_PASSWORD: "Invalid email or password",
    EMAIL_NOT_VERIFIED: "Email is not verified",
    ACCOUNT_NOT_FOUND: "Account not found",
    CREDENTIAL_ACCOUNT_NOT_FOUND: "Credential account not found",

    // Session errors
    FAILED_TO_CREATE_SESSION: "Failed to create session",
    FAILED_TO_GET_SESSION: "Failed to get session",
    SESSION_NOT_FOUND: "Session not found",
    SESSION_EXPIRED: "Session has expired",
    INVALID_SESSION_TOKEN: "Invalid session token",
    SESSION_NOT_FRESH: "Session is not fresh",

    // Email verification errors
    VERIFICATION_EMAIL_NOT_ENABLED: "Verification email is not enabled",
    EMAIL_ALREADY_VERIFIED: "Email is already verified",
    INVALID_VERIFICATION_TOKEN: "Invalid verification token",
    VERIFICATION_TOKEN_EXPIRED: "Verification token has expired",

    // Password reset errors
    RESET_PASSWORD_NOT_ENABLED: "Password reset is not enabled",
    INVALID_RESET_TOKEN: "Invalid reset token",
    RESET_TOKEN_EXPIRED: "Reset token has expired",
    FAILED_TO_UPDATE_PASSWORD: "Failed to update password",

    // OAuth errors
    PROVIDER_NOT_FOUND: "OAuth provider not found or not configured",
    PROVIDER_NOT_CONFIGURED: "OAuth provider is not configured",
    ACCOUNT_ALREADY_LINKED: "Account is already linked to this provider",
    ACCOUNT_IN_USE: "This account is already linked to another user",
    OAUTH_ERROR: "OAuth authentication failed",
    USER_INFO_FAILED: "Failed to get user info from provider",
    INVALID_STATE: "Invalid OAuth state",
    STATE_EXPIRED: "OAuth state has expired",
    CODE_EXCHANGE_FAILED: "Failed to exchange authorization code",
    EMAIL_EXISTS: "An account with this email already exists",

    // Account management errors
    CANNOT_UNLINK_ONLY_ACCOUNT: "Cannot unlink the only linked account",

    // General errors
    UNAUTHORIZED: "Unauthorized",
    FORBIDDEN: "Forbidden",
    INTERNAL_ERROR: "Internal server error",
} as const

export type AuthErrorCode = keyof typeof AUTH_ERROR_CODES
