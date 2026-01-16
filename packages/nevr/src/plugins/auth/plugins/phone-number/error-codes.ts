// =============================================================================
// PHONE NUMBER PLUGIN ERROR CODES
// =============================================================================

export const PHONE_NUMBER_ERROR_CODES = {
    INVALID_PHONE_NUMBER: "Invalid phone number format",
    INVALID_PHONE_NUMBER_OR_PASSWORD: "Invalid phone number or password",
    PHONE_NUMBER_NOT_VERIFIED: "Phone number not verified",
    PHONE_NUMBER_ALREADY_EXISTS: "Phone number already in use",
    PHONE_NUMBER_CANNOT_BE_UPDATED: "Phone number cannot be updated directly. Use verification flow.",
    OTP_EXPIRED: "OTP has expired",
    INVALID_OTP: "Invalid OTP code",
    SEND_OTP_FAILED: "Failed to send OTP",
    UNEXPECTED_ERROR: "An unexpected error occurred",
} as const

export type PhoneNumberErrorCode = keyof typeof PHONE_NUMBER_ERROR_CODES
