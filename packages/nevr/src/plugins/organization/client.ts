// =============================================================================
// ORGANIZATION CLIENT
// Client-side helpers for organization management
// =============================================================================

import type {
    Organization,
    Member,
    MemberWithUser,
    Invitation,
    InvitationWithDetails,
    Team,
    FullOrganization,
    CreateOrganizationInput,
    UpdateOrganizationInput,
    InviteMemberInput,
} from "./types.js"

// =============================================================================
// CLIENT OPTIONS
// =============================================================================

export interface OrganizationClientOptions {
    /** Base URL for API calls */
    baseUrl?: string
    /** Custom fetch function */
    fetch?: typeof fetch
    /** Get auth token */
    getToken?: () => string | Promise<string> | null
}

// =============================================================================
// CLIENT METHODS
// =============================================================================

export interface OrganizationClientMethods {
    // Organization CRUD
    create(data: CreateOrganizationInput): Promise<{ organization: Organization; member: Member }>
    update(organizationId: string, data: UpdateOrganizationInput): Promise<Organization>
    delete(organizationId: string): Promise<void>
    get(organizationId: string): Promise<FullOrganization>
    list(): Promise<Organization[]>
    checkSlug(slug: string): Promise<{ available: boolean }>

    // Active organization
    setActive(organizationId: string): Promise<void>
    getActive(): Promise<Organization | null>

    // Members
    listMembers(organizationId: string): Promise<MemberWithUser[]>
    addMember(organizationId: string, userId: string, role?: string): Promise<Member>
    removeMember(organizationId: string, memberId: string): Promise<void>
    updateMemberRole(organizationId: string, memberId: string, role: string): Promise<Member>
    leave(organizationId: string): Promise<void>
    getMyMembership(organizationId: string): Promise<Member | null>

    // Invitations
    invite(organizationId: string, data: InviteMemberInput): Promise<Invitation>
    cancelInvitation(invitationId: string): Promise<void>
    listInvitations(organizationId: string): Promise<Invitation[]>
    getMyInvitations(): Promise<InvitationWithDetails[]>
    acceptInvitation(invitationId: string): Promise<{ organization: Organization; member: Member }>
    rejectInvitation(invitationId: string): Promise<void>

    // Teams (if enabled)
    createTeam(organizationId: string, name: string): Promise<Team>
    updateTeam(teamId: string, name: string): Promise<Team>
    deleteTeam(teamId: string): Promise<void>
    listTeams(organizationId: string): Promise<Team[]>
    addTeamMember(teamId: string, userId: string): Promise<void>
    removeTeamMember(teamId: string, userId: string): Promise<void>
    setActiveTeam(teamId: string): Promise<void>

    // Permissions
    hasPermission(permission: Record<string, string[]>, organizationId?: string): Promise<boolean>
}

// =============================================================================
// CLIENT FACTORY
// =============================================================================

/**
 * Create organization client for frontend usage
 *
 * @example
 * ```typescript
 * import { organizationClient } from "nevr/plugins/organization"
 *
 * const org = organizationClient({
 *   getToken: () => localStorage.getItem("token"),
 * })
 *
 * // Create organization
 * const { organization } = await org.create({ name: "My Workspace" })
 *
 * // List my organizations
 * const orgs = await org.list()
 *
 * // Invite member
 * await org.invite(orgId, { email: "user@example.com", role: "member" })
 *
 * // Check permission
 * const canDelete = await org.hasPermission({ organization: ["delete"] })
 * ```
 */
export function organizationClient(options: OrganizationClientOptions = {}): OrganizationClientMethods {
    const baseUrl = options.baseUrl || (typeof window !== "undefined" ? window.location.origin : "")
    const fetchFn = options.fetch || fetch

    async function request<T>(
        method: string,
        path: string,
        body?: Record<string, unknown>
    ): Promise<T> {
        const url = `${baseUrl}/organization${path}`
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        }

        if (options.getToken) {
            const token = await options.getToken()
            if (token) {
                headers["Authorization"] = `Bearer ${token}`
            }
        }

        const response = await fetchFn(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            credentials: "include",
        })

        const data = await response.json()

        if (!response.ok) {
            const error = new Error(data.message || "Request failed") as any
            error.code = data.error || data.code
            error.status = response.status
            error.data = data
            throw error
        }

        return data
    }

    return {
        // =================================================================
        // Organization CRUD
        // =================================================================

        async create(data) {
            return request("POST", "/create", data as unknown as Record<string, unknown>)
        },

        async update(organizationId, data) {
            return request("POST", "/update", { organizationId, ...data })
        },

        async delete(organizationId) {
            return request("POST", "/delete", { organizationId })
        },

        async get(organizationId) {
            return request("GET", `/get?organizationId=${organizationId}`)
        },

        async list() {
            return request("GET", "/list")
        },

        async checkSlug(slug) {
            return request("GET", `/check-slug?slug=${encodeURIComponent(slug)}`)
        },

        // =================================================================
        // Active Organization
        // =================================================================

        async setActive(organizationId) {
            return request("POST", "/set-active", { organizationId })
        },

        async getActive() {
            return request("GET", "/active")
        },

        // =================================================================
        // Members
        // =================================================================

        async listMembers(organizationId) {
            return request("GET", `/members?organizationId=${organizationId}`)
        },

        async addMember(organizationId, userId, role = "member") {
            return request("POST", "/add-member", { organizationId, userId, role })
        },

        async removeMember(organizationId, memberId) {
            return request("POST", "/remove-member", { organizationId, memberId })
        },

        async updateMemberRole(organizationId, memberId, role) {
            return request("POST", "/update-member-role", { organizationId, memberId, role })
        },

        async leave(organizationId) {
            return request("POST", "/leave", { organizationId })
        },

        async getMyMembership(organizationId) {
            return request("GET", `/my-membership?organizationId=${organizationId}`)
        },

        // =================================================================
        // Invitations
        // =================================================================

        async invite(organizationId, data) {
            return request("POST", "/invite", { organizationId, ...data })
        },

        async cancelInvitation(invitationId) {
            return request("POST", "/cancel-invitation", { invitationId })
        },

        async listInvitations(organizationId) {
            return request("GET", `/invitations?organizationId=${organizationId}`)
        },

        async getMyInvitations() {
            return request("GET", "/my-invitations")
        },

        async acceptInvitation(invitationId) {
            return request("POST", "/accept-invitation", { invitationId })
        },

        async rejectInvitation(invitationId) {
            return request("POST", "/reject-invitation", { invitationId })
        },

        // =================================================================
        // Teams
        // =================================================================

        async createTeam(organizationId, name) {
            return request("POST", "/create-team", { organizationId, name })
        },

        async updateTeam(teamId, name) {
            return request("POST", "/update-team", { teamId, name })
        },

        async deleteTeam(teamId) {
            return request("POST", "/delete-team", { teamId })
        },

        async listTeams(organizationId) {
            return request("GET", `/teams?organizationId=${organizationId}`)
        },

        async addTeamMember(teamId, userId) {
            return request("POST", "/add-team-member", { teamId, userId })
        },

        async removeTeamMember(teamId, userId) {
            return request("POST", "/remove-team-member", { teamId, userId })
        },

        async setActiveTeam(teamId) {
            return request("POST", "/set-active-team", { teamId })
        },

        // =================================================================
        // Permissions
        // =================================================================

        async hasPermission(permission, organizationId) {
            return request("POST", "/has-permission", { permission, organizationId })
        },
    }
}

// =============================================================================
// REACT HOOK TYPES
// =============================================================================

export interface UseOrganizationResult {
    organization: Organization | null
    organizations: Organization[]
    members: MemberWithUser[]
    myMembership: Member | null
    isLoading: boolean
    error: Error | null

    // Actions
    create: OrganizationClientMethods["create"]
    update: OrganizationClientMethods["update"]
    delete: OrganizationClientMethods["delete"]
    setActive: OrganizationClientMethods["setActive"]
    invite: OrganizationClientMethods["invite"]
    leave: OrganizationClientMethods["leave"]
    hasPermission: OrganizationClientMethods["hasPermission"]

    // Refresh
    refresh: () => Promise<void>
}

export default organizationClient
