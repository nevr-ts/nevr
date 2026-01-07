// =============================================================================
// COOKIES MODULE TESTS
// Tests for cookie creation, parsing, and session cookie management
// =============================================================================

import { describe, it, expect } from "vitest"
import {
    createCookieHeader,
    deleteCookieHeader,
    parseCookies,
    getCookie,
    getSessionCookieConfig,
    getExpiryDate,
    isExpired,
    needsRefresh,
    getSessionToken,
} from "./index.js"

// -----------------------------------------------------------------------------
// Cookie Creation Tests
// -----------------------------------------------------------------------------

describe("Cookies - Creation", () => {
    it("should create basic cookie header", () => {
        const cookie = createCookieHeader("name", "value")

        expect(cookie).toBe("name=value")
    })

    it("should create cookie with maxAge", () => {
        const cookie = createCookieHeader("name", "value", { maxAge: 3600 })

        expect(cookie).toContain("Max-Age=3600")
    })

    it("should create cookie with expires", () => {
        const date = new Date("2025-01-01T00:00:00Z")
        const cookie = createCookieHeader("name", "value", { expires: date })

        expect(cookie).toContain("Expires=Wed, 01 Jan 2025 00:00:00 GMT")
    })

    it("should create cookie with path", () => {
        const cookie = createCookieHeader("name", "value", { path: "/" })

        expect(cookie).toContain("Path=/")
    })

    it("should create cookie with domain", () => {
        const cookie = createCookieHeader("name", "value", { domain: "example.com" })

        expect(cookie).toContain("Domain=example.com")
    })

    it("should create secure cookie", () => {
        const cookie = createCookieHeader("name", "value", { secure: true })

        expect(cookie).toContain("Secure")
    })

    it("should create httpOnly cookie", () => {
        const cookie = createCookieHeader("name", "value", { httpOnly: true })

        expect(cookie).toContain("HttpOnly")
    })

    it("should create cookie with sameSite", () => {
        const cookie = createCookieHeader("name", "value", { sameSite: "strict" })

        expect(cookie).toContain("SameSite=strict")
    })

    it("should create cookie with all options", () => {
        const cookie = createCookieHeader("session", "token123", {
            maxAge: 86400,
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "lax",
        })

        expect(cookie).toContain("session=token123")
        expect(cookie).toContain("Max-Age=86400")
        expect(cookie).toContain("Path=/")
        expect(cookie).toContain("HttpOnly")
        expect(cookie).toContain("Secure")
        expect(cookie).toContain("SameSite=lax")
    })

    it("should encode special characters", () => {
        const cookie = createCookieHeader("name", "value with spaces")

        expect(cookie).toBe("name=value%20with%20spaces")
    })

    it("should create delete cookie header", () => {
        const cookie = deleteCookieHeader("name", { path: "/" })

        expect(cookie).toContain("name=")
        expect(cookie).toContain("Max-Age=0")
    })
})

// -----------------------------------------------------------------------------
// Cookie Parsing Tests
// -----------------------------------------------------------------------------

describe("Cookies - Parsing", () => {
    it("should parse empty cookie header", () => {
        const cookies = parseCookies(undefined)
        expect(cookies).toEqual({})
    })

    it("should parse single cookie", () => {
        const cookies = parseCookies("name=value")
        expect(cookies).toEqual({ name: "value" })
    })

    it("should parse multiple cookies", () => {
        const cookies = parseCookies("name=value; session=abc123")
        expect(cookies).toEqual({ name: "value", session: "abc123" })
    })

    it("should handle cookies with equals in value", () => {
        const cookies = parseCookies("data=a=b=c")
        expect(cookies).toEqual({ data: "a=b=c" })
    })

    it("should decode URL encoded values", () => {
        const cookies = parseCookies("name=value%20with%20spaces")
        expect(cookies).toEqual({ name: "value with spaces" })
    })

    it("should get specific cookie", () => {
        const value = getCookie("name=value; session=abc123", "session")
        expect(value).toBe("abc123")
    })

    it("should return undefined for missing cookie", () => {
        const value = getCookie("name=value", "session")
        expect(value).toBeUndefined()
    })
})

// -----------------------------------------------------------------------------
// Session Cookie Configuration Tests
// -----------------------------------------------------------------------------

describe("Cookies - Session Config", () => {
    it("should create default config", () => {
        const config = getSessionCookieConfig()

        expect(config.name).toBe("nevr.session_token")
        expect(config.expiresIn).toBe(60 * 60 * 24 * 7)
        expect(config.options.httpOnly).toBe(true)
        expect(config.options.sameSite).toBe("lax")
        expect(config.options.path).toBe("/")
    })

    it("should use custom cookie name", () => {
        const config = getSessionCookieConfig({ cookieName: "custom.session" })

        expect(config.name).toBe("custom.session")
    })

    it("should use custom expiry", () => {
        const config = getSessionCookieConfig({ expiresIn: 3600 })

        expect(config.expiresIn).toBe(3600)
    })

    it("should use custom cookie options", () => {
        const config = getSessionCookieConfig({
            cookie: {
                httpOnly: false,
                secure: true,
                sameSite: "strict",
                domain: "example.com",
            },
        })

        expect(config.options.httpOnly).toBe(false)
        expect(config.options.secure).toBe(true)
        expect(config.options.sameSite).toBe("strict")
        expect(config.options.domain).toBe("example.com")
    })
})

// -----------------------------------------------------------------------------
// Date Utilities Tests
// -----------------------------------------------------------------------------

describe("Cookies - Date Utilities", () => {
    it("should get expiry date in future", () => {
        const now = Date.now()
        const expiry = getExpiryDate(3600)

        expect(expiry.getTime()).toBeGreaterThan(now)
        expect(expiry.getTime()).toBeLessThanOrEqual(now + 3600 * 1000 + 100)
    })

    it("should detect expired date", () => {
        const past = new Date(Date.now() - 1000)
        expect(isExpired(past)).toBe(true)
    })

    it("should detect non-expired date", () => {
        const future = new Date(Date.now() + 1000)
        expect(isExpired(future)).toBe(false)
    })

    it("should detect when refresh is needed", () => {
        const expiresIn = 7 * 24 * 60 * 60 // 7 days
        const updateAge = 24 * 60 * 60 // 1 day

        // Expiry 6 days ago from initial + updateAge should need refresh
        const expiresAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) // 1 day left
        expect(needsRefresh(expiresAt, expiresIn, updateAge)).toBe(true)
    })

    it("should not need refresh when fresh", () => {
        const expiresIn = 7 * 24 * 60 * 60 // 7 days
        const updateAge = 24 * 60 * 60 // 1 day

        // Just created session, 7 days left
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        expect(needsRefresh(expiresAt, expiresIn, updateAge)).toBe(false)
    })
})

// -----------------------------------------------------------------------------
// Session Token Extraction Tests
// -----------------------------------------------------------------------------

describe("Cookies - Session Token", () => {
    it("should extract token from cookie header", () => {
        const token = getSessionToken({ cookie: "nevr.session_token=abc123" }, "nevr.session_token")

        expect(token).toBe("abc123")
    })

    it("should extract token from Authorization header", () => {
        const token = getSessionToken({ authorization: "Bearer abc123" }, "nevr.session_token")

        expect(token).toBe("abc123")
    })

    it("should prefer Authorization header", () => {
        const token = getSessionToken(
            { authorization: "Bearer bearer-token", cookie: "nevr.session_token=cookie-token" },
            "nevr.session_token"
        )

        expect(token).toBe("bearer-token")
    })

    it("should return null when no token", () => {
        const token = getSessionToken({}, "nevr.session_token")

        expect(token).toBeNull()
    })
})
