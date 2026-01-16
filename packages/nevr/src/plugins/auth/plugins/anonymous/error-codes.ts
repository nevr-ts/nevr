// =============================================================================
// ANONYMOUS PLUGIN ERROR CODES
// =============================================================================

export const ANONYMOUS_ERROR_CODES = {
    FAILED_TO_CREATE_USER: "Failed to create anonymous user",
    COULD_NOT_CREATE_SESSION: "Could not create session for anonymous user",
    ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY: "Anonymous users cannot sign in again anonymously",
    INVALID_EMAIL_FORMAT: "Invalid email format generated",
} as const

export type AnonymousErrorCode = keyof typeof ANONYMOUS_ERROR_CODES
