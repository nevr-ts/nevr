# Storage Plugin

The Storage plugin handles file uploads and management, supporting local storage for development and S3/R2 for production.

## Usage

We recommend configuring the storage plugin in a separate file.

**`src/plugins/storage.ts`**
```typescript
import { storage } from "nevr/plugins/storage"

// Local Storage (Development)
export const storagePlugin = storage({
  provider: "local",
  local: {
    directory: "./uploads",
    publicUrl: "http://localhost:3000/uploads"
  }
})

// S3 / R2 (Production)
/*
export const storagePlugin = storage({
  provider: "s3", // or "r2"
  s3: {
    region: "us-east-1",
    bucket: "my-app-uploads",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
})
*/
```

**`src/config.ts`**
```typescript
import { nevr } from "nevr"
import { storagePlugin } from "./plugins/storage"

export const api = nevr({
  plugins: [
    storagePlugin
  ]
})
```

## Schema

The plugin adds:
- **file**: Metadata for stored files (name, size, mime type, url).
- **folder**: Virtual folder structure.

It extends `user` with:
- `avatarUrl`: Link to a stored file.
- `storageQuota`: Max bytes allowed.
- `storageUsed`: Current usage.

## API Routes

- `POST /storage/upload` - Get upload URL (presigned for S3)
- `GET /storage/files` - List files
- `DELETE /storage/files/:id` - Delete file
- `POST /storage/folders` - Create folder
