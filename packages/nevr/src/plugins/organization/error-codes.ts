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
    ORGANIZATION_SLUG_ALREADY_EXISTS: "An organization with this slug already exists",
    MAX_ORGANIZATIONS_REACHED: "You have reached the maximum number of organizations",
    USER_NOT_ALLOWED_TO_CREATE_ORGANIZATION: "You are not allowed to create organizations",
    ORGANIZATION_DELETION_DISABLED: "Organization deletion is disabled",
    NOT_ALLOWED_TO_UPDATE_ORGANIZATION: "You do not have permission to update this organization",
    NOT_ALLOWED_TO_DELETE_ORGANIZATION: "You do not have permission to delete this organization",

    // Member errors
    MEMBER_NOT_FOUND: "Member not found",
    USER_ALREADY_A_MEMBER: "User is already a member of this organization",
    USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION: "You are not a member of this organization",
    MAX_MEMBERS_REACHED: "Organization has reached the maximum number of members",
    NOT_ALLOWED_TO_ADD_MEMBER: "You do not have permission to add members",
    NOT_ALLOWED_TO_REMOVE_MEMBER: "You do not have permission to remove members",
    NOT_ALLOWED_TO_UPDATE_MEMBER: "You do not have permission to update member roles",
    CANNOT_REMOVE_OWNER: "Cannot remove the organization owner",
    CANNOT_CHANGE_OWNER_ROLE: "Cannot change the owner's role",
    CANNOT_LEAVE_AS_ONLY_OWNER: "Cannot leave organization as the only owner",

    // Permission errors
    PERMISSION_DENIED: "You do not have permission to perform this action",
    INVALID_ROLE: "Invalid role specified",
    ROLE_NOT_FOUND: "Role not found",

    // Invitation errors
    INVITATION_NOT_FOUND: "Invitation not found",
    INVITATION_EXPIRED: "Invitation has expired",
    INVITATION_NOT_PENDING: "Invitation is not pending",
    INVITATION_EMAIL_MISMATCH: "Invitation email does not match your account",
    INVITATION_ALREADY_PENDING: "An invitation is already pending for this email",
    NOT_ALLOWED_TO_INVITE: "You do not have permission to invite members",
    NOT_ALLOWED_TO_CANCEL_INVITATION: "You do not have permission to cancel invitations",
    NOT_ALLOWED_TO_VIEW_INVITATIONS: "You do not have permission to view invitations",
    MAX_PENDING_INVITATIONS_REACHED: "Maximum pending invitations reached",
    INVITATION_SEND_FAILED: "Failed to send invitation email",
    EMAIL_VERIFICATION_REQUIRED: "Email verification is required",

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
