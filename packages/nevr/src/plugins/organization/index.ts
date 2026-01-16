// =============================================================================
// ORGANIZATION PLUGIN
// Multi-tenant organization/workspace support
// Follows better-auth patterns with nevr conventions
// =============================================================================

import { createPlugin } from "../unified/index.js"
import { getLogger } from "../../logger.js"
import type {
    OrganizationPluginOptions,
    OrganizationAdapter,
    OrganizationRouteConfig,
    Organization,
    Member,
    RoleDefinition,
    PermissionResource,
    PermissionAction,
    DEFAULT_ROLES,
} from "./types.js"
import { getOrganizationSchema } from "./schema.js"
import { createOrganizationAdapter } from "./api/internal-adapter.js"
import { checkPermission } from "./api/middleware.js"

// =============================================================================
// RE-EXPORTS
// =============================================================================

export * from "./types.js"
export { ORGANIZATION_ERROR_CODES } from "./error-codes.js"
export { getOrganizationSchema } from "./schema.js"
export { createOrganizationAdapter } from "./api/internal-adapter.js"
export { sessionMiddleware, createOrgMiddleware, createPermissionMiddleware } from "./api/middleware.js"

// Unified endpoint utilities
export { z, endpoint, EndpointError, createMiddleware } from "../unified/endpoint.js"

// Client
export { organizationClient, type OrganizationClientOptions, type OrganizationClientMethods } from "./client.js"

// =============================================================================
// PRE-REGISTRATION (Side Effect)
// =============================================================================

import { preRegisterPluginSchema } from "../unified/runtime.js"

preRegisterPluginSchema("organization", getOrganizationSchema())

// =============================================================================
// DEFAULT ROLES
// =============================================================================

const defaultRoles: Record<string, RoleDefinition> = {
    owner: {
        name: "Owner",
        permissions: {
            organization: ["create", "read", "update", "delete"],
            member: ["create", "read", "update", "delete"],
            invitation: ["create", "read", "update", "delete"],
            team: ["create", "read", "update", "delete"],
        },
    },
    admin: {
        name: "Admin",
        permissions: {
            organization: ["read", "update"],
            member: ["create", "read", "update", "delete"],
            invitation: ["create", "read", "update", "delete"],
            team: ["create", "read", "update", "delete"],
        },
    },
    member: {
        name: "Member",
        permissions: {
            organization: ["read"],
            member: ["read"],
            invitation: ["read"],
            team: ["read"],
        },
    },
}

// =============================================================================
// SLUG GENERATOR
// =============================================================================

function defaultSlugGenerator(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 50)
}

// =============================================================================
// ORGANIZATION PLUGIN
// =============================================================================

/**
 * Organization plugin for multi-tenant support
 *
 * @example
 * ```ts
 * import { organization } from "nevr/plugins"
 *
 * const app = nevr({
 *   plugins: [
 *     organization({
 *       allowUserToCreate: true,
 *       maxOrgsPerUser: 5,
 *       roles: {
 *         owner: { permissions: { organization: ["*"], member: ["*"] } },
 *         admin: { permissions: { member: ["create", "read", "update"] } },
 *         member: { permissions: { organization: ["read"] } },
 *       },
 *       invitation: {
 *         expiresIn: 7 * 24 * 60 * 60, // 7 days
 *         sendEmail: async ({ invitation, organization, invitee, acceptUrl }) => {
 *           await sendEmail(invitee.email, `Join ${organization.name}`, acceptUrl)
 *         },
 *       },
 *     }),
 *   ],
 * })
 * ```
 */
export const organization = createPlugin<OrganizationPluginOptions>({
    id: "organization",
    name: "Organization",
    version: "1.0.0",
    description: "Multi-tenant organization/workspace support",
    basePath: "/organization",

    defaults: {
        allowUserToCreate: true,
        maxOrgsPerUser: 10,
        maxMembersPerOrg: 100,
        creatorRole: "owner",
        disableDeletion: false,
    },

    validate: (options) => {
        const errors: string[] = []

        if (options.creatorRole && options.roles && !options.roles[options.creatorRole] && !defaultRoles[options.creatorRole]) {
            errors.push(`Creator role "${options.creatorRole}" is not defined in roles`)
        }

        return errors
    },

    factory: (options) => {
        // Adapter instance (lazy)
        let adapterInstance: OrganizationAdapter | null = null

        const getAdapter = (): OrganizationAdapter => {
            if (!adapterInstance) {
                throw new Error("[Organization] Adapter not initialized")
            }
            return adapterInstance
        }

        // Merge roles
        const roles: Record<string, RoleDefinition> = {
            ...defaultRoles,
            ...options.roles,
        }

        const getRoles = () => roles

        // Permission checker
        const hasPermission = (member: Member, resource: PermissionResource, action: PermissionAction): boolean => {
            return checkPermission(member, roles, resource, action)
        }

        // Slug generator
        const generateSlug = options.generateSlug || defaultSlugGenerator

        // Teams enabled
        const teamsEnabled = options.teams && "enabled" in options.teams && options.teams.enabled

        // Route config
        const routeConfig: OrganizationRouteConfig = {
            options: { ...options, creatorRole: options.creatorRole || "owner" },
            getAdapter,
            getRoles,
            hasPermission,
        }

        return {
            schema: getOrganizationSchema({ teams: teamsEnabled }),

            endpoints: {
                // Endpoints will be added here
                // For now, using inline handlers
            } as any,

            lifecycle: {
                onInit: async (ctx) => {
                    getLogger().debug("[Organization] Initializing...")

                    // Create adapter
                    adapterInstance = createOrganizationAdapter(ctx.driver)

                    getLogger().info("[Organization] Initialized")
                },
            },

            // Session hooks to manage activeOrganizationId
            sessionHooks: {
                // After session is created, check for pending invitations
                afterSessionCreate: async (ctx: any) => {
                    const session = ctx.session
                    const user = session?.user
                    if (!user?.email) return

                    // Check for pending invitations
                    const adapter = getAdapter()
                    const invitations = await adapter.findInvitationsByEmail(user.email)

                    if (invitations.length > 0) {
                        getLogger().debug(`[Organization] User ${user.id} has ${invitations.length} pending invitations`)
                    }
                },
            },

            $Infer: {
                Organization: {} as Organization,
                Member: {} as Member,
            },
            $ERROR_CODES: {} as typeof import("./error-codes.js").ORGANIZATION_ERROR_CODES,
        }
    },
})

export default organization
