// =============================================================================
// ORGANIZATION ROUTES INDEX
// Export all organization API routes
// =============================================================================

// Organization CRUD
export {
    createOrganization,
    updateOrganization,
    deleteOrganization,
    setActiveOrganization,
    getFullOrganization,
    listOrganizations,
    checkOrganizationSlug,
    createOrgMiddleware,
} from "./crud-org.js"

// Member management
export {
    addMember,
    removeMember,
    updateMemberRole,
    getActiveMember,
    getActiveMemberRole,
    listMembers,
    leaveOrganization,
} from "./crud-members.js"

// Invitation management
export {
    createInvitation,
    acceptInvitation,
    rejectInvitation,
    cancelInvitation,
    getInvitation,
    listInvitations,
    listUserInvitations,
} from "./crud-invites.js"

// Team management
export {
    createTeam,
    removeTeam,
    updateTeam,
    listOrganizationTeams,
    setActiveTeam,
    listUserTeams,
    listTeamMembers,
    addTeamMember,
    removeTeamMember,
} from "./crud-team.js"

// Access control
export {
    createOrgRole,
    deleteOrgRole,
    listOrgRoles,
    getOrgRole,
    updateOrgRole,
    hasPermissionEndpoint,
} from "./crud-access-control.js"
