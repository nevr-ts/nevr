// =============================================================================
// CLIENT FETCH
// Type-safe fetch wrapper for NEVR API calls with middleware support
// =============================================================================

import type {
  NevrFetch,
  NevrFetchOptions,
  NevrFetchResponse,
  NevrFetchError,
  NevrFetchPlugin,
  ClientMiddleware,
  ResponseInterceptor,
  MiddlewareRequestContext,
  MiddlewareResponseContext,
} from "./types.js"

export interface CreateFetchOptions {
  baseURL: string
  basePath: string
  defaultOptions?: NevrFetchOptions
  plugins?: NevrFetchPlugin[]
  /** Client middleware chain */
  middleware?: ClientMiddleware[]
  /** Response interceptors */
  interceptors?: ResponseInterceptor[]
}

/**
 * Build query string from object
 */
function buildQueryString(query: Record<string, any>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        for (const v of value) {
          params.append(key, String(v))
        }
      } else {
        params.append(key, String(value))
      }
    }
  }
  const str = params.toString()
  return str ? `?${str}` : ""
}

/**
 * Parse response body based on content type
 */
async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type")

  if (contentType?.includes("application/json")) {
    try {
      return await response.json()
    } catch {
      return null
    }
  }

  if (contentType?.includes("text/")) {
    return await response.text()
  }

  return null
}

/**
 * Create a fetch error from response
 */
function createFetchError(response: Response, data: any): NevrFetchError {
  // Handle nested error object (Nevr standard format: { error: { code, message } })
  const errorObj = data?.error

  let message = data?.message || response.statusText
  let code = data?.code
  let details = data?.details

  // If valid nested error object found
  if (errorObj && typeof errorObj === "object") {
    message = errorObj.message || message
    code = errorObj.code || code
    details = errorObj.details || details
  } else if (typeof errorObj === "string") {
    message = errorObj
  }

  return {
    status: response.status,
    statusText: response.statusText,
    message,
    code,
    details,
  }
}

/**
 * Create the NEVR fetch function with middleware support
 */
export function createNevrFetch(options: CreateFetchOptions): NevrFetch {
  const {
    baseURL,
    basePath,
    defaultOptions = {},
    plugins = [],
    middleware = [],
    interceptors = [],
  } = options

  return async function nevrFetch<T = any>(
    path: string,
    fetchOptions?: NevrFetchOptions
  ): Promise<NevrFetchResponse<T>> {
    // Merge options
    const opts: NevrFetchOptions = {
      ...defaultOptions,
      ...fetchOptions,
    }

    // Build URL
    const queryString = opts.query ? buildQueryString(opts.query) : ""
    const fullPath = path.startsWith("/") ? path : `/${path}`
    const url = `${baseURL}${basePath}${fullPath}${queryString}`

    // Build request options
    const method = opts.method || "GET"
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...opts.headers,
    }

    // Create middleware request context
    let abortedResponse: NevrFetchResponse<any> | null = null
    const requestContext: MiddlewareRequestContext = {
      url,
      path: fullPath,
      method,
      headers,
      body: opts.body,
      query: opts.query,
      aborted: false,
      abort: (response) => {
        abortedResponse = response
        requestContext.aborted = true
      },
    }

    // Core fetch function (innermost in middleware chain)
    const coreFetch = async (): Promise<MiddlewareResponseContext> => {
      // Check if aborted
      if (requestContext.aborted && abortedResponse) {
        return {
          request: requestContext,
          data: abortedResponse.data,
          error: abortedResponse.error,
          status: abortedResponse.error?.status || 200,
          ok: !abortedResponse.error,
        }
      }

      const requestInit: RequestInit = {
        method: requestContext.method,
        headers: requestContext.headers,
        credentials: opts.credentials || "include",
      }

      // Add body for non-GET requests
      if (requestContext.method !== "GET" && requestContext.body) {
        requestInit.body = JSON.stringify(requestContext.body)
      }

      try {
        // Run legacy onRequest hooks
        await opts.onRequest?.({ url: requestContext.url, options: requestInit })
        for (const plugin of plugins) {
          await plugin.onRequest?.({ url: requestContext.url, options: requestInit })
        }

        // Make the request
        const fetchFn = opts.customFetch || fetch
        const response = await fetchFn(requestContext.url, requestInit)

        // Run legacy onResponse hooks
        for (const plugin of plugins) {
          await plugin.onResponse?.({ response })
        }

        // Parse response
        const data = await parseResponse(response)

        await opts.onResponse?.({ response, data })

        // Check for errors
        if (!response.ok) {
          const error = createFetchError(response, data)
          await opts.onError?.({ error })
          return {
            request: requestContext,
            data: null,
            error,
            status: response.status,
            ok: false,
          }
        }

        // Success
        await opts.onSuccess?.({ data })
        return {
          request: requestContext,
          data,
          error: null,
          status: response.status,
          ok: true,
        }
      } catch (err) {
        // Network or parsing error
        const error: NevrFetchError = {
          status: 0,
          statusText: "Network Error",
          message: err instanceof Error ? err.message : "An unknown error occurred",
        }
        await opts.onError?.({ error })
        return {
          request: requestContext,
          data: null,
          error,
          status: 0,
          ok: false,
        }
      }
    }

    // Build middleware chain (reverse order so first middleware wraps outer)
    let chain = coreFetch
    for (let i = middleware.length - 1; i >= 0; i--) {
      const mw = middleware[i]
      const next = chain
      chain = () => mw(requestContext, next)
    }

    // Execute middleware chain
    let result = await chain()

    // Run response interceptors
    for (const interceptor of interceptors) {
      const interceptorResult = await interceptor(result)
      if ("retry" in interceptorResult && interceptorResult.retry) {
        // Retry the request
        result = await chain()
      } else {
        // Type guard: if not retry, it's a MiddlewareResponseContext
        result = interceptorResult as MiddlewareResponseContext
      }
    }

    // Return standard response format
    return {
      data: result.data as T,
      error: result.error,
    }
  }
}
