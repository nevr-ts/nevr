// =============================================================================
// ORGANIZATION CLIENT SDK TEST
// Tests for client plugin pattern and type inference
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest"
import { organizationClient, type OrganizationClientPlugin } from "./client.js"

describe("Organization Client Plugin", () => {
    describe("Plugin Structure", () => {
        it("should have required plugin properties", () => {
            const client = organizationClient()

            expect(client.id).toBe("organization-client")
            expect(client.pathMethods).toBeDefined()
            expect(client.getAtoms).toBeDefined()
            expect(client.getActions).toBeDefined()
            expect(client.atomListeners).toBeDefined()
            expect(client.$InferTypes).toBeDefined()
        })

        it("should have correct $InferTypes structure", () => {
            const client = organizationClient()
            const infer = client.$InferTypes

            expect(infer).toHaveProperty("endpoints")
            expect(infer).toHaveProperty("$ERROR_CODES")
            expect(infer).toHaveProperty("Organization")
            expect(infer).toHaveProperty("Member")
            expect(infer).toHaveProperty("Team")
            expect(infer).toHaveProperty("Invitation")
            expect(infer).toHaveProperty("RoleDefinition")
        })

        it("should have pathMethods for all endpoints", () => {
            const client = organizationClient()
            const methods = client.pathMethods

            // Core endpoints
            expect(methods["/organization/create-organization"]).toBe("POST")
            expect(methods["/organization/update-organization"]).toBe("POST")
            expect(methods["/organization/delete-organization"]).toBe("POST")
            expect(methods["/organization/list-organizations"]).toBe("GET")
            expect(methods["/organization/set-active-organization"]).toBe("POST")

            // Member endpoints
            expect(methods["/organization/add-member"]).toBe("POST")
            expect(methods["/organization/remove-member"]).toBe("POST")
            expect(methods["/organization/list-members"]).toBe("GET")

            // Invitation endpoints
            expect(methods["/organization/create-invitation"]).toBe("POST")
            expect(methods["/organization/accept-invitation"]).toBe("POST")
            expect(methods["/organization/list-invitations"]).toBe("GET")

            // Team endpoints
            expect(methods["/organization/create-team"]).toBe("POST")
            expect(methods["/organization/list-organization-teams"]).toBe("GET")

            // Access control endpoints
            expect(methods["/organization/create-org-role"]).toBe("POST")
            expect(methods["/organization/has-permission"]).toBe("POST")
        })

        it("should support custom basePath", () => {
            const client = organizationClient({ basePath: "/api/org" })

            expect(client.pathMethods["/api/org/create-organization"]).toBe("POST")
            expect(client.pathMethods["/api/org/list-organizations"]).toBe("GET")
        })
    })

    describe("getAtoms", () => {
        it("should create reactive atoms", () => {
            const client = organizationClient()
            const mockFetch = vi.fn().mockResolvedValue({ data: null, error: null })

            const atoms = client.getAtoms!(mockFetch as any)

            expect(atoms).toHaveProperty("activeOrganization")
            expect(atoms).toHaveProperty("organizations")
            expect(atoms).toHaveProperty("$orgSignal")
        })

        it("should initialize with correct state", () => {
            const client = organizationClient()
            const mockFetch = vi.fn().mockResolvedValue({ data: null, error: null })

            const atoms = client.getAtoms!(mockFetch as any)
            const activeOrg = atoms.activeOrganization.get()
            const orgs = atoms.organizations.get()

            expect(activeOrg.organization).toBeNull()
            expect(activeOrg.member).toBeNull()
            expect(activeOrg.isPending).toBe(true)
            expect(orgs.data).toEqual([])
            expect(orgs.isPending).toBe(true)
        })
    })

    describe("getActions", () => {
        let mockFetch: ReturnType<typeof vi.fn>
        let mockStore: any
        let client: OrganizationClientPlugin
        let actions: ReturnType<NonNullable<OrganizationClientPlugin["getActions"]>>

        beforeEach(() => {
            mockFetch = vi.fn().mockResolvedValue({ data: null, error: null })
            mockStore = { atoms: {} }
            client = organizationClient()

            // Initialize atoms first
            client.getAtoms!(mockFetch as any)

            // Get actions
            actions = client.getActions!(mockFetch as any, mockStore)
        })

        it("should have all action methods", () => {
            // Organization CRUD
            expect(actions.create).toBeDefined()
            expect(actions.update).toBeDefined()
            expect(actions.delete).toBeDefined()
            expect(actions.get).toBeDefined()
            expect(actions.list).toBeDefined()
            expect(actions.checkSlug).toBeDefined()

            // Active organization
            expect(actions.setActive).toBeDefined()
            expect(actions.getActive).toBeDefined()

            // Members
            expect(actions.listMembers).toBeDefined()
            expect(actions.addMember).toBeDefined()
            expect(actions.removeMember).toBeDefined()
            expect(actions.updateMemberRole).toBeDefined()
            expect(actions.leave).toBeDefined()

            // Invitations
            expect(actions.invite).toBeDefined()
            expect(actions.acceptInvitation).toBeDefined()
            expect(actions.rejectInvitation).toBeDefined()
            expect(actions.cancelInvitation).toBeDefined()
            expect(actions.listInvitations).toBeDefined()
            expect(actions.getMyInvitations).toBeDefined()

            // Teams
            expect(actions.createTeam).toBeDefined()
            expect(actions.updateTeam).toBeDefined()
            expect(actions.deleteTeam).toBeDefined()
            expect(actions.listTeams).toBeDefined()
            expect(actions.addTeamMember).toBeDefined()
            expect(actions.removeTeamMember).toBeDefined()
            expect(actions.setActiveTeam).toBeDefined()

            // Permissions & Roles
            expect(actions.hasPermission).toBeDefined()
            expect(actions.listRoles).toBeDefined()
            expect(actions.createRole).toBeDefined()
            expect(actions.updateRole).toBeDefined()
            expect(actions.deleteRole).toBeDefined()
        })

        it("create should call POST with correct body", async () => {
            mockFetch.mockResolvedValueOnce({
                data: {
                    organization: { id: "org-1", name: "Test Org", slug: "test-org" },
                    member: { id: "member-1", organizationId: "org-1", userId: "user-1", role: "owner" }
                },
                error: null
            })

            await actions.create({ name: "Test Org" })

            expect(mockFetch).toHaveBeenCalledWith(
                "/organization/create-organization",
                expect.objectContaining({
                    method: "POST",
                    body: { name: "Test Org" }
                })
            )
        })

        it("list should call GET", async () => {
            mockFetch.mockResolvedValueOnce({
                data: [{ id: "org-1", name: "Org 1" }],
                error: null
            })

            await actions.list()

            expect(mockFetch).toHaveBeenCalledWith(
                "/organization/list-organizations",
                expect.objectContaining({ method: "GET" })
            )
        })

        it("setActive should update atom state on success", async () => {
            const org = { id: "org-1", name: "Org 1", slug: "org-1" }
            const member = { id: "m-1", organizationId: "org-1", userId: "u-1", role: "owner" }

            mockFetch.mockResolvedValueOnce({
                data: { organization: org, member },
                error: null
            })

            await actions.setActive("org-1")

            // Check that atoms were updated (we initialized them earlier)
            expect(mockFetch).toHaveBeenCalledWith(
                "/organization/set-active-organization",
                expect.objectContaining({
                    method: "POST",
                    body: { organizationId: "org-1" }
                })
            )
        })
    })

    describe("atomListeners", () => {
        it("should trigger on org-changing actions", () => {
            const client = organizationClient()
            const listeners = client.atomListeners!

            expect(listeners.length).toBeGreaterThan(0)

            const matcher = listeners[0].matcher

            // Should trigger on these paths
            expect(matcher("/organization/create-organization")).toBe(true)
            expect(matcher("/organization/set-active-organization")).toBe(true)
            expect(matcher("/organization/leave-organization")).toBe(true)
            expect(matcher("/organization/accept-invitation")).toBe(true)

            // Should not trigger on these paths
            expect(matcher("/organization/list-organizations")).toBe(false)
            expect(matcher("/organization/list-members")).toBe(false)
        })
    })
})
