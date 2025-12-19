# CRUD Operations

Once your entities are defined and your server is running, you can interact with your API using standard HTTP methods.

---

## Base URL

By default, Nevr routes are mounted where you attach the adapter.

If you use:
```typescript
app.use("/api", expressAdapter(api))
```
Then all routes will start with `/api`.

---

## List Records

**GET** `/{resource}`

Returns a list of records.

```bash
GET /api/posts
```

### Pagination

Use `page` and `limit` query parameters.

```bash
GET /api/posts?page=1&limit=10
```

### Filtering (Coming Soon)
Nevr will support filtering via query parameters like `?title=hello` or `?age_gt=18`.

---

## Get Record

**GET** `/{resource}/{id}`

Returns a single record by its ID.

```bash
GET /api/posts/user_123
```

**Response (200 OK):**
```json
{
  "id": "user_123",
  "title": "My Post",
  "content": "...",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Response (404 Not Found):**
```json
{ "error": "Not found" }
```

---

## Create Record

**POST** `/{resource}`

Creates a new record.

**Headers:** `Content-Type: application/json`

```bash
POST /api/posts
```

**Body:**
```json
{
  "title": "New Post",
  "content": "This is the content",
  "authorId": "user_abc"
}
```

**Response (201 Created):**
Returns the created object.

**Response (400 Bad Request):**
Validation failed.
```json
{
  "error": "Validation failed",
  "details": [ ... ]
}
```

---

## Update Record

**PUT** `/{resource}/{id}` (Full Update)
**PATCH** `/{resource}/{id}` (Partial Update)

Updates an existing record.

```bash
PATCH /api/posts/post_123
```

**Body:**
```json
{
  "title": "Updated Title"
}
```

**Response (200 OK):**
Returns the updated object.

---

## Delete Record

**DELETE** `/{resource}/{id}`

Deletes a record.

```bash
DELETE /api/posts/post_123
```

**Response (200 OK):**
```json
{ "success": true }
```

---

## Using the Generated Client

If you are using TypeScript on the frontend, you don't need to remember these URLs. Use the generated client!

```typescript
import { createClient } from "./generated/client"

const client = createClient({
  baseUrl: "http://localhost:3000/api"
})

// List
const posts = await client.post.findMany()

// Get
const post = await client.post.findUnique("post_123")

// Create
const newPost = await client.post.create({
  title: "Hello",
  content: "World",
  authorId: "user_1"
})

// Update
await client.post.update("post_123", {
  title: "New Title"
})

// Delete
await client.post.delete("post_123")
```
