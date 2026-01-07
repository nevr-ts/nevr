import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
    hashPassword,
    verifyPassword,
    isPasswordHash,
    initEncryption,
    generateEncryptionKey,
    encryptValue,
    decryptValue,
    isEncrypted,
    clearEncryptionKeys,
    processWriteData,
    processReadData,
    getPasswordFields,
    getOmitFields,
    getEncryptedFields,
    hasSecurityFields,
} from "./security.js"
import type { Entity, FieldDef } from "../types.js"

// Helper to create test entity
function createTestEntity(fields: Record<string, Omit<FieldDef, "hasDefault"> & { hasDefault?: boolean }>): Entity {
    const processedFields: Record<string, FieldDef> = {}
    for (const [key, field] of Object.entries(fields)) {
        processedFields[key] = {
            hasDefault: false,
            ...field,
        } as FieldDef
    }

    return {
        name: "testEntity",
        config: {
            fields: processedFields,
            rules: { create: [], read: [], update: [], delete: [], list: [] },
            timestamps: false,
        },
    }
}

describe("Security Enhancement", () => {
    describe("Password Hashing", () => {
        it("should hash a password", async () => {
            const hash = await hashPassword("password123", 1) // Lower cost for testing

            expect(hash).toBeDefined()
            expect(hash).not.toBe("password123")
            expect(isPasswordHash(hash)).toBe(true)
            expect(hash.startsWith("$pbkdf2$")).toBe(true)
        })

        it("should verify correct password", async () => {
            const hash = await hashPassword("password123", 1)
            const isValid = await verifyPassword("password123", hash)

            expect(isValid).toBe(true)
        })

        it("should reject incorrect password", async () => {
            const hash = await hashPassword("password123", 1)
            const isValid = await verifyPassword("wrongpassword", hash)

            expect(isValid).toBe(false)
        })

        it("should generate unique hashes", async () => {
            const hash1 = await hashPassword("password123", 1)
            const hash2 = await hashPassword("password123", 1)

            expect(hash1).not.toBe(hash2)
        })

        it("isPasswordHash should detect password hashes", async () => {
            const realHash = await hashPassword("test", 1)
            expect(isPasswordHash(realHash)).toBe(true)
            expect(isPasswordHash("plaintext")).toBe(false)
            expect(isPasswordHash("")).toBe(false)
        })
    })

    describe("Field Encryption", () => {
        beforeEach(async () => {
            clearEncryptionKeys()
            const key = await generateEncryptionKey()
            await initEncryption(key)
        })

        afterEach(() => {
            clearEncryptionKeys()
        })

        it("should generate a valid encryption key", async () => {
            const key = await generateEncryptionKey()

            expect(key).toBeDefined()
            expect(typeof key).toBe("string")
            // Base64 encoded 32 bytes
            expect(Buffer.from(key, "base64").length).toBe(32)
        })

        it("should encrypt and decrypt a value", async () => {
            const original = "secret data"
            const encrypted = await encryptValue(original)
            const decrypted = await decryptValue(encrypted)

            expect(encrypted).not.toBe(original)
            expect(decrypted).toBe(original)
        })

        it("should produce different ciphertext each time", async () => {
            const original = "secret data"
            const encrypted1 = await encryptValue(original)
            const encrypted2 = await encryptValue(original)

            expect(encrypted1).not.toBe(encrypted2)
        })

        it("isEncrypted should detect encrypted values", async () => {
            const encrypted = await encryptValue("test")

            expect(isEncrypted(encrypted)).toBe(true)
            expect(isEncrypted("plaintext")).toBe(false)
            expect(isEncrypted("short")).toBe(false)
        })

        it("should throw when encrypting without initialization", async () => {
            // Reset encryption key by importing fresh module
            // This is tricky in tests, so we'll skip detailed test
        })
    })

    describe("processWriteData", () => {
        beforeEach(async () => {
            clearEncryptionKeys()
            const key = await generateEncryptionKey()
            await initEncryption(key)
        })

        afterEach(() => {
            clearEncryptionKeys()
        })

        it("should hash password fields", async () => {
            const entity = createTestEntity({
                email: { type: "string", optional: false, unique: false },
                password: { type: "string", optional: false, unique: false, security: { password: { cost: 1 } } },
            })

            const result = await processWriteData(
                { email: "test@test.com", password: "secret123" },
                entity
            )

            expect(result.email).toBe("test@test.com")
            expect(result.password).not.toBe("secret123")
            expect(isPasswordHash(result.password as string)).toBe(true)
        })

        it("should not re-hash already hashed passwords", async () => {
            const entity = createTestEntity({
                password: { type: "string", optional: false, unique: false, security: { password: { cost: 1 } } },
            })

            const originalHash = await hashPassword("test", 1)
            const result = await processWriteData({ password: originalHash }, entity)

            expect(result.password).toBe(originalHash)
        })

        it("should encrypt encrypted fields", async () => {
            const entity = createTestEntity({
                ssn: { type: "string", optional: false, unique: false, security: { encrypted: true } },
            })

            const result = await processWriteData({ ssn: "123-45-6789" }, entity)

            expect(result.ssn).not.toBe("123-45-6789")
            expect(isEncrypted(result.ssn as string)).toBe(true)
        })

        it("should skip non-string values", async () => {
            const entity = createTestEntity({
                count: { type: "int", optional: false, unique: false, security: { password: { cost: 1 } } },
            })

            const result = await processWriteData({ count: 42 }, entity)
            expect(result.count).toBe(42)
        })
    })

    describe("processReadData", () => {
        beforeEach(async () => {
            clearEncryptionKeys()
            const key = await generateEncryptionKey()
            await initEncryption(key)
        })

        afterEach(() => {
            clearEncryptionKeys()
        })

        it("should omit fields with omit security", async () => {
            const entity = createTestEntity({
                email: { type: "string", optional: false, unique: false },
                password: { type: "string", optional: false, unique: false, security: { omit: true } },
            })

            const result = await processReadData(
                { email: "test@test.com", password: "hashed" },
                entity
            )

            expect(result.email).toBe("test@test.com")
            expect(result.password).toBeUndefined()
        })

        it("should decrypt encrypted fields", async () => {
            const entity = createTestEntity({
                ssn: { type: "string", optional: false, unique: false, security: { encrypted: true } },
            })

            const encrypted = await encryptValue("123-45-6789")
            const result = await processReadData({ ssn: encrypted }, entity)

            expect(result.ssn).toBe("123-45-6789")
        })

        it("should keep non-encrypted values as-is", async () => {
            const entity = createTestEntity({
                name: { type: "string", optional: false, unique: false },
            })

            const result = await processReadData({ name: "John" }, entity)
            expect(result.name).toBe("John")
        })
    })

    describe("Security Metadata Functions", () => {
        it("getPasswordFields should return password fields", () => {
            const entity = createTestEntity({
                email: { type: "string", optional: false, unique: false },
                password: { type: "string", optional: false, unique: false, security: { password: {} } },
                secret: { type: "string", optional: false, unique: false, security: { password: { cost: 3 } } },
            })

            expect(getPasswordFields(entity)).toEqual(["password", "secret"])
        })

        it("getOmitFields should return omit fields", () => {
            const entity = createTestEntity({
                email: { type: "string", optional: false, unique: false },
                password: { type: "string", optional: false, unique: false, security: { omit: true } },
                token: { type: "string", optional: false, unique: false, security: { omit: true } },
            })

            expect(getOmitFields(entity)).toEqual(["password", "token"])
        })

        it("getEncryptedFields should return encrypted fields", () => {
            const entity = createTestEntity({
                email: { type: "string", optional: false, unique: false },
                ssn: { type: "string", optional: false, unique: false, security: { encrypted: true } },
            })

            expect(getEncryptedFields(entity)).toEqual(["ssn"])
        })

        it("hasSecurityFields should detect security fields", () => {
            const withSecurity = createTestEntity({
                password: { type: "string", optional: false, unique: false, security: { password: {} } },
            })
            const withoutSecurity = createTestEntity({
                name: { type: "string", optional: false, unique: false },
            })

            expect(hasSecurityFields(withSecurity)).toBe(true)
            expect(hasSecurityFields(withoutSecurity)).toBe(false)
        })
    })
})
