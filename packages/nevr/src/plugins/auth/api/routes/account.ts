// =============================================================================
// ROUTE - ACCOUNT
// List linked accounts, unlink accounts
// =============================================================================

import { z } from "zod"
import { endpoint, EndpointError, validateWithZod } from "../../../unified/endpoint.js"
import type { AuthPluginOptions, InternalAdapter, AuthAccount } from "../../types.js"
import { AUTH_ERROR_CODES } from "../../error-codes.js"
import type { SessionCookieConfig } from "../../cookies/session-cookie.js"
import { createInternalAdapter } from "../internal-adapter.js"
import {
    requireSession,
    requireFreshSession,
    type SessionMiddlewareConfig,
    type SessionContext,
} from "./session.js"

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

export const unlinkAccountSchema = z.object({
    providerId: z.string().min(1, "Provider ID is required"),
    accountId: z.string().optional(),
})

// -----------------------------------------------------------------------------
// Route Configuration
// -----------------------------------------------------------------------------

export interface AccountRouteConfig {
    options: AuthPluginOptions
    cookieConfig: SessionCookieConfig
    sessionConfig: {
        expiresIn: number
    }
}

// -----------------------------------------------------------------------------
// List Accounts
// -----------------------------------------------------------------------------

/**
 * List all linked accounts for the current user
 */
export function listAccounts(config: AccountRouteConfig) {
    const { cookieConfig, sessionConfig } = config
    const sessionMwConfig: SessionMiddlewareConfig = {
        cookieConfig,
        sessionExpiresIn: sessionConfig.expiresIn,
    }

    return endpoint("/list-accounts", {
        method: "GET",
        meta: {
            summary: "List linked accounts",
            description: "Get all accounts/providers linked to the current user",
            tags: ["Account"],
        },
        handler: requireSession(async (ctx: any, session: SessionContext) => {
            const driver = ctx.context?.driver || ctx.driver

            // Get all accounts for current user
            const accounts = await driver.findMany("account", {
                where: { userId: session.user.id }
            }) as AuthAccount[]

            // Filter out sensitive data
            const safeAccounts = accounts.map((account: AuthAccount) => ({
                id: account.id,
                providerId: account.providerId,
                accountId: account.accountId,
                createdAt: account.createdAt,
                updatedAt: account.updatedAt,
                // Include scope if available
                ...(account.scope && { scope: account.scope }),
                // Include expiry info but not actual tokens
                ...(account.accessTokenExpiresAt && {
                    accessTokenExpiresAt: account.accessTokenExpiresAt
                }),
            }))

            return {
                status: 200,
                body: { accounts: safeAccounts },
            }
        }, sessionMwConfig),
    })
}

// -----------------------------------------------------------------------------
// Unlink Account
// -----------------------------------------------------------------------------

/**
 * Unlink a provider from the current user's account
 */
export function unlinkAccount(config: AccountRouteConfig) {
    const { cookieConfig, sessionConfig } = config
    const sessionMwConfig: SessionMiddlewareConfig = {
        cookieConfig,
        sessionExpiresIn: sessionConfig.expiresIn,
        freshAge: 300, // 5 minutes for security
    }

    return endpoint("/unlink-account", {
        method: "POST",
        body: unlinkAccountSchema,
        meta: {
            summary: "Unlink account",
            description: "Remove a linked provider from the current user",
            tags: ["Account"],
        },
        handler: requireFreshSession(async (ctx: any, session: SessionContext) => {
            const rawBody = ctx.body || ctx.input || {}
            const body = validateWithZod(unlinkAccountSchema, rawBody)

            const { providerId, accountId } = body

            const driver = ctx.context?.driver || ctx.driver
            const adapter: InternalAdapter = createInternalAdapter(driver, {
                sessionExpiresIn: sessionConfig.expiresIn,
            })

            // Get all accounts for user
            const accounts = await driver.findMany("account", {
                where: { userId: session.user.id }
            }) as AuthAccount[]

            // Prevent unlinking if only one account remains
            if (accounts.length <= 1) {
                throw new EndpointError("BAD_REQUEST", {
                    code: AUTH_ERROR_CODES.FORBIDDEN,
                    message: "Cannot unlink the only linked account",
                })
            }

            // Find the account to unlink
            let accountToUnlink: AuthAccount | undefined

            if (accountId) {
                accountToUnlink = accounts.find(
                    (a: AuthAccount) => a.providerId === providerId && a.accountId === accountId
                )
            } else {
                accountToUnlink = accounts.find(
                    (a: AuthAccount) => a.providerId === providerId
                )
            }

            if (!accountToUnlink) {
                throw new EndpointError("NOT_FOUND", {
                    code: AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND,
                    message: `Account with provider "${providerId}" not found`,
                })
            }

            // Delete the account
            await driver.delete("account", { id: accountToUnlink.id })

            return {
                status: 200,
                body: { status: true },
            }
        }, sessionMwConfig),
    })
}
