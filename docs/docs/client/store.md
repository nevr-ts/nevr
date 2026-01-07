# Store & Atoms

Reactive state management using nanostores.

## Overview

Nevr client uses [nanostores](https://github.com/nanostores/nanostores) for reactive state - tiny (300 bytes) state manager that works with React, Vue, Svelte, and vanilla JS.

---

## createClientStore()

Create a reactive store:

```typescript
import { createClientStore } from "nevr/client"

const store = createClientStore()
```

### ClientStore Interface

```typescript
interface ClientStore {
  /** Notify listeners of a signal */
  notify: (signal: string) => void
  /** Listen to a signal */
  listen: (signal: string, listener: () => void) => void
  /** All registered atoms */
  atoms: Record<string, WritableAtom<any>>
}
```

---

## createSessionAtom()

Create session state atom with loading/error states:

```typescript
import { createSessionAtom } from "nevr/client"

const $session = createSessionAtom<{ user: User; session: Session }>()

// Initial state
// { data: null, error: null, isPending: true }

// Subscribe
$session.subscribe(({ data, error, isPending }) => {
  console.log("Session:", data?.user)
})

// Update
$session.set({
  data: { user, session },
  error: null,
  isPending: false,
})
```

---

## createSignalAtom()

Create a signal atom for triggering refetches:

```typescript
import { createSignalAtom } from "nevr/client"

const $refetch = createSignalAtom()

// Toggle to trigger subscribers
$refetch.set(!$refetch.get())
```

---

## Using with React

```tsx
import { useStore } from "@nanostores/react"
// or
import { useStore } from "nevr/client/react"

function Profile() {
  const session = useStore(client.useSession)

  if (session.isPending) return <Loading />
  if (!session.data) return <Login />

  return <div>{session.data.user.name}</div>
}
```

---

## Using with Vue

```vue
<script setup>
import { useStore } from '@nanostores/vue'

const session = useStore(client.useSession)
</script>

<template>
  <div v-if="session.isPending">Loading...</div>
  <div v-else-if="session.data">{{ session.data.user.name }}</div>
</template>
```

---

## Using with Svelte

```svelte
<script>
  import { client } from './client'
  const session = client.useSession
</script>

{#if $session.isPending}
  <Loading />
{:else if $session.data}
  {$session.data.user.name}
{/if}
```

---

## Using with Vanilla JS

```typescript
// Subscribe
const unsubscribe = client.useSession.subscribe(({ data, isPending }) => {
  if (isPending) {
    document.getElementById("status").textContent = "Loading..."
  } else if (data) {
    document.getElementById("status").textContent = `Hello, ${data.user.name}`
  }
})

// Cleanup
unsubscribe()
```

---

## $store Property

Access the client store:

```typescript
const client = createTypedClient<API>({ ... })

// Notify signal
client.$store.notify("$sessionSignal")

// Listen to signal
client.$store.listen("$sessionSignal", () => {
  console.log("Session changed!")
})

// Access atoms
const atoms = client.$store.atoms
```

---

## Atom Types

```typescript
import type { Atom, WritableAtom } from "nanostores"

// Read-only atom
const $count: Atom<number>
$count.get()           // Get value
$count.subscribe(fn)   // Subscribe

// Writable atom
const $count: WritableAtom<number>
$count.get()           // Get value
$count.set(5)          // Set value
$count.subscribe(fn)   // Subscribe
```

---

## Custom Atoms

Create custom atoms for your app:

```typescript
import { atom } from "nanostores"

// Simple atom
const $theme = atom<"light" | "dark">("light")

// Use in React
const theme = useStore($theme)

// Toggle
$theme.set($theme.get() === "light" ? "dark" : "light")
```

---

## Next Steps

- [React Integration](/client/react)
- [Client Overview](/client/overview)
