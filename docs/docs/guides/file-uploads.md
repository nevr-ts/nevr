# File Uploads

Handle file uploads in Nevr applications.

## Basic Setup

File uploads are typically handled outside Nevr's entity system, but you can integrate them with your entities.

### Express Example

```typescript
import multer from "multer"
import express from "express"
import { expressAdapter } from "nevr/adapters/express"

const app = express()
const upload = multer({ dest: "uploads/" })

// File upload endpoint
app.post("/api/upload", upload.single("file"), async (req, res) => {
  const file = req.file
  res.json({
    filename: file.filename,
    url: `/uploads/${file.filename}`,
  })
})

// Nevr API
app.use("/api", expressAdapter(api))
```

### With Entity

```typescript
const image = entity("image", {
  filename: string,
  url: string.url(),
  mimeType: string,
  size: int,
  uploadedBy: belongsTo(() => user),
})
  .ownedBy("uploadedBy")
```

## Cloud Storage

### S3 Upload

```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"

const s3 = new S3Client({ region: "us-east-1" })

app.post("/api/upload", upload.single("file"), async (req, res) => {
  const file = req.file

  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: file.filename,
    Body: fs.createReadStream(file.path),
    ContentType: file.mimetype,
  }))

  // Save to database
  const image = await api.getDriver().create("image", {
    filename: file.originalname,
    url: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${file.filename}`,
    mimeType: file.mimetype,
    size: file.size,
  })

  res.json(image)
})
```

### Presigned URLs

For direct browser-to-S3 uploads:

```typescript
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const upload = entity("upload", { ... })
  .actions({
    getUploadUrl: action()
      .rules("authenticated")
      .input({ filename: string, mimeType: string })
      .handler(async (ctx) => {
        const key = `${ctx.user.id}/${Date.now()}-${ctx.input.filename}`

        const url = await getSignedUrl(s3, new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          ContentType: ctx.input.mimeType,
        }), { expiresIn: 3600 })

        return { uploadUrl: url, key }
      }),
  })
```

## Image Processing

```typescript
import sharp from "sharp"

app.post("/api/upload/image", upload.single("file"), async (req, res) => {
  const file = req.file

  // Resize and convert to webp
  const processed = await sharp(file.path)
    .resize(800, 600, { fit: "inside" })
    .webp({ quality: 80 })
    .toBuffer()

  // Upload processed image
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: `images/${file.filename}.webp`,
    Body: processed,
    ContentType: "image/webp",
  }))

  res.json({ url: `...` })
})
```

## Validation

```typescript
const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
const maxSize = 5 * 1024 * 1024 // 5MB

app.post("/api/upload", upload.single("file"), async (req, res) => {
  const file = req.file

  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({ error: "Invalid file type" })
  }

  if (file.size > maxSize) {
    return res.status(400).json({ error: "File too large" })
  }

  // Process upload...
})
```

## Client Upload

```typescript
async function uploadFile(file: File) {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  })

  return response.json()
}
```

### React Component

```tsx
function FileUpload({ onUpload }) {
  const [uploading, setUploading] = useState(false)

  const handleChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    try {
      const result = await uploadFile(file)
      onUpload(result)
    } finally {
      setUploading(false)
    }
  }

  return (
    <input
      type="file"
      onChange={handleChange}
      disabled={uploading}
    />
  )
}
```

## Next Steps

- [Custom Endpoints](/guides/custom-endpoints)
<!-- - [Storage Plugin](/plugins/storage) -->
