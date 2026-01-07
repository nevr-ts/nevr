// =============================================================================
// WORKFLOW ENGINE
// Atomic operations with rollback support for NEVR
// Entity-first approach with saga pattern compensation
// =============================================================================

import type { Driver, Where } from "./types.js"
import { getLogger } from "./logger.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Context passed to workflow steps
 */
export interface WorkflowContext<TData = Record<string, unknown>> {
  /** Database driver */
  driver: Driver
  /** Shared data between steps */
  data: TData
  /** Set data for subsequent steps */
  set: <K extends keyof TData>(key: K, value: TData[K]) => void
  /** Get data from previous steps */
  get: <K extends keyof TData>(key: K) => TData[K] | undefined
  /** Current step index */
  stepIndex: number
  /** Total steps count */
  totalSteps: number
  /** Workflow metadata */
  metadata: WorkflowMetadata
}

/**
 * Workflow metadata
 */
export interface WorkflowMetadata {
  /** Unique workflow ID */
  id: string
  /** Workflow name */
  name: string
  /** When workflow started */
  startedAt: Date
  /** Execution timeout in ms */
  timeout?: number
}

/**
 * Result of a single step execution
 */
export interface StepResult<T = unknown> {
  /** Whether step succeeded */
  success: boolean
  /** Result data from step */
  data?: T
  /** Error if step failed */
  error?: Error
}

/**
 * Result of workflow execution
 */
export interface WorkflowResult<TData = Record<string, unknown>> {
  /** Whether entire workflow succeeded */
  success: boolean
  /** Final workflow data */
  data: TData
  /** Error if workflow failed */
  error?: Error
  /** Which step failed (if any) */
  failedStep?: string
  /** Steps that were compensated */
  compensatedSteps?: string[]
  /** Execution duration in ms */
  duration: number
  /** Workflow metadata */
  metadata: WorkflowMetadata
}

/**
 * Step definition
 */
export interface WorkflowStep<TData = Record<string, unknown>, TResult = unknown> {
  /** Step name (for logging and identification) */
  name: string
  /**
   * Execute the step
   * @returns Result data or void
   */
  execute: (ctx: WorkflowContext<TData>) => Promise<TResult> | TResult
  /**
   * Compensate/rollback this step if a later step fails
   * Only called if execute succeeded but workflow failed later
   */
  compensate?: (ctx: WorkflowContext<TData>, result: TResult) => Promise<void> | void
  /**
   * Retry configuration for this step
   */
  retry?: {
    /** Max retry attempts */
    maxAttempts: number
    /** Delay between retries in ms */
    delay?: number
    /** Exponential backoff multiplier */
    backoff?: number
  }
  /**
   * Timeout for this step in ms
   */
  timeout?: number
}

/**
 * Workflow configuration
 */
export interface WorkflowConfig<TData = Record<string, unknown>> {
  /** Workflow name */
  name: string
  /** Steps to execute */
  steps: WorkflowStep<TData, any>[]
  /** Initial data */
  initialData?: Partial<TData>
  /**
   * Use database transaction if available
   * @default false
   */
  useTransaction?: boolean
  /**
   * Global timeout for entire workflow in ms
   */
  timeout?: number
  /**
   * Hooks for workflow lifecycle
   */
  hooks?: {
    onStart?: (ctx: WorkflowContext<TData>) => Promise<void> | void
    onStepComplete?: (stepName: string, result: StepResult, ctx: WorkflowContext<TData>) => Promise<void> | void
    onStepFailed?: (stepName: string, error: Error, ctx: WorkflowContext<TData>) => Promise<void> | void
    onCompensate?: (stepName: string, ctx: WorkflowContext<TData>) => Promise<void> | void
    onComplete?: (result: WorkflowResult<TData>) => Promise<void> | void
    onFailed?: (result: WorkflowResult<TData>) => Promise<void> | void
  }
}

// -----------------------------------------------------------------------------
// Workflow Builder (Fluent API)
// -----------------------------------------------------------------------------

export class WorkflowBuilder<TData = Record<string, unknown>> {
  private config: WorkflowConfig<TData>

  constructor(name: string) {
    this.config = {
      name,
      steps: [],
    }
  }

  /**
   * Add a step to the workflow
   */
  step<TResult = unknown>(
    name: string,
    execute: WorkflowStep<TData, TResult>["execute"],
    compensate?: WorkflowStep<TData, TResult>["compensate"]
  ): this {
    this.config.steps.push({ name, execute, compensate })
    return this
  }

  /**
   * Add a step with full configuration
   */
  addStep<TResult = unknown>(step: WorkflowStep<TData, TResult>): this {
    this.config.steps.push(step)
    return this
  }

  /**
   * Set initial data
   */
  withData(data: Partial<TData>): this {
    this.config.initialData = data
    return this
  }

  /**
   * Enable database transaction
   */
  transactional(): this {
    this.config.useTransaction = true
    return this
  }

  /**
   * Set workflow timeout
   */
  withTimeout(ms: number): this {
    this.config.timeout = ms
    return this
  }

  /**
   * Add lifecycle hooks
   */
  withHooks(hooks: WorkflowConfig<TData>["hooks"]): this {
    this.config.hooks = { ...this.config.hooks, ...hooks }
    return this
  }

  /**
   * Build the workflow configuration
   */
  build(): WorkflowConfig<TData> {
    return this.config
  }
}

// -----------------------------------------------------------------------------
// Workflow Executor
// -----------------------------------------------------------------------------

/**
 * Execute a workflow with automatic rollback on failure
 */
export async function executeWorkflow<TData = Record<string, unknown>>(
  driver: Driver,
  config: WorkflowConfig<TData>
): Promise<WorkflowResult<TData>> {
  const startTime = Date.now()
  const workflowId = generateWorkflowId()

  const metadata: WorkflowMetadata = {
    id: workflowId,
    name: config.name,
    startedAt: new Date(),
    timeout: config.timeout,
  }

  const data = (config.initialData || {}) as TData
  const completedSteps: { step: WorkflowStep<TData, any>; result: any }[] = []

  // Create context factory
  const createContext = (stepIndex: number): WorkflowContext<TData> => ({
    driver,
    data,
    set: <K extends keyof TData>(key: K, value: TData[K]) => {
      (data as any)[key] = value
    },
    get: <K extends keyof TData>(key: K) => data[key],
    stepIndex,
    totalSteps: config.steps.length,
    metadata,
  })

  // Execute workflow
  const executeSteps = async (txDriver: Driver): Promise<WorkflowResult<TData>> => {
    const ctx = createContext(0)
    ctx.driver = txDriver

    // Call onStart hook
    if (config.hooks?.onStart) {
      await config.hooks.onStart(ctx)
    }

    // Execute each step
    for (let i = 0; i < config.steps.length; i++) {
      const step = config.steps[i]
      const stepCtx = createContext(i)
      stepCtx.driver = txDriver

      try {
        // Execute step with optional retry
        const result = await executeStepWithRetry(step, stepCtx)
        completedSteps.push({ step, result })

        // Call onStepComplete hook
        if (config.hooks?.onStepComplete) {
          await config.hooks.onStepComplete(step.name, { success: true, data: result }, stepCtx)
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))

        // Call onStepFailed hook
        if (config.hooks?.onStepFailed) {
          await config.hooks.onStepFailed(step.name, err, stepCtx)
        }

        // If using transaction, throw to trigger rollback
        if (config.useTransaction) {
          throw error
        }

        // Otherwise, run compensation (saga pattern)
        const compensationResult = await runCompensation(completedSteps, stepCtx, config.hooks?.onCompensate)

        const result: WorkflowResult<TData> = {
          success: false,
          data,
          error: err,
          failedStep: step.name,
          compensatedSteps: compensationResult.compensated,
          duration: Date.now() - startTime,
          metadata,
        }

        // Call onFailed hook
        if (config.hooks?.onFailed) {
          await config.hooks.onFailed(result)
        }

        return result
      }
    }

    const result: WorkflowResult<TData> = {
      success: true,
      data,
      duration: Date.now() - startTime,
      metadata,
    }

    // Call onComplete hook
    if (config.hooks?.onComplete) {
      await config.hooks.onComplete(result)
    }

    return result
  }

  // Run with or without transaction
  try {
    if (config.useTransaction && driver.transaction) {
      return await driver.transaction(async (tx) => {
        return executeSteps(tx)
      })
    } else {
      return await executeSteps(driver)
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))

    // Transaction rollback already happened, no need for compensation
    const result: WorkflowResult<TData> = {
      success: false,
      data,
      error: err,
      failedStep: config.steps[completedSteps.length]?.name,
      duration: Date.now() - startTime,
      metadata,
    }

    if (config.hooks?.onFailed) {
      await config.hooks.onFailed(result)
    }

    return result
  }
}

/**
 * Execute a step with retry logic
 */
async function executeStepWithRetry<TData, TResult>(
  step: WorkflowStep<TData, TResult>,
  ctx: WorkflowContext<TData>
): Promise<TResult> {
  const maxAttempts = step.retry?.maxAttempts || 1
  const baseDelay = step.retry?.delay || 100
  const backoff = step.retry?.backoff || 2

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Execute with optional timeout
      if (step.timeout) {
        return await withTimeout(step.execute(ctx), step.timeout, `Step "${step.name}" timed out`)
      }
      return await step.execute(ctx)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(backoff, attempt - 1)
        await sleep(delay)
      }
    }
  }

  throw lastError
}

/**
 * Compensation error for a single step
 */
export interface CompensationError {
  stepName: string
  error: Error
}

/**
 * Aggregated error when compensation fails
 */
export class CompensationFailedError extends Error {
  readonly errors: CompensationError[]
  readonly compensatedSteps: string[]

  constructor(errors: CompensationError[], compensatedSteps: string[]) {
    const stepNames = errors.map(e => e.stepName).join(", ")
    super(`Compensation failed for steps: ${stepNames}`)
    this.name = "CompensationFailedError"
    this.errors = errors
    this.compensatedSteps = compensatedSteps
  }
}

/**
 * Result of running compensation
 */
export interface CompensationResult {
  /** Steps that were successfully compensated */
  compensated: string[]
  /** Errors from failed compensations */
  errors: CompensationError[]
  /** Whether all compensations succeeded */
  success: boolean
}

/**
 * Run compensation for completed steps in reverse order
 * Continues running all compensations even if some fail
 */
async function runCompensation<TData>(
  completedSteps: { step: WorkflowStep<TData, any>; result: any }[],
  ctx: WorkflowContext<TData>,
  onCompensate?: (stepName: string, ctx: WorkflowContext<TData>) => Promise<void> | void
): Promise<CompensationResult> {
  const compensated: string[] = []
  const errors: CompensationError[] = []

  // Run compensation in reverse order
  for (let i = completedSteps.length - 1; i >= 0; i--) {
    const { step, result } = completedSteps[i]

    if (step.compensate) {
      try {
        await step.compensate(ctx, result)
        compensated.push(step.name)

        if (onCompensate) {
          await onCompensate(step.name, ctx)
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        errors.push({ stepName: step.name, error: err })
        getLogger().error(`[Workflow] Compensation failed for step "${step.name}":`, error)
      }
    }
  }

  return {
    compensated,
    errors,
    success: errors.length === 0,
  }
}

// -----------------------------------------------------------------------------
// Entity-First Workflow Helpers
// -----------------------------------------------------------------------------

/**
 * Create a step that creates an entity record
 */
export function createEntityStep<TData = Record<string, unknown>>(
  stepName: string,
  entityName: string,
  getData: (ctx: WorkflowContext<TData>) => Record<string, unknown>,
  options?: {
    /** Key to store created record ID in context */
    storeAs?: keyof TData
    /** Whether to include compensation */
    compensate?: boolean
  }
): WorkflowStep<TData, Record<string, unknown>> {
  return {
    name: stepName,
    execute: async (ctx) => {
      const data = getData(ctx)
      const created = await ctx.driver.create(entityName, data)

      if (options?.storeAs) {
        ctx.set(options.storeAs, (created as any).id)
      }

      return created as Record<string, unknown>
    },
    compensate: options?.compensate !== false ? async (ctx, result) => {
      if (result?.id) {
        await ctx.driver.delete(entityName, { id: result.id })
      }
    } : undefined,
  }
}

/**
 * Create a step that updates an entity record
 */
export function updateEntityStep<TData = Record<string, unknown>>(
  stepName: string,
  entityName: string,
  getWhere: (ctx: WorkflowContext<TData>) => Where,
  getData: (ctx: WorkflowContext<TData>) => Record<string, unknown>,
  options?: {
    /** Whether to include compensation (restore previous values) */
    compensate?: boolean
  }
): WorkflowStep<TData, { previous: Record<string, unknown>; updated: Record<string, unknown> }> {
  return {
    name: stepName,
    execute: async (ctx) => {
      const where = getWhere(ctx)
      const updateData = getData(ctx)

      // Get previous values for compensation
      const previous = await ctx.driver.findOne<Record<string, unknown>>(entityName, where)
      if (!previous) {
        throw new Error(`${entityName} not found for update`)
      }

      const updated = await ctx.driver.update<Record<string, unknown>>(entityName, where, updateData)

      return { previous, updated }
    },
    compensate: options?.compensate !== false ? async (ctx, result) => {
      if (result?.previous?.id) {
        // Restore only the fields that were changed
        const where = getWhere(ctx)
        const restoreData: Record<string, unknown> = {}
        const updateData = getData(ctx)

        for (const key of Object.keys(updateData)) {
          if (key in result.previous) {
            restoreData[key] = result.previous[key]
          }
        }

        await ctx.driver.update(entityName, where, restoreData)
      }
    } : undefined,
  }
}

/**
 * Create a step that deletes an entity record
 */
export function deleteEntityStep<TData = Record<string, unknown>>(
  stepName: string,
  entityName: string,
  getWhere: (ctx: WorkflowContext<TData>) => Where,
  options?: {
    /** Whether to include compensation (recreate deleted record) */
    compensate?: boolean
  }
): WorkflowStep<TData, Record<string, unknown>> {
  return {
    name: stepName,
    execute: async (ctx) => {
      const where = getWhere(ctx)

      // Get record before deletion for compensation
      const record = await ctx.driver.findOne<Record<string, unknown>>(entityName, where)
      if (!record) {
        throw new Error(`${entityName} not found for deletion`)
      }

      await ctx.driver.delete(entityName, where)

      return record
    },
    compensate: options?.compensate !== false ? async (ctx, result) => {
      if (result) {
        await ctx.driver.create(entityName, result)
      }
    } : undefined,
  }
}

// -----------------------------------------------------------------------------
// Factory Functions
// -----------------------------------------------------------------------------

/**
 * Create a new workflow builder
 */
export function workflow<TData = Record<string, unknown>>(name: string): WorkflowBuilder<TData> {
  return new WorkflowBuilder<TData>(name)
}

/**
 * Create and execute a workflow in one call
 */
export async function runWorkflow<TData = Record<string, unknown>>(
  driver: Driver,
  name: string,
  steps: WorkflowStep<TData, any>[],
  options?: {
    initialData?: Partial<TData>
    useTransaction?: boolean
    timeout?: number
  }
): Promise<WorkflowResult<TData>> {
  return executeWorkflow(driver, {
    name,
    steps,
    initialData: options?.initialData,
    useTransaction: options?.useTransaction,
    timeout: options?.timeout,
  })
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

function generateWorkflowId(): string {
  return `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withTimeout<T>(promise: Promise<T> | T, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ])
}
