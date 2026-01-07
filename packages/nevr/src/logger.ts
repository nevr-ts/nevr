// =============================================================================
// LOGGER
// Structured logging interface for Nevr
// =============================================================================

/**
 * Logger interface that can be implemented by any logging library
 * (pino, winston, console, etc.)
 */
export interface Logger {
  /** Debug level - verbose information for development */
  debug(message: string, ...args: unknown[]): void
  /** Info level - general operational information */
  info(message: string, ...args: unknown[]): void
  /** Warn level - something unexpected but not critical */
  warn(message: string, ...args: unknown[]): void
  /** Error level - something failed */
  error(message: string, ...args: unknown[]): void
}

/**
 * No-op logger that silently discards all messages
 * Useful for testing or when logging is disabled
 */
export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

/**
 * Console logger that wraps the global console
 * Default logger used when no custom logger is provided
 */
export const consoleLogger: Logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[Nevr] ${message}`, ...args)
    }
  },
  info: (message: string, ...args: unknown[]) => {
    console.info(`[Nevr] ${message}`, ...args)
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[Nevr] ${message}`, ...args)
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[Nevr] ${message}`, ...args)
  },
}

/**
 * Create a prefixed logger that adds a prefix to all messages
 * Useful for plugin-specific logging
 * 
 * @example
 * const authLogger = createPrefixedLogger(logger, "[Auth]")
 * authLogger.info("User logged in") // "[Nevr] [Auth] User logged in"
 */
export function createPrefixedLogger(logger: Logger, prefix: string): Logger {
  return {
    debug: (message: string, ...args: unknown[]) => logger.debug(`${prefix} ${message}`, ...args),
    info: (message: string, ...args: unknown[]) => logger.info(`${prefix} ${message}`, ...args),
    warn: (message: string, ...args: unknown[]) => logger.warn(`${prefix} ${message}`, ...args),
    error: (message: string, ...args: unknown[]) => logger.error(`${prefix} ${message}`, ...args),
  }
}

// -----------------------------------------------------------------------------
// Global Logger (for use in modules that don't have access to NevrInstance)
// -----------------------------------------------------------------------------

let globalLogger: Logger = consoleLogger

/**
 * Get the current global logger
 */
export function getLogger(): Logger {
  return globalLogger
}

/**
 * Set the global logger
 * This is called automatically when nevr() is initialized with a logger option
 */
export function setLogger(logger: Logger): void {
  globalLogger = logger
}

/**
 * Reset the global logger to the default console logger
 */
export function resetLogger(): void {
  globalLogger = consoleLogger
}
