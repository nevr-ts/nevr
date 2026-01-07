// =============================================================================
// REACT CLIENT
// React-specific hooks and utilities for NEVR client
// =============================================================================

import { useState, useEffect, useCallback, useRef } from "react"
import { useStore } from "@nanostores/react"
import type { Atom } from "nanostores"
import { createClient, type NevrClient } from "./vanilla.js"
import type { NevrClientOptions, SessionState, NevrFetchResponse } from "./types.js"

// Re-export vanilla client
export { createClient, type NevrClient } from "./vanilla.js"

/**
 * React-specific client type alias
 * Same as NevrClient but named for React context
 */
export type ReactNevrClient = NevrClient<NevrClientOptions> & {
  /**
   * Raw fetch method for custom API calls
   * Use for entity actions or custom endpoints
   *
   * @example
   * // Entity action call
   * await client.$fetch('/orders/123/checkout', {
   *   method: 'POST',
   *   body: { paymentMethodId: 'pm_xxx' }
   * })
   */
  $fetch: <T = unknown>(path: string, options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: unknown
    query?: Record<string, string>
  }) => Promise<NevrFetchResponse<T>>
  $store: any
  useSession: any
  $Infer: any
}

/**
 * Use a nanostore atom in React
 * This is a convenience re-export
 */
export { useStore }

/**
 * Create a React-aware NEVR client
 * This is an alias for createClient with better type inference for React
 */
export function createReactClient<Options extends NevrClientOptions>(
  options?: Options
): NevrClient<Options> {
  return createClient(options)
}

/**
 * Hook to use session state in React components
 *
 * @example
 * ```tsx
 * function Profile() {
 *   const { data, isPending, error } = useSession(client.useSession)
 *
 *   if (isPending) return <Loading />
 *   if (error) return <Error message={error.message} />
 *   if (!data) return <LoginPrompt />
 *
 *   return <div>Hello, {data.user.name}</div>
 * }
 * ```
 */
export function useSession<T>(sessionAtom: Atom<SessionState<T>>): SessionState<T> {
  return useStore(sessionAtom)
}

/**
 * Hook for making API calls with loading state
 *
 * @example
 * ```tsx
 * function CreatePost() {
 *   const { execute, data, error, isPending } = useMutation(
 *     (input) => client.posts.create(input)
 *   )
 *
 *   return (
 *     <form onSubmit={() => execute({ title: "Hello" })}>
 *       <button disabled={isPending}>
 *         {isPending ? "Creating..." : "Create Post"}
 *       </button>
 *     </form>
 *   )
 * }
 * ```
 */
export function useMutation<TInput, TData>(
  mutationFn: (input: TInput) => Promise<NevrFetchResponse<TData>>
): {
  execute: (input: TInput) => Promise<NevrFetchResponse<TData>>
  data: TData | null
  error: any
  isPending: boolean
  reset: () => void
} {
  const [state, setState] = useState<{
    data: TData | null
    error: any
    isPending: boolean
  }>({
    data: null,
    error: null,
    isPending: false,
  })

  const execute = useCallback(
    async (input: TInput) => {
      setState((prev) => ({ ...prev, isPending: true, error: null }))

      try {
        const result = await mutationFn(input)

        if (result.error) {
          setState({ data: null, error: result.error, isPending: false })
        } else {
          setState({ data: result.data, error: null, isPending: false })
        }

        return result
      } catch (err) {
        setState({ data: null, error: err, isPending: false })
        return { data: null, error: err as any }
      }
    },
    [mutationFn]
  )

  const reset = useCallback(() => {
    setState({ data: null, error: null, isPending: false })
  }, [])

  return {
    execute,
    data: state.data,
    error: state.error,
    isPending: state.isPending,
    reset,
  }
}

/**
 * Hook for querying data with automatic refetching
 *
 * @example
 * ```tsx
 * function PostList() {
 *   const { data, error, isPending, refetch } = useQuery(
 *     () => client.posts.list()
 *   )
 *
 *   if (isPending) return <Loading />
 *   if (error) return <Error message={error.message} />
 *
 *   return (
 *     <ul>
 *       {data?.map(post => <li key={post.id}>{post.title}</li>)}
 *     </ul>
 *   )
 * }
 * ```
 */
export function useQuery<TData>(
  queryFn: () => Promise<NevrFetchResponse<TData>>,
  options?: {
    enabled?: boolean
    refetchInterval?: number
    refetchOnWindowFocus?: boolean
  }
): {
  data: TData | null
  error: any
  isPending: boolean
  refetch: () => Promise<void>
} {
  const [state, setState] = useState<{
    data: TData | null
    error: any
    isPending: boolean
  }>({
    data: null,
    error: null,
    isPending: true,
  })

  const queryFnRef = useRef(queryFn)
  queryFnRef.current = queryFn

  const enabled = options?.enabled !== false

  const refetch = useCallback(async () => {
    setState((prev) => ({ ...prev, isPending: true }))

    try {
      const result = await queryFnRef.current()

      if (result.error) {
        setState({ data: null, error: result.error, isPending: false })
      } else {
        setState({ data: result.data, error: null, isPending: false })
      }
    } catch (err) {
      setState({ data: null, error: err, isPending: false })
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      refetch()
    }
  }, [enabled, refetch])

  // Refetch interval
  useEffect(() => {
    if (!enabled || !options?.refetchInterval) return

    const interval = setInterval(refetch, options.refetchInterval * 1000)
    return () => clearInterval(interval)
  }, [enabled, options?.refetchInterval, refetch])

  // Refetch on window focus
  useEffect(() => {
    if (!enabled || options?.refetchOnWindowFocus === false) return
    if (typeof window === "undefined") return

    const handleFocus = () => refetch()
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [enabled, options?.refetchOnWindowFocus, refetch])

  return {
    data: state.data,
    error: state.error,
    isPending: state.isPending,
    refetch,
  }
}
