// =============================================================================
// OAUTH PROVIDERS TESTS
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { google } from "./providers/google.js"
import { github } from "./providers/github.js"
import { apple } from "./providers/apple.js"

describe("OAuth Providers", () => {
    describe("Google Provider", () => {
        const provider = google({
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
        })

        it("should have correct id and name", () => {
            expect(provider.id).toBe("google")
            expect(provider.name).toBe("Google")
        })

        it("should create authorization URL with PKCE", async () => {
            const url = await provider.createAuthorizationURL({
                state: "test-state",
                codeVerifier: "test-code-verifier-12345678901234567890",
                redirectURI: "http://localhost:3000/callback/google",
            })

            expect(url.hostname).toBe("accounts.google.com")
            expect(url.searchParams.get("client_id")).toBe("test-client-id")
            expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/callback/google")
            expect(url.searchParams.get("state")).toBe("test-state")
            expect(url.searchParams.get("response_type")).toBe("code")
            expect(url.searchParams.get("scope")).toContain("email")
            expect(url.searchParams.get("code_challenge")).toBeDefined()
            expect(url.searchParams.get("code_challenge_method")).toBe("S256")
        })

        it("should throw if codeVerifier is missing", async () => {
            await expect(
                provider.createAuthorizationURL({
                    state: "test-state",
                    redirectURI: "http://localhost:3000/callback/google",
                })
            ).rejects.toThrow("codeVerifier is required")
        })

        it("should include additional scopes", async () => {
            const url = await provider.createAuthorizationURL({
                state: "test-state",
                codeVerifier: "test-code-verifier-12345678901234567890",
                redirectURI: "http://localhost:3000/callback/google",
                scopes: ["calendar.readonly"],
            })

            const scope = url.searchParams.get("scope")
            expect(scope).toContain("calendar.readonly")
        })

        it("should verify ID token (basic)", async () => {
            // Create a mock JWT with valid structure
            const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
            const payload = Buffer.from(JSON.stringify({
                iss: "https://accounts.google.com",
                aud: "test-client-id",
                sub: "12345",
                email: "test@gmail.com",
                exp: Math.floor(Date.now() / 1000) + 3600,
            })).toString("base64url")
            const mockToken = `${header}.${payload}.fake-signature`

            const result = await provider.verifyIdToken?.(mockToken)
            expect(result).toBe(true)
        })

        it("should reject expired ID token", async () => {
            const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
            const payload = Buffer.from(JSON.stringify({
                iss: "https://accounts.google.com",
                aud: "test-client-id",
                sub: "12345",
                email: "test@gmail.com",
                exp: Math.floor(Date.now() / 1000) - 3600, // Expired
            })).toString("base64url")
            const mockToken = `${header}.${payload}.fake-signature`

            const result = await provider.verifyIdToken?.(mockToken)
            expect(result).toBe(false)
        })

        it("should get user info from ID token", async () => {
            const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
            const payload = Buffer.from(JSON.stringify({
                sub: "12345",
                email: "test@gmail.com",
                email_verified: true,
                name: "Test User",
                picture: "https://example.com/photo.jpg",
            })).toString("base64url")
            const mockIdToken = `${header}.${payload}.fake-signature`

            const userInfo = await provider.getUserInfo({
                accessToken: "test-access-token",
                idToken: mockIdToken,
            })

            expect(userInfo).not.toBeNull()
            expect(userInfo?.user.id).toBe("12345")
            expect(userInfo?.user.email).toBe("test@gmail.com")
            expect(userInfo?.user.name).toBe("Test User")
            expect(userInfo?.user.emailVerified).toBe(true)
        })
    })

    describe("GitHub Provider", () => {
        const provider = github({
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
        })

        it("should have correct id and name", () => {
            expect(provider.id).toBe("github")
            expect(provider.name).toBe("GitHub")
        })

        it("should create authorization URL", async () => {
            const url = await provider.createAuthorizationURL({
                state: "test-state",
                redirectURI: "http://localhost:3000/callback/github",
            })

            expect(url.hostname).toBe("github.com")
            expect(url.pathname).toBe("/login/oauth/authorize")
            expect(url.searchParams.get("client_id")).toBe("test-client-id")
            expect(url.searchParams.get("scope")).toContain("read:user")
            expect(url.searchParams.get("scope")).toContain("user:email")
        })

        it("should disable signup when configured", async () => {
            const providerNoSignup = github({
                clientId: "test-client-id",
                clientSecret: "test-client-secret",
                allowSignup: false,
            })

            const url = await providerNoSignup.createAuthorizationURL({
                state: "test-state",
                redirectURI: "http://localhost:3000/callback/github",
            })

            expect(url.searchParams.get("allow_signup")).toBe("false")
        })
    })

    describe("Apple Provider", () => {
        const provider = apple({
            clientId: "com.example.app",
            clientSecret: "test-client-secret",
        })

        it("should have correct id and name", () => {
            expect(provider.id).toBe("apple")
            expect(provider.name).toBe("Apple")
        })

        it("should create authorization URL with form_post", async () => {
            const url = await provider.createAuthorizationURL({
                state: "test-state",
                redirectURI: "http://localhost:3000/callback/apple",
            })

            expect(url.hostname).toBe("appleid.apple.com")
            expect(url.pathname).toBe("/auth/authorize")
            expect(url.searchParams.get("response_mode")).toBe("form_post")
            expect(url.searchParams.get("response_type")).toBe("code id_token")
            expect(url.searchParams.get("scope")).toContain("email")
            expect(url.searchParams.get("scope")).toContain("name")
        })

        it("should get user info from ID token", async () => {
            const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
            const payload = Buffer.from(JSON.stringify({
                sub: "apple-user-id",
                email: "user@privaterelay.appleid.com",
                email_verified: true,
                is_private_email: true,
            })).toString("base64url")
            const mockIdToken = `${header}.${payload}.fake-signature`

            const userInfo = await provider.getUserInfo({
                accessToken: "test-access-token",
                idToken: mockIdToken,
            })

            expect(userInfo).not.toBeNull()
            expect(userInfo?.user.id).toBe("apple-user-id")
            expect(userInfo?.user.email).toBe("user@privaterelay.appleid.com")
            expect(userInfo?.user.emailVerified).toBe(true)
        })

        it("should handle Apple user object from first auth", async () => {
            const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
            const payload = Buffer.from(JSON.stringify({
                sub: "apple-user-id",
                email: "user@example.com",
                email_verified: "true", // Apple sends as string sometimes
            })).toString("base64url")
            const mockIdToken = `${header}.${payload}.fake-signature`

            const tokens = {
                accessToken: "test-access-token",
                idToken: mockIdToken,
                user: {
                    name: { firstName: "John", lastName: "Doe" },
                    email: "user@example.com",
                },
            }

            const userInfo = await provider.getUserInfo(tokens as any)

            expect(userInfo).not.toBeNull()
            expect(userInfo?.user.name).toBe("John Doe")
        })
    })
})
