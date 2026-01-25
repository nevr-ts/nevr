// =============================================================================
// ORGANIZATION CRUD ROUTES
// Create, read, update, delete organization endpoints
// =============================================================================

import { endpoint, z, EndpointError, requireAuth, createMiddleware } from "../../../unified/endpoint.js"
import type { EndpointContext } from "../../../unified/endpoint.js"
import { ORGANIZATION_ERROR_CODES } from "../../error-codes.js"
import type { OrganizationRouteConfig, Organization, Member } from "../../types.js"

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Middleware to validate organization access
 */
export function createOrgMiddleware(config: OrganizationRouteConfig) {
    return createMiddleware(async (ctx: EndpointContext) => {
        const user = ctx.user
        if (!user) {
            throw new EndpointError("UNAUTHORIZED", { message: "Authentication required" })
        }

        const organizationId = (ctx.body as any)?.organizationId ||
            (ctx.query as any)?.organizationId ||
            (ctx.params as any)?.organizationId

        if (!organizationId) return

        const adapter = config.getAdapter()
        const member = await adapter.findMemberByUserAndOrg(user.id, organizationId)

        if (!member) {
            throw new EndpointError("FORBIDDEN", {
                message: ORGANIZATION_ERROR_CODES.USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION,
            })
        }

        // Add member to context
        ; (ctx as any).member = member
    })
}

// =============================================================================
// CREATE ORGANIZATION
// =============================================================================

export function createOrganization(config: OrganizationRouteConfig) {
    return endpoint("/create", {
        method: "POST",
        body: z.object({
            name: z.string().min(1, "Organization name is required"),
            slug: z.string().optional(),
            logo: z.string().url().optional(),
            metadata: z.record(z.string(), z.unknown()).optional(),
        }),
        use: [requireAuth],
        meta: {
            summary: "Create organization",
            description: "Create a new organization and add the creator as owner",
            tags: ["Organization"],
        },
        handler: async (ctx) => {
            const { user, driver, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const options = config.options

            // Check if user is allowed to create organizations
            if (typeof options.allowUserToCreate === "function") {
                const allowed = await options.allowUserToCreate(user)
                if (!allowed) {
                    throw new EndpointError("FORBIDDEN", {
                        message: ORGANIZATION_ERROR_CODES.USER_NOT_ALLOWED_TO_CREATE_ORGANIZATION,
                    })
                }
            } else if (options.allowUserToCreate === false) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.USER_NOT_ALLOWED_TO_CREATE_ORGANIZATION,
                })
            }

            // Check max organizations per user
            const userOrgs = await adapter.findOrganizationsByUserId(user.id)
            const maxOrgs = typeof options.maxOrgsPerUser === "function"
                ? await options.maxOrgsPerUser(user)
                : options.maxOrgsPerUser || 10

            if (userOrgs.length >= maxOrgs) {
                throw new EndpointError("BAD_REQUEST", {
                    message: ORGANIZATION_ERROR_CODES.MAX_ORGANIZATIONS_REACHED,
                })
            }

            // Generate slug if not provided
            let slug = body.slug
            if (!slug) {
                slug = body.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "")
                    .substring(0, 50)
            }

            // Check if slug is unique
            const existingOrg = await adapter.findOrganizationBySlug(slug)
            if (existingOrg) {
                throw new EndpointError("CONFLICT", {
                    message: ORGANIZATION_ERROR_CODES.ORGANIZATION_SLUG_ALREADY_EXISTS,
                })
            }

            // Run beforeCreate hook
            let orgData: Partial<Organization> = {}
            if (options.hooks?.beforeCreate) {
                const hookResult = await options.hooks.beforeCreate(
                    { name: body.name, slug, userId: user.id },
                    ctx as any
                )
                if (hookResult?.data) {
                    orgData = hookResult.data
                }
            }

            // Create organization
            const organization = await adapter.createOrganization({
                name: body.name,
                slug,
                logo: body.logo,
                metadata: body.metadata,
                ...orgData,
            })

            // Add creator as member with creator role
            const creatorRole = config.options.creatorRole || "owner"
            const member = await adapter.createMember({
                organizationId: organization.id,
                userId: user.id,
                role: creatorRole,
            })

            // Run afterCreate hook
            if (options.hooks?.afterCreate) {
                await options.hooks.afterCreate({ organization, member }, ctx as any)
            }

            return ctx.json({ organization, member })
        },
    })
}

// =============================================================================
// UPDATE ORGANIZATION
// =============================================================================

export function updateOrganization(config: OrganizationRouteConfig) {
    return endpoint("/update", {
        method: "POST",
        body: z.object({
            organizationId: z.string(),
            name: z.string().optional(),
            slug: z.string().optional(),
            logo: z.string().url().nullable().optional(),
            metadata: z.record(z.string(), z.unknown()).optional(),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "Update organization",
            description: "Update an organization's details",
            tags: ["Organization"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const member = (ctx as any).member as Member

            // Check permission
            if (!config.hasPermission(member, "organization", "update")) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.NOT_ALLOWED_TO_UPDATE_ORGANIZATION,
                })
            }

            const organization = await adapter.findOrganizationById(body.organizationId)
            if (!organization) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND,
                })
            }

            // Check if slug is unique (if changing)
            if (body.slug && body.slug !== organization.slug) {
                const existingOrg = await adapter.findOrganizationBySlug(body.slug)
                if (existingOrg) {
                    throw new EndpointError("CONFLICT", {
                        message: ORGANIZATION_ERROR_CODES.ORGANIZATION_SLUG_ALREADY_EXISTS,
                    })
                }
            }

            // Prepare updates
            const updates: Partial<Organization> = {}
            if (body.name !== undefined) updates.name = body.name
            if (body.slug !== undefined) updates.slug = body.slug
            if (body.logo !== undefined) updates.logo = body.logo
            if (body.metadata !== undefined) updates.metadata = body.metadata

            // Run beforeUpdate hook
            if (config.options.hooks?.beforeUpdate) {
                const hookResult = await config.options.hooks.beforeUpdate(
                    { organization, updates },
                    ctx as any
                )
                if (hookResult?.data) {
                    Object.assign(updates, hookResult.data)
                }
            }

            // Update organization
            const updatedOrg = await adapter.updateOrganization(body.organizationId, updates)

            // Run afterUpdate hook
            if (config.options.hooks?.afterUpdate && updatedOrg) {
                await config.options.hooks.afterUpdate({ organization: updatedOrg }, ctx as any)
            }

            return ctx.json(updatedOrg)
        },
    })
}

// =============================================================================
// DELETE ORGANIZATION
// =============================================================================

export function deleteOrganization(config: OrganizationRouteConfig) {
    return endpoint("/delete", {
        method: "POST",
        body: z.object({
            organizationId: z.string(),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "Delete organization",
            description: "Delete an organization and all its members",
            tags: ["Organization"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const member = (ctx as any).member as Member

            // Check if deletion is disabled
            if (config.options.disableDeletion) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.ORGANIZATION_DELETION_DISABLED,
                })
            }

            // Check permission
            if (!config.hasPermission(member, "organization", "delete")) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.NOT_ALLOWED_TO_DELETE_ORGANIZATION,
                })
            }

            const organization = await adapter.findOrganizationById(body.organizationId)
            if (!organization) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND,
                })
            }

            // Run beforeDelete hook
            if (config.options.hooks?.beforeDelete) {
                await config.options.hooks.beforeDelete({ organization }, ctx as any)
            }

            // Delete all members first
            await adapter.deleteMembersByOrganizationId(body.organizationId)

            // Delete organization
            await adapter.deleteOrganization(body.organizationId)

            // Run afterDelete hook
            if (config.options.hooks?.afterDelete) {
                await config.options.hooks.afterDelete({ organization }, ctx as any)
            }

            return ctx.json({ success: true })
        },
    })
}

// =============================================================================
// SET ACTIVE ORGANIZATION
// =============================================================================

export function setActiveOrganization(config: OrganizationRouteConfig) {
    return endpoint("/set-active", {
        method: "POST",
        body: z.object({
            organizationId: z.string().nullable(),
        }),
        use: [requireAuth],
        meta: {
            summary: "Set active organization",
            description: "Set the active organization for the current session",
            tags: ["Organization"],
        },
        handler: async (ctx) => {
            const { user, driver, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()

            // If setting to null, clear active organization
            if (body.organizationId === null) {
                return ctx.json({
                    activeOrganizationId: null as string | null,
                    organization: null as Organization | null,
                    member: null as Member | null,
                })
            }

            // Verify user is a member
            const member = await adapter.findMemberByUserAndOrg(user.id, body.organizationId)
            if (!member) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION,
                })
            }

            const organization = await adapter.findOrganizationById(body.organizationId)
            if (!organization) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND,
                })
            }

            // Return the active organization (session update handled by auth layer)
            return ctx.json({
                activeOrganizationId: body.organizationId as string | null,
                organization: organization as Organization | null,
                member: member as Member | null,
            })
        },
    })
}

// =============================================================================
// GET FULL ORGANIZATION
// =============================================================================

export function getFullOrganization(config: OrganizationRouteConfig) {
    return endpoint("/get-full-organization", {
        method: "GET",
        query: z.object({
            organizationId: z.string().optional(),
        }).optional(),
        use: [requireAuth],
        meta: {
            summary: "Get full organization",
            description: "Get organization with all members and invitations",
            tags: ["Organization"],
        },
        handler: async (ctx) => {
            const { user, query } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const organizationId = query?.organizationId

            if (!organizationId) {
                throw new EndpointError("BAD_REQUEST", {
                    message: "Organization ID is required",
                })
            }

            // Check membership
            const member = await adapter.findMemberByUserAndOrg(user.id, organizationId)
            if (!member) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION,
                })
            }

            const organization = await adapter.findOrganizationById(organizationId)
            if (!organization) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND,
                })
            }

            // Get members
            const members = await adapter.findMembersByOrganizationId(organizationId)

            // Get invitations
            const invitations = await adapter.findInvitationsByOrganizationId(organizationId)

            return ctx.json({
                ...organization,
                members,
                invitations,
            })
        },
    })
}

// =============================================================================
// LIST ORGANIZATIONS
// =============================================================================

export function listOrganizations(config: OrganizationRouteConfig) {
    return endpoint("/list", {
        method: "GET",
        use: [requireAuth],
        meta: {
            summary: "List organizations",
            description: "List all organizations the user is a member of",
            tags: ["Organization"],
        },
        handler: async (ctx) => {
            const { user } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const organizations = await adapter.findOrganizationsByUserId(user.id)

            return ctx.json(organizations)
        },
    })
}

// =============================================================================
// CHECK ORGANIZATION SLUG
// =============================================================================

export function checkOrganizationSlug(config: OrganizationRouteConfig) {
    return endpoint("/check-slug", {
        method: "POST",
        body: z.object({
            slug: z.string(),
        }),
        meta: {
            summary: "Check organization slug",
            description: "Check if an organization slug is available",
            tags: ["Organization"],
        },
        handler: async (ctx) => {
            const { body } = ctx
            const adapter = config.getAdapter()

            const existingOrg = await adapter.findOrganizationBySlug(body.slug)

            return ctx.json({
                available: !existingOrg,
            })
        },
    })
}
