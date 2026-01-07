# React Integration

React hooks for Nevr client using nanostores.

## Setup

```typescript
import { createTypedClient } from "nevr/client"
import { entityClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import type { API } from "./server/api"

export const client = createTypedClient<API>({
  baseURL: "http://localhost:3000",
  plugins: [authClient(), entityClient({ entities: ["user", "post"] })],
})
```

---

## useSession()

Reactive session state:

```tsx
import { useSession } from "nevr/client/react"

function Profile() {
  const { data, isPending, error } = useSession(client.useSession)

  if (isPending) return <Loading />
  if (error) return <Error message={error.message} />
  if (!data) return <LoginPrompt />

  return <div>Welcome, {data.user.name}</div>
}
```

### SessionState

```typescript
interface SessionState<TUser, TSession> {
  data: { user: TUser; session: TSession } | null
  error: NevrFetchError | null
  isPending: boolean
}
```

---

## useQuery()

Fetch with loading state and auto-refetch:

```tsx
import { useQuery } from "nevr/client/react"

function PostList() {
  const { data, error, isPending, refetch } = useQuery(
    () => client.posts.list({ take: 10 }),
    { refetchOnWindowFocus: true }
  )

  if (isPending) return <Loading />
  if (error) return <Error message={error.message} />

  return (
    <>
      <button onClick={refetch}>Refresh</button>
      <ul>{data?.data.map(p => <li key={p.id}>{p.title}</li>)}</ul>
    </>
  )
}
```

### Options

```typescript
useQuery(queryFn, {
  enabled?: boolean           // Disable auto-fetch
  refetchInterval?: number    // Seconds between refetches
  refetchOnWindowFocus?: boolean
})
```

---

## useMutation()

Handle mutations with state:

```tsx
import { useMutation } from "nevr/client/react"

function CreatePost() {
  const { execute, data, error, isPending, reset } = useMutation(
    (input) => client.posts.create(input)
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    const form = new FormData(e.target)
    const result = await execute({
      title: form.get("title"),
      content: form.get("content"),
    })
    if (result.data) router.push(`/posts/${result.data.id}`)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" required />
      <textarea name="content" required />
      {error && <p className="error">{error.message}</p>}
      <button disabled={isPending}>
        {isPending ? "Creating..." : "Create"}
      </button>
    </form>
  )
}
```

### Return Type

```typescript
{
  execute: (input: TInput) => Promise<NevrFetchResponse<TData>>
  data: TData | null
  error: NevrFetchError | null
  isPending: boolean
  reset: () => void
}
```

---

## useStore()

Use any nanostore atom:

```tsx
import { useStore } from "nevr/client/react"

const session = useStore(client.useSession)
```

---

## Auth Examples

### Login

```tsx
function Login() {
  const { execute, error, isPending } = useMutation(
    (input) => client.signIn.email(input)
  )

  return (
    <form onSubmit={async (e) => {
      e.preventDefault()
      const form = new FormData(e.target)
      const res = await execute({
        email: form.get("email"),
        password: form.get("password"),
      })
      if (res.data) location.href = "/dashboard"
    }}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      {error && <p>{error.message}</p>}
      <button disabled={isPending}>{isPending ? "..." : "Login"}</button>
    </form>
  )
}
```

### Auth Guard

```tsx
function AuthGuard({ children }) {
  const { data, isPending } = useSession(client.useSession)
  if (isPending) return <Loading />
  if (!data) return <Navigate to="/login" />
  return children
}
```

### Logout

```tsx
function LogoutButton() {
  const { execute, isPending } = useMutation(() => client.auth.signOut())
  return (
    <button onClick={async () => { await execute(); location.href = "/login" }}>
      {isPending ? "..." : "Logout"}
    </button>
  )
}
```

---

## CRUD Example

```tsx
function Products() {
  const { data, refetch } = useQuery(() => client.products.list())
  const create = useMutation((input) => client.products.create(input))
  const remove = useMutation((id) => client.products.delete(id))

  return (
    <div>
      <form onSubmit={async (e) => {
        e.preventDefault()
        await create.execute({ name: e.target.name.value })
        refetch()
      }}>
        <input name="name" required />
        <button>Add</button>
      </form>
      <ul>
        {data?.data.map(p => (
          <li key={p.id}>
            {p.name}
            <button onClick={async () => { await remove.execute(p.id); refetch() }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

---

## Next Steps

- [Entity Client](/client/entity-client)
- [Client Overview](/client/overview)
