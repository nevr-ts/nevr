# Adapters (HTTP Layer)

Adapters translate between your web framework and Nevr's framework-agnostic core.

Role:
1) Convert native request → `NevrRequest`
2) Call `nevr.handleRequest`
3) Convert `NevrResponse` → native response

## Express

```ts
import express from "express"
import { nevr } from "nevr"
import { expressAdapter, expressDevAuth, expressJwtAuth } from "nevr/adapters/express"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()
const api = nevr({ entities, driver: prisma(db) })

const app = express()
app.use(express.json())

// Development auth via headers
app.use("/api", expressAdapter(api, { getUser: expressDevAuth, cors: true }))

// Or JWT auth
// const verify = async (token: string) => /* return { id, role } or null */
// app.use("/api", expressAdapter(api, { getUser: expressJwtAuth(verify) }))
```

Options:
- `getUser(req)` return `User | null`
- `cors` true | string | string[]
- `debugLogs` boolean

## Hono

```ts
import { Hono } from "hono"
import { nevr } from "nevr"
import { honoAdapter, honoDevAuth, honoJwtAuth } from "nevr/adapters/hono"

const app = new Hono()
const api = nevr({ entities, driver })
app.route("/api", honoAdapter(api, { getUser: honoDevAuth }))
```
