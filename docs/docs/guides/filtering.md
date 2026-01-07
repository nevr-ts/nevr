# Filtering & Sorting

Complete guide to querying data with filters, sorting, pagination, and relations.

---

## Quick Reference

```bash
# HTTP API
GET /api/posts?filter[published]=true&filter[views][gte]=100&sort=-createdAt&limit=10&include=author
```

```typescript
// TypeScript Client
const { data } = await client.posts.list({
  filter: { published: true, views: { gte: 100 } },
  sort: { createdAt: "desc" },
  take: 10,
  include: ["author"]
})
```

---

## Filter Operators

### Comparison Operators

| Operator | Description | HTTP | TypeScript |
|----------|-------------|------|------------|
| `equals` | Exact match | `filter[age]=25` | `{ age: 25 }` or `{ age: { equals: 25 } }` |
| `not` | Not equal | `filter[status][not]=deleted` | `{ status: { not: "deleted" } }` |
| `gt` | Greater than | `filter[price][gt]=100` | `{ price: { gt: 100 } }` |
| `gte` | Greater or equal | `filter[age][gte]=18` | `{ age: { gte: 18 } }` |
| `lt` | Less than | `filter[stock][lt]=10` | `{ stock: { lt: 10 } }` |
| `lte` | Less or equal | `filter[rating][lte]=5` | `{ rating: { lte: 5 } }` |

### String Operators

| Operator | Description | HTTP | TypeScript |
|----------|-------------|------|------------|
| `contains` | Contains substring | `filter[name][contains]=john` | `{ name: { contains: "john" } }` |
| `startsWith` | Starts with | `filter[email][startsWith]=admin` | `{ email: { startsWith: "admin" } }` |
| `endsWith` | Ends with | `filter[email][endsWith]=@gmail.com` | `{ email: { endsWith: "@gmail.com" } }` |

### Array Operators

| Operator | Description | HTTP | TypeScript |
|----------|-------------|------|------------|
| `in` | Value in list | `filter[status][in]=active,pending` | `{ status: { in: ["active", "pending"] } }` |
| `notIn` | Not in list | `filter[role][notIn]=guest,banned` | `{ role: { notIn: ["guest", "banned"] } }` |

---

## HTTP API Examples

### Basic Filtering

```bash
# Exact match
GET /api/users?filter[role]=admin
GET /api/posts?filter[published]=true

# Multiple filters (AND)
GET /api/products?filter[category]=electronics&filter[inStock]=true

# Range filter
GET /api/products?filter[price][gte]=50&filter[price][lte]=200
```

### String Search

```bash
# Contains
GET /api/users?filter[name][contains]=smith

# Starts with
GET /api/posts?filter[title][startsWith]=How%20to

# Ends with
GET /api/users?filter[email][endsWith]=@company.com
```

### Array Filters

```bash
# In list
GET /api/orders?filter[status][in]=pending,processing,shipped

# Not in list
GET /api/users?filter[role][notIn]=guest,banned
```

---

## TypeScript Client Examples

### Basic Filtering

```typescript
// Exact match
const { data } = await client.users.list({
  filter: { role: "admin" }
})

// Multiple conditions (AND)
const { data } = await client.products.list({
  filter: {
    category: "electronics",
    inStock: true,
    price: { gte: 50, lte: 200 }
  }
})
```

### Logical Operators

```typescript
// OR - match any condition
const { data } = await client.posts.list({
  filter: {
    OR: [
      { status: "published" },
      { featured: true }
    ]
  }
})

// AND - match all conditions
const { data } = await client.products.list({
  filter: {
    AND: [
      { price: { gte: 100 } },
      { stock: { gt: 0 } },
      { published: true }
    ]
  }
})

// NOT - exclude matches
const { data } = await client.users.list({
  filter: {
    NOT: { role: "banned" }
  }
})

// Combined
const { data } = await client.posts.list({
  filter: {
    published: true,
    OR: [
      { category: "tech" },
      { category: "science" }
    ],
    NOT: { authorId: "user_banned" }
  }
})
```

### Nested Filters

```typescript
// Filter by relation
const { data } = await client.posts.list({
  filter: {
    author: {
      role: "admin"
    }
  }
})

// Deep nesting
const { data } = await client.comments.list({
  filter: {
    post: {
      author: {
        verified: true
      }
    }
  }
})
```

---

## Sorting

### HTTP API

```bash
# Ascending (A-Z, oldest first)
GET /api/users?sort=name
GET /api/posts?sort=createdAt

# Descending (Z-A, newest first)
GET /api/posts?sort=-createdAt

# Multiple fields
GET /api/products?sort=category,-price
GET /api/todos?sort=-priority,createdAt
```

### TypeScript Client

```typescript
// Single field ascending
const { data } = await client.users.list({
  sort: { name: "asc" }
})

// Single field descending
const { data } = await client.posts.list({
  sort: { createdAt: "desc" }
})

// Multiple fields
const { data } = await client.products.list({
  sort: { category: "asc", price: "desc" }
})
```

---

## Pagination

### Limit & Offset

```bash
# HTTP
GET /api/posts?limit=10&offset=0   # First 10
GET /api/posts?limit=10&offset=10  # Next 10
GET /api/posts?limit=10&offset=20  # Next 10
```

```typescript
// TypeScript
const { data } = await client.posts.list({
  take: 10,
  skip: 0
})

// Page 2
const { data } = await client.posts.list({
  take: 10,
  skip: 10
})
```

### Page-Based

```bash
# HTTP
GET /api/posts?page=1&limit=10  # Page 1
GET /api/posts?page=2&limit=10  # Page 2
```

```typescript
// Helper function
async function getPage(page: number, pageSize = 10) {
  return client.posts.list({
    take: pageSize,
    skip: (page - 1) * pageSize
  })
}

// Usage
const page1 = await getPage(1)
const page2 = await getPage(2)
```

### Pagination Response

```typescript
const { data } = await client.posts.list({ take: 10 })

console.log(data?.pagination)
// { total: 150, limit: 10, offset: 0 }

const totalPages = Math.ceil(data.pagination.total / data.pagination.limit)
// 15 pages
```

---

## Including Relations

### HTTP API

```bash
# Single relation
GET /api/posts?include=author

# Multiple relations
GET /api/posts?include=author,comments,tags

# Nested (if supported)
GET /api/posts?include=author.profile,comments.user
```

### TypeScript Client

```typescript
// Single relation
const { data } = await client.posts.list({
  include: ["author"]
})

// Multiple relations
const { data } = await client.posts.list({
  include: ["author", "comments", "tags"]
})

// Access included data
data?.data.forEach(post => {
  console.log(post.title)
  console.log(post.author?.name)  // Included
  console.log(post.comments)      // Included array
})
```

---

## Field Selection

Select specific fields to return, reducing response size and improving performance.

### HTTP API

```bash
# Comma-separated field names
GET /api/users?select=id,name,email

# JSON format for more control
GET /api/users?select={"id":true,"name":true,"email":true}
```

### TypeScript Client

```typescript
// Array format (simple)
const { data } = await client.users.list({
  select: ["id", "name", "email"]
})

// Object format (explicit)
const { data } = await client.users.list({
  select: { id: true, name: true, email: true }
})
```

### System Fields

All entities have system fields automatically available for filtering and sorting:

```typescript
// Sort by createdAt (system field)
const { data } = await client.posts.list({
  sort: { createdAt: "desc" }
})

// Filter by updatedAt (system field)
const { data } = await client.posts.list({
  filter: { updatedAt: { gte: new Date("2024-01-01") } }
})

// Select system fields
const { data } = await client.users.list({
  select: ["id", "name", "createdAt", "updatedAt"]
})
```

| System Field | Type | Description |
|--------------|------|-------------|
| `id` | `string` | Unique identifier |
| `createdAt` | `Date` | When record was created |
| `updatedAt` | `Date` | When record was last modified |

---

## Combined Queries

### HTTP API

```bash
GET /api/posts?\
  filter[published]=true&\
  filter[views][gte]=100&\
  filter[category][in]=tech,science&\
  sort=-createdAt,title&\
  limit=10&\
  page=1&\
  include=author,tags
```

### TypeScript Client

```typescript
const { data, error } = await client.posts.list({
  filter: {
    published: true,
    views: { gte: 100 },
    category: { in: ["tech", "science"] }
  },
  sort: { createdAt: "desc", title: "asc" },
  take: 10,
  skip: 0,
  include: ["author", "tags"]
})
```

---

## Search Implementation

### Simple Search

```typescript
async function search(query: string) {
  return client.products.list({
    filter: {
      OR: [
        { name: { contains: query } },
        { description: { contains: query } },
        { sku: { contains: query } }
      ]
    },
    take: 20
  })
}
```

### Advanced Search

```typescript
interface SearchOptions {
  query?: string
  category?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  sortBy?: "price" | "name" | "createdAt"
  sortOrder?: "asc" | "desc"
  page?: number
  pageSize?: number
}

async function advancedSearch(options: SearchOptions) {
  const filter: any = {}

  if (options.query) {
    filter.OR = [
      { name: { contains: options.query } },
      { description: { contains: options.query } }
    ]
  }

  if (options.category) {
    filter.category = options.category
  }

  if (options.minPrice !== undefined || options.maxPrice !== undefined) {
    filter.price = {}
    if (options.minPrice !== undefined) filter.price.gte = options.minPrice
    if (options.maxPrice !== undefined) filter.price.lte = options.maxPrice
  }

  if (options.inStock !== undefined) {
    filter.stock = options.inStock ? { gt: 0 } : { equals: 0 }
  }

  return client.products.list({
    filter,
    sort: options.sortBy
      ? { [options.sortBy]: options.sortOrder || "asc" }
      : undefined,
    take: options.pageSize || 20,
    skip: ((options.page || 1) - 1) * (options.pageSize || 20)
  })
}
```

---

## React Hook Example

```tsx
import { useState } from "react"
import { useQuery } from "nevr/client/react"

function ProductList() {
  const [filters, setFilters] = useState({
    category: "",
    minPrice: 0,
    maxPrice: 1000,
    search: ""
  })
  const [sort, setSort] = useState({ field: "createdAt", order: "desc" })
  const [page, setPage] = useState(1)

  const { data, isPending, error } = useQuery(() =>
    client.products.list({
      filter: {
        ...(filters.category && { category: filters.category }),
        ...(filters.search && { name: { contains: filters.search } }),
        price: { gte: filters.minPrice, lte: filters.maxPrice }
      },
      sort: { [sort.field]: sort.order },
      take: 10,
      skip: (page - 1) * 10
    }),
    { deps: [filters, sort, page] }
  )

  if (isPending) return <div>Loading...</div>

  return (
    <div>
      {/* Filters UI */}
      <input
        placeholder="Search..."
        value={filters.search}
        onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
      />

      {/* Products */}
      <ul>
        {data?.data.map(product => (
          <li key={product.id}>{product.name} - ${product.price}</li>
        ))}
      </ul>

      {/* Pagination */}
      <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>
        Previous
      </button>
      <span>Page {page}</span>
      <button onClick={() => setPage(p => p + 1)}>
        Next
      </button>
    </div>
  )
}
```

---

## FilterOperators Type

```typescript
interface FilterOperators<T> {
  equals?: T
  not?: T
  in?: T[]
  notIn?: T[]
  lt?: T
  lte?: T
  gt?: T
  gte?: T
  contains?: string      // String only
  startsWith?: string    // String only
  endsWith?: string      // String only
}

// Logical operators
interface LogicalOperators<T> {
  AND?: T[]
  OR?: T[]
  NOT?: T
}
```

---

## Next Steps

- [CRUD Operations](/guides/crud) - Full CRUD reference
- [Custom Endpoints](/guides/custom-endpoints) - Business logic
- [Entity Client](/client/entity-client) - Client API details
