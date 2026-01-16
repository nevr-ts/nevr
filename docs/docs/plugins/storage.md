# Storage Plugin

File storage with S3-compatible and local filesystem providers.

## Installation

```typescript
import { nevr } from "nevr"
import { storage } from "nevr/plugins/storage"

const api = nevr({
  plugins: [
    storage({
      provider: "s3",
      s3: {
        bucket: process.env.S3_BUCKET,
        region: process.env.S3_REGION,
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
      },
    }),
  ],
})
```

## Configuration

### S3 Provider

```typescript
storage({
  provider: "s3",
  s3: {
    bucket: "my-bucket",
    region: "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    endpoint: "https://s3.amazonaws.com", // Optional, for S3-compatible
  },

  // File restrictions
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ["image/*", "application/pdf"],

  // Path prefix
  pathPrefix: "uploads",

  // Public or private files
  public: false,

  // Signed URL expiration (for private files)
  signedUrlExpiration: 3600, // 1 hour
})
```

### Local Provider

```typescript
storage({
  provider: "local",
  local: {
    directory: "./uploads",
    baseUrl: "/files",
  },
  maxFileSize: 10 * 1024 * 1024,
})
```

### Cloudflare R2

```typescript
storage({
  provider: "s3",
  s3: {
    bucket: "my-bucket",
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
})
```

## Endpoints

### Upload File

```
POST /storage/upload
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: The file to upload
- `path`: Optional path/filename

**Response:**
```json
{
  "id": "file_abc123",
  "key": "uploads/image.png",
  "url": "https://bucket.s3.amazonaws.com/uploads/image.png",
  "size": 12345,
  "mimeType": "image/png",
  "createdAt": "..."
}
```

### Get Signed URL

For private files:

```
POST /storage/signed-url
```

**Request:**
```json
{
  "key": "uploads/private-doc.pdf",
  "expiresIn": 3600
}
```

**Response:**
```json
{
  "url": "https://bucket.s3.amazonaws.com/uploads/private-doc.pdf?X-Amz-...",
  "expiresAt": "..."
}
```

### Delete File

```
DELETE /storage/files/:key
```

### List Files

```
GET /storage/files?prefix=uploads/&limit=20
```

## Client Usage

```typescript
import { createClient } from "nevr/client"
import { storageClient } from "nevr/plugins/storage/client"

const client = createClient({
  baseURL: "/api",
  plugins: [storageClient()],
})

// Upload file
const file = document.getElementById("fileInput").files[0]
const { data } = await client.storage.upload(file, {
  path: "avatars/user-123.png",
})
console.log(data.url)

// Get signed URL for private file
const { data: signed } = await client.storage.getSignedUrl({
  key: "documents/contract.pdf",
  expiresIn: 3600,
})

// Delete file
await client.storage.delete("avatars/old-avatar.png")

// List files
const { data: files } = await client.storage.list({
  prefix: "avatars/",
  limit: 20,
})
```

## Hooks

```typescript
storage({
  // Before upload validation
  onBeforeUpload: async ({ file, user }) => {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("File too large")
    }
  },

  // After upload processing
  onAfterUpload: async ({ file, key, url }) => {
    // Generate thumbnail, update database, etc.
    await processImage(key)
  },

  // Before delete validation
  onBeforeDelete: async ({ key, user }) => {
    // Check permissions
  },
})
```

## Schema

### File

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| key | string | Storage key/path |
| bucket | string | Bucket name |
| size | number | File size in bytes |
| mimeType | string | MIME type |
| url | string | Public URL (if public) |
| userId | string? | Uploader reference |
| metadata | json? | Custom metadata |
| createdAt | datetime | Upload timestamp |

## Security

- Files are validated before upload (size, type)
- Private files require signed URLs
- User authentication recommended for uploads
- Consider rate limiting upload endpoints
