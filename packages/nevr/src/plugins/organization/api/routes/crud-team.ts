// =============================================================================
// ORGANIZATION TEAM ROUTES
// Team management endpoints
// =============================================================================

import { endpoint, z, EndpointError, requireAuth } from "../../../unified/endpoint.js"
import { ORGANIZATION_ERROR_CODES } from "../../error-codes.js"
import type { OrganizationRouteConfig, Member, Team, TeamMember } from "../../types.js"
import { createOrgMiddleware } from "./crud-org.js"

// =============================================================================
// CREATE TEAM
// =============================================================================

export function createTeam(config: OrganizationRouteConfig) {
    return endpoint("/create-team", {
        method: "POST",
        body: z.object({
            name: z.string().min(1, "Team name is required"),
            organizationId: z.string().optional(),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "Create team",
            description: "Create a new team in an organization",
            tags: ["Organization", "Teams"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const member = (ctx as any).member as Member
            const options = config.options

            // Check if teams are enabled
            if (!options.teams || !("enabled" in options.teams) || !options.teams.enabled) {
                throw new EndpointError("BAD_REQUEST", {
                    message: ORGANIZATION_ERROR_CODES.TEAMS_NOT_ENABLED,
                })
            }

            // Check permission
            if (!config.hasPermission(member, "team", "create")) {
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

            // Check max teams
            if (adapter.countTeamsByOrganizationId) {
                const teamCount = await adapter.countTeamsByOrganizationId(organizationId)
                const maxTeams = typeof options.teams.maxTeams === "function"
                    ? await options.teams.maxTeams({ organizationId })
                    : options.teams.maxTeams || 100

                if (teamCount >= maxTeams) {
                    throw new EndpointError("BAD_REQUEST", {
                        message: ORGANIZATION_ERROR_CODES.TEAM_LIMIT_REACHED,
                    })
                }
            }

            // Create team
            if (!adapter.createTeam) {
                throw new EndpointError("INTERNAL_ERROR", {
                    message: "Team operations not supported",
                })
            }

            const team = await adapter.createTeam({
                name: body.name,
                organizationId,
            })

            return ctx.json(team)
        },
    })
}

// =============================================================================
// REMOVE TEAM
// =============================================================================

export function removeTeam(config: OrganizationRouteConfig) {
    return endpoint("/remove-team", {
        method: "POST",
        body: z.object({
            teamId: z.string(),
            organizationId: z.string().optional(),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "Remove team",
            description: "Delete a team from an organization",
            tags: ["Organization", "Teams"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const member = (ctx as any).member as Member

            // Check permission
            if (!config.hasPermission(member, "team", "delete")) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.PERMISSION_DENIED,
                })
            }

            if (!adapter.findTeamById || !adapter.deleteTeam) {
                throw new EndpointError("INTERNAL_ERROR", {
                    message: "Team operations not supported",
                })
            }

            const team = await adapter.findTeamById(body.teamId)
            if (!team) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.TEAM_NOT_FOUND,
                })
            }

            await adapter.deleteTeam(body.teamId)

            return ctx.json({ success: true })
        },
    })
}

// =============================================================================
// UPDATE TEAM
// =============================================================================

export function updateTeam(config: OrganizationRouteConfig) {
    return endpoint("/update-team", {
        method: "POST",
        body: z.object({
            teamId: z.string(),
            name: z.string().optional(),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "Update team",
            description: "Update team details",
            tags: ["Organization", "Teams"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const member = (ctx as any).member as Member

            // Check permission
            if (!config.hasPermission(member, "team", "update")) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.PERMISSION_DENIED,
                })
            }

            if (!adapter.findTeamById || !adapter.updateTeam) {
                throw new EndpointError("INTERNAL_ERROR", {
                    message: "Team operations not supported",
                })
            }

            const team = await adapter.findTeamById(body.teamId)
            if (!team) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.TEAM_NOT_FOUND,
                })
            }

            const updates: Partial<Team> = {}
            if (body.name !== undefined) updates.name = body.name

            const updatedTeam = await adapter.updateTeam(body.teamId, updates)

            return ctx.json(updatedTeam)
        },
    })
}

// =============================================================================
// LIST ORGANIZATION TEAMS
// =============================================================================

export function listOrganizationTeams(config: OrganizationRouteConfig) {
    return endpoint("/list-teams", {
        method: "GET",
        query: z.object({
            organizationId: z.string().optional(),
        }).optional(),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "List organization teams",
            description: "List all teams in an organization",
            tags: ["Organization", "Teams"],
        },
        handler: async (ctx) => {
            const { query } = ctx
            const adapter = config.getAdapter()

            if (!adapter.findTeamsByOrganizationId) {
                return ctx.json([])
            }

            const organizationId = query?.organizationId || (ctx as any).organization?.id
            if (!organizationId) {
                throw new EndpointError("BAD_REQUEST", {
                    message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION,
                })
            }

            const teams = await adapter.findTeamsByOrganizationId(organizationId)

            return ctx.json(teams)
        },
    })
}

// =============================================================================
// SET ACTIVE TEAM
// =============================================================================

export function setActiveTeam(config: OrganizationRouteConfig) {
    return endpoint("/set-active-team", {
        method: "POST",
        body: z.object({
            teamId: z.string().nullable(),
        }),
        use: [requireAuth],
        meta: {
            summary: "Set active team",
            description: "Set the active team for the current session",
            tags: ["Organization", "Teams"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()

            if (body.teamId === null) {
                return ctx.json({ activeTeamId: null as string | null })
            }

            if (!adapter.findTeamById) {
                throw new EndpointError("INTERNAL_ERROR", {
                    message: "Team operations not supported",
                })
            }

            const team = await adapter.findTeamById(body.teamId)
            if (!team) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.TEAM_NOT_FOUND,
                })
            }

            return ctx.json({
                activeTeamId: body.teamId as string | null,
                team,
            })
        },
    })
}

// =============================================================================
// LIST USER TEAMS
// =============================================================================

export function listUserTeams(config: OrganizationRouteConfig) {
    return endpoint("/list-user-teams", {
        method: "GET",
        query: z.object({
            organizationId: z.string(),
        }),
        use: [requireAuth],
        meta: {
            summary: "List user teams",
            description: "List all teams the user is a member of in an organization",
            tags: ["Organization", "Teams"],
        },
        handler: async (ctx) => {
            const { user, query } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()

            if (!adapter.findTeamsByUserId) {
                return ctx.json([])
            }

            const teams = await adapter.findTeamsByUserId(user.id, query.organizationId)

            return ctx.json(teams)
        },
    })
}

// =============================================================================
// LIST TEAM MEMBERS
// =============================================================================

export function listTeamMembers(config: OrganizationRouteConfig) {
    return endpoint("/list-team-members", {
        method: "GET",
        query: z.object({
            teamId: z.string(),
        }),
        use: [requireAuth],
        meta: {
            summary: "List team members",
            description: "List all members of a team",
            tags: ["Organization", "Teams"],
        },
        handler: async (ctx) => {
            const { query } = ctx
            const adapter = config.getAdapter()

            if (!adapter.findTeamMembersByTeamId) {
                return ctx.json([])
            }

            const members = await adapter.findTeamMembersByTeamId(query.teamId)

            return ctx.json(members)
        },
    })
}

// =============================================================================
// ADD TEAM MEMBER
// =============================================================================

export function addTeamMember(config: OrganizationRouteConfig) {
    return endpoint("/add-team-member", {
        method: "POST",
        body: z.object({
            teamId: z.string(),
            userId: z.string(),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "Add team member",
            description: "Add a user to a team",
            tags: ["Organization", "Teams"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const member = (ctx as any).member as Member
            const options = config.options

            // Check permission
            if (!config.hasPermission(member, "team", "update")) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.PERMISSION_DENIED,
                })
            }

            if (!adapter.findTeamById || !adapter.findTeamMember || !adapter.addTeamMember) {
                throw new EndpointError("INTERNAL_ERROR", {
                    message: "Team operations not supported",
                })
            }

            const team = await adapter.findTeamById(body.teamId)
            if (!team) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.TEAM_NOT_FOUND,
                })
            }

            // Check if already a member
            const existingMember = await adapter.findTeamMember(body.userId, body.teamId)
            if (existingMember) {
                throw new EndpointError("CONFLICT", {
                    message: ORGANIZATION_ERROR_CODES.TEAM_MEMBER_ALREADY_EXISTS,
                })
            }

            // Check max members
            if (options.teams && "enabled" in options.teams && options.teams.enabled && adapter.countTeamMembers) {
                const memberCount = await adapter.countTeamMembers(body.teamId)
                const maxMembers = typeof options.teams.maxMembersPerTeam === "function"
                    ? await options.teams.maxMembersPerTeam({ teamId: body.teamId })
                    : options.teams.maxMembersPerTeam || 100

                if (memberCount >= maxMembers) {
                    throw new EndpointError("BAD_REQUEST", {
                        message: ORGANIZATION_ERROR_CODES.TEAM_MEMBER_LIMIT_REACHED,
                    })
                }
            }

            const teamMember = await adapter.addTeamMember({
                teamId: body.teamId,
                userId: body.userId,
            })

            return ctx.json(teamMember)
        },
    })
}

// =============================================================================
// REMOVE TEAM MEMBER
// =============================================================================

export function removeTeamMember(config: OrganizationRouteConfig) {
    return endpoint("/remove-team-member", {
        method: "POST",
        body: z.object({
            teamId: z.string(),
            userId: z.string(),
        }),
        use: [requireAuth, createOrgMiddleware(config)],
        meta: {
            summary: "Remove team member",
            description: "Remove a user from a team",
            tags: ["Organization", "Teams"],
        },
        handler: async (ctx) => {
            const { user, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = config.getAdapter()
            const member = (ctx as any).member as Member

            // Check permission
            if (!config.hasPermission(member, "team", "update")) {
                throw new EndpointError("FORBIDDEN", {
                    message: ORGANIZATION_ERROR_CODES.PERMISSION_DENIED,
                })
            }

            if (!adapter.findTeamMember || !adapter.removeTeamMember) {
                throw new EndpointError("INTERNAL_ERROR", {
                    message: "Team operations not supported",
                })
            }

            const teamMember = await adapter.findTeamMember(body.userId, body.teamId)
            if (!teamMember) {
                throw new EndpointError("NOT_FOUND", {
                    message: ORGANIZATION_ERROR_CODES.TEAM_MEMBER_NOT_FOUND,
                })
            }

            await adapter.removeTeamMember(body.userId, body.teamId)

            return ctx.json({ success: true })
        },
    })
}
