# Filtering & Sorting

Nevr provides powerful query parameters for filtering, sorting, and paginating list endpoints.

---

## Quick Reference

```bash
# Filter by exact value
GET /api/posts?filter[published]=true

# Filter with operator
GET /api/posts?filter[views][gte]=100

# Sort (prefix with - for descending)
GET /api/posts?sort=-createdAt,title

# Paginate
GET /api/posts?limit=10&page=2

# Include relations
GET /api/posts?include=author,comments
```

---

## Filtering

### Exact Match

Filter by exact value:

```bash
GET /api/users?filter[role]=admin
GET /api/posts?filter[published]=true
GET /api/todos?filter[completed]=false
```

### Comparison Operators

Use operators for advanced filtering:

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equals | `filter[age][eq]=25` |
| `ne` | Not equals | `filter[status][ne]=deleted` |
| `gt` | Greater than | `filter[price][gt]=100` |
| `gte` | Greater than or equal | `filter[age][gte]=18` |
| `lt` | Less than | `filter[stock][lt]=10` |
| `lte` | Less than or equal | `filter[rating][lte]=5` |

**Example:**
```bash
# Get products with price over $50
GET /api/products?filter[price][gt]=50

# Get users aged 18-65
GET /api/users?filter[age][gte]=18&filter[age][lte]=65
```

### String Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `contains` | Contains substring | `filter[name][contains]=john` |
| `startsWith` | Starts with | `filter[email][startsWith]=admin` |
| `endsWith` | Ends with | `filter[email][endsWith]=@gmail.com` |

**Example:**
```bash
# Search users by name
GET /api/users?filter[name][contains]=smith

# Find emails from specific domain
GET /api/users?filter[email][endsWith]=@company.com
```

### Array Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `in` | Value in list | `filter[status][in]=active,pending` |
| `notIn` | Value not in list | `filter[role][notIn]=guest,banned` |

**Example:**
```bash
# Get posts with specific statuses
GET /api/posts?filter[status][in]=draft,published

# Exclude certain categories
GET /api/products?filter[category][notIn]=discontinued,archived
```

---

## Sorting

Use the `sort` parameter with comma-separated field names.

- **Ascending**: `sort=fieldName` or `sort=+fieldName`
- **Descending**: `sort=-fieldName`

### Single Field

```bash
# Sort by name (A-Z)
GET /api/users?sort=name

# Sort by newest first
GET /api/posts?sort=-createdAt
```

### Multiple Fields

```bash
# Sort by priority (desc), then by createdAt (asc)
GET /api/todos?sort=-priority,createdAt

# Sort by category, then by price descending
GET /api/products?sort=category,-price
```

---

## Pagination

### Limit & Offset

| Parameter | Description | Default | Max |
|-----------|-------------|---------|-----|
| `limit` | Number of results | 20 | 100 |
| `offset` | Skip N results | 0 | - |

```bash
# First 10 results
GET /api/posts?limit=10

# Skip first 20, get next 10
GET /api/posts?limit=10&offset=20
```

### Page-Based

Use `page` for simpler pagination:

```bash
# Page 1 (results 1-20)
GET /api/posts?page=1

# Page 2 (results 21-40)
GET /api/posts?page=2

# Page 3 with 10 items per page (results 21-30)
GET /api/posts?page=3&limit=10
```

---

## Including Relations

Load related data using `include`:

```bash
# Get posts with their author
GET /api/posts?include=author

# Get posts with author and comments
GET /api/posts?include=author,comments

# Get users with their posts
GET /api/users?include=posts
```

**Response:**
```json
{
  "id": "post_123",
  "title": "Hello World",
  "author": {
    "id": "user_456",
    "name": "Alice"
  }
}
```

---

## Combining Parameters

You can combine all parameters:

```bash
# Complex query example
GET /api/posts?\
  filter[published]=true&\
  filter[views][gte]=100&\
  sort=-createdAt&\
  limit=10&\
  page=1&\
  include=author
```

This returns:
- Published posts only
- With at least 100 views
- Sorted by newest first
- 10 results per page
- First page
- With author data included

---

## TypeScript Client

When using the generated client, filtering and sorting are fully typed:

```typescript
const posts = await client.post.findMany({
  filter: {
    published: true,
    views: { gte: 100 }
  },
  sort: { createdAt: "desc" },
  limit: 10,
  include: ["author"]
})
```

---

## Next Steps

- [CRUD Operations](/guides/crud) — Full CRUD reference
- [Authorization](/entity/authorization) — Control access to filtered data
