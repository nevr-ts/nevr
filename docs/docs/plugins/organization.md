# Organization Plugin

Multi-tenant organizations with teams, members, roles, and invitations.

## Installation

```typescript
import { nevr } from "nevr"
import { organization } from "nevr/plugins/organization"

const api = nevr({
  plugins: [
    organization({
      roles: ["owner", "admin", "member", "viewer"],
      defaultRole: "member",
    }),
  ],
})
```

## Configuration

```typescript
organization({
  // Available roles
  roles: ["owner", "admin", "member", "viewer"],

  // Default role for new members
  defaultRole: "member",

  // Enable teams within organizations
  teams: true,

  // Invitation settings
  invitations: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    maxPending: 50,
  },

  // Maximum members per organization (0 = unlimited)
  maxMembers: 0,

  // Allow users to create organizations
  allowUserCreation: true,

  // Callbacks
  onOrganizationCreated: async (org, user) => {
    console.log(`${user.email} created ${org.name}`)
  },
  onMemberJoined: async (org, member) => {
    console.log(`${member.email} joined ${org.name}`)
  },
})
```

## Endpoints

### Organizations

```
POST   /organizations              Create organization
GET    /organizations              List user's organizations
GET    /organizations/:id          Get organization
PATCH  /organizations/:id          Update organization
DELETE /organizations/:id          Delete organization
```

### Members

```
GET    /organizations/:id/members              List members
POST   /organizations/:id/members              Add member
PATCH  /organizations/:id/members/:memberId    Update member role
DELETE /organizations/:id/members/:memberId    Remove member
```

### Invitations

```
POST   /organizations/:id/invitations          Create invitation
GET    /organizations/:id/invitations          List pending invitations
DELETE /organizations/:id/invitations/:invId   Cancel invitation
POST   /invitations/:token/accept              Accept invitation
```

### Teams

```
POST   /organizations/:id/teams                Create team
GET    /organizations/:id/teams                List teams
PATCH  /organizations/:id/teams/:teamId        Update team
DELETE /organizations/:id/teams/:teamId        Delete team
POST   /organizations/:id/teams/:teamId/members  Add team member
```

## Client Usage

```typescript
import { createClient } from "nevr/client"
import { organizationClient } from "nevr/plugins/organization/client"

const client = createClient({
  baseURL: "/api",
  plugins: [organizationClient()],
})

// Create organization
const { data: org } = await client.organizations.create({
  name: "Acme Inc",
  slug: "acme",
})

// Invite member
await client.organizations.invite(org.id, {
  email: "teammate@example.com",
  role: "admin",
})

// List members
const { data: members } = await client.organizations.listMembers(org.id)

// Create team
await client.organizations.createTeam(org.id, {
  name: "Engineering",
})
```

## Middleware

Use organization context in your endpoints:

```typescript
import { requireOrgMember, requireOrgRole } from "nevr/plugins/organization"

const endpoint = endpoint("/projects", {
  method: "GET",
  use: [
    requireOrgMember(),  // Must be org member
    // or
    requireOrgRole(["admin", "owner"]),  // Must have role
  ],
  handler: async (ctx) => {
    const { organization, membership } = ctx
    // Access org context
  },
})
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
| joinedAt | datetime | Join timestamp |

### Invitation

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| email | string | Invitee email |
| organizationId | string | Organization reference |
| role | string | Assigned role |
| token | string | Invitation token |
| expiresAt | datetime | Expiration |
| invitedBy | string | Inviter user ID |

### Team

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| name | string | Team name |
| organizationId | string | Organization reference |
| members | string[] | User IDs |
