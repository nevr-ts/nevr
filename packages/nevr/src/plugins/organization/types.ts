// =============================================================================
// ORGANIZATION PLUGIN TYPES
// Multi-tenant organization/workspace support
// Follows better-auth patterns with nevr conventions
// =============================================================================

import type { EndpointContext } from "../unified/endpoint.js"

// =============================================================================
// CORE ENTITIES
// =============================================================================

/**
 * Organization entity
 */
export interface Organization {
    id: string
    name: string
    slug: string
    logo?: string | null
    metadata?: Record<string, unknown> | null
    createdAt: Date
    updatedAt?: Date | null
}

/**
 * Organization member - links users to organizations
 */
export interface Member {
    id: string
    organizationId: string
    userId: string
    role: string // Can be comma-separated for multiple roles
    createdAt: Date
}

/**
 * Member with user data
 */
export interface MemberWithUser extends Member {
    user: {
        id: string
        email: string
        name?: string | null
        image?: string | null
    }
}

/**
 * Invitation status
 */
export type InvitationStatus = "pending" | "accepted" | "rejected" | "canceled"

/**
 * Invitation entity
 */
export interface Invitation {
    id: string
    organizationId: string
    email: string
    role: string
    status: InvitationStatus
    inviterId: string
    teamId?: string | null
    expiresAt: Date
    createdAt: Date
}

/**
 * Invitation with organization and inviter data
 */
export interface InvitationWithDetails extends Invitation {
    organization: Pick<Organization, "id" | "name" | "slug" | "logo">
    inviter: {
        id: string
        email: string
        name?: string | null
    }
}

/**
 * Team entity (optional feature)
 */
export interface Team {
    id: string
    name: string
    organizationId: string
    createdAt: Date
    updatedAt?: Date | null
}

/**
 * Team member - links users to teams
 */
export interface TeamMember {
    id: string
    teamId: string
    userId: string
    createdAt: Date
}

// =============================================================================
// ROLES & PERMISSIONS
// =============================================================================

/**
 * Permission actions
 */
export type PermissionAction = "create" | "read" | "update" | "delete"

/**
 * Permission resources
 */
export type PermissionResource =
    | "organization"
    | "member"
    | "invitation"
    | "team"

/**
 * Permission definition
 */
export type Permission = {
    [K in PermissionResource]?: PermissionAction[]
}

/**
 * Role definition with permissions
 */
export interface RoleDefinition {
    /** Role display name */
    name?: string
    /** Role description */
    description?: string
    /** Permissions for this role */
    permissions: Permission
}

/**
 * Built-in role names
 */
export type BuiltinRole = "owner" | "admin" | "member"

/**
 * Default roles configuration
 */
export const DEFAULT_ROLES: Record<BuiltinRole, RoleDefinition> = {
    owner: {
        name: "Owner",
        description: "Full access to everything",
        permissions: {
            organization: ["create", "read", "update", "delete"],
            member: ["create", "read", "update", "delete"],
            invitation: ["create", "read", "update", "delete"],
            team: ["create", "read", "update", "delete"],
        },
    },
    admin: {
        name: "Admin",
        description: "Can manage members and teams",
        permissions: {
            organization: ["read", "update"],
            member: ["create", "read", "update", "delete"],
            invitation: ["create", "read", "update", "delete"],
            team: ["create", "read", "update", "delete"],
        },
    },
    member: {
        name: "Member",
        description: "Basic access",
        permissions: {
            organization: ["read"],
            member: ["read"],
            invitation: ["read"],
            team: ["read"],
        },
    },
}

// =============================================================================
// PLUGIN OPTIONS
// =============================================================================

/**
 * Teams configuration
 */
export interface TeamsOptions {
    /** Enable teams feature */
    enabled: boolean
    /** Maximum teams per organization */
    maxTeams?: number | ((data: { organizationId: string }) => Promise<number>)
    /** Maximum members per team */
    maxMembersPerTeam?: number | ((data: { teamId: string }) => Promise<number>)
    /** Create default team on organization creation */
    createDefaultTeam?: boolean
    /** Custom default team creator */
    customDefaultTeam?: (organization: Organization) => Promise<{ name: string }>
}

/**
 * Invitation configuration
 */
export interface InvitationOptions {
    /** Invitation expiration in seconds (default: 48 hours) */
    expiresIn?: number
    /** Maximum pending invitations per organization */
    maxPending?: number | ((data: { organizationId: string }, ctx: EndpointContext) => Promise<number>)
    /** Cancel pending invitations when re-inviting same email */
    cancelOnReInvite?: boolean
    /** Require email verification before accepting invitation */
    requireEmailVerification?: boolean
    /** Custom email sender */
    sendEmail?: (data: InvitationEmailData) => Promise<void>
}

/**
 * Data passed to invitation email sender
 */
export interface InvitationEmailData {
    invitation: Invitation
    organization: Pick<Organization, "id" | "name" | "slug" | "logo">
    inviter: { id: string; email: string; name?: string | null }
    invitee: { email: string }
    acceptUrl: string
    expiresAt: Date
}

/**
 * Organization plugin options
 */
export interface OrganizationPluginOptions {
    /** Allow users to create organizations */
    allowUserToCreate?: boolean | ((user: any) => Promise<boolean>)

    /** Maximum organizations per user */
    maxOrgsPerUser?: number | ((user: any) => Promise<number>)

    /** Maximum members per organization */
    maxMembersPerOrg?: number | ((organizationId: string) => Promise<number>)

    /** Role assigned to organization creator */
    creatorRole?: string

    /** Custom roles definition */
    roles?: Record<string, RoleDefinition>

    /** Teams configuration */
    teams?: TeamsOptions | { enabled: false }

    /** Invitation configuration */
    invitation?: InvitationOptions

    /** Base URL for invitation links */
    invitationBaseUrl?: string

    /** Disable organization deletion */
    disableDeletion?: boolean

    /** Slug generator function */
    generateSlug?: (name: string) => string | Promise<string>

    /** Hooks for organization lifecycle */
    hooks?: OrganizationHooks
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook context with organization data
 */
export interface OrgHookContext extends EndpointContext {
    organization?: Organization
    member?: Member
}

/**
 * Organization lifecycle hooks
 */
export interface OrganizationHooks {
    // Organization hooks
    beforeCreate?: (data: { name: string; slug: string; userId: string }, ctx: EndpointContext) => Promise<{ data?: Partial<Organization> } | void>
    afterCreate?: (data: { organization: Organization; member: Member }, ctx: EndpointContext) => Promise<void>

    beforeUpdate?: (data: { organization: Organization; updates: Partial<Organization> }, ctx: EndpointContext) => Promise<{ data?: Partial<Organization> } | void>
    afterUpdate?: (data: { organization: Organization }, ctx: EndpointContext) => Promise<void>

    beforeDelete?: (data: { organization: Organization }, ctx: EndpointContext) => Promise<void>
    afterDelete?: (data: { organization: Organization }, ctx: EndpointContext) => Promise<void>

    // Member hooks
    beforeAddMember?: (data: { organization: Organization; userId: string; role: string }, ctx: EndpointContext) => Promise<{ data?: { role?: string } } | void>
    afterAddMember?: (data: { organization: Organization; member: Member }, ctx: EndpointContext) => Promise<void>

    beforeRemoveMember?: (data: { organization: Organization; member: Member }, ctx: EndpointContext) => Promise<void>
    afterRemoveMember?: (data: { organization: Organization; member: Member }, ctx: EndpointContext) => Promise<void>

    beforeUpdateMemberRole?: (data: { organization: Organization; member: Member; newRole: string }, ctx: EndpointContext) => Promise<{ data?: { role?: string } } | void>
    afterUpdateMemberRole?: (data: { organization: Organization; member: Member }, ctx: EndpointContext) => Promise<void>

    // Invitation hooks
    beforeInvite?: (data: { organization: Organization; email: string; role: string }, ctx: EndpointContext) => Promise<{ data?: { role?: string } } | void>
    afterInvite?: (data: { organization: Organization; invitation: Invitation }, ctx: EndpointContext) => Promise<void>

    beforeAcceptInvitation?: (data: { invitation: Invitation; user: any }, ctx: EndpointContext) => Promise<void>
    afterAcceptInvitation?: (data: { invitation: Invitation; member: Member }, ctx: EndpointContext) => Promise<void>

    beforeRejectInvitation?: (data: { invitation: Invitation }, ctx: EndpointContext) => Promise<void>
    afterRejectInvitation?: (data: { invitation: Invitation }, ctx: EndpointContext) => Promise<void>

    beforeCancelInvitation?: (data: { invitation: Invitation }, ctx: EndpointContext) => Promise<void>
    afterCancelInvitation?: (data: { invitation: Invitation }, ctx: EndpointContext) => Promise<void>

    // Team hooks
    beforeCreateTeam?: (data: { organization: Organization; name: string }, ctx: EndpointContext) => Promise<{ data?: { name?: string } } | void>
    afterCreateTeam?: (data: { organization: Organization; team: Team }, ctx: EndpointContext) => Promise<void>

    beforeDeleteTeam?: (data: { organization: Organization; team: Team }, ctx: EndpointContext) => Promise<void>
    afterDeleteTeam?: (data: { organization: Organization; team: Team }, ctx: EndpointContext) => Promise<void>
}

// =============================================================================
// ADAPTER INTERFACE
// =============================================================================

/**
 * Organization adapter for database operations
 */
export interface OrganizationAdapter {
    // Organization operations
    findOrganizationById(id: string): Promise<Organization | null>
    findOrganizationBySlug(slug: string): Promise<Organization | null>
    findOrganizationsByUserId(userId: string): Promise<Organization[]>
    createOrganization(data: Omit<Organization, "id" | "createdAt">): Promise<Organization>
    updateOrganization(id: string, data: Partial<Organization>): Promise<Organization | null>
    deleteOrganization(id: string): Promise<void>

    // Member operations
    findMemberById(id: string): Promise<Member | null>
    findMemberByUserAndOrg(userId: string, organizationId: string): Promise<Member | null>
    findMembersByOrganizationId(organizationId: string, options?: ListOptions): Promise<MemberWithUser[]>
    findMembersByUserId(userId: string): Promise<Member[]>
    createMember(data: Omit<Member, "id" | "createdAt">): Promise<Member>
    updateMember(id: string, data: Partial<Member>): Promise<Member | null>
    deleteMember(id: string): Promise<void>
    deleteMembersByOrganizationId(organizationId: string): Promise<void>
    countMembersByOrganizationId(organizationId: string): Promise<number>

    // Invitation operations
    findInvitationById(id: string): Promise<Invitation | null>
    findInvitationByEmailAndOrg(email: string, organizationId: string): Promise<Invitation | null>
    findInvitationsByOrganizationId(organizationId: string, options?: ListOptions): Promise<Invitation[]>
    findInvitationsByEmail(email: string): Promise<InvitationWithDetails[]>
    createInvitation(data: Omit<Invitation, "id" | "createdAt">): Promise<Invitation>
    updateInvitation(id: string, data: Partial<Invitation>): Promise<Invitation | null>
    deleteInvitation(id: string): Promise<void>
    deleteExpiredInvitations(organizationId: string): Promise<void>
    countPendingInvitations(organizationId: string): Promise<number>

    // Team operations (optional)
    findTeamById?(id: string): Promise<Team | null>
    findTeamsByOrganizationId?(organizationId: string): Promise<Team[]>
    findTeamsByUserId?(userId: string, organizationId: string): Promise<Team[]>
    createTeam?(data: Omit<Team, "id" | "createdAt">): Promise<Team>
    updateTeam?(id: string, data: Partial<Team>): Promise<Team | null>
    deleteTeam?(id: string): Promise<void>
    countTeamsByOrganizationId?(organizationId: string): Promise<number>

    // Team member operations (optional)
    findTeamMember?(userId: string, teamId: string): Promise<TeamMember | null>
    findTeamMembersByTeamId?(teamId: string): Promise<TeamMember[]>
    addTeamMember?(data: Omit<TeamMember, "id" | "createdAt">): Promise<TeamMember>
    removeTeamMember?(userId: string, teamId: string): Promise<void>
    countTeamMembers?(teamId: string): Promise<number>
}

/**
 * List options for pagination and filtering
 */
export interface ListOptions {
    /** Alias for take */
    limit?: number
    /** Alias for skip */
    offset?: number
    /** Number of records to take */
    take?: number
    /** Number of records to skip */
    skip?: number
    sortBy?: string
    sortOrder?: "asc" | "desc"
    filter?: Record<string, unknown>
}

// =============================================================================
// ROUTE CONFIG
// =============================================================================

/**
 * Route configuration passed to endpoint handlers
 */
export interface OrganizationRouteConfig {
    options: Required<Pick<OrganizationPluginOptions, "creatorRole">> & OrganizationPluginOptions
    getAdapter: () => OrganizationAdapter
    getRoles: () => Record<string, RoleDefinition>
    hasPermission: (member: Member, resource: PermissionResource, action: PermissionAction) => boolean
}

// =============================================================================
// SESSION EXTENSION
// =============================================================================

/**
 * Session extension for organization
 */
export interface OrganizationSession {
    activeOrganizationId?: string | null
    activeTeamId?: string | null
}

// =============================================================================
// CLIENT TYPES
// =============================================================================

/**
 * Organization create input
 */
export interface CreateOrganizationInput {
    name: string
    slug?: string
    logo?: string
    metadata?: Record<string, unknown>
}

/**
 * Organization update input
 */
export interface UpdateOrganizationInput {
    name?: string
    slug?: string
    logo?: string | null
    metadata?: Record<string, unknown>
}

/**
 * Invite member input
 */
export interface InviteMemberInput {
    email: string
    role?: string
    teamId?: string
}

/**
 * Full organization with members and invitations
 */
export interface FullOrganization extends Organization {
    members: MemberWithUser[]
    invitations: Invitation[]
    teams?: Team[]
}
