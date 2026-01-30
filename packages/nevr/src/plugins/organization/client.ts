// =============================================================================
// ORGANIZATION CLIENT PLUGIN
// Client-side organization management with reactive state
// Follows auth plugin pattern for SDK type inference
// =============================================================================

import { atom, type WritableAtom } from "nanostores"
import type {
    NevrClientPlugin,
    NevrFetch,
    NevrFetchResponse,
    NevrFetchError,
    ClientStore,
    ClientAtomListener,
} from "../../client/types.js"
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
    RoleDefinition,
} from "./types.js"
import { ORGANIZATION_ERROR_CODES } from "./error-codes.js"

// =============================================================================
// STATE TYPES
// =============================================================================

/**
 * Active organization state
 */
export interface OrganizationState {
    /** Currently active organization */
    organization: Organization | null
    /** Current user's membership in active org */
    member: Member | null
    /** Error if any */
    error: NevrFetchError | null
    /** Loading state */
    isPending: boolean
}

/**
 * Organizations list state
 */
export interface OrganizationsState {
    /** List of user's organizations */
    data: Organization[]
    /** Error if any */
    error: NevrFetchError | null
    /** Loading state */
    isPending: boolean
}

// =============================================================================
// CLIENT OPTIONS
// =============================================================================

export interface OrganizationClientOptions {
    /** Base path for organization endpoints (default: /organization) */
    basePath?: string
    /** Auto-refresh active org on window focus */
    refreshOnWindowFocus?: boolean
    /** Storage for persisting active org ID */
    storage?: Storage | null
    /** Storage key */
    storageKey?: string
}

// =============================================================================
// CLIENT METHODS
// =============================================================================

/**
 * Organization methods (inside org namespace)
 */
export interface OrgMethods {
    // Organization CRUD
    create(data: CreateOrganizationInput): Promise<NevrFetchResponse<{ organization: Organization; member: Member }>>
    update(organizationId: string, data: UpdateOrganizationInput): Promise<NevrFetchResponse<Organization>>
    delete(organizationId: string): Promise<NevrFetchResponse<{ success: boolean }>>
    get(organizationId: string): Promise<NevrFetchResponse<FullOrganization>>
    list(): Promise<NevrFetchResponse<Organization[]>>
    checkSlug(slug: string): Promise<NevrFetchResponse<{ available: boolean }>>

    // Active organization
    setActive(organizationId: string | null): Promise<NevrFetchResponse<{ organization: Organization | null; member: Member | null }>>
    getActive(): Promise<NevrFetchResponse<{ organization: Organization | null; member: Member | null }>>

    // Members
    listMembers(organizationId: string): Promise<NevrFetchResponse<MemberWithUser[]>>
    addMember(data: { organizationId: string; userId: string; role?: string }): Promise<NevrFetchResponse<Member>>
    removeMember(data: { organizationId: string; memberId: string }): Promise<NevrFetchResponse<{ success: boolean }>>
    updateMemberRole(data: { organizationId: string; memberId: string; role: string }): Promise<NevrFetchResponse<Member>>
    leave(organizationId: string): Promise<NevrFetchResponse<{ success: boolean }>>
    getMyMembership(organizationId: string): Promise<NevrFetchResponse<Member | null>>
    getMyRole(organizationId?: string): Promise<NevrFetchResponse<{ role: string; permissions: RoleDefinition["permissions"] }>>

    // Invitations
    invite(data: { organizationId: string } & InviteMemberInput): Promise<NevrFetchResponse<Invitation>>
    cancelInvitation(invitationId: string): Promise<NevrFetchResponse<{ success: boolean }>>
    listInvitations(organizationId: string): Promise<NevrFetchResponse<Invitation[]>>
    getMyInvitations(): Promise<NevrFetchResponse<InvitationWithDetails[]>>
    acceptInvitation(invitationId: string): Promise<NevrFetchResponse<{ organization: Organization; member: Member }>>
    rejectInvitation(invitationId: string): Promise<NevrFetchResponse<{ success: boolean }>>

    // Teams (if enabled)
    createTeam(data: { organizationId: string; name: string }): Promise<NevrFetchResponse<Team>>
    updateTeam(data: { teamId: string; name: string }): Promise<NevrFetchResponse<Team>>
    deleteTeam(teamId: string): Promise<NevrFetchResponse<{ success: boolean }>>
    listTeams(organizationId: string): Promise<NevrFetchResponse<Team[]>>
    addTeamMember(data: { teamId: string; userId: string }): Promise<NevrFetchResponse<{ success: boolean }>>
    removeTeamMember(data: { teamId: string; userId: string }): Promise<NevrFetchResponse<{ success: boolean }>>
    setActiveTeam(teamId: string | null): Promise<NevrFetchResponse<{ success: boolean }>>

    // Permissions
    hasPermission(data: { permission: Record<string, string[]>; organizationId?: string }): Promise<NevrFetchResponse<{ allowed: boolean }>>

    // Roles
    listRoles(organizationId: string): Promise<NevrFetchResponse<Array<{ id: string; name: string; permissions: RoleDefinition["permissions"] }>>>
    createRole(data: { organizationId: string; name: string; permissions: RoleDefinition["permissions"] }): Promise<NevrFetchResponse<{ id: string; name: string }>>
    updateRole(data: { roleId: string; name?: string; permissions?: RoleDefinition["permissions"] }): Promise<NevrFetchResponse<{ success: boolean }>>
    deleteRole(roleId: string): Promise<NevrFetchResponse<{ success: boolean }>>
}

/**
 * Organization client methods - namespaced under `client.org.*`
 */
export interface OrganizationClientMethods {
    org: OrgMethods
}

// =============================================================================
// CLIENT PLUGIN TYPE
// =============================================================================

/**
 * Organization client plugin type with server inference
 */
export type OrganizationClientPlugin = NevrClientPlugin & {
    /**
     * Type-only property for SDK type inference
     */
    readonly $InferTypes: {
        endpoints: OrganizationClientMethods
        $ERROR_CODES: typeof ORGANIZATION_ERROR_CODES
        Organization: Organization
        Member: Member
        Team: Team
        Invitation: Invitation
        RoleDefinition: RoleDefinition
    }
    readonly $InferActions: OrganizationClientMethods
}

// =============================================================================
// ATOMS
// =============================================================================

function createOrganizationAtom(): WritableAtom<OrganizationState> {
    return atom<OrganizationState>({
        organization: null,
        member: null,
        error: null,
        isPending: true,
    })
}

function createOrganizationsAtom(): WritableAtom<OrganizationsState> {
    return atom<OrganizationsState>({
        data: [],
        error: null,
        isPending: true,
    })
}

// =============================================================================
// CLIENT PLUGIN FACTORY
// =============================================================================

/**
 * Create organization client plugin for frontend usage
 *
 * @example
 * ```typescript
 * import { createClient } from "nevr/client"
 * import { organizationClient } from "nevr/plugins/organization/client"
 *
 * const client = createClient({
 *   baseURL: "http://localhost:3000",
 *   plugins: [organizationClient()]
 * })
 *
 * // Create organization
 * const { data, error } = await client.organization.create({
 *   name: "My Workspace"
 * })
 *
 * // Reactive state
 * client.$store.atoms.activeOrganization.subscribe(({ organization }) => {
 *   console.log("Active org:", organization?.name)
 * })
 *
 * // Set active organization
 * await client.organization.setActive(orgId)
 * ```
 */
export function organizationClient(options?: OrganizationClientOptions): OrganizationClientPlugin {
    const basePath = options?.basePath || "/organization"
    const refreshOnWindowFocus = options?.refreshOnWindowFocus !== false
    const storageKey = options?.storageKey || "nevr.organization.activeId"

    // Atoms
    let $activeOrganization: WritableAtom<OrganizationState>
    let $organizations: WritableAtom<OrganizationsState>
    let $orgSignal: WritableAtom<boolean>

    return {
        id: "organization-client",

        /**
         * Path methods for endpoint proxy
         */
        pathMethods: {
            // Organization CRUD
            [`${basePath}/create-organization`]: "POST",
            [`${basePath}/update-organization`]: "POST",
            [`${basePath}/delete-organization`]: "POST",
            [`${basePath}/get-full-organization`]: "GET",
            [`${basePath}/list-organizations`]: "GET",
            [`${basePath}/check-organization-slug`]: "GET",
            [`${basePath}/set-active-organization`]: "POST",
            [`${basePath}/get-active-member`]: "GET",
            [`${basePath}/get-active-member-role`]: "GET",
            // Members
            [`${basePath}/add-member`]: "POST",
            [`${basePath}/remove-member`]: "POST",
            [`${basePath}/update-member-role`]: "POST",
            [`${basePath}/list-members`]: "GET",
            [`${basePath}/leave-organization`]: "POST",
            // Invitations
            [`${basePath}/create-invitation`]: "POST",
            [`${basePath}/accept-invitation`]: "POST",
            [`${basePath}/reject-invitation`]: "POST",
            [`${basePath}/cancel-invitation`]: "POST",
            [`${basePath}/get-invitation`]: "GET",
            [`${basePath}/list-invitations`]: "GET",
            [`${basePath}/list-user-invitations`]: "GET",
            // Teams
            [`${basePath}/create-team`]: "POST",
            [`${basePath}/remove-team`]: "POST",
            [`${basePath}/update-team`]: "POST",
            [`${basePath}/list-organization-teams`]: "GET",
            [`${basePath}/set-active-team`]: "POST",
            [`${basePath}/list-user-teams`]: "GET",
            [`${basePath}/list-team-members`]: "GET",
            [`${basePath}/add-team-member`]: "POST",
            [`${basePath}/remove-team-member`]: "POST",
            // Access control
            [`${basePath}/create-org-role`]: "POST",
            [`${basePath}/delete-org-role`]: "POST",
            [`${basePath}/list-org-roles`]: "GET",
            [`${basePath}/get-org-role`]: "GET",
            [`${basePath}/update-org-role`]: "POST",
            [`${basePath}/has-permission`]: "POST",
        },

        /**
         * Get reactive atoms
         */
        getAtoms($fetch: NevrFetch) {
            $activeOrganization = createOrganizationAtom()
            $organizations = createOrganizationsAtom()
            $orgSignal = atom<boolean>(false)

            // Initial fetch
            fetchActiveOrganization($fetch)
            fetchOrganizations($fetch)

            // Window focus refresh
            if (refreshOnWindowFocus && typeof window !== "undefined") {
                window.addEventListener("focus", () => {
                    fetchActiveOrganization($fetch)
                })
            }

            // Storage sync
            if (typeof window !== "undefined" && options?.storage !== null) {
                window.addEventListener("storage", (event) => {
                    if (event.key === storageKey) {
                        fetchActiveOrganization($fetch)
                    }
                })
            }

            return {
                activeOrganization: $activeOrganization,
                organizations: $organizations,
                $orgSignal,
            }

            async function fetchActiveOrganization(fetch: NevrFetch) {
                $activeOrganization.set({ ...$activeOrganization.get(), isPending: true })

                try {
                    const result = await fetch(`${basePath}/get-active-member`, { method: "GET" })

                    if (result.error) {
                        $activeOrganization.set({
                            organization: null,
                            member: null,
                            error: result.error,
                            isPending: false,
                        })
                    } else {
                        const data = result.data as { organization: Organization | null; member: Member | null } | null
                        $activeOrganization.set({
                            organization: data?.organization || null,
                            member: data?.member || null,
                            error: null,
                            isPending: false,
                        })
                    }
                } catch (error) {
                    $activeOrganization.set({
                        organization: null,
                        member: null,
                        error: error as any,
                        isPending: false,
                    })
                }
            }

            async function fetchOrganizations(fetch: NevrFetch) {
                $organizations.set({ ...$organizations.get(), isPending: true })

                try {
                    const result = await fetch(`${basePath}/list-organizations`, { method: "GET" })

                    if (result.error) {
                        $organizations.set({
                            data: [],
                            error: result.error,
                            isPending: false,
                        })
                    } else {
                        $organizations.set({
                            data: (result.data as Organization[]) || [],
                            error: null,
                            isPending: false,
                        })
                    }
                } catch (error) {
                    $organizations.set({
                        data: [],
                        error: error as any,
                        isPending: false,
                    })
                }
            }
        },

        /**
         * Atom listeners for triggering refreshes
         */
        atomListeners: [
            {
                matcher: (path: string) => {
                    return (
                        path === `${basePath}/create-organization` ||
                        path === `${basePath}/set-active-organization` ||
                        path === `${basePath}/leave-organization` ||
                        path === `${basePath}/accept-invitation`
                    )
                },
                signal: "$orgSignal",
            },
        ] as ClientAtomListener[],

        /**
         * Get action methods
         */
        getActions($fetch: NevrFetch, $store: ClientStore) {
            // Helper to update active org state
            const updateActiveOrg = async () => {
                if ($activeOrganization) {
                    $activeOrganization.set({ ...$activeOrganization.get(), isPending: true })
                    try {
                        const result = await $fetch(`${basePath}/get-active-member`, { method: "GET" })
                        const data = result.data as { organization: Organization | null; member: Member | null } | null
                        $activeOrganization.set({
                            organization: data?.organization || null,
                            member: data?.member || null,
                            error: result.error || null,
                            isPending: false,
                        })
                    } catch (error) {
                        $activeOrganization.set({
                            organization: null,
                            member: null,
                            error: error as any,
                            isPending: false,
                        })
                    }
                }
            }

            // Helper to update organizations list
            const updateOrganizations = async () => {
                if ($organizations) {
                    $organizations.set({ ...$organizations.get(), isPending: true })
                    try {
                        const result = await $fetch(`${basePath}/list-organizations`, { method: "GET" })
                        $organizations.set({
                            data: (result.data as Organization[]) || [],
                            error: result.error || null,
                            isPending: false,
                        })
                    } catch (error) {
                        $organizations.set({
                            data: [],
                            error: error as any,
                            isPending: false,
                        })
                    }
                }
            }

            return {
                org: {
                    // ============================================================
                    // Organization CRUD
                    // ============================================================

                    create: async (data: CreateOrganizationInput) => {
                    const result = await $fetch(`${basePath}/create-organization`, {
                        method: "POST",
                        body: data,
                    })
                    if (!result.error) {
                        await updateOrganizations()
                    }
                    return result as NevrFetchResponse<{ organization: Organization; member: Member }>
                },

                update: async (organizationId: string, data: UpdateOrganizationInput) => {
                    const result = await $fetch(`${basePath}/update-organization`, {
                        method: "POST",
                        body: { organizationId, ...data },
                    })
                    if (!result.error) {
                        await updateOrganizations()
                        await updateActiveOrg()
                    }
                    return result as NevrFetchResponse<Organization>
                },

                delete: async (organizationId: string) => {
                    const result = await $fetch(`${basePath}/delete-organization`, {
                        method: "POST",
                        body: { organizationId },
                    })
                    if (!result.error) {
                        await updateOrganizations()
                        // Clear active if we deleted the active org
                        const current = $activeOrganization?.get()
                        if (current?.organization?.id === organizationId) {
                            $activeOrganization?.set({
                                organization: null,
                                member: null,
                                error: null,
                                isPending: false,
                            })
                        }
                    }
                    return result as NevrFetchResponse<{ success: boolean }>
                },

                get: async (organizationId: string) => {
                    return $fetch(`${basePath}/get-full-organization`, {
                        method: "GET",
                        query: { organizationId },
                    }) as Promise<NevrFetchResponse<FullOrganization>>
                },

                list: async () => {
                    const result = await $fetch(`${basePath}/list-organizations`, { method: "GET" })
                    return result as NevrFetchResponse<Organization[]>
                },

                checkSlug: async (slug: string) => {
                    return $fetch(`${basePath}/check-organization-slug`, {
                        method: "GET",
                        query: { slug },
                    }) as Promise<NevrFetchResponse<{ available: boolean }>>
                },

                // ============================================================
                // Active Organization
                // ============================================================

                setActive: async (organizationId: string | null) => {
                    const result = await $fetch(`${basePath}/set-active-organization`, {
                        method: "POST",
                        body: { organizationId },
                    })
                    if (!result.error) {
                        const data = result.data as { organization: Organization | null; member: Member | null }
                        $activeOrganization?.set({
                            organization: data.organization,
                            member: data.member,
                            error: null,
                            isPending: false,
                        })
                        // Persist to storage
                        if (typeof window !== "undefined" && options?.storage !== null) {
                            const storage = options?.storage || window.localStorage
                            if (storage) {
                                try {
                                    if (organizationId) {
                                        storage.setItem(storageKey, organizationId)
                                    } else {
                                        storage.removeItem(storageKey)
                                    }
                                } catch { /* ignored */ }
                            }
                        }
                    }
                    return result as NevrFetchResponse<{ organization: Organization | null; member: Member | null }>
                },

                getActive: async () => {
                    const result = await $fetch(`${basePath}/get-active-member`, { method: "GET" })
                    return result as NevrFetchResponse<{ organization: Organization | null; member: Member | null }>
                },

                // ============================================================
                // Members
                // ============================================================

                listMembers: async (organizationId: string) => {
                    return $fetch(`${basePath}/list-members`, {
                        method: "GET",
                        query: { organizationId },
                    }) as Promise<NevrFetchResponse<MemberWithUser[]>>
                },

                addMember: async (data: { organizationId: string; userId: string; role?: string }) => {
                    return $fetch(`${basePath}/add-member`, {
                        method: "POST",
                        body: data,
                    }) as Promise<NevrFetchResponse<Member>>
                },

                removeMember: async (data: { organizationId: string; memberId: string }) => {
                    return $fetch(`${basePath}/remove-member`, {
                        method: "POST",
                        body: data,
                    }) as Promise<NevrFetchResponse<{ success: boolean }>>
                },

                updateMemberRole: async (data: { organizationId: string; memberId: string; role: string }) => {
                    return $fetch(`${basePath}/update-member-role`, {
                        method: "POST",
                        body: data,
                    }) as Promise<NevrFetchResponse<Member>>
                },

                leave: async (organizationId: string) => {
                    const result = await $fetch(`${basePath}/leave-organization`, {
                        method: "POST",
                        body: { organizationId },
                    })
                    if (!result.error) {
                        await updateOrganizations()
                        // Clear active if we left the active org
                        const current = $activeOrganization?.get()
                        if (current?.organization?.id === organizationId) {
                            $activeOrganization?.set({
                                organization: null,
                                member: null,
                                error: null,
                                isPending: false,
                            })
                        }
                    }
                    return result as NevrFetchResponse<{ success: boolean }>
                },

                getMyMembership: async (organizationId: string) => {
                    return $fetch(`${basePath}/get-active-member`, {
                        method: "GET",
                        query: { organizationId },
                    }) as Promise<NevrFetchResponse<Member | null>>
                },

                getMyRole: async (organizationId?: string) => {
                    return $fetch(`${basePath}/get-active-member-role`, {
                        method: "GET",
                        query: organizationId ? { organizationId } : undefined,
                    }) as Promise<NevrFetchResponse<{ role: string; permissions: RoleDefinition["permissions"] }>>
                },

                // ============================================================
                // Invitations
                // ============================================================

                invite: async (data: { organizationId: string } & InviteMemberInput) => {
                    return $fetch(`${basePath}/create-invitation`, {
                        method: "POST",
                        body: data,
                    }) as Promise<NevrFetchResponse<Invitation>>
                },

                cancelInvitation: async (invitationId: string) => {
                    return $fetch(`${basePath}/cancel-invitation`, {
                        method: "POST",
                        body: { invitationId },
                    }) as Promise<NevrFetchResponse<{ success: boolean }>>
                },

                listInvitations: async (organizationId: string) => {
                    return $fetch(`${basePath}/list-invitations`, {
                        method: "GET",
                        query: { organizationId },
                    }) as Promise<NevrFetchResponse<Invitation[]>>
                },

                getMyInvitations: async () => {
                    return $fetch(`${basePath}/list-user-invitations`, {
                        method: "GET",
                    }) as Promise<NevrFetchResponse<InvitationWithDetails[]>>
                },

                acceptInvitation: async (invitationId: string) => {
                    const result = await $fetch(`${basePath}/accept-invitation`, {
                        method: "POST",
                        body: { invitationId },
                    })
                    if (!result.error) {
                        await updateOrganizations()
                    }
                    return result as NevrFetchResponse<{ organization: Organization; member: Member }>
                },

                rejectInvitation: async (invitationId: string) => {
                    return $fetch(`${basePath}/reject-invitation`, {
                        method: "POST",
                        body: { invitationId },
                    }) as Promise<NevrFetchResponse<{ success: boolean }>>
                },

                // ============================================================
                // Teams
                // ============================================================

                createTeam: async (data: { organizationId: string; name: string }) => {
                    return $fetch(`${basePath}/create-team`, {
                        method: "POST",
                        body: data,
                    }) as Promise<NevrFetchResponse<Team>>
                },

                updateTeam: async (data: { teamId: string; name: string }) => {
                    return $fetch(`${basePath}/update-team`, {
                        method: "POST",
                        body: data,
                    }) as Promise<NevrFetchResponse<Team>>
                },

                deleteTeam: async (teamId: string) => {
                    return $fetch(`${basePath}/remove-team`, {
                        method: "POST",
                        body: { teamId },
                    }) as Promise<NevrFetchResponse<{ success: boolean }>>
                },

                listTeams: async (organizationId: string) => {
                    return $fetch(`${basePath}/list-organization-teams`, {
                        method: "GET",
                        query: { organizationId },
                    }) as Promise<NevrFetchResponse<Team[]>>
                },

                addTeamMember: async (data: { teamId: string; userId: string }) => {
                    return $fetch(`${basePath}/add-team-member`, {
                        method: "POST",
                        body: data,
                    }) as Promise<NevrFetchResponse<{ success: boolean }>>
                },

                removeTeamMember: async (data: { teamId: string; userId: string }) => {
                    return $fetch(`${basePath}/remove-team-member`, {
                        method: "POST",
                        body: data,
                    }) as Promise<NevrFetchResponse<{ success: boolean }>>
                },

                setActiveTeam: async (teamId: string | null) => {
                    return $fetch(`${basePath}/set-active-team`, {
                        method: "POST",
                        body: { teamId },
                    }) as Promise<NevrFetchResponse<{ success: boolean }>>
                },

                // ============================================================
                // Permissions & Roles
                // ============================================================

                hasPermission: async (data: { permission: Record<string, string[]>; organizationId?: string }) => {
                    return $fetch(`${basePath}/has-permission`, {
                        method: "POST",
                        body: data,
                    }) as Promise<NevrFetchResponse<{ allowed: boolean }>>
                },

                listRoles: async (organizationId: string) => {
                    return $fetch(`${basePath}/list-org-roles`, {
                        method: "GET",
                        query: { organizationId },
                    }) as Promise<NevrFetchResponse<Array<{ id: string; name: string; permissions: RoleDefinition["permissions"] }>>>
                },

                createRole: async (data: { organizationId: string; name: string; permissions: RoleDefinition["permissions"] }) => {
                    return $fetch(`${basePath}/create-org-role`, {
                        method: "POST",
                        body: data,
                    }) as Promise<NevrFetchResponse<{ id: string; name: string }>>
                },

                updateRole: async (data: { roleId: string; name?: string; permissions?: RoleDefinition["permissions"] }) => {
                    return $fetch(`${basePath}/update-org-role`, {
                        method: "POST",
                        body: data,
                    }) as Promise<NevrFetchResponse<{ success: boolean }>>
                },

                deleteRole: async (roleId: string) => {
                    return $fetch(`${basePath}/delete-org-role`, {
                        method: "POST",
                        body: { roleId },
                    }) as Promise<NevrFetchResponse<{ success: boolean }>>
                },
                }
            }
        },

        // Type inference for SDK
        $InferTypes: {
            endpoints: {} as OrganizationClientMethods,
            $ERROR_CODES: ORGANIZATION_ERROR_CODES,
            Organization: {} as Organization,
            Member: {} as Member,
            Team: {} as Team,
            Invitation: {} as Invitation,
            RoleDefinition: {} as RoleDefinition,
        },

        $InferActions: {} as OrganizationClientMethods,
    } as OrganizationClientPlugin
}

// =============================================================================
// REACT HOOK TYPES
// =============================================================================

export interface UseOrganizationResult {
    organization: Organization | null
    member: Member | null
    organizations: Organization[]
    isLoading: boolean
    error: Error | null

    // Actions
    create: OrgMethods["create"]
    update: OrgMethods["update"]
    delete: OrgMethods["delete"]
    setActive: OrgMethods["setActive"]
    invite: OrgMethods["invite"]
    leave: OrgMethods["leave"]
    hasPermission: OrgMethods["hasPermission"]

    // Refresh
    refresh: () => Promise<void>
}

export default organizationClient
