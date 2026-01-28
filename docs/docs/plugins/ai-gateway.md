# AI Gateway

> Nevr's AI Gateway provides a unified API for multiple AI providers (OpenAI, Anthropic, Google) with built-in usage tracking, rate limiting, and SSE streaming support.

## Why AI Gateway?

### The Problem

Building AI-powered applications requires:
- Managing multiple provider APIs with different formats
- Tracking token usage and costs across providers
- Implementing rate limiting per user/plan
- Handling streaming responses consistently
- Switching providers without code changes

### The Solution

AI Gateway provides:
1. **Unified API**: One interface for all providers
2. **Usage Tracking**: Automatic token counting and cost calculation
3. **Rate Limiting**: Per-minute, per-day, and monthly token limits
4. **SSE Streaming**: Real-time token output with consistent format
5. **Plan Integration**: Tie AI limits to subscription plans

---

## Quick Start

### 1. Add AI Gateway Plugin

Add the plugin to your config:

```typescript
// src/nevr.config.ts
import { defineConfig } from "nevr"
import { aiGateway } from "nevr/plugins"

export const config = defineConfig({
  database: "postgresql",
  entities: [],
  plugins: [
    aiGateway({
      providers: {
        openai: { apiKey: process.env.OPENAI_API_KEY },
        anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
        google: { apiKey: process.env.GOOGLE_API_KEY },
      },
      defaultProvider: "openai",
      defaultModel: "gpt-5-mini",
      trackUsage: true,
      rateLimiting: { enabled: true },
    }),
  ],
})

export default config
```

Then in your server:

```typescript
// src/server.ts
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

const api = nevr({ ...config, driver: prisma(new PrismaClient()) })
```

### 2. Client Setup

```typescript
import { createTypedClient } from "nevr/client"
import { aiClient } from "nevr/ai-gateway"
import type { API } from "./api"

const client = createTypedClient<API>({
  baseURL: "/api",
  plugins: [aiClient()],
})
```

### 3. Send Chat Requests

```typescript
// Simple chat
const response = await client.ai.chat({
  messages: [{ role: "user", content: "Hello, how are you?" }],
})
console.log(response.content)

// Streaming with async generator
for await (const chunk of client.ai.chatStream({
  messages: [{ role: "user", content: "Write a poem about coding" }],
})) {
  process.stdout.write(chunk.content)
}
```

---

## Plugin Options

```typescript
aiGateway({
  // Provider configurations
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: "https://api.openai.com/v1",  // Optional: custom endpoint
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
    google: {
      apiKey: process.env.GOOGLE_API_KEY,
    },
  },

  // Default provider when not specified in request
  defaultProvider: "openai",

  // Default model when not specified
  defaultModel: "gpt-5-mini",

  // Usage tracking (stores in database)
  trackUsage: true,

  // Rate limiting
  rateLimiting: {
    enabled: true,
    mode: "hard",           // "hard" (429) or "soft" (warning header)
    defaultLimits: {
      requestsPerMinute: 20,
      requestsPerDay: 1000,
      tokensPerMonth: 100000,
    },
  },

  // Plan-based limits (integrates with payment plugin)
  planLimits: {
    free: {
      requestsPerMinute: 5,
      requestsPerDay: 100,
      tokensPerMonth: 10000,
    },
    pro: {
      requestsPerMinute: 30,
      requestsPerDay: 5000,
      tokensPerMonth: 500000,
    },
    enterprise: {
      requestsPerMinute: -1,  // Unlimited
      requestsPerDay: -1,
      tokensPerMonth: -1,
    },
  },

  // Cost tracking (per 1K tokens)
  costTracking: {
    "gpt-5-mini": { input: 0.0003, output: 0.0012 },
    "gpt-5": { input: 0.00125, output: 0.01 },
    "claude-sonnet-4-5-20250929": { input: 0.003, output: 0.015 },
  },

  // Custom reference ID resolver (for multi-tenant)
  getReferenceId: async (ctx) => {
    return ctx.session?.user?.organizationId || ctx.session?.user?.id
  },

  // Get user's current plan
  getPlan: async (ctx) => {
    return ctx.session?.user?.plan || "free"
  },
})
```

---

## Supported Providers

### OpenAI

```typescript
providers: {
  openai: { apiKey: process.env.OPENAI_API_KEY }
}
```

**Models (2026):**
- `gpt-5` - Most capable, 400K context ($1.25/$10 per 1M tokens)
- `gpt-5-mini` - Fast and cost-effective ($0.30/$1.20 per 1M tokens)
- `o3` - Advanced reasoning model ($2/$8 per 1M tokens)
- `o3-mini` - Fast reasoning ($0.55/$2.20 per 1M tokens)
- `o4-mini` - Latest efficient reasoning ($1.10/$4.40 per 1M tokens)
- `gpt-4o`, `gpt-5-mini` - Previous generation (still supported)

### Anthropic

```typescript
providers: {
  anthropic: { apiKey: process.env.ANTHROPIC_API_KEY }
}
```

**Models (2026):**
- `claude-opus-4-5-20251124` - Most capable ($5/$25 per 1M tokens)
- `claude-sonnet-4-5-20250929` - Best balance of speed and capability ($3/$15 per 1M tokens)
- `claude-haiku-4-5-20250929` - Fastest ($1/$5 per 1M tokens)
- `claude-opus-4-20250522`, `claude-sonnet-4-20250522` - Claude 4 series
- `claude-3-5-sonnet-20241022` - Legacy (still supported)

### Google AI

```typescript
providers: {
  google: { apiKey: process.env.GOOGLE_API_KEY }
}
```

**Models (2026):**
- `gemini-3-pro` - Latest reasoning model, 1M context ($2/$12 per 1M tokens)
- `gemini-3-flash` - Fast Gemini 3 ($0.50/$3 per 1M tokens)
- `gemini-2.5-pro` - Production ready, 2M context ($1.25/$10 per 1M tokens)
- `gemini-2.5-flash` - Fast and cheap ($0.15/$0.60 per 1M tokens)
- `gemini-2.0-flash` - Legacy (still supported)

---

## Client API

### Basic Chat

```typescript
const response = await client.ai.chat({
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "What is TypeScript?" },
  ],
  provider: "openai",      // Optional: override default
  model: "gpt-5-mini",    // Optional: override default
  temperature: 0.7,        // Optional: 0-2
  maxTokens: 1000,         // Optional: limit response
})

// Response
{
  content: "TypeScript is a typed superset of JavaScript...",
  usage: {
    promptTokens: 24,
    completionTokens: 150,
    totalTokens: 174,
  },
  model: "gpt-5-mini",
  provider: "openai",
  finishReason: "stop",
}
```

### Streaming

```typescript
// Using callbacks
await client.ai.stream({
  messages: [{ role: "user", content: "Write a story" }],
  onToken: (token) => {
    // Called for each token
    process.stdout.write(token)
  },
  onDone: (response) => {
    // Called when complete
    console.log("Total tokens:", response.usage.totalTokens)
  },
  onError: (error) => {
    console.error("Stream error:", error)
  },
})

// Using async iterator
const stream = client.ai.streamIterator({
  messages: [{ role: "user", content: "Explain quantum computing" }],
})

for await (const chunk of stream) {
  if (chunk.type === "token") {
    process.stdout.write(chunk.content)
  } else if (chunk.type === "done") {
    console.log("\nUsage:", chunk.usage)
  }
}
```

### React Hook

```typescript
import { createUseAIChat } from "nevr/ai-gateway"
import React from "react"

const useAIChat = createUseAIChat(React)

function ChatComponent() {
  const { messages, isLoading, error, send, clear } = useAIChat({
    systemPrompt: "You are a helpful assistant.",
    model: "gpt-5-mini",
  })

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i} className={msg.role}>
          {msg.content}
        </div>
      ))}
      {isLoading && <div>Thinking...</div>}
      <input onKeyDown={(e) => e.key === 'Enter' && send(e.target.value)} />
    </div>
  )
}
```

### Reactive State (Nanostores)

```typescript
import { useStore } from "@nanostores/react"

function UsageDashboard() {
  const { usage, isLoading } = useStore(client.$atoms.usage)
  const { models } = useStore(client.$atoms.models)

  if (isLoading) return <Loading />

  return (
    <div>
      <p>Tokens used: {usage?.totalTokens} / {usage?.limit}</p>
      <p>Cost: ${usage?.totalCost}</p>
    </div>
  )
}
```

---

## Usage Tracking

### Automatic Tracking

When `trackUsage: true`, every request is logged:

```typescript
// Database schema (auto-created)
{
  id: string,
  referenceId: string,      // User or org ID
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
  estimatedCost: number,
  createdAt: Date,
}
```

### Query Usage

```typescript
// Get usage for current user
const usage = await client.ai.getUsage({
  period: "month",  // "day" | "week" | "month"
})

// Response
{
  totalRequests: 150,
  totalTokens: 45000,
  totalCost: 0.0225,
  byModel: {
    "gpt-5-mini": { requests: 100, tokens: 30000, cost: 0.015 },
    "gpt-4o": { requests: 50, tokens: 15000, cost: 0.0075 },
  },
  byDay: [
    { date: "2024-01-15", requests: 50, tokens: 15000 },
    // ...
  ],
}

// Admin: get usage for specific reference
const orgUsage = await client.ai.getUsage({
  referenceId: "org_123",
  period: "month",
})
```

---

## Rate Limiting

### How It Works

1. **Request comes in** -> Check rate limit state
2. **Under limit** -> Process request, update counters
3. **Over limit (hard mode)** -> Return 429 error
4. **Over limit (soft mode)** -> Add warning header, process anyway

### Limit Types

| Limit | Scope | Resets |
|-------|-------|--------|
| `requestsPerMinute` | Per reference | Every minute |
| `requestsPerDay` | Per reference | Midnight UTC |
| `tokensPerMonth` | Per reference | 1st of month |

### Error Handling

```typescript
try {
  await client.ai.chat({ messages })
} catch (error) {
  if (error.code === "RATE_LIMIT_EXCEEDED") {
    console.log("Please wait:", error.retryAfter, "seconds")
    console.log("Limit type:", error.limitType)  // "minute" | "day" | "month"
  }
}
```

### Custom Limits per Plan

```typescript
aiGateway({
  planLimits: {
    free: {
      requestsPerMinute: 5,
      requestsPerDay: 100,
      tokensPerMonth: 10000,
    },
    pro: {
      requestsPerMinute: 30,
      requestsPerDay: 5000,
      tokensPerMonth: 500000,
    },
  },
  getPlan: async (ctx) => {
    // Return user's subscription plan
    return ctx.session?.user?.plan || "free"
  },
})
```

---

## API Reference

### Server Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai-gateway/chat` | Chat completion |
| POST | `/ai-gateway/chat/stream` | Streaming chat (SSE) |
| GET | `/ai-gateway/usage` | Get usage statistics |
| GET | `/ai-gateway/models` | List available models |

### Client Methods

```typescript
const ai = client.ai

// Chat
ai.chat(params: ChatInput): Promise<ChatOutput>
ai.chatStream(params: ChatInput): AsyncGenerator<ChatChunk>

// Usage
ai.getUsage(params?: UsageQueryInput): Promise<UsageOutput>
ai.getUsageRecords(params?: UsageRecordsInput): Promise<UsageRecordsOutput>
ai.getRateLimitStatus(): Promise<RateLimitStatusOutput>

// Models
ai.getModels(): Promise<ModelsOutput>
ai.getModelInfo(provider, model): Promise<ModelInfo | null>

// Tokens
ai.countTokens(text, options?): Promise<CountTokensOutput>
```

### Reactive Atoms

```typescript
// Access via client.$atoms
client.$atoms.usage  // WritableAtom<UsageState>
client.$atoms.models // WritableAtom<ModelsState>

// Auto-refresh after chat & countTokens calls
```

### Types

```typescript
interface ChatParams {
  messages: Array<{
    role: "user" | "system" | "assistant"
    content: string
  }>
  provider?: "openai" | "anthropic" | "google"
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

interface ChatResponse {
  content: string
  usage: TokenUsage
  model: string
  provider: string
  finishReason: "stop" | "length" | "error"
}

interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}
```

---

## Best Practices

### 1. Use Environment Variables

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
```

### 2. Set Appropriate Limits

```typescript
// Development: generous limits
rateLimiting: {
  defaultLimits: {
    requestsPerMinute: 60,
    tokensPerMonth: 1000000,
  },
}

// Production: protect your budget
rateLimiting: {
  defaultLimits: {
    requestsPerMinute: 10,
    tokensPerMonth: 50000,
  },
}
```

### 3. Handle Errors Gracefully

```typescript
try {
  const response = await client.ai.chat({ messages })
} catch (error) {
  if (error.code === "RATE_LIMIT_EXCEEDED") {
    // Show upgrade prompt or retry later
  } else if (error.code === "PROVIDER_ERROR") {
    // Fallback to different provider
  } else if (error.code === "INVALID_MODEL") {
    // Use default model
  }
}
```

### 4. Stream for Better UX

```typescript
// Bad: Wait for full response
const response = await client.ai.chat({ messages })
setContent(response.content)  // User waits 5+ seconds

// Good: Stream tokens progressively
await client.ai.stream({
  messages,
  onToken: (token) => {
    setContent(prev => prev + token)  // Instant feedback
  },
})
```

### 5. Monitor Usage

```typescript
// Weekly usage report
const usage = await client.ai.getUsage({ period: "week" })
if (usage.totalCost > 100) {
  await notifyAdmin("High AI usage: $" + usage.totalCost)
}
```

---

## Production Checklist

- [ ] Set all provider API keys in environment
- [ ] Configure appropriate rate limits
- [ ] Enable usage tracking for cost monitoring
- [ ] Set up plan-based limits if using subscriptions
- [ ] Add error handling for rate limits and provider errors
- [ ] Use streaming for chat interfaces
- [ ] Monitor costs with `getUsage()` endpoint
- [ ] Consider fallback providers for high availability
