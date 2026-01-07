// =============================================================================
// LOGGER TEST
// Tests for logger interface and implementations
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  noopLogger,
  consoleLogger,
  createPrefixedLogger,
  getLogger,
  setLogger,
  type Logger,
} from "./logger.js"

describe("Logger", () => {
  describe("noopLogger", () => {
    it("should not throw when calling methods", () => {
      expect(() => noopLogger.debug("test")).not.toThrow()
      expect(() => noopLogger.info("test")).not.toThrow()
      expect(() => noopLogger.warn("test")).not.toThrow()
      expect(() => noopLogger.error("test")).not.toThrow()
    })

    it("should implement Logger interface", () => {
      expect(noopLogger.debug).toBeTypeOf("function")
      expect(noopLogger.info).toBeTypeOf("function")
      expect(noopLogger.warn).toBeTypeOf("function")
      expect(noopLogger.error).toBeTypeOf("function")
    })
  })

  describe("consoleLogger", () => {
    let consoleSpy: {
      debug: ReturnType<typeof vi.spyOn>
      log: ReturnType<typeof vi.spyOn>
      warn: ReturnType<typeof vi.spyOn>
      error: ReturnType<typeof vi.spyOn>
    }

    beforeEach(() => {
      consoleSpy = {
        debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
        log: vi.spyOn(console, "log").mockImplementation(() => {}),
        warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
        error: vi.spyOn(console, "error").mockImplementation(() => {}),
      }
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it("should log to console.warn", () => {
      consoleLogger.warn("test warning")
      expect(consoleSpy.warn).toHaveBeenCalledWith("[Nevr] test warning")
    })

    it("should log to console.error", () => {
      consoleLogger.error("test error")
      expect(consoleSpy.error).toHaveBeenCalledWith("[Nevr] test error")
    })

    it("should pass additional arguments", () => {
      const extra = { data: 123 }
      consoleLogger.error("test error", extra)
      expect(consoleSpy.error).toHaveBeenCalledWith("[Nevr] test error", extra)
    })
  })

  describe("createPrefixedLogger", () => {
    it("should create a logger with custom prefix", () => {
      const mockLogger: Logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }

      const prefixedLogger = createPrefixedLogger(mockLogger, "[MyPlugin]")

      prefixedLogger.info("test message")
      expect(mockLogger.info).toHaveBeenCalledWith("[MyPlugin] test message")
    })

    it("should pass additional arguments through", () => {
      const mockLogger: Logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }

      const prefixedLogger = createPrefixedLogger(mockLogger, "[MyPlugin]")
      const extra = { id: 1 }

      prefixedLogger.error("error occurred", extra)
      expect(mockLogger.error).toHaveBeenCalledWith("[MyPlugin] error occurred", extra)
    })

    it("should work with consoleLogger", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
      const prefixedLogger = createPrefixedLogger(consoleLogger, "[Test]")

      prefixedLogger.warn("warning")
      expect(spy).toHaveBeenCalled()

      vi.restoreAllMocks()
    })
  })

  describe("getLogger / setLogger", () => {
    let originalLogger: Logger

    beforeEach(() => {
      originalLogger = getLogger()
    })

    afterEach(() => {
      setLogger(originalLogger)
    })

    it("should return default consoleLogger", () => {
      const logger = getLogger()
      expect(logger).toBeDefined()
      expect(logger.debug).toBeTypeOf("function")
      expect(logger.info).toBeTypeOf("function")
      expect(logger.warn).toBeTypeOf("function")
      expect(logger.error).toBeTypeOf("function")
    })

    it("should allow setting a custom logger", () => {
      const customLogger: Logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }

      setLogger(customLogger)
      const logger = getLogger()

      expect(logger).toBe(customLogger)
    })

    it("should use custom logger after setting", () => {
      const customLogger: Logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }

      setLogger(customLogger)
      getLogger().info("test")

      expect(customLogger.info).toHaveBeenCalledWith("test")
    })
  })
})
