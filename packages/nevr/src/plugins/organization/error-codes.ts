// =============================================================================
// ORGANIZATION ERROR CODES
// Centralized error codes for organization plugin
// =============================================================================

/**
 * Organization plugin error codes
 */
export const ORGANIZATION_ERROR_CODES = {
    // Organization errors
    ORGANIZATION_NOT_FOUND: "Organization not found",
    ORGANIZATION_SLUG_EXISTS: "An organization with this slug already exists",
    ORGANIZATION_LIMIT_REACHED: "You have reached the maximum number of organizations",
    ORGANIZATION_CREATION_NOT_ALLOWED: "You are not allowed to create organizations",
    ORGANIZATION_DELETION_DISABLED: "Organization deletion is disabled",
    ORGANIZATION_DELETE_FAILED: "Failed to delete organization",

    // Member errors
    MEMBER_NOT_FOUND: "Member not found",
    MEMBER_ALREADY_EXISTS: "User is already a member of this organization",
    MEMBER_LIMIT_REACHED: "Organization has reached the maximum number of members",
    NOT_A_MEMBER: "You are not a member of this organization",
    CANNOT_REMOVE_OWNER: "Cannot remove the organization owner",
    CANNOT_CHANGE_OWNER_ROLE: "Cannot change the owner's role",
    LAST_OWNER: "Cannot remove or change role of the last owner",

    // Permission errors
    PERMISSION_DENIED: "You do not have permission to perform this action",
    INVALID_ROLE: "Invalid role specified",
    ROLE_NOT_FOUND: "Role not found",

    // Invitation errors
    INVITATION_NOT_FOUND: "Invitation not found",
    INVITATION_EXPIRED: "Invitation has expired",
    INVITATION_ALREADY_ACCEPTED: "Invitation has already been accepted",
    INVITATION_ALREADY_REJECTED: "Invitation has already been rejected",
    INVITATION_ALREADY_CANCELED: "Invitation has already been canceled",
    INVITATION_ALREADY_EXISTS: "An invitation has already been sent to this email",
    INVITATION_LIMIT_REACHED: "Maximum pending invitations reached",
    INVITATION_SEND_FAILED: "Failed to send invitation email",
    EMAIL_VERIFICATION_REQUIRED: "Email verification is required to accept invitations",

    // Team errors
    TEAM_NOT_FOUND: "Team not found",
    TEAM_ALREADY_EXISTS: "A team with this name already exists",
    TEAM_LIMIT_REACHED: "Organization has reached the maximum number of teams",
    TEAM_MEMBER_LIMIT_REACHED: "Team has reached the maximum number of members",
    TEAM_MEMBER_NOT_FOUND: "Team member not found",
    TEAM_MEMBER_ALREADY_EXISTS: "User is already a member of this team",
    TEAMS_NOT_ENABLED: "Teams feature is not enabled",

    // Session errors
    NO_ACTIVE_ORGANIZATION: "No active organization selected",
    NO_ACTIVE_TEAM: "No active team selected",

    // General errors
    UNAUTHORIZED: "Authentication required",
    INTERNAL_ERROR: "An internal error occurred",
} as const

export type OrganizationErrorCode = keyof typeof ORGANIZATION_ERROR_CODES
