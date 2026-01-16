// =============================================================================
// ORGANIZATION INTERNAL ADAPTER
// Database operations for organization plugin
// =============================================================================

import type { Driver } from "../../../types.js"
import type {
    OrganizationAdapter,
    Organization,
    Member,
    MemberWithUser,
    Invitation,
    InvitationWithDetails,
    Team,
    TeamMember,
    ListOptions,
} from "../types.js"
import { generateId } from "../../auth/crypto/index.js"

// -----------------------------------------------------------------------------
// Internal Adapter Factory
// -----------------------------------------------------------------------------

/**
 * Create internal adapter for organization database operations
 */
export function createOrganizationAdapter(driver: Driver): OrganizationAdapter {
    return {
        // =====================================================================
        // Organization Operations
        // =====================================================================

        async findOrganizationById(id: string): Promise<Organization | null> {
            return driver.findOne<Organization>("organization", { id })
        },

        async findOrganizationBySlug(slug: string): Promise<Organization | null> {
            return driver.findOne<Organization>("organization", { slug })
        },

        async findOrganizationsByUserId(userId: string): Promise<Organization[]> {
            // Find all memberships for user
            const members = await driver.findMany<Member>("member", {
                where: { userId },
            })

            if (members.length === 0) return []

            // Get all organizations
            const orgs: Organization[] = []
            for (const member of members) {
                const org = await driver.findOne<Organization>("organization", {
                    id: member.organizationId,
                })
                if (org) orgs.push(org)
            }

            return orgs
        },

        async createOrganization(data: Omit<Organization, "id" | "createdAt">): Promise<Organization> {
            const now = new Date()
            return driver.create<Organization>("organization", {
                id: generateId(),
                ...data,
                createdAt: now,
                updatedAt: now,
            })
        },

        async updateOrganization(id: string, data: Partial<Organization>): Promise<Organization | null> {
            return driver.update<Organization>("organization", { id }, {
                ...data,
                updatedAt: new Date(),
            })
        },

        async deleteOrganization(id: string): Promise<void> {
            await driver.delete("organization", { id })
        },

        // =====================================================================
        // Member Operations
        // =====================================================================

        async findMemberById(id: string): Promise<Member | null> {
            return driver.findOne<Member>("member", { id })
        },

        async findMemberByUserAndOrg(userId: string, organizationId: string): Promise<Member | null> {
            return driver.findOne<Member>("member", { userId, organizationId })
        },

        async findMembersByOrganizationId(organizationId: string, options?: ListOptions): Promise<MemberWithUser[]> {
            const members = await driver.findMany<Member>("member", {
                where: { organizationId },
                take: options?.take ?? options?.limit,
                skip: options?.skip ?? options?.offset,
            })

            // Fetch user data for each member
            const membersWithUsers: MemberWithUser[] = []
            for (const member of members) {
                const user = await driver.findOne<{
                    id: string
                    email: string
                    name?: string | null
                    image?: string | null
                }>("user", { id: member.userId })

                if (user) {
                    membersWithUsers.push({
                        ...member,
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            image: user.image,
                        },
                    })
                }
            }

            return membersWithUsers
        },

        async findMembersByUserId(userId: string): Promise<Member[]> {
            return driver.findMany<Member>("member", {
                where: { userId },
            })
        },

        async createMember(data: Omit<Member, "id" | "createdAt">): Promise<Member> {
            return driver.create<Member>("member", {
                id: generateId(),
                ...data,
                createdAt: new Date(),
            })
        },

        async updateMember(id: string, data: Partial<Member>): Promise<Member | null> {
            return driver.update<Member>("member", { id }, data)
        },

        async deleteMember(id: string): Promise<void> {
            await driver.delete("member", { id })
        },

        async deleteMembersByOrganizationId(organizationId: string): Promise<void> {
            const members = await driver.findMany<Member>("member", {
                where: { organizationId },
            })
            for (const member of members) {
                await driver.delete("member", { id: member.id })
            }
        },

        async countMembersByOrganizationId(organizationId: string): Promise<number> {
            const members = await driver.findMany<Member>("member", {
                where: { organizationId },
            })
            return members.length
        },

        // =====================================================================
        // Invitation Operations
        // =====================================================================

        async findInvitationById(id: string): Promise<Invitation | null> {
            return driver.findOne<Invitation>("invitation", { id })
        },

        async findInvitationByEmailAndOrg(email: string, organizationId: string): Promise<Invitation | null> {
            const invitations = await driver.findMany<Invitation>("invitation", {
                where: { organizationId },
            })
            return invitations.find(inv => inv.email.toLowerCase() === email.toLowerCase() && inv.status === "pending") || null
        },

        async findInvitationsByOrganizationId(organizationId: string, options?: ListOptions): Promise<Invitation[]> {
            return driver.findMany<Invitation>("invitation", {
                where: { organizationId },
                take: options?.take ?? options?.limit,
                skip: options?.skip ?? options?.offset,
            })
        },

        async findInvitationsByEmail(email: string): Promise<InvitationWithDetails[]> {
            // This is a more complex query - we need to find all invitations and join with org/inviter
            const allInvitations = await driver.findMany<Invitation>("invitation", {
                where: { status: "pending" },
            })

            const matchingInvitations = allInvitations.filter(
                inv => inv.email.toLowerCase() === email.toLowerCase()
            )

            const withDetails: InvitationWithDetails[] = []
            for (const invitation of matchingInvitations) {
                const org = await driver.findOne<Organization>("organization", {
                    id: invitation.organizationId,
                })
                const inviter = await driver.findOne<{
                    id: string
                    email: string
                    name?: string | null
                }>("user", { id: invitation.inviterId })

                if (org && inviter) {
                    withDetails.push({
                        ...invitation,
                        organization: {
                            id: org.id,
                            name: org.name,
                            slug: org.slug,
                            logo: org.logo,
                        },
                        inviter: {
                            id: inviter.id,
                            email: inviter.email,
                            name: inviter.name,
                        },
                    })
                }
            }

            return withDetails
        },

        async createInvitation(data: Omit<Invitation, "id" | "createdAt">): Promise<Invitation> {
            return driver.create<Invitation>("invitation", {
                id: generateId(),
                ...data,
                createdAt: new Date(),
            })
        },

        async updateInvitation(id: string, data: Partial<Invitation>): Promise<Invitation | null> {
            return driver.update<Invitation>("invitation", { id }, data)
        },

        async deleteInvitation(id: string): Promise<void> {
            await driver.delete("invitation", { id })
        },

        async deleteExpiredInvitations(organizationId: string): Promise<void> {
            const invitations = await driver.findMany<Invitation>("invitation", {
                where: { organizationId, status: "pending" },
            })
            const now = new Date()
            for (const inv of invitations) {
                if (new Date(inv.expiresAt) < now) {
                    await driver.delete("invitation", { id: inv.id })
                }
            }
        },

        async countPendingInvitations(organizationId: string): Promise<number> {
            const invitations = await driver.findMany<Invitation>("invitation", {
                where: { organizationId, status: "pending" },
            })
            return invitations.length
        },

        // =====================================================================
        // Team Operations (Optional)
        // =====================================================================

        async findTeamById(id: string): Promise<Team | null> {
            return driver.findOne<Team>("team", { id })
        },

        async findTeamsByOrganizationId(organizationId: string): Promise<Team[]> {
            return driver.findMany<Team>("team", {
                where: { organizationId },
            })
        },

        async findTeamsByUserId(userId: string, organizationId: string): Promise<Team[]> {
            const teamMembers = await driver.findMany<TeamMember>("teamMember", {
                where: { userId },
            })

            const teams: Team[] = []
            for (const tm of teamMembers) {
                const team = await driver.findOne<Team>("team", { id: tm.teamId })
                if (team && team.organizationId === organizationId) {
                    teams.push(team)
                }
            }

            return teams
        },

        async createTeam(data: Omit<Team, "id" | "createdAt">): Promise<Team> {
            const now = new Date()
            return driver.create<Team>("team", {
                id: generateId(),
                ...data,
                createdAt: now,
                updatedAt: now,
            })
        },

        async updateTeam(id: string, data: Partial<Team>): Promise<Team | null> {
            return driver.update<Team>("team", { id }, {
                ...data,
                updatedAt: new Date(),
            })
        },

        async deleteTeam(id: string): Promise<void> {
            // Delete team members first
            const teamMembers = await driver.findMany<TeamMember>("teamMember", {
                where: { teamId: id },
            })
            for (const tm of teamMembers) {
                await driver.delete("teamMember", { id: tm.id })
            }
            // Delete team
            await driver.delete("team", { id })
        },

        async countTeamsByOrganizationId(organizationId: string): Promise<number> {
            const teams = await driver.findMany<Team>("team", {
                where: { organizationId },
            })
            return teams.length
        },

        // =====================================================================
        // Team Member Operations (Optional)
        // =====================================================================

        async findTeamMember(userId: string, teamId: string): Promise<TeamMember | null> {
            return driver.findOne<TeamMember>("teamMember", { userId, teamId })
        },

        async findTeamMembersByTeamId(teamId: string): Promise<TeamMember[]> {
            return driver.findMany<TeamMember>("teamMember", {
                where: { teamId },
            })
        },

        async addTeamMember(data: Omit<TeamMember, "id" | "createdAt">): Promise<TeamMember> {
            return driver.create<TeamMember>("teamMember", {
                id: generateId(),
                ...data,
                createdAt: new Date(),
            })
        },

        async removeTeamMember(userId: string, teamId: string): Promise<void> {
            const tm = await driver.findOne<TeamMember>("teamMember", { userId, teamId })
            if (tm) {
                await driver.delete("teamMember", { id: tm.id })
            }
        },

        async countTeamMembers(teamId: string): Promise<number> {
            const members = await driver.findMany<TeamMember>("teamMember", {
                where: { teamId },
            })
            return members.length
        },
    }
}
