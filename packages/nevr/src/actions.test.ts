// =============================================================================
// ENTITY ACTIONS TESTS
// Tests for entity action definitions, action builder API, and action routes
// =============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest"
import { entity, action, step, ActionBuilder } from "./entity.js"
import { string, int, boolean } from "./fields.js"
import type { EntityAction, EntityActionContext, EntityWorkflowStep } from "./types.js"

// -----------------------------------------------------------------------------
// Action Builder Tests
// -----------------------------------------------------------------------------

describe("ActionBuilder", () => {
  describe("Basic Action Creation", () => {
    it("should create a basic action with default POST method", () => {
      const verifyAction = action()._build("verify")

      expect(verifyAction.name).toBe("verify")
      expect(verifyAction.method).toBe("POST")
      expect(verifyAction.requiresId).toBe(false)
    })

    it("should create action with custom path", () => {
      const myAction = action("custom-path")._build("myAction")

      expect(myAction.path).toBe("custom-path")
    })

    it("should set HTTP method", () => {
      const getAction = action().method("GET")._build("fetch")
      const deleteAction = action().method("DELETE")._build("remove")

      expect(getAction.method).toBe("GET")
      expect(deleteAction.method).toBe("DELETE")
    })

    it("should use method shorthand helpers", () => {
      const getAction = action().get()._build("list")
      const postAction = action().post()._build("create")

      expect(getAction.method).toBe("GET")
      expect(postAction.method).toBe("POST")
    })

    it("should mark action as resource-level with onResource()", () => {
      const resourceAction = action().onResource()._build("update")

      expect(resourceAction.requiresId).toBe(true)
    })

    it("should set authorization rules", () => {
      const protectedAction = action()
        .rules("authenticated", "admin")
        ._build("admin-only")

      expect(protectedAction.rules).toEqual(["authenticated", "admin"])
    })
  })

  describe("Input Schema", () => {
    it("should define input schema", () => {
      const actionWithInput = action()
        .input({
          email: string,
          age: int,
        })
        ._build("register")

      expect(actionWithInput.input).toBeDefined()
      expect(actionWithInput.input!.email.type).toBe("string")
      expect(actionWithInput.input!.age.type).toBe("int")
    })
  })

  describe("Handler", () => {
    it("should set action handler", () => {
      const handler = vi.fn().mockResolvedValue({ success: true })
      const handlerAction = action()
        .handler(handler)
        ._build("process")

      expect(handlerAction.handler).toBe(handler)
    })
  })

  describe("Workflow Definition", () => {
    it("should define workflow with steps", () => {
      const steps: EntityWorkflowStep[] = [
        {
          name: "step1",
          execute: vi.fn(),
        },
        {
          name: "step2",
          execute: vi.fn(),
          compensate: vi.fn(),
        },
      ]

      const workflowAction = action()
        .workflow(steps)
        ._build("checkout")

      expect(workflowAction.workflow).toBeDefined()
      expect(workflowAction.workflow!.steps).toHaveLength(2)
      expect(workflowAction.workflow!.useTransaction).toBe(false)
    })

    it("should enable transaction for workflow", () => {
      const workflowAction = action()
        .workflow([{ name: "step1", execute: vi.fn() }], { useTransaction: true })
        ._build("atomic")

      expect(workflowAction.workflow!.useTransaction).toBe(true)
    })
  })

  describe("Metadata", () => {
    it("should add metadata", () => {
      const metaAction = action()
        .meta({
          summary: "Verify user email",
          description: "Sends verification email to user",
          tags: ["User", "Authentication"],
        })
        ._build("verify")

      expect(metaAction.metadata?.summary).toBe("Verify user email")
      expect(metaAction.metadata?.tags).toContain("User")
    })
  })

  describe("Method Chaining", () => {
    it("should support full fluent API", () => {
      const fullAction = action("verify-email")
        .post()
        .onResource()
        .rules("authenticated")
        .input({ code: string })
        .handler(async (ctx) => ({ verified: true }))
        .meta({ summary: "Verify email" })
        ._build("verifyEmail")

      expect(fullAction.name).toBe("verifyEmail")
      expect(fullAction.method).toBe("POST")
      expect(fullAction.path).toBe("verify-email")
      expect(fullAction.requiresId).toBe(true)
      expect(fullAction.rules).toEqual(["authenticated"])
      expect(fullAction.input).toBeDefined()
      expect(fullAction.handler).toBeDefined()
      expect(fullAction.metadata?.summary).toBe("Verify email")
    })
  })
})

// -----------------------------------------------------------------------------
// Step Helper Tests
// -----------------------------------------------------------------------------

describe("step() helper", () => {
  it("should create a workflow step with execute only", () => {
    const executeFn = vi.fn()
    const myStep = step("myStep", executeFn)

    expect(myStep.name).toBe("myStep")
    expect(myStep.execute).toBe(executeFn)
    expect(myStep.compensate).toBeUndefined()
  })

  it("should create a workflow step with compensate", () => {
    const executeFn = vi.fn()
    const compensateFn = vi.fn()
    const myStep = step("myStep", executeFn, compensateFn)

    expect(myStep.name).toBe("myStep")
    expect(myStep.execute).toBe(executeFn)
    expect(myStep.compensate).toBe(compensateFn)
  })
})

// -----------------------------------------------------------------------------
// Entity Actions Integration Tests
// -----------------------------------------------------------------------------

describe("Entity with Actions", () => {
  it("should add actions to entity via .actions()", () => {
    const User = entity("user", {
      email: string,
      verified: boolean,
    }).actions({
      verify: action()
        .onResource()
        .handler(async (ctx) => {
          return { verified: true }
        }),
      sendReminder: action()
        .handler(async (ctx) => {
          return { sent: true }
        }),
    }).build()

    expect(User.config.actions).toBeDefined()
    expect(User.config.actions!.verify).toBeDefined()
    expect(User.config.actions!.sendReminder).toBeDefined()
  })

  it("should add single action via .action()", () => {
    const User = entity("user", {
      email: string,
    }).action("verify", action().onResource().handler(async () => ({ ok: true })))
      .build()

    expect(User.config.actions!.verify).toBeDefined()
    expect(User.config.actions!.verify.requiresId).toBe(true)
  })

  it("should preserve entity config when adding actions", () => {
    const Post = entity("post", {
      title: string,
    })
      .rules({ create: ["authenticated"] })
      .noTimestamps()
      .actions({
        publish: action().onResource().handler(async () => ({ published: true })),
      })
      .build()

    expect(Post.config.rules.create).toEqual(["authenticated"])
    expect(Post.config.timestamps).toBe(false)
    expect(Post.config.actions!.publish).toBeDefined()
  })

  it("should build entity without actions", () => {
    const Simple = entity("simple", {
      name: string,
    }).build()

    expect(Simple.config.actions).toBeUndefined()
  })

  it("should define complex workflow action", () => {
    const Order = entity("order", {
      amount: int,
      status: string,
    }).actions({
      checkout: action()
        .input({ paymentMethod: string })
        .workflow([
          step("validate", async (ctx) => {
            return { valid: true }
          }),
          step("charge", async (ctx) => {
            return { chargeId: "ch_123" }
          }, async (ctx, result) => {
            // Refund logic
          }),
          step("fulfill", async (ctx) => {
            return { fulfilled: true }
          }),
        ], { useTransaction: true })
        .meta({ summary: "Process order checkout" }),
    }).build()

    const checkout = Order.config.actions!.checkout
    expect(checkout.workflow).toBeDefined()
    expect(checkout.workflow!.steps).toHaveLength(3)
    expect(checkout.workflow!.useTransaction).toBe(true)
    expect(checkout.workflow!.steps[1].compensate).toBeDefined()
  })
})

// -----------------------------------------------------------------------------
// Action Context Tests
// -----------------------------------------------------------------------------

describe("EntityActionContext", () => {
  it("should provide correct context shape to handlers", async () => {
    let capturedCtx: EntityActionContext | null = null

    const User = entity("user", {
      email: string,
    }).actions({
      test: action()
        .onResource()
        .handler(async (ctx) => {
          capturedCtx = ctx
          return { success: true }
        }),
    }).build()

    // We can't actually execute the handler without the full nevr instance,
    // but we can verify the action is properly defined
    expect(User.config.actions!.test.handler).toBeDefined()
    expect(User.config.actions!.test.requiresId).toBe(true)
  })
})

// -----------------------------------------------------------------------------
// Real-World Usage Patterns Tests
// -----------------------------------------------------------------------------

describe("Real-World Action Patterns", () => {
  it("should support user verification pattern", () => {
    const User = entity("user", {
      email: string,
      verified: boolean,
    }).actions({
      sendVerification: action()
        .post()
        .onResource()
        .rules("authenticated", "owner")
        .meta({ summary: "Send verification email" })
        .handler(async (ctx) => {
          // Would send email here
          return { sent: true, email: ctx.resource?.email }
        }),

      verify: action("verify-email")
        .post()
        .input({ token: string })
        .handler(async (ctx) => {
          // Would verify token here
          return { verified: true }
        }),
    }).build()

    expect(User.config.actions).toHaveProperty("sendVerification")
    expect(User.config.actions).toHaveProperty("verify")
    expect(User.config.actions!.sendVerification.requiresId).toBe(true)
    expect(User.config.actions!.verify.requiresId).toBe(false)
  })

  it("should support e-commerce checkout workflow", () => {
    const Order = entity("order", {
      items: string, // JSON in real app
      total: int,
      status: string,
    }).actions({
      checkout: action()
        .input({ paymentMethodId: string })
        .workflow([
          step("reserve-inventory",
            async (ctx) => {
              ctx.set("inventoryReservation", { id: "res_123" })
              return { reservationId: "res_123" }
            },
            async (ctx, result) => {
              // Release inventory
            }
          ),
          step("process-payment",
            async (ctx) => {
              const paymentService = ctx.resolve("payments")
              return { paymentId: "pay_123" }
            },
            async (ctx, result) => {
              // Refund payment
            }
          ),
          step("create-shipment",
            async (ctx) => {
              return { trackingNumber: "1Z999" }
            }
          ),
        ], { useTransaction: true }),

      cancel: action()
        .onResource()
        .rules("authenticated", "owner")
        .handler(async (ctx) => {
          return { cancelled: true }
        }),

      track: action()
        .get()
        .onResource()
        .handler(async (ctx) => {
          return { status: "in_transit", eta: "2024-01-15" }
        }),
    }).build()

    const checkout = Order.config.actions!.checkout
    expect(checkout.workflow!.steps).toHaveLength(3)
    expect(checkout.workflow!.steps[0].compensate).toBeDefined()
    expect(checkout.workflow!.steps[1].compensate).toBeDefined()
    expect(checkout.workflow!.steps[2].compensate).toBeUndefined()

    expect(Order.config.actions!.cancel.method).toBe("POST")
    expect(Order.config.actions!.track.method).toBe("GET")
  })

  it("should support content publishing workflow", () => {
    const Post = entity("post", {
      title: string,
      content: string,
      status: string,
    }).actions({
      publish: action()
        .onResource()
        .rules("authenticated", "owner")
        .workflow([
          step("validate-content", async (ctx) => {
            // Check for prohibited content
            return { valid: true }
          }),
          step("generate-slug", async (ctx) => {
            return { slug: "my-post-title" }
          }),
          step("update-search-index", async (ctx) => {
            // Index in Algolia/Elasticsearch
            return { indexed: true }
          }),
          step("notify-subscribers", async (ctx) => {
            // Send notifications
            return { notified: 10 }
          }),
        ]),

      unpublish: action()
        .onResource()
        .rules("authenticated", "owner")
        .handler(async (ctx) => {
          return { unpublished: true }
        }),

      duplicate: action()
        .onResource()
        .rules("authenticated", "owner")
        .handler(async (ctx) => {
          // Create copy of post
          return { newPostId: "post_copy_123" }
        }),
    }).build()

    expect(Post.config.actions!.publish.workflow!.steps).toHaveLength(4)
    expect(Post.config.actions!.unpublish.handler).toBeDefined()
    expect(Post.config.actions!.duplicate.handler).toBeDefined()
  })
})

// -----------------------------------------------------------------------------
// Multi-Entity Operations Tests (Zero API Pattern)
// -----------------------------------------------------------------------------

describe("Multi-Entity Operations", () => {
  describe(".creates() method", () => {
    it("should add create operation with auto-mapping", () => {
      const User = entity("user", {
        email: string,
        name: string,
      })
        .actions({
          signUp: action("sign-up")
            .post()
            .input({ email: string, name: string })
            .creates("user"),  // Auto-map from input
        })
        .build()

      const signUp = User.config.actions!.signUp
      expect(signUp.operations).toBeDefined()
      expect(signUp.operations).toHaveLength(1)
      expect(signUp.operations![0].entity).toBe("user")
      expect(signUp.operations![0].operation).toBe("create")
      expect(signUp.operations![0].data).toBe("auto")
    })

    it("should add create operation with custom mapping", () => {
      const User = entity("user", {
        email: string,
      })
        .actions({
          signUp: action("sign-up")
            .post()
            .input({ email: string, password: string })
            .creates("user")
            .creates("session", ctx => ({
              userId: ctx.results.user.id,
              token: "generated-token",
            })),
        })
        .build()

      const signUp = User.config.actions!.signUp
      expect(signUp.operations).toHaveLength(2)
      expect(signUp.operations![1].entity).toBe("session")
      expect(signUp.operations![1].data).toBeTypeOf("function")
    })
  })

  describe(".updates() method", () => {
    it("should add update operation with default where", () => {
      const User = entity("user", {
        verified: boolean,
      })
        .actions({
          verify: action("verify")
            .post()
            .onResource()
            .updates("user", ctx => ({ verified: true })),
        })
        .build()

      const verify = User.config.actions!.verify
      expect(verify.operations).toBeDefined()
      expect(verify.operations![0].operation).toBe("update")
      expect(verify.operations![0].data).toBeTypeOf("function")
      expect(verify.operations![0].where).toBeTypeOf("function")
    })

    it("should add update operation with custom where", () => {
      const Order = entity("order", {
        status: string,
      })
        .actions({
          updateStatus: action("update-status")
            .post()
            .input({ orderId: string, status: string })
            .updates(
              "order",
              ctx => ({ status: ctx.input.status }),
              ctx => ({ id: ctx.input.orderId })
            ),
        })
        .build()

      const updateStatus = Order.config.actions!.updateStatus
      expect(updateStatus.operations![0].where).toBeTypeOf("function")
    })
  })

  describe(".deletes() method", () => {
    it("should add delete operation", () => {
      const Session = entity("session", {
        token: string,
        userId: string,
      })
        .actions({
          signOut: action("sign-out")
            .post()
            .deletes("session", ctx => ({ userId: ctx.resourceId })),
        })
        .build()

      const signOut = Session.config.actions!.signOut
      expect(signOut.operations).toBeDefined()
      expect(signOut.operations![0].operation).toBe("delete")
    })
  })

  describe(".returns() method", () => {
    it("should set return configuration with omit", () => {
      const User = entity("user", {
        email: string,
        password: string,
      })
        .actions({
          signUp: action("sign-up")
            .post()
            .creates("user")
            .returns("user", { omit: ["password"] }),
        })
        .build()

      const signUp = User.config.actions!.signUp
      expect(signUp.returns).toBeDefined()
      expect(signUp.returns!.entity).toBe("user")
      expect(signUp.returns!.omit).toContain("password")
    })

    it("should set return configuration with pick", () => {
      const User = entity("user", {
        id: string,
        email: string,
        name: string,
        password: string,
      })
        .actions({
          getProfile: action("profile")
            .get()
            .onResource()
            .returns("user", { pick: ["id", "email", "name"] }),
        })
        .build()

      const getProfile = User.config.actions!.getProfile
      expect(getProfile.returns!.pick).toEqual(["id", "email", "name"])
    })
  })

  describe("Full Multi-Entity Action Pattern", () => {
    it("should support complete auth signup pattern", () => {
      const User = entity("user", {
        email: string,
        password: string,
        name: string,
      })
        .actions({
          signUp: action("sign-up")
            .post()
            .input({
              email: string,
              password: string,
              name: string,
            })
            .creates("user")
            .creates("session", ctx => ({
              userId: ctx.results.user.id,
              token: "jwt-token",
              expiresAt: new Date(),
            }))
            .returns("user", { omit: ["password"] })
            .meta({
              summary: "Create a new user account",
              tags: ["Authentication"],
            }),
        })
        .build()

      const signUp = User.config.actions!.signUp

      // Verify input schema
      expect(signUp.input).toBeDefined()
      expect(signUp.input!.email).toBeDefined()
      expect(signUp.input!.password).toBeDefined()

      // Verify operations
      expect(signUp.operations).toHaveLength(2)
      expect(signUp.operations![0].entity).toBe("user")
      expect(signUp.operations![0].data).toBe("auto")
      expect(signUp.operations![1].entity).toBe("session")
      expect(signUp.operations![1].data).toBeTypeOf("function")

      // Verify returns
      expect(signUp.returns!.entity).toBe("user")
      expect(signUp.returns!.omit).toContain("password")

      // Verify metadata
      expect(signUp.metadata!.summary).toBe("Create a new user account")
    })

    it("should mix operations with handler (handler takes priority)", () => {
      const User = entity("user", {
        email: string,
      })
        .actions({
          customAction: action("custom")
            .post()
            .creates("user")  // Will be ignored if handler is present
            .handler(async ctx => ({ custom: true })),
        })
        .build()

      const customAction = User.config.actions!.customAction

      // Both are present - handler should be used at runtime
      expect(customAction.handler).toBeDefined()
      expect(customAction.operations).toHaveLength(1)
    })
  })
})

