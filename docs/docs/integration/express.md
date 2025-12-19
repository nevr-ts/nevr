# Express Integration

Express is the most popular web framework for Node.js. Nevr provides a first-class adapter for Express.

## Installation

```bash
npm install express
npm install -D @types/express
```

## Usage

The `expressAdapter` creates an Express router that you can mount anywhere in your application.

```typescript
import express from "express"
import { nevr } from "nevr"
import { expressAdapter } from "nevr/adapters/express"
// ... imports for entities and driver

const app = express()

// 1. Initialize Nevr
const api = nevr({
  entities: [/* ... */],
  driver: /* ... */
})

// 2. Add Body Parser (Required)
app.use(express.json())

// 3. Mount Nevr
app.use("/api", expressAdapter(api))

// 4. Start Server
app.listen(3000, () => {
  console.log("Server running on port 3000")
})
```

## Middleware

You can use standard Express middleware before the Nevr adapter to handle things like logging, CORS, or global authentication.

```typescript
import cors from "cors"
import morgan from "morgan"

app.use(cors())
app.use(morgan("dev"))
app.use("/api", expressAdapter(api))
```
