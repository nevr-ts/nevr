# Storage Plugin

File storage with S3-compatible providers (AWS S3, Cloudflare R2, MinIO) and local filesystem.

## Installation

```typescript
import { nevr } from "nevr"
import { storage } from "nevr/plugins/storage"

const api = nevr({
  plugins: [
    storage({
      provider: "s3",
      s3: {
        bucket: process.env.S3_BUCKET!,
        region: process.env.S3_REGION!,
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
    }),
  ],
})

export type API = typeof api
```

## Configuration

### AWS S3

```typescript
storage({
  provider: "s3",
  s3: {
    bucket: "my-bucket",
    region: "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ["image/*", "application/pdf"],
  defaultVisibility: "private",
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
    publicUrlBase: "https://pub-xxx.r2.dev",
  },
})
```

### Local Provider (Development)

```typescript
storage({
  provider: "local",
  local: {
    basePath: "./uploads",
    publicUrlBase: "http://localhost:3000/files",
  },
})
```

## Client Usage

### Setup

```typescript
import { createTypedClient } from "nevr/client"
import { storageClient } from "nevr/plugins/storage"
import type { API } from "./api"

export const client = createTypedClient<API>({
  baseURL: "http://localhost:3000",
  plugins: [storageClient()],
})
```

### Upload a File (1 Line!)

```typescript
// Upload with automatic 3-step flow
const file = await client.storage.upload(fileInput.files[0], {
  visibility: "public",
})

console.log(file.url) // Public URL
```

### Upload with Progress

```typescript
const file = await client.storage.upload(fileInput.files[0], {
  visibility: "public",
  onProgress: (progress) => {
    console.log(`${progress.percentage}%`)
  },
})
```

### Download a File

```typescript
// Open in new tab
await client.storage.download(file.key)

// Get as blob
const blob = await client.storage.download(file.key, { asBlob: true })
```

### Delete a File

```typescript
await client.storage.delete(file.key)
```

### List Files

```typescript
const { data } = await client.storage.listFiles({
  limit: 20,
  offset: 0,
  visibility: "public",
})

for (const file of data.files) {
  console.log(file.name, formatSize(file.size))
}
```

### Search Files

```typescript
const { data } = await client.storage.searchFiles({
  query: "avatar",
  mimeType: "image/*",
})
```

### Get Stats

```typescript
const { data } = await client.storage.getStats()
console.log(`Total: ${formatSize(data.totalSize)}`)
```

## Reactive State

The storage client provides reactive state via nanostores:

```typescript
import { useStore } from "@nanostores/react"

function FileList() {
  const { files, isLoading } = useStore(client.$atoms.files)

  if (isLoading) return <Loading />

  return (
    <ul>
      {files.map((file) => (
        <li key={file.id}>{file.name}</li>
      ))}
    </ul>
  )
}
```

## React Hook

```typescript
import { createUseFileUpload } from "nevr/plugins/storage"
import React from "react"

const useFileUpload = createUseFileUpload(React)

function UploadButton() {
  const { upload, progress, isUploading, uploadedFile } = useFileUpload(client)

  return (
    <div>
      <input
        type="file"
        onChange={(e) => upload(e.target.files[0], { visibility: "public" })}
        disabled={isUploading}
      />
      {isUploading && <progress value={progress} max={100} />}
      {uploadedFile && <p>Uploaded: {uploadedFile.name}</p>}
    </div>
  )
}
```

## Utility Functions

```typescript
import { 
  formatSize, 
  isImage, 
  isVideo, 
  isAudio, 
  isDocument,
  getFileIcon,
} from "nevr/plugins/storage"

formatSize(1048576)       // "1.0 MB"
isImage("image/png")      // true
isVideo("video/mp4")      // true
isDocument("application/pdf") // true
getFileIcon("image/png")  // "image"
```

## Hooks (Server-side)

```typescript
storage({
  hooks: {
    beforeUpload: async (file, userId) => {
      if (file.size > 5 * 1024 * 1024) {
        return null // Reject
      }
      return file
    },
    
    afterUpload: async (file, driver) => {
      // Generate thumbnail, notify user, etc.
      console.log(`Uploaded: ${file.key}`)
    },
    
    beforeDelete: async (file, userId) => {
      // Return false to prevent deletion
      return true
    },
  },
})
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/storage/upload` | POST | Request presigned upload URL |
| `/storage/upload/confirm` | POST | Confirm upload completed |
| `/storage/download` | POST | Get presigned download URL |
| `/storage/file/:id` | GET | Get file metadata |
| `/storage/file` | DELETE | Delete a file |
| `/storage/files` | GET | List files |
| `/storage/files` | DELETE | Bulk delete files |
| `/storage/search` | POST | Search files |
| `/storage/stats` | GET | Get storage stats |

## Schema

### File

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| key | string | Storage key/path |
| name | string | Original filename |
| mimeType | string | MIME type |
| size | number | Size in bytes |
| visibility | string | "public" or "private" |
| url | string? | Public URL (if public) |
| userId | string? | Uploader reference |
| metadata | json? | Custom metadata |
| createdAt | datetime | Upload timestamp |
| updatedAt | datetime | Last modified |

## Type Inference

```typescript
// Get plugin types
type File = typeof api.$Infer.storage.File

// Access error codes
import { STORAGE_ERROR_CODES } from "nevr/plugins/storage"
```
