// =============================================================================
// USERNAME PLUGIN ERROR CODES
// Standardized error codes for username-based authentication
// =============================================================================

export const USERNAME_ERROR_CODES = {
    INVALID_USERNAME_OR_PASSWORD: "Invalid username or password",
    EMAIL_NOT_VERIFIED: "Email not verified",
    UNEXPECTED_ERROR: "Unexpected error",
    USERNAME_IS_ALREADY_TAKEN: "Username is already taken. Please try another.",
    USERNAME_TOO_SHORT: "Username is too short",
    USERNAME_TOO_LONG: "Username is too long",
    INVALID_USERNAME: "Username is invalid",
    INVALID_DISPLAY_USERNAME: "Display username is invalid",
} as const

export type UsernameErrorCode = keyof typeof USERNAME_ERROR_CODES
