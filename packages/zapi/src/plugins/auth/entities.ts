// =============================================================================
// AUTH ENTITIES
// Schema entities added by the auth plugin (matches Better Auth schema)
// =============================================================================

import type { Entity, FieldDef } from "../../types.js"

// -----------------------------------------------------------------------------
// User Entity
// Core user model required by Better Auth
// -----------------------------------------------------------------------------

export const userEntity: Entity = {
  name: "user",
  config: {
    fields: {
      name: {
        type: "string",
        optional: false,
        unique: false,
      },
      email: {
        type: "string",
        optional: false,
        unique: true,
      },
      emailVerified: {
        type: "boolean",
        optional: false,
        unique: false,
        default: false,
      },
      image: {
        type: "string",
        optional: true,
        unique: false,
      },
    },
    rules: {
      create: [],  // Managed by Better Auth
      read: ["authenticated"],
      update: ["owner"],
      delete: ["admin"],
      list: ["admin"],
    },
    timestamps: true,
  },
}

// -----------------------------------------------------------------------------
// User Fields (for extending existing user entity)
// These fields are required by Better Auth
// -----------------------------------------------------------------------------

export const userAuthFields: Record<string, FieldDef> = {
  // email is usually already defined, but we ensure it's unique
  email: {
    type: "string",
    optional: false,
    unique: true,
  },
  // emailVerified is required by Better Auth
  emailVerified: {
    type: "boolean",
    optional: false,
    unique: false,
    default: false,
  },
  // image from OAuth providers
  image: {
    type: "string",
    optional: true,
    unique: false,
  },
}

// -----------------------------------------------------------------------------
// Session Entity
// Stores active user sessions
// -----------------------------------------------------------------------------

export const sessionEntity: Entity = {
  name: "session",
  config: {
    fields: {
      token: {
        type: "string",
        optional: false,
        unique: true,
      },
      userId: {
        type: "string",
        optional: false,
        unique: false,
      },
      expiresAt: {
        type: "datetime",
        optional: false,
        unique: false,
      },
      ipAddress: {
        type: "string",
        optional: true,
        unique: false,
      },
      userAgent: {
        type: "string",
        optional: true,
        unique: false,
      },
    },
    rules: {
      create: [],  // Managed by Better Auth
      read: [],
      update: [],
      delete: [],
      list: [],
    },
    timestamps: true,
  },
}

// -----------------------------------------------------------------------------
// Account Entity
// Stores OAuth provider accounts and credentials
// -----------------------------------------------------------------------------

export const accountEntity: Entity = {
  name: "account",
  config: {
    fields: {
      userId: {
        type: "string",
        optional: false,
        unique: false,
      },
      accountId: {
        type: "string",
        optional: false,
        unique: false,
      },
      providerId: {
        type: "string",
        optional: false,
        unique: false,
      },
      accessToken: {
        type: "text",
        optional: true,
        unique: false,
      },
      refreshToken: {
        type: "text",
        optional: true,
        unique: false,
      },
      accessTokenExpiresAt: {
        type: "datetime",
        optional: true,
        unique: false,
      },
      refreshTokenExpiresAt: {
        type: "datetime",
        optional: true,
        unique: false,
      },
      scope: {
        type: "string",
        optional: true,
        unique: false,
      },
      idToken: {
        type: "text",
        optional: true,
        unique: false,
      },
      password: {
        type: "string",
        optional: true,
        unique: false,
      },
    },
    rules: {
      create: [],  // Managed by Better Auth
      read: [],
      update: [],
      delete: [],
      list: [],
    },
    timestamps: true,
  },
}

// -----------------------------------------------------------------------------
// Verification Entity
// Stores email verification and password reset tokens
// -----------------------------------------------------------------------------

export const verificationEntity: Entity = {
  name: "verification",
  config: {
    fields: {
      identifier: {
        type: "string",
        optional: false,
        unique: false,
      },
      value: {
        type: "string",
        optional: false,
        unique: false,
      },
      expiresAt: {
        type: "datetime",
        optional: false,
        unique: false,
      },
    },
    rules: {
      create: [],  // Managed by Better Auth
      read: [],
      update: [],
      delete: [],
      list: [],
    },
    timestamps: true,
  },
}

// -----------------------------------------------------------------------------
// Get All Auth Entities
// -----------------------------------------------------------------------------

export function getAuthEntities(): Entity[] {
  return [
    userEntity,
    sessionEntity,
    accountEntity,
    verificationEntity,
  ]
}

// -----------------------------------------------------------------------------
// JWKS Entity (for JWT mode)
// Stores JSON Web Keys for JWT verification
// -----------------------------------------------------------------------------

export const jwksEntity: Entity = {
  name: "jwks",
  config: {
    fields: {
      publicKey: {
        type: "text",
        optional: false,
        unique: false,
      },
      privateKey: {
        type: "text",
        optional: false,
        unique: false,
      },
      expiresAt: {
        type: "datetime",
        optional: true,
        unique: false,
      },
    },
    rules: {
      create: [],  // Managed by Better Auth
      read: [],
      update: [],
      delete: [],
      list: [],
    },
    timestamps: true,
  },
}

// -----------------------------------------------------------------------------
// Get JWKS Entity (for JWT mode)
// -----------------------------------------------------------------------------

export function getJwksEntity(): Entity {
  return jwksEntity
}

// -----------------------------------------------------------------------------
// Get User Fields to Add
// -----------------------------------------------------------------------------

export function getUserAuthFields(): Record<string, FieldDef> {
  return userAuthFields
}
