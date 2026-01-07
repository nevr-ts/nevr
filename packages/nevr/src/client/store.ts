// =============================================================================
// CLIENT STORE
// Reactive state management using nanostores
// =============================================================================

import { atom, type WritableAtom, type Atom } from "nanostores"
import type { ClientStore } from "./types.js"

/**
 * Create a client store for managing reactive state
 */
export function createClientStore(): ClientStore {
  const atoms: Record<string, WritableAtom<any>> = {}
  const listeners: Map<string, Set<() => void>> = new Map()

  return {
    atoms,

    notify(signal: string) {
      const signalListeners = listeners.get(signal)
      if (signalListeners) {
        for (const listener of signalListeners) {
          listener()
        }
      }
    },

    listen(signal: string, listener: () => void) {
      if (!listeners.has(signal)) {
        listeners.set(signal, new Set())
      }
      listeners.get(signal)!.add(listener)
    },
  }
}

/**
 * Create a session atom with pending/error state
 */
export function createSessionAtom<T>() {
  return atom<{
    data: T | null
    error: any
    isPending: boolean
  }>({
    data: null,
    error: null,
    isPending: true,
  })
}

/**
 * Create a signal atom for triggering refetches
 */
export function createSignalAtom() {
  return atom(false)
}
