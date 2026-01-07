// =============================================================================
// CRYPTO MODULE
// Barrel exports for cryptographic functions
// =============================================================================

// Password hashing
export {
    hashPassword,
    verifyPassword,
    needsRehash,
} from "./password.js"

// Token generation
export {
    generateSessionToken,
    generateId,
    generateUUID,
    generateVerificationToken,
    generateResetToken,
    generateTOTPSecret,
} from "./token.js"

// HMAC signing
export {
    signValue,
    verifySignedValue,
    signWithTimestamp,
    verifyWithTimestamp,
} from "./hmac.js"

// JWT (for email verification tokens)
export {
    signJWT,
    verifyJWT,
    createEmailVerificationToken,
    verifyEmailVerificationToken,
    type JWTPayload,
    type VerifyJWTResult,
    type EmailVerificationPayload,
} from "./jwt.js"

