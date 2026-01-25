// =============================================================================
// ORGANIZATION ACCESS CONTROL ROUTES
// Role and permission management endpoints
// =============================================================================

import { endpoint, z, EndpointError, requireAuth } from "../../../unified/endpoint.js"
import { ORGANIZATION_ERROR_CODES } from "../../error-codes.js"
import type { OrganizationRouteConfig, Member, RoleDefinition } from "../../types.js"
import { createOrgMiddleware } from "./crud-org.js"

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface OrganizationRole {
    id: string
    organizationId: string
    role: string
    permissions: Record<string, string[]>
    createdAt: Date
}

// =============================================================================
// CREATE ORGANIZATION ROLE
// =============================================================================

export function createOrgRole(config: OrganizationRouteConfig) {
    return endpoint("/create-role", {
        method: "POST",
        body: z.object({
            organizationId: z.string().optional(),
            role: z.string().min(1, "Role name is required"),
            permissions: z.record(z.string(), z.array(z.string())),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "Create organization role",
            description: "Create a custom role for an organization",
            tags: ["Organization", "Access Control"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const member = (ctx as any).member as Member

            // Check permission (need organization update permission to manage roles)
            if (!config.hasPermission(member, "organization", "update")) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.PERMISSION_DENIED,
                })
            }

            const organizationId = body.organizationId || (ctx as any).organization?.id
            if (!organizationId) {
                throw new EndpointError("BAD_REQUEST", {
                    message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION,
                })
            }

            // Normalize role name
            const normalizedRole = body.role.toLowerCase().trim()

            // Check if role already exists in predefined roles
            const predefinedRoles = config.getRoles()
            if (predefinedRoles[normalizedRole]) {
                throw new EndpointError("CONFLICT", {
                    message: "Role name conflicts with a predefined role",
                })
            }

            // Create custom role (stored in metadata or separate table)
            // For now, return the role definition
            const roleDefinition: RoleDefinition = {
                name: body.role,
                permissions: body.permissions as any,
            }

            return ctx.json({
                role: normalizedRole,
                ...roleDefinition,
            })
        },
    })
}

// =============================================================================
// DELETE ORGANIZATION ROLE
// =============================================================================

export function deleteOrgRole(config: OrganizationRouteConfig) {
    return endpoint("/delete-role", {
        method: "POST",
        body: z.object({
            organizationId: z.string().optional(),
            roleName: z.string().optional(),
            roleId: z.string().optional(),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "Delete organization role",
            description: "Delete a custom role from an organization",
            tags: ["Organization", "Access Control"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const member = (ctx as any).member as Member

            // Check permission
            if (!config.hasPermission(member, "organization", "update")) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.PERMISSION_DENIED,
                })
            }

            if (!body.roleName && !body.roleId) {
                throw new EndpointError("BAD_REQUEST", {
                    message: "Either roleName or roleId is required",
                })
            }

            // Check if trying to delete a predefined role
            const predefinedRoles = config.getRoles()
            const roleToDelete = body.roleName || body.roleId
            if (roleToDelete && predefinedRoles[roleToDelete]) {
                throw new EndpointError("BAD_REQUEST", {
                    message: "Cannot delete predefined roles",
                })
            }

            return ctx.json({ success: true })
        },
    })
}

// =============================================================================
// LIST ORGANIZATION ROLES
// =============================================================================

export function listOrgRoles(config: OrganizationRouteConfig) {
    return endpoint("/list-roles", {
        method: "GET",
        query: z.object({
            organizationId: z.string().optional(),
        }).optional(),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "List organization roles",
            description: "List all roles available in an organization",
            tags: ["Organization", "Access Control"],
        },
        handler: async (ctx) => {
            const member = (ctx as any).member as Member

            // Check permission
            if (!config.hasPermission(member, "organization", "read")) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.PERMISSION_DENIED,
                })
            }

            // Get predefined roles
            const predefinedRoles = config.getRoles()

            const roles = Object.entries(predefinedRoles).map(([key, value]) => ({
                role: key,
                name: value.name || key,
                description: value.description,
                permissions: value.permissions,
                isPredefined: true,
            }))

            return ctx.json(roles)
        },
    })
}

// =============================================================================
// GET ORGANIZATION ROLE
// =============================================================================

export function getOrgRole(config: OrganizationRouteConfig) {
    return endpoint("/get-role", {
        method: "GET",
        query: z.object({
            organizationId: z.string().optional(),
            roleName: z.string().optional(),
            roleId: z.string().optional(),
        }).optional(),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "Get organization role",
            description: "Get details of a specific role",
            tags: ["Organization", "Access Control"],
        },
        handler: async (ctx) => {
            const { query } = ctx
            const member = (ctx as any).member as Member

            // Check permission
            if (!config.hasPermission(member, "organization", "read")) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.PERMISSION_DENIED,
                })
            }

            const roleName = query?.roleName || query?.roleId
            if (!roleName) {
                throw new EndpointError("BAD_REQUEST", {
                    message: "Either roleName or roleId is required",
                })
            }

            const predefinedRoles = config.getRoles()
            const role = predefinedRoles[roleName]

            if (!role) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.ROLE_NOT_FOUND,
                })
            }

            return ctx.json({
                role: roleName,
                name: role.name || roleName,
                description: role.description,
                permissions: role.permissions,
                isPredefined: true,
            })
        },
    })
}

// =============================================================================
// UPDATE ORGANIZATION ROLE
// =============================================================================

export function updateOrgRole(config: OrganizationRouteConfig) {
    return endpoint("/update-role", {
        method: "POST",
        body: z.object({
            organizationId: z.string().optional(),
            roleName: z.string().optional(),
            roleId: z.string().optional(),
            permissions: z.record(z.string(), z.array(z.string())).optional(),
            name: z.string().optional(),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "Update organization role",
            description: "Update permissions for a custom role",
            tags: ["Organization", "Access Control"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const member = (ctx as any).member as Member

            // Check permission
            if (!config.hasPermission(member, "organization", "update")) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.PERMISSION_DENIED,
                })
            }

            const roleName = body.roleName || body.roleId
            if (!roleName) {
                throw new EndpointError("BAD_REQUEST", {
                    message: "Either roleName or roleId is required",
                })
            }

            // Check if trying to update a predefined role
            const predefinedRoles = config.getRoles()
            if (predefinedRoles[roleName]) {
                throw new EndpointError("BAD_REQUEST", {
                    message: "Cannot update predefined roles",
                })
            }

            return ctx.json({
                role: roleName,
                permissions: body.permissions,
                name: body.name,
            })
        },
    })
}

// =============================================================================
// HAS PERMISSION
// =============================================================================

export function hasPermissionEndpoint(config: OrganizationRouteConfig) {
    return endpoint("/has-permission", {
        method: "POST",
        body: z.object({
            organizationId: z.string().optional(),
            permission: z.record(z.string(), z.array(z.string())),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "Check permission",
            description: "Check if the current user has specific permissions",
            tags: ["Organization", "Access Control"],
        },
        handler: async (ctx) => {
            const { body } = ctx
            const member = (ctx as any).member as Member

            if (!member) {
                return ctx.json({ hasPermission: false })
            }

            const predefinedRoles = config.getRoles()

            // Check all requested permissions
            for (const [resource, actions] of Object.entries(body.permission)) {
                for (const action of actions) {
                    const hasIt = config.hasPermission(member, resource as any, action as any)
                    if (!hasIt) {
                        return ctx.json({ hasPermission: false })
                    }
                }
            }

            return ctx.json({ hasPermission: true })
        },
    })
}
