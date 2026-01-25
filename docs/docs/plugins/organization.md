# Organization Plugin

Multi-tenant organizations with teams, members, roles, and invitations.

## Installation

```typescript
import { nevr } from "nevr"
import { organization } from "nevr/plugins/organization"

const api = nevr({
  plugins: [
    organization({
      allowUserToCreate: true,
      creatorRole: "owner",
      teams: { enabled: true },
    }),
  ],
})
```

## Configuration

```typescript
organization({
  // Allow users to create organizations
  allowUserToCreate: true,

  // Maximum organizations per user
  maxOrgsPerUser: 10,

  // Maximum members per organization
  maxMembersPerOrg: 100,

  // Role assigned to organization creator
  creatorRole: "owner",

  // Custom roles with permissions
  roles: {
    owner: {
      name: "Owner",
      permissions: {
        organization: ["create", "read", "update", "delete"],
        member: ["create", "read", "update", "delete"],
        invitation: ["create", "read", "update", "delete"],
        team: ["create", "read", "update", "delete"],
      },
    },
    admin: {
      name: "Admin",
      permissions: {
        organization: ["read", "update"],
        member: ["create", "read", "update", "delete"],
        invitation: ["create", "read", "update", "delete"],
        team: ["create", "read", "update", "delete"],
      },
    },
    member: {
      name: "Member",
      permissions: {
        organization: ["read"],
        member: ["read"],
        invitation: ["read"],
        team: ["read"],
      },
    },
  },

  // Enable teams feature
  teams: {
    enabled: true,
    maxTeams: 10,
    maxMembersPerTeam: 50,
  },

  // Invitation settings
  invitation: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    maxPending: 50,
    sendEmail: async ({ invitation, organization, inviter, acceptUrl }) => {
      // Send invitation email
    },
  },

  // Lifecycle hooks
  hooks: {
    afterCreate: async ({ organization, member }) => {
      console.log(`Created ${organization.name}`)
    },
  },
})
```

## Endpoints

### Organization CRUD (7 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/organization/create-organization` | Create organization |
| POST | `/organization/update-organization` | Update organization |
| POST | `/organization/delete-organization` | Delete organization |
| POST | `/organization/set-active-organization` | Set active org |
| GET | `/organization/get-full-organization` | Get org with members |
| GET | `/organization/list-organizations` | List user's orgs |
| GET | `/organization/check-organization-slug` | Check slug availability |

### Member Management (7 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/organization/add-member` | Add member |
| POST | `/organization/remove-member` | Remove member |
| POST | `/organization/update-member-role` | Update role |
| GET | `/organization/get-active-member` | Get current membership |
| GET | `/organization/get-active-member-role` | Get role with permissions |
| GET | `/organization/list-members` | List members |
| POST | `/organization/leave-organization` | Leave organization |

### Invitations (7 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/organization/create-invitation` | Create invitation |
| POST | `/organization/accept-invitation` | Accept invitation |
| POST | `/organization/reject-invitation` | Reject invitation |
| POST | `/organization/cancel-invitation` | Cancel invitation |
| GET | `/organization/get-invitation` | Get invitation |
| GET | `/organization/list-invitations` | List org invitations |
| GET | `/organization/list-user-invitations` | List user's invitations |

### Teams (9 endpoints) - *when enabled*

| Method | Path | Description |
|--------|------|-------------|
| POST | `/organization/create-team` | Create team |
| POST | `/organization/remove-team` | Delete team |
| POST | `/organization/update-team` | Update team |
| GET | `/organization/list-organization-teams` | List teams |
| POST | `/organization/set-active-team` | Set active team |
| GET | `/organization/list-user-teams` | List user's teams |
| GET | `/organization/list-team-members` | List team members |
| POST | `/organization/add-team-member` | Add to team |
| POST | `/organization/remove-team-member` | Remove from team |

### Access Control (6 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/organization/create-org-role` | Create custom role |
| POST | `/organization/delete-org-role` | Delete role |
| GET | `/organization/list-org-roles` | List roles |
| GET | `/organization/get-org-role` | Get role |
| POST | `/organization/update-org-role` | Update role |
| POST | `/organization/has-permission` | Check permission |

## Client SDK

The organization plugin uses the unified client pattern with `createTypedClient`:

```typescript
import { createTypedClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import { organizationClient } from "nevr/plugins/organization/client"
import type { API } from "./api"

// Create typed client with server API inference
export const client = createTypedClient<API>({
  baseURL: "http://localhost:3000",
  plugins: [
    authClient(),
    organizationClient(),
  ],
})

// Create organization
const { data } = await client.organization.create({
  name: "Acme Inc",
  slug: "acme",
})

// Reactive state
client.$store.atoms.activeOrganization.subscribe(({ organization, member }) => {
  console.log("Active:", organization?.name)
})

// Set active organization
await client.organization.setActive(data.organization.id)

// Invite member
await client.organization.invite({
  organizationId: orgId,
  email: "teammate@example.com",
  role: "admin",
})

// Create team
await client.organization.createTeam({
  organizationId: orgId,
  name: "Engineering",
})

// Check permission
const { data: result } = await client.organization.hasPermission({
  permission: { member: ["create"] },
})
```

## Reactive State

The client plugin provides reactive atoms:

| Atom | Description |
|------|-------------|
| `$activeOrganization` | Current org + member + loading state |
| `$organizations` | List of user's organizations |

```typescript
// React usage with nanostores
import { useStore } from "@nanostores/react"

function OrgSwitcher() {
  const { organization, isPending } = useStore(client.$store.atoms.activeOrganization)
  const { data: orgs } = useStore(client.$store.atoms.organizations)

  if (isPending) return <Loading />

  return (
    <select 
      value={organization?.id} 
      onChange={(e) => client.organization.setActive(e.target.value)}
    >
      {orgs.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
    </select>
  )
}
```

## Type Inference

The plugin exports types for SDK inference:

```typescript
import type { InferPlugin } from "nevr"
import { organization } from "nevr/plugins/organization"

type OrgPlugin = InferPlugin<typeof organization>

// Available types:
// OrgPlugin["Organization"]
// OrgPlugin["Member"]
// OrgPlugin["Team"]
// OrgPlugin["Invitation"]
// OrgPlugin["RoleDefinition"]
```

## Schema

### Organization

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| name | string | Organization name |
| slug | string | URL-friendly identifier |
| logo | string? | Logo URL |
| metadata | json? | Custom metadata |
| createdAt | datetime | Creation timestamp |

### Member

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| userId | string | User reference |
| organizationId | string | Organization reference |
| role | string | Member role |
| createdAt | datetime | Join timestamp |

### Invitation

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| email | string | Invitee email |
| organizationId | string | Organization reference |
| role | string | Assigned role |
| status | string | pending, accepted, rejected, canceled |
| expiresAt | datetime | Expiration |
| inviterId | string | Inviter user ID |

### Team

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| name | string | Team name |
| organizationId | string | Organization reference |
| createdAt | datetime | Creation timestamp |
