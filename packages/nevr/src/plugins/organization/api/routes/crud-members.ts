// =============================================================================
// ORGANIZATION MEMBER ROUTES
// Member management endpoints
// =============================================================================

import { endpoint, z, EndpointError, requireAuth } from "../../../unified/endpoint.js"
import { ORGANIZATION_ERROR_CODES } from "../../error-codes.js"
import type { OrganizationRouteConfig, Member } from "../../types.js"
import { createOrgMiddleware } from "./crud-org.js"

// =============================================================================
// ADD MEMBER
// =============================================================================

export function addMember(config: OrganizationRouteConfig) {
    return endpoint("/add-member", {
        method: "POST",
        body: z.object({
            organizationId: z.string(),
            userId: z.string(),
            role: z.string().optional().default("member"),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "Add member",
            description: "Add a user as a member of an organization",
            tags: ["Organization", "Members"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const member = (ctx as any).member as Member

            // Check permission
            if (!config.hasPermission(member, "member", "create")) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.NOT_ALLOWED_TO_ADD_MEMBER,
                })
            }

            // Check if user is already a member
            const existingMember = await adapter.findMemberByUserAndOrg(body.userId, body.organizationId)
            if (existingMember) {
                throw new EndpointError("CONFLICT", {
                    message: ORGANIZATION_ERROR_CODES.USER_ALREADY_A_MEMBER,
                })
            }

            // Check max members
            const options = config.options
            const memberCount = await adapter.countMembersByOrganizationId(body.organizationId)
            const maxMembers = typeof options.maxMembersPerOrg === "function"
                ? await options.maxMembersPerOrg(body.organizationId)
                : options.maxMembersPerOrg || 100

            if (memberCount >= maxMembers) {
                throw new EndpointError("BAD_REQUEST", {
                    message: ORGANIZATION_ERROR_CODES.MAX_MEMBERS_REACHED,
                })
            }

            // Validate role exists
            const roles = config.getRoles()
            if (!roles[body.role]) {
                throw new EndpointError("BAD_REQUEST", {
                    message: ORGANIZATION_ERROR_CODES.INVALID_ROLE,
                })
            }

            // Run beforeAddMember hook
            let role = body.role
            if (options.hooks?.beforeAddMember) {
                const organization = await adapter.findOrganizationById(body.organizationId)
                if (organization) {
                    const hookResult = await options.hooks.beforeAddMember(
                        { organization, userId: body.userId, role },
                        ctx as any
                    )
                    if (hookResult?.data?.role) {
                        role = hookResult.data.role
                    }
                }
            }

            // Create member
            const newMember = await adapter.createMember({
                organizationId: body.organizationId,
                userId: body.userId,
                role,
            })

            // Run afterAddMember hook
            if (options.hooks?.afterAddMember) {
                const organization = await adapter.findOrganizationById(body.organizationId)
                if (organization) {
                    await options.hooks.afterAddMember({ organization, member: newMember }, ctx as any)
                }
            }

            return ctx.json(newMember)
        },
    })
}

// =============================================================================
// REMOVE MEMBER
// =============================================================================

export function removeMember(config: OrganizationRouteConfig) {
    return endpoint("/remove-member", {
        method: "POST",
        body: z.object({
            organizationId: z.string(),
            memberId: z.string(),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "Remove member",
            description: "Remove a member from an organization",
            tags: ["Organization", "Members"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const currentMember = (ctx as any).member as Member

            // Check permission
            if (!config.hasPermission(currentMember, "member", "delete")) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.NOT_ALLOWED_TO_REMOVE_MEMBER,
                })
            }

            // Find member to remove
            const memberToRemove = await adapter.findMemberById(body.memberId)
            if (!memberToRemove || memberToRemove.organizationId !== body.organizationId) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.MEMBER_NOT_FOUND,
                })
            }

            // Check if trying to remove an owner (need special permission)
            if (memberToRemove.role === "owner" && currentMember.role !== "owner") {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.CANNOT_REMOVE_OWNER,
                })
            }

            const organization = await adapter.findOrganizationById(body.organizationId)

            // Run beforeRemoveMember hook
            if (config.options.hooks?.beforeRemoveMember && organization) {
                await config.options.hooks.beforeRemoveMember(
                    { organization, member: memberToRemove },
                    ctx as any
                )
            }

            // Remove member
            await adapter.deleteMember(body.memberId)

            // Run afterRemoveMember hook
            if (config.options.hooks?.afterRemoveMember && organization) {
                await config.options.hooks.afterRemoveMember(
                    { organization, member: memberToRemove },
                    ctx as any
                )
            }

            return ctx.json({ success: true })
        },
    })
}

// =============================================================================
// UPDATE MEMBER ROLE
// =============================================================================

export function updateMemberRole(config: OrganizationRouteConfig) {
    return endpoint("/update-member-role", {
        method: "POST",
        body: z.object({
            organizationId: z.string(),
            memberId: z.string(),
            role: z.string(),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "Update member role",
            description: "Update a member's role in an organization",
            tags: ["Organization", "Members"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const currentMember = (ctx as any).member as Member

            // Check permission
            if (!config.hasPermission(currentMember, "member", "update")) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.NOT_ALLOWED_TO_UPDATE_MEMBER,
                })
            }

            // Find member to update
            const memberToUpdate = await adapter.findMemberById(body.memberId)
            if (!memberToUpdate || memberToUpdate.organizationId !== body.organizationId) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.MEMBER_NOT_FOUND,
                })
            }

            // Validate new role exists
            const roles = config.getRoles()
            if (!roles[body.role]) {
                throw new EndpointError("BAD_REQUEST", {
                    message: ORGANIZATION_ERROR_CODES.INVALID_ROLE,
                })
            }

            // Check if trying to change owner role (need to be owner)
            if ((memberToUpdate.role === "owner" || body.role === "owner") && currentMember.role !== "owner") {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.CANNOT_CHANGE_OWNER_ROLE,
                })
            }

            const organization = await adapter.findOrganizationById(body.organizationId)

            // Run beforeUpdateMemberRole hook
            let newRole = body.role
            if (config.options.hooks?.beforeUpdateMemberRole && organization) {
                const hookResult = await config.options.hooks.beforeUpdateMemberRole(
                    { organization, member: memberToUpdate, newRole },
                    ctx as any
                )
                if (hookResult?.data?.role) {
                    newRole = hookResult.data.role
                }
            }

            // Update member role
            const updatedMember = await adapter.updateMember(body.memberId, { role: newRole })

            // Run afterUpdateMemberRole hook
            if (config.options.hooks?.afterUpdateMemberRole && organization && updatedMember) {
                await config.options.hooks.afterUpdateMemberRole(
                    { organization, member: updatedMember },
                    ctx as any
                )
            }

            return ctx.json(updatedMember)
        },
    })
}

// =============================================================================
// GET ACTIVE MEMBER
// =============================================================================

export function getActiveMember(config: OrganizationRouteConfig) {
    return endpoint("/get-active-member", {
        method: "GET",
        query: z.object({
            organizationId: z.string(),
        }),
        use: [requireAuth],
        meta: {
            summary: "Get active member",
            description: "Get the current user's membership in an organization",
            tags: ["Organization", "Members"],
        },
        handler: async (ctx) => {
            const { user, query } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const member = await adapter.findMemberByUserAndOrg(user.id, query.organizationId)

            if (!member) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.MEMBER_NOT_FOUND,
                })
            }

            return ctx.json(member)
        },
    })
}

// =============================================================================
// GET ACTIVE MEMBER ROLE
// =============================================================================

export function getActiveMemberRole(config: OrganizationRouteConfig) {
    return endpoint("/get-active-member-role", {
        method: "GET",
        query: z.object({
            organizationId: z.string(),
        }),
        use: [requireAuth],
        meta: {
            summary: "Get active member role",
            description: "Get the current user's role in an organization",
            tags: ["Organization", "Members"],
        },
        handler: async (ctx) => {
            const { user, query } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const member = await adapter.findMemberByUserAndOrg(user.id, query.organizationId)

            if (!member) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.MEMBER_NOT_FOUND,
                })
            }

            const roles = config.getRoles()
            const roleDefinition = roles[member.role]

            return ctx.json({
                role: member.role,
                name: roleDefinition?.name || member.role,
                permissions: roleDefinition?.permissions || {},
            })
        },
    })
}

// =============================================================================
// LIST MEMBERS
// =============================================================================

export function listMembers(config: OrganizationRouteConfig) {
    return endpoint("/list-members", {
        method: "GET",
        query: z.object({
            organizationId: z.string(),
            limit: z.coerce.number().optional(),
            offset: z.coerce.number().optional(),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "List members",
            description: "List all members of an organization",
            tags: ["Organization", "Members"],
        },
        handler: async (ctx) => {
            const { query } = ctx
            const adapter = config.getAdapter()

            const members = await adapter.findMembersByOrganizationId(query.organizationId, {
                limit: query.limit,
                offset: query.offset,
            })

            return ctx.json(members)
        },
    })
}

// =============================================================================
// LEAVE ORGANIZATION
// =============================================================================

export function leaveOrganization(config: OrganizationRouteConfig) {
    return endpoint("/leave", {
        method: "POST",
        body: z.object({
            organizationId: z.string(),
        }),
        use: [requireAuth],
        meta: {
            summary: "Leave organization",
            description: "Leave an organization (remove self as member)",
            tags: ["Organization", "Members"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()

            // Find membership
            const member = await adapter.findMemberByUserAndOrg(user.id, body.organizationId)
            if (!member) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.MEMBER_NOT_FOUND,
                })
            }

            // Check if user is the only owner
            if (member.role === "owner") {
                const members = await adapter.findMembersByOrganizationId(body.organizationId)
                const owners = members.filter(m => m.role === "owner")
                if (owners.length === 1) {
                    throw new EndpointError("BAD_REQUEST", {
                        message: ORGANIZATION_ERROR_CODES.CANNOT_LEAVE_AS_ONLY_OWNER,
                    })
                }
            }

            const organization = await adapter.findOrganizationById(body.organizationId)

            // Run beforeRemoveMember hook
            if (config.options.hooks?.beforeRemoveMember && organization) {
                await config.options.hooks.beforeRemoveMember(
                    { organization, member },
                    ctx as any
                )
            }

            // Remove self
            await adapter.deleteMember(member.id)

            // Run afterRemoveMember hook
            if (config.options.hooks?.afterRemoveMember && organization) {
                await config.options.hooks.afterRemoveMember(
                    { organization, member },
                    ctx as any
                )
            }

            return ctx.json({ success: true })
        },
    })
}
