// =============================================================================
// ORGANIZATION INVITATION ROUTES
// Invitation management endpoints
// =============================================================================

import { endpoint, z, EndpointError, requireAuth } from "../../../unified/endpoint.js"
import { ORGANIZATION_ERROR_CODES } from "../../error-codes.js"
import type { OrganizationRouteConfig, Member, Invitation, InvitationStatus } from "../../types.js"
import { createOrgMiddleware } from "./crud-org.js"

// =============================================================================
// CREATE INVITATION
// =============================================================================

export function createInvitation(config: OrganizationRouteConfig) {
    return endpoint("/invite-member", {
        method: "POST",
        body: z.object({
            organizationId: z.string(),
            email: z.string().email(),
            role: z.string().optional().default("member"),
            teamId: z.string().optional(),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "Invite member",
            description: "Send an invitation to join an organization",
            tags: ["Organization", "Invitations"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const member = (ctx as any).member as Member
            const options = config.options

            // Check permission
            if (!config.hasPermission(member, "invitation", "create")) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.NOT_ALLOWED_TO_INVITE,
                })
            }

            // Validate role exists
            const roles = config.getRoles()
            if (!roles[body.role]) {
                throw new EndpointError("BAD_REQUEST", {
                    message: ORGANIZATION_ERROR_CODES.INVALID_ROLE,
                })
            }

            // Check if already a member
            const organization = await adapter.findOrganizationById(body.organizationId)
            if (!organization) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND,
                })
            }

            // Check for existing pending invitation
            const existingInvitation = await adapter.findInvitationByEmailAndOrg(body.email, body.organizationId)
            if (existingInvitation && existingInvitation.status === "pending") {
                if (options.invitation?.cancelOnReInvite) {
                    // Cancel existing and create new
                    await adapter.updateInvitation(existingInvitation.id, { status: "canceled" })
                } else {
                    throw new EndpointError("CONFLICT", {
                        message: ORGANIZATION_ERROR_CODES.INVITATION_ALREADY_PENDING,
                    })
                }
            }

            // Check max pending invitations
            if (options.invitation?.maxPending) {
                const pendingCount = await adapter.countPendingInvitations(body.organizationId)
                const maxPending = typeof options.invitation.maxPending === "function"
                    ? await options.invitation.maxPending({ organizationId: body.organizationId }, ctx as any)
                    : options.invitation.maxPending

                if (pendingCount >= maxPending) {
                    throw new EndpointError("BAD_REQUEST", {
                        message: ORGANIZATION_ERROR_CODES.MAX_PENDING_INVITATIONS_REACHED,
                    })
                }
            }

            // Run beforeInvite hook
            let role = body.role
            if (options.hooks?.beforeInvite) {
                const hookResult = await options.hooks.beforeInvite(
                    { organization, email: body.email, role },
                    ctx as any
                )
                if (hookResult?.data?.role) {
                    role = hookResult.data.role
                }
            }

            // Calculate expiration
            const expiresInSeconds = options.invitation?.expiresIn || 48 * 60 * 60 // Default 48 hours
            const expiresAt = new Date(Date.now() + expiresInSeconds * 1000)

            // Create invitation
            const invitation = await adapter.createInvitation({
                organizationId: body.organizationId,
                email: body.email,
                role,
                status: "pending",
                inviterId: user.id,
                teamId: body.teamId,
                expiresAt,
            })

            // Send email if configured
            if (options.invitation?.sendEmail) {
                const acceptUrl = `${options.invitationBaseUrl || ""}/accept-invitation?id=${invitation.id}`
                await options.invitation.sendEmail({
                    invitation,
                    organization: {
                        id: organization.id,
                        name: organization.name,
                        slug: organization.slug,
                        logo: organization.logo,
                    },
                    inviter: {
                        id: user.id,
                        email: user.email || "",
                        name: (user as any).name,
                    },
                    invitee: { email: body.email },
                    acceptUrl,
                    expiresAt,
                })
            }

            // Run afterInvite hook
            if (options.hooks?.afterInvite) {
                await options.hooks.afterInvite({ organization, invitation }, ctx as any)
            }

            return ctx.json(invitation)
        },
    })
}

// =============================================================================
// ACCEPT INVITATION
// =============================================================================

export function acceptInvitation(config: OrganizationRouteConfig) {
    return endpoint("/accept-invitation", {
        method: "POST",
        body: z.object({
            invitationId: z.string(),
        }),
        use: [requireAuth],
        meta: {
            summary: "Accept invitation",
            description: "Accept an invitation to join an organization",
            tags: ["Organization", "Invitations"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const options = config.options

            // Find invitation
            const invitation = await adapter.findInvitationById(body.invitationId)
            if (!invitation) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.INVITATION_NOT_FOUND,
                })
            }

            // Check invitation status
            if (invitation.status !== "pending") {
                throw new EndpointError("BAD_REQUEST", {
                    message: ORGANIZATION_ERROR_CODES.INVITATION_NOT_PENDING,
                })
            }

            // Check expiration
            if (new Date() > invitation.expiresAt) {
                await adapter.updateInvitation(invitation.id, { status: "canceled" })
                throw new EndpointError("BAD_REQUEST", {
                    message: ORGANIZATION_ERROR_CODES.INVITATION_EXPIRED,
                })
            }

            // Check email matches
            const userEmail = user.email || (user as any).email
            if (invitation.email.toLowerCase() !== userEmail?.toLowerCase()) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.INVITATION_EMAIL_MISMATCH,
                })
            }

            // Check email verification if required
            if (options.invitation?.requireEmailVerification && !(user as any).emailVerified) {
                throw new EndpointError("BAD_REQUEST", {
                    message: ORGANIZATION_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED,
                })
            }

            // Check if already a member
            const existingMember = await adapter.findMemberByUserAndOrg(user.id, invitation.organizationId)
            if (existingMember) {
                await adapter.updateInvitation(invitation.id, { status: "accepted" })
                throw new EndpointError("CONFLICT", {
                    message: ORGANIZATION_ERROR_CODES.USER_ALREADY_A_MEMBER,
                })
            }

            // Run beforeAcceptInvitation hook
            if (options.hooks?.beforeAcceptInvitation) {
                await options.hooks.beforeAcceptInvitation({ invitation, user }, ctx as any)
            }

            // Create membership
            const member = await adapter.createMember({
                organizationId: invitation.organizationId,
                userId: user.id,
                role: invitation.role,
            })

            // Update invitation status
            await adapter.updateInvitation(invitation.id, { status: "accepted" })

            // Run afterAcceptInvitation hook
            if (options.hooks?.afterAcceptInvitation) {
                await options.hooks.afterAcceptInvitation({ invitation, member }, ctx as any)
            }

            const organization = await adapter.findOrganizationById(invitation.organizationId)

            return ctx.json({ member, organization })
        },
    })
}

// =============================================================================
// REJECT INVITATION
// =============================================================================

export function rejectInvitation(config: OrganizationRouteConfig) {
    return endpoint("/reject-invitation", {
        method: "POST",
        body: z.object({
            invitationId: z.string(),
        }),
        use: [requireAuth],
        meta: {
            summary: "Reject invitation",
            description: "Reject an invitation to join an organization",
            tags: ["Organization", "Invitations"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const options = config.options

            // Find invitation
            const invitation = await adapter.findInvitationById(body.invitationId)
            if (!invitation) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.INVITATION_NOT_FOUND,
                })
            }

            // Check invitation belongs to user
            const userEmail = user.email || (user as any).email
            if (invitation.email.toLowerCase() !== userEmail?.toLowerCase()) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.INVITATION_EMAIL_MISMATCH,
                })
            }

            // Check invitation is pending
            if (invitation.status !== "pending") {
                throw new EndpointError("BAD_REQUEST", {
                    message: ORGANIZATION_ERROR_CODES.INVITATION_NOT_PENDING,
                })
            }

            // Run beforeRejectInvitation hook
            if (options.hooks?.beforeRejectInvitation) {
                await options.hooks.beforeRejectInvitation({ invitation }, ctx as any)
            }

            // Update status
            await adapter.updateInvitation(invitation.id, { status: "rejected" })

            // Run afterRejectInvitation hook
            if (options.hooks?.afterRejectInvitation) {
                await options.hooks.afterRejectInvitation({ invitation }, ctx as any)
            }

            return ctx.json({ success: true })
        },
    })
}

// =============================================================================
// CANCEL INVITATION
// =============================================================================

export function cancelInvitation(config: OrganizationRouteConfig) {
    return endpoint("/cancel-invitation", {
        method: "POST",
        body: z.object({
            invitationId: z.string(),
            organizationId: z.string(),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "Cancel invitation",
            description: "Cancel a pending invitation",
            tags: ["Organization", "Invitations"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const member = (ctx as any).member as Member
            const options = config.options

            // Check permission
            if (!config.hasPermission(member, "invitation", "delete")) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.NOT_ALLOWED_TO_CANCEL_INVITATION,
                })
            }

            // Find invitation
            const invitation = await adapter.findInvitationById(body.invitationId)
            if (!invitation || invitation.organizationId !== body.organizationId) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.INVITATION_NOT_FOUND,
                })
            }

            // Check invitation is pending
            if (invitation.status !== "pending") {
                throw new EndpointError("BAD_REQUEST", {
                    message: ORGANIZATION_ERROR_CODES.INVITATION_NOT_PENDING,
                })
            }

            // Run beforeCancelInvitation hook
            if (options.hooks?.beforeCancelInvitation) {
                await options.hooks.beforeCancelInvitation({ invitation }, ctx as any)
            }

            // Update status
            await adapter.updateInvitation(invitation.id, { status: "canceled" })

            // Run afterCancelInvitation hook
            if (options.hooks?.afterCancelInvitation) {
                await options.hooks.afterCancelInvitation({ invitation }, ctx as any)
            }

            return ctx.json({ success: true })
        },
    })
}

// =============================================================================
// GET INVITATION
// =============================================================================

export function getInvitation(config: OrganizationRouteConfig) {
    return endpoint("/get-invitation", {
        method: "GET",
        query: z.object({
            invitationId: z.string(),
        }),
        meta: {
            summary: "Get invitation",
            description: "Get invitation details by ID",
            tags: ["Organization", "Invitations"],
        },
        handler: async (ctx) => {
            const { query } = ctx
            const adapter = config.getAdapter()

            const invitation = await adapter.findInvitationById(query.invitationId)
            if (!invitation) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.INVITATION_NOT_FOUND,
                })
            }

            const organization = await adapter.findOrganizationById(invitation.organizationId)

            return ctx.json({
                ...invitation,
                organization: organization ? {
                    id: organization.id,
                    name: organization.name,
                    slug: organization.slug,
                    logo: organization.logo,
                } : null,
            })
        },
    })
}

// =============================================================================
// LIST INVITATIONS
// =============================================================================

export function listInvitations(config: OrganizationRouteConfig) {
    return endpoint("/list-invitations", {
        method: "GET",
        query: z.object({
            organizationId: z.string(),
            status: z.enum(["pending", "accepted", "rejected", "canceled"]).optional(),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "List invitations",
            description: "List all invitations for an organization",
            tags: ["Organization", "Invitations"],
        },
        handler: async (ctx) => {
            const { query } = ctx
            const member = (ctx as any).member as Member

            // Check permission
            if (!config.hasPermission(member, "invitation", "read")) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.NOT_ALLOWED_TO_VIEW_INVITATIONS,
                })
            }

            const adapter = config.getAdapter()
            const invitations = await adapter.findInvitationsByOrganizationId(query.organizationId)

            // Filter by status if provided
            const filtered = query.status
                ? invitations.filter(inv => inv.status === query.status)
                : invitations

            return ctx.json(filtered)
        },
    })
}

// =============================================================================
// LIST USER INVITATIONS
// =============================================================================

export function listUserInvitations(config: OrganizationRouteConfig) {
    return endpoint("/list-user-invitations", {
        method: "GET",
        use: [requireAuth],
        meta: {
            summary: "List user invitations",
            description: "List all pending invitations for the current user",
            tags: ["Organization", "Invitations"],
        },
        handler: async (ctx) => {
            const { user } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const userEmail = user.email || (user as any).email

            if (!userEmail) {
                return ctx.json([])
            }

            const invitations = await adapter.findInvitationsByEmail(userEmail)

            // Filter to pending only
            const pending = invitations.filter(inv => inv.status === "pending")

            return ctx.json(pending)
        },
    })
}
