import { describe, it, expect, beforeEach, vi } from "vitest"
import {
    workflow,
    executeWorkflow,
    WorkflowBuilder,
    createEntityStep,
    updateEntityStep,
    deleteEntityStep,
} from "./workflow.js"
import type { Driver } from "./types.js"

// Mock driver
const createMockDriver = (): Driver => ({
    name: "mock",
    findMany: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation((entity, data) =>
        Promise.resolve({ id: `${entity}_1`, ...data })
    ),
    update: vi.fn().mockImplementation((entity, id, data) =>
        Promise.resolve({ id, ...data })
    ),
    delete: vi.fn().mockResolvedValue({ id: "1" }),
    count: vi.fn().mockResolvedValue(0),
    transaction: vi.fn().mockImplementation(async (fn) => fn({} as any)),
})

describe("Workflow Engine", () => {
    let driver: Driver

    beforeEach(() => {
        driver = createMockDriver()
    })

    describe("WorkflowBuilder", () => {
        it("should create a workflow with name", () => {
            const wf = workflow<{ orderId: string }>("checkout").build()
            expect(wf.name).toBe("checkout")
            expect(wf.steps).toHaveLength(0)
        })

        it("should add steps with step()", () => {
            const wf = workflow<{ count: number }>("test")
                .step("step1", async () => "result1")
                .step("step2", async () => "result2")
                .build()

            expect(wf.steps).toHaveLength(2)
            expect(wf.steps[0].name).toBe("step1")
            expect(wf.steps[1].name).toBe("step2")
        })

        it("should add steps with compensate functions", () => {
            const wf = workflow<{ count: number }>("test")
                .step(
                    "reserve",
                    async () => ({ reservationId: "123" }),
                    async (ctx, result) => { /* release */ }
                )
                .build()

            expect(wf.steps[0].compensate).toBeDefined()
        })

        it("should set initial data with withData()", () => {
            const wf = workflow<{ userId: string }>("test")
                .withData({ userId: "user_123" })
                .build()

            expect(wf.initialData).toEqual({ userId: "user_123" })
        })

        it("should enable transactions with transactional()", () => {
            const wf = workflow<{}>("test")
                .transactional()
                .build()

            expect(wf.useTransaction).toBe(true)
        })

        it("should set timeout with withTimeout()", () => {
            const wf = workflow<{}>("test")
                .withTimeout(5000)
                .build()

            expect(wf.timeout).toBe(5000)
        })

        it("should set hooks with withHooks()", () => {
            const onStart = vi.fn()
            const onComplete = vi.fn()

            const wf = workflow<{}>("test")
                .withHooks({ onStart, onComplete })
                .build()

            expect(wf.hooks?.onStart).toBe(onStart)
            expect(wf.hooks?.onComplete).toBe(onComplete)
        })
    })

    describe("executeWorkflow", () => {
        it("should execute all steps in order", async () => {
            const order: string[] = []

            const wf = workflow<{ result: string }>("test")
                .step("step1", async () => { order.push("step1"); return "a" })
                .step("step2", async () => { order.push("step2"); return "b" })
                .step("step3", async () => { order.push("step3"); return "c" })
                .build()

            const result = await executeWorkflow(driver, wf)

            expect(result.success).toBe(true)
            expect(order).toEqual(["step1", "step2", "step3"])
        })

        it("should pass context between steps", async () => {
            const wf = workflow<{ value: number }>("test")
                .withData({ value: 0 })
                .step("increment", async (ctx) => {
                    ctx.set("value", (ctx.get("value") || 0) + 10)
                    return ctx.get("value")
                })
                .step("double", async (ctx) => {
                    ctx.set("value", (ctx.get("value") || 0) * 2)
                    return ctx.get("value")
                })
                .build()

            const result = await executeWorkflow(driver, wf)

            expect(result.success).toBe(true)
            expect(result.data.value).toBe(20)
        })

        it("should return failure when step throws", async () => {
            const wf = workflow<{}>("test")
                .step("failing", async () => {
                    throw new Error("Step failed")
                })
                .build()

            const result = await executeWorkflow(driver, wf)

            expect(result.success).toBe(false)
            expect(result.error?.message).toBe("Step failed")
            expect(result.failedStep).toBe("failing")
        })

        it("should include duration in result", async () => {
            const wf = workflow<{}>("test")
                .step("quick", async () => "done")
                .build()

            const result = await executeWorkflow(driver, wf)

            expect(result.duration).toBeGreaterThanOrEqual(0)
        })

        it("should include metadata in result", async () => {
            const wf = workflow<{}>("my-workflow")
                .step("step1", async () => "done")
                .build()

            const result = await executeWorkflow(driver, wf)

            expect(result.metadata.name).toBe("my-workflow")
            expect(result.metadata.id).toBeDefined()
            expect(result.metadata.startedAt).toBeInstanceOf(Date)
        })
    })

    describe("Compensation (Rollback)", () => {
        it("should compensate completed steps on failure", async () => {
            const compensated: string[] = []

            const wf = workflow<{}>("test")
                .step(
                    "step1",
                    async () => "result1",
                    async () => { compensated.push("step1") }
                )
                .step(
                    "step2",
                    async () => "result2",
                    async () => { compensated.push("step2") }
                )
                .step(
                    "step3",
                    async () => { throw new Error("Failed") }
                )
                .build()

            const result = await executeWorkflow(driver, wf)

            expect(result.success).toBe(false)
            expect(result.failedStep).toBe("step3")
            // Should compensate in reverse order
            expect(compensated).toEqual(["step2", "step1"])
        })

        it("should include compensated steps in result", async () => {
            const wf = workflow<{}>("test")
                .step("step1", async () => "a", async () => { })
                .step("step2", async () => "b", async () => { })
                .step("step3", async () => { throw new Error("Failed") })
                .build()

            const result = await executeWorkflow(driver, wf)

            expect(result.compensatedSteps).toContain("step2")
            expect(result.compensatedSteps).toContain("step1")
        })

        it("should pass result to compensate function", async () => {
            let capturedResult: any

            const wf = workflow<{}>("test")
                .step(
                    "step1",
                    async () => ({ reservationId: "res_123" }),
                    async (ctx, result) => { capturedResult = result }
                )
                .step("step2", async () => { throw new Error("Failed") })
                .build()

            await executeWorkflow(driver, wf)

            expect(capturedResult).toEqual({ reservationId: "res_123" })
        })
    })

    describe("Lifecycle Hooks", () => {
        it("should call onStart hook", async () => {
            const onStart = vi.fn()

            const wf = workflow<{}>("test")
                .step("step1", async () => "done")
                .withHooks({ onStart })
                .build()

            await executeWorkflow(driver, wf)

            expect(onStart).toHaveBeenCalledTimes(1)
        })

        it("should call onComplete hook on success", async () => {
            const onComplete = vi.fn()

            const wf = workflow<{}>("test")
                .step("step1", async () => "done")
                .withHooks({ onComplete })
                .build()

            await executeWorkflow(driver, wf)

            expect(onComplete).toHaveBeenCalledTimes(1)
            expect(onComplete.mock.calls[0][0].success).toBe(true)
        })

        it("should call onFailed hook on failure", async () => {
            const onFailed = vi.fn()

            const wf = workflow<{}>("test")
                .step("step1", async () => { throw new Error("Failed") })
                .withHooks({ onFailed })
                .build()

            await executeWorkflow(driver, wf)

            expect(onFailed).toHaveBeenCalledTimes(1)
            expect(onFailed.mock.calls[0][0].success).toBe(false)
        })

        it("should call onStepComplete for each step", async () => {
            const onStepComplete = vi.fn()

            const wf = workflow<{}>("test")
                .step("step1", async () => "a")
                .step("step2", async () => "b")
                .withHooks({ onStepComplete })
                .build()

            await executeWorkflow(driver, wf)

            expect(onStepComplete).toHaveBeenCalledTimes(2)
        })

        it("should call onCompensate during rollback", async () => {
            const onCompensate = vi.fn()

            const wf = workflow<{}>("test")
                .step("step1", async () => "a", async () => { })
                .step("step2", async () => { throw new Error("Failed") })
                .withHooks({ onCompensate })
                .build()

            await executeWorkflow(driver, wf)

            expect(onCompensate).toHaveBeenCalledWith("step1", expect.any(Object))
        })
    })

    describe("Pre-built Entity Steps", () => {
        it("should create entity step", async () => {
            const step = createEntityStep("create-user", "user", () => ({
                email: "test@example.com",
                name: "Test"
            }))

            expect(step.name).toBe("create-user")
            expect(step.execute).toBeDefined()
            expect(step.compensate).toBeDefined()
        })

        it("should update entity step", async () => {
            const step = updateEntityStep("update-user", "user",
                () => ({ id: "user_1" }),
                () => ({ name: "Updated" })
            )

            expect(step.name).toBe("update-user")
            expect(step.execute).toBeDefined()
        })

        it("should delete entity step", async () => {
            const step = deleteEntityStep("delete-user", "user", () => ({ id: "user_1" }))

            expect(step.name).toBe("delete-user")
            expect(step.execute).toBeDefined()
            expect(step.compensate).toBeDefined()
        })
    })
})
