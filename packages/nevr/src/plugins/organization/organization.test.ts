// =============================================================================
// ORGANIZATION PLUGIN TESTS
// Tests for organization CRUD, members, and invitations
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest"
import { createOrganization, addMember, createInvitation } from "./api/routes/index.js"
import { ORGANIZATION_ERROR_CODES } from "./error-codes.js"
import type { EndpointContext } from "../unified/endpoint.js"
import type { OrganizationRouteConfig, Organization, Member, OrganizationAdapter } from "./types.js"
import type { User } from "../../types.js"

// Mock Adapter
const mockAdapter = {
    findOrganizationById: vi.fn(),
    findOrganizationBySlug: vi.fn(),
    findOrganizationsByUserId: vi.fn(),
    createOrganization: vi.fn(),
    updateOrganization: vi.fn(),
    deleteOrganization: vi.fn(),
    findMemberById: vi.fn(),
    findMemberByUserAndOrg: vi.fn(),
    findMembersByOrganizationId: vi.fn(),
    countMembersByOrganizationId: vi.fn(),
    createMember: vi.fn(),
    updateMember: vi.fn(),
    deleteMember: vi.fn(),
    findInvitationByEmailAndOrg: vi.fn(),
    countPendingInvitations: vi.fn(),
    createInvitation: vi.fn(),
}

// Mock Config
const mockConfig: OrganizationRouteConfig = {
    options: {
        creatorRole: "owner",
    },
    getAdapter: () => mockAdapter as unknown as OrganizationAdapter,
    getRoles: () => ({
        owner: { permissions: { organization: ["create", "read", "update", "delete"] } } as any,
        member: { permissions: { organization: ["read"] } } as any,
    }),
    hasPermission: vi.fn().mockReturnValue(true),
}

// Mock Context Helper
function createMockContext(user?: Partial<User>, body: any = {}): EndpointContext {
    return {
        user: user ? { id: "user-1", role: "user", ...user } as User : null,
        body,
        query: {},
        params: {},
        driver: {} as any,
        json: (data) => ({ status: 200, body: data }),
    } as unknown as EndpointContext
}

describe("Organization Plugin Endpoints", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe("createOrganization", () => {
        it("should create organization and add owner", async () => {
            const endpoint = createOrganization(mockConfig)
            const ctx = createMockContext({ id: "user-1" }, { name: "Test Org" })

            mockAdapter.findOrganizationsByUserId.mockResolvedValue([])
            mockAdapter.findOrganizationBySlug.mockResolvedValue(null)
            mockAdapter.createOrganization.mockResolvedValue({ id: "org-1", name: "Test Org", slug: "test-org" })
            mockAdapter.createMember.mockResolvedValue({ id: "member-1", role: "owner", userId: "user-1", organizationId: "org-1" })

            const response = await endpoint.handler(ctx)

            expect(mockAdapter.createOrganization).toHaveBeenCalledWith(expect.objectContaining({
                name: "Test Org",
                slug: "test-org",
            }))
            expect(mockAdapter.createMember).toHaveBeenCalledWith(expect.objectContaining({
                userId: "user-1",
                organizationId: "org-1",
                role: "owner",
            }))
            expect((response as any).body).toEqual(expect.objectContaining({
                organization: { id: "org-1", name: "Test Org", slug: "test-org" },
            }))
        })

        it("should fail if user not authenticated", async () => {
            const endpoint = createOrganization(mockConfig)
            const ctx = createMockContext(undefined, { name: "Test Org" })

            await expect(endpoint.handler(ctx)).rejects.toThrow("UNAUTHORIZED")
        })

        it("should fail if slug exists", async () => {
            const endpoint = createOrganization(mockConfig)
            const ctx = createMockContext({ id: "user-1" }, { name: "Test Org" })

            mockAdapter.findOrganizationsByUserId.mockResolvedValue([])
            mockAdapter.findOrganizationBySlug.mockResolvedValue({ id: "existing" })

            await expect(endpoint.handler(ctx)).rejects.toThrow(ORGANIZATION_ERROR_CODES.ORGANIZATION_SLUG_ALREADY_EXISTS)
        })
    })

    describe("addMember", () => {
        it("should add member if permitted", async () => {
            const endpoint = addMember(mockConfig)
            const ctx = createMockContext({ id: "user-1" }, { organizationId: "org-1", userId: "user-2", role: "member" })
                ; (ctx as any).member = { role: "owner", userId: "user-1", organizationId: "org-1" } // Inject middleware member

            mockAdapter.findMemberByUserAndOrg.mockResolvedValue(null)
            mockAdapter.countMembersByOrganizationId.mockResolvedValue(5)
            mockAdapter.createMember.mockResolvedValue({ id: "member-2", userId: "user-2", role: "member" })

            const response = await endpoint.handler(ctx)

            expect(mockAdapter.createMember).toHaveBeenCalledWith(expect.objectContaining({
                userId: "user-2",
                role: "member",
            }))
            expect((response as any).body).toEqual(expect.objectContaining({
                id: "member-2",
            }))
        })

        it("should fail if invalid role", async () => {
            const endpoint = addMember(mockConfig)
            const ctx = createMockContext({ id: "user-1" }, { organizationId: "org-1", userId: "user-2", role: "invalid" })
                ; (ctx as any).member = { role: "owner" }

            await expect(endpoint.handler(ctx)).rejects.toThrow(ORGANIZATION_ERROR_CODES.INVALID_ROLE)
        })
    })

    describe("createInvitation", () => {
        it("should create invitation", async () => {
            const endpoint = createInvitation(mockConfig)
            const ctx = createMockContext({ id: "user-1" }, {
                organizationId: "org-1",
                email: "test@example.com",
                role: "member"
            })
                ; (ctx as any).member = { role: "owner" }

            mockAdapter.findOrganizationById.mockResolvedValue({ id: "org-1" })
            mockAdapter.findInvitationByEmailAndOrg.mockResolvedValue(null)
            mockAdapter.createInvitation.mockResolvedValue({ id: "inv-1", email: "test@example.com", status: "pending" })

            const response = await endpoint.handler(ctx)

            expect(mockAdapter.createInvitation).toHaveBeenCalledWith(expect.objectContaining({
                email: "test@example.com",
                status: "pending",
                inviterId: "user-1",
            }))
            expect((response as any).body).toEqual(expect.objectContaining({
                id: "inv-1",
            }))
        })

        it("should fail if permission denied", async () => {
            const endpoint = createInvitation(mockConfig)
            const ctx = createMockContext({ id: "user-1" }, { organizationId: "org-1", email: "test@example.com" })
                ; (ctx as any).member = { role: "member" }

            // Mock permissions to return false
            const mockConfigWithDenied = { ...mockConfig, hasPermission: vi.fn().mockReturnValue(false) }
            const endpointDenied = createInvitation(mockConfigWithDenied)

            await expect(endpointDenied.handler(ctx)).rejects.toThrow(ORGANIZATION_ERROR_CODES.NOT_ALLOWED_TO_INVITE)
        })
    })
})
