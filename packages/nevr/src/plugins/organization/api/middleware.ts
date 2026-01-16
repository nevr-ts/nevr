// =============================================================================
// ORGANIZATION MIDDLEWARE
// Authentication and authorization middleware for organization plugin
// =============================================================================

import { createMiddleware, EndpointError } from "../../unified/endpoint.js"
import type { EndpointContext } from "../../unified/endpoint.js"
import type {
    OrganizationAdapter,
    Organization,
    Member,
    PermissionResource,
    PermissionAction,
    RoleDefinition,
} from "../types.js"
import { ORGANIZATION_ERROR_CODES } from "../error-codes.js"

// -----------------------------------------------------------------------------
// Extended Context Type
// -----------------------------------------------------------------------------

export interface OrgEndpointContext extends EndpointContext {
    session?: {
        user: any
        activeOrganizationId?: string | null
        activeTeamId?: string | null
        [key: string]: unknown
    }
    organization?: Organization
    member?: Member
}

// -----------------------------------------------------------------------------
// Session Middleware
// Ensures user is authenticated
// -----------------------------------------------------------------------------

export const sessionMiddleware = createMiddleware(async (ctx) => {
    const orgCtx = ctx as OrgEndpointContext

    const session = orgCtx.session || (orgCtx.context as any)?.session
    const user = orgCtx.user || session?.user

    if (!session || !user) {
        throw new EndpointError("UNAUTHORIZED", {
            message: ORGANIZATION_ERROR_CODES.UNAUTHORIZED,
        })
    }

    // Ensure ctx has user and session
    ;(orgCtx as any).user = user
    orgCtx.session = session
})

// -----------------------------------------------------------------------------
// Organization Middleware Factory
// Loads organization from ID/slug and validates membership
// -----------------------------------------------------------------------------

export function createOrgMiddleware(
    getAdapter: () => OrganizationAdapter,
    options?: {
        /** If true, requires an active organization in session */
        requireActive?: boolean
        /** If true, loads organization from body/query orgId or slug */
        loadFromRequest?: boolean
    }
) {
    return createMiddleware(async (ctx) => {
        const orgCtx = ctx as OrgEndpointContext
        const adapter = getAdapter()

        const session = orgCtx.session || (orgCtx.context as any)?.session
        const user = orgCtx.user || session?.user

        if (!session || !user) {
            throw new EndpointError("UNAUTHORIZED", {
                message: ORGANIZATION_ERROR_CODES.UNAUTHORIZED,
            })
        }

        let organizationId: string | undefined

        // Try to get organization from request
        if (options?.loadFromRequest) {
            const body = orgCtx.body as Record<string, unknown> | undefined
            const query = orgCtx.query as Record<string, unknown> | undefined

            const orgIdFromRequest = body?.organizationId || query?.organizationId
            const slugFromRequest = body?.slug || query?.slug

            if (typeof orgIdFromRequest === "string") {
                organizationId = orgIdFromRequest
            } else if (typeof slugFromRequest === "string") {
                const org = await adapter.findOrganizationBySlug(slugFromRequest)
                if (org) organizationId = org.id
            }
        }

        // Fall back to active organization from session
        if (!organizationId && session.activeOrganizationId) {
            organizationId = session.activeOrganizationId
        }

        // If we require an active org but don't have one
        if (options?.requireActive && !organizationId) {
            throw new EndpointError("BAD_REQUEST", {
                message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION,
            })
        }

        // Load organization if we have an ID
        if (organizationId) {
            const organization = await adapter.findOrganizationById(organizationId)
            if (!organization) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND,
                })
            }

            // Check membership
            const member = await adapter.findMemberByUserAndOrg(user.id, organizationId)
            if (!member) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.NOT_A_MEMBER,
                })
            }

            orgCtx.organization = organization
            orgCtx.member = member
        }
    })
}

// -----------------------------------------------------------------------------
// Permission Middleware Factory
// Checks if user has required permissions
// -----------------------------------------------------------------------------

export function createPermissionMiddleware(
    getAdapter: () => OrganizationAdapter,
    getRoles: () => Record<string, RoleDefinition>,
    resource: PermissionResource,
    action: PermissionAction
) {
    return createMiddleware(async (ctx) => {
        const orgCtx = ctx as OrgEndpointContext

        if (!orgCtx.member) {
            throw new EndpointError("FORBIDDEN", {
                message: ORGANIZATION_ERROR_CODES.NOT_A_MEMBER,
            })
        }

        const roles = getRoles()
        const hasPermission = checkPermission(orgCtx.member, roles, resource, action)

        if (!hasPermission) {
            throw new EndpointError("FORBIDDEN", {
                message: ORGANIZATION_ERROR_CODES.PERMISSION_DENIED,
            })
        }
    })
}

// -----------------------------------------------------------------------------
// Permission Helper
// -----------------------------------------------------------------------------

/**
 * Check if a member has permission for a resource/action
 */
export function checkPermission(
    member: Member,
    roles: Record<string, RoleDefinition>,
    resource: PermissionResource,
    action: PermissionAction
): boolean {
    // Member can have multiple roles (comma-separated)
    const memberRoles = member.role.split(",").map(r => r.trim())

    for (const roleName of memberRoles) {
        const role = roles[roleName]
        if (!role) continue

        const permissions = role.permissions[resource]
        if (permissions && permissions.includes(action)) {
            return true
        }
    }

    return false
}

/**
 * Check if member is an owner
 */
export function isOwner(member: Member): boolean {
    const roles = member.role.split(",").map(r => r.trim())
    return roles.includes("owner")
}

/**
 * Count owners in organization
 */
export async function countOwners(
    adapter: OrganizationAdapter,
    organizationId: string
): Promise<number> {
    const members = await adapter.findMembersByOrganizationId(organizationId)
    return members.filter(m => isOwner(m)).length
}
