// =============================================================================
// ORGANIZATION PLUGIN SCHEMA
// Entity definitions for multi-tenant organization support
// =============================================================================

import { string, datetime, json } from "../../index.js"
import type { PluginSchema } from "../unified/types.js"

// -----------------------------------------------------------------------------
// Schema Options
// -----------------------------------------------------------------------------

export interface OrganizationSchemaOptions {
    /** Enable teams feature */
    teams?: boolean
}

// -----------------------------------------------------------------------------
// Schema Export
// -----------------------------------------------------------------------------

/**
 * Get the organization plugin schema
 *
 * Entities:
 * - organization: Core organization/workspace entity
 * - member: Links users to organizations with roles
 * - invitation: Pending invitations to join organizations
 * - team (optional): Sub-groups within organizations
 * - teamMember (optional): Links users to teams
 *
 * Session extensions:
 * - activeOrganizationId: Currently active organization
 * - activeTeamId: Currently active team (if teams enabled)
 */
export function getOrganizationSchema(options?: OrganizationSchemaOptions): PluginSchema {
    const enableTeams = options?.teams === true

    const schema: PluginSchema = {
        // Extend session with active organization tracking
        extend: {
            session: {
                activeOrganizationId: string.optional().label("Active Organization ID"),
                ...(enableTeams ? {
                    activeTeamId: string.optional().label("Active Team ID"),
                } : {}),
            },
        },

        entities: {
            // -----------------------------------------------------------------
            // Organization Entity
            // -----------------------------------------------------------------
            organization: {
                description: "Organization or workspace for multi-tenant support",
                internal: true, // Managed by organization plugin endpoints
                fields: {
                    name: string.label("Organization Name"),
                    slug: string.unique().label("URL Slug"),
                    logo: string.optional().label("Logo URL"),
                    metadata: json.optional().label("Custom Metadata"),
                },
            },

            // -----------------------------------------------------------------
            // Member Entity
            // -----------------------------------------------------------------
            member: {
                description: "Organization membership linking users to organizations",
                internal: true, // Managed by organization plugin endpoints
                fields: {
                    organizationId: string.label("Organization ID"),
                    userId: string.label("User ID"),
                    role: string.default("member").label("Role"),
                },
            },

            // -----------------------------------------------------------------
            // Invitation Entity
            // -----------------------------------------------------------------
            invitation: {
                description: "Pending invitation to join an organization",
                internal: true, // Managed by organization plugin endpoints
                fields: {
                    organizationId: string.label("Organization ID"),
                    email: string.label("Invitee Email"),
                    role: string.default("member").label("Invited Role"),
                    status: string
                        .options(["pending", "accepted", "rejected", "canceled"])
                        .default("pending")
                        .label("Status"),
                    inviterId: string.label("Inviter User ID"),
                    teamId: string.optional().label("Team ID"),
                    expiresAt: datetime.label("Expiration Date"),
                },
            },
        },
    }

    // Add team entities if enabled
    if (enableTeams && schema.entities) {
        schema.entities.team = {
            description: "Team within an organization",
            internal: true,
            fields: {
                name: string.label("Team Name"),
                organizationId: string.label("Organization ID"),
            },
        }

        schema.entities.teamMember = {
            description: "Team membership linking users to teams",
            internal: true,
            fields: {
                teamId: string.label("Team ID"),
                userId: string.label("User ID"),
            },
        }
    }

    return schema
}

// -----------------------------------------------------------------------------
// Default Export
// -----------------------------------------------------------------------------

export default getOrganizationSchema
