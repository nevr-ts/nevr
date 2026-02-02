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

## Installation

### Add AI Gateway Plugin

Add the plugin to your config:

```typescript
// nevr.config.ts
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

###  Generate and push or migrate the database

```bash
npx nevr generate    # Generates user + session tables
npx nevr db:push     # Push to database
# or
npx nevr db:migrate  # Create migration files
```

###  Client Setup

```typescript
import { createClient } from "nevr/client"
import { aiGatewayClient } from "nevr/plugins/ai-gateway/client"
import type { API } from "./api"

const client = createClient<API>()({
  baseURL: "/api",
  plugins: [aiGatewayClient()],
})
```

---

## Configuration Reference

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

### Tool/Function Calling

AI Gateway supports tool/function calling across all providers with a unified interface:

```typescript
// Define tools
const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Get current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
          unit: { type: "string", enum: ["celsius", "fahrenheit"] },
        },
        required: ["location"],
      },
    },
  },
]

// Chat with tools
const response = await client.ai.chat({
  messages: [{ role: "user", content: "What's the weather in Tokyo?" }],
  tools,
  toolChoice: "auto",  // "auto" | "none" | "required" | { type: "function", function: { name: "..." } }
})

// Handle tool calls
if (response.toolCalls && response.toolCalls.length > 0) {
  for (const toolCall of response.toolCalls) {
    const args = JSON.parse(toolCall.function.arguments)

    // Execute your function
    const result = await getWeather(args.location, args.unit)

    // Continue conversation with tool result
    const followUp = await client.ai.chat({
      messages: [
        { role: "user", content: "What's the weather in Tokyo?" },
        { role: "assistant", content: response.content, toolCalls: response.toolCalls },
        { role: "tool", toolCallId: toolCall.id, content: JSON.stringify(result) },
      ],
      tools,
    })
  }
}
```

### Image/Vision Support

Send images in messages for multimodal analysis:

```typescript
// Using base64 image
const response = await client.ai.chat({
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "What's in this image?" },
        {
          type: "image",
          image: "data:image/jpeg;base64,/9j/4AAQ...",  // base64 or URL
          mimeType: "image/jpeg",  // Optional
          detail: "high",          // "low" | "high" | "auto"
        },
      ],
    },
  ],
  model: "gpt-5",  // Use a vision-capable model
})

// Using image URL
const response = await client.ai.chat({
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Describe this diagram" },
        { type: "image", image: "https://example.com/diagram.png" },
      ],
    },
  ],
})
```

### Request Cancellation

Cancel in-flight requests using AbortSignal:

```typescript
// Create abort controller
const controller = new AbortController()

// Start request
const responsePromise = client.ai.chat({
  messages: [{ role: "user", content: "Write a long essay..." }],
  signal: controller.signal,
})

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000)

try {
  const response = await responsePromise
} catch (error) {
  if (error.code === "REQUEST_CANCELLED") {
    console.log("Request was cancelled")
  }
}

// Cancel streaming
const streamController = new AbortController()

await client.ai.stream({
  messages: [{ role: "user", content: "Tell me a very long story" }],
  signal: streamController.signal,
  onToken: (token) => {
    console.log(token)
    // Cancel if we got enough content
    if (totalLength > 1000) {
      streamController.abort()
    }
  },
})
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
import { createClient } from "nevr/client"
import { aiGatewayClient } from "nevr/plugins/ai-gateway/client"
import React from "react"

// Create your client
const client = createClient<API>()({
  baseURL: "/api",
  plugins: [aiGatewayClient()],
})

// Create the hook with React and client.ai
const useAIChat = createUseAIChat(React, client.ai)

function ChatComponent() {
  const { messages, isLoading, error, send, clear, abort } = useAIChat({
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
      {isLoading && (
        <div>
          Thinking...
          <button onClick={abort}>Cancel</button>
        </div>
      )}
      <input onKeyDown={(e) => e.key === 'Enter' && send(e.target.value)} />
    </div>
  )
}
```

#### Understanding `createUseAIChat(React, client.ai)`

The `createUseAIChat` function is a **factory function** that creates a React hook. Here's why it takes two parameters:

**Parameter 1: `React`**

```typescript
createUseAIChat(React, client.ai)
//              ^^^^^ Why pass React?
```

Nevr doesn't bundle React as a dependency. This "dependency injection" pattern:
- **Avoids React version conflicts** — Your app uses its own React version
- **Keeps bundle size small** — No duplicate React in the bundle
- **Supports SSR** — Works with any React environment (Next.js, Remix, etc.)
- **Framework agnostic** — Could work with Preact or other React-compatible libraries

The function only needs `useState` and `useCallback` from React:

```typescript
function createUseAIChat(
  React: {
    useState: <T>(initial: T) => [T, (value: T) => void]
    useCallback: <T extends Function>(callback: T, deps: any[]) => T
  },
  aiClient: AIGatewayClientMethods
)
```

**Parameter 2: `client.ai`**

```typescript
createUseAIChat(React, client.ai)
//                     ^^^^^^^^^ Why pass the client?
```

The hook needs the **actual client instance** because:
- **Authentication** — The client handles cookies/tokens automatically
- **Base URL** — Uses the configured API endpoint
- **Error handling** — Inherits client's error handling and typing
- **Type safety** — Full TypeScript inference from your API types

Without passing the client, the hook would need to:
- Create its own fetch logic (duplicating code)
- Handle authentication separately (breaking the pattern)
- Lose type inference from your API

**How it works internally:**

```typescript
// 1. Factory creates the hook bound to your client
const useAIChat = createUseAIChat(React, client.ai)

// 2. Hook manages state and calls client.ai methods
function useAIChat(options) {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const send = useCallback(async (content) => {
    // Uses client.ai.chat() with auth headers, base URL, etc.
    const response = await client.ai.chat({
      messages: [...messages, { role: "user", content }],
      model: options.model,
    })
    setMessages([...messages, response])
  }, [messages])

  return { messages, isLoading, send, clear }
}
```

**Alternative: Stream with hook**

```typescript
function ChatComponent() {
  const { messages, sendStream } = useAIChat()
  const [streaming, setStreaming] = useState("")

  const handleSend = async (input) => {
    setStreaming("")
    for await (const token of sendStream(input)) {
      setStreaming(prev => prev + token)  // Real-time updates
    }
  }
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

## Conversation Persistence

AI Gateway can persist conversations to your database, enabling chat history, conversation resumption, and multi-turn interactions.

### Create a Conversation

```typescript
const conversation = await client.ai.createConversation({
  title: "Project Discussion",
  systemPrompt: "You are a helpful project manager.",
  model: "gpt-5-mini",
  provider: "openai",
  metadata: { projectId: "proj_123" },
})

// Returns
{
  id: "conv_abc123",
  title: "Project Discussion",
  systemPrompt: "You are a helpful project manager.",
  messages: [],
  model: "gpt-5-mini",
  provider: "openai",
  metadata: { projectId: "proj_123" },
  totalTokens: 0,
  totalCost: 0,
  createdAt: "2026-02-02T10:00:00Z",
  updatedAt: "2026-02-02T10:00:00Z",
}
```

### Send Messages to Conversation

```typescript
// Send a message and get AI response
const response = await client.ai.sendMessage("conv_abc123", "What are our project deadlines?", {
  temperature: 0.7,
  maxTokens: 500,
})

// Response includes AI reply and updates conversation
{
  content: "Based on the project timeline...",
  usage: { promptTokens: 45, completionTokens: 120, totalTokens: 165 },
  model: "gpt-5-mini",
  provider: "openai",
  finishReason: "stop",
}
```

### Retrieve Conversation

```typescript
const conversation = await client.ai.getConversation("conv_abc123")

// Returns full conversation with message history
{
  id: "conv_abc123",
  title: "Project Discussion",
  messages: [
    { role: "user", content: "What are our project deadlines?" },
    { role: "assistant", content: "Based on the project timeline..." },
  ],
  totalTokens: 165,
  totalCost: 0.00012,
  // ...
}
```

### List Conversations

```typescript
const { conversations, pagination } = await client.ai.listConversations({
  limit: 20,
  offset: 0,
  orderBy: "updatedAt",
  order: "desc",
})

// Returns paginated list
{
  conversations: [
    { id: "conv_abc123", title: "Project Discussion", ... },
    { id: "conv_def456", title: "Code Review", ... },
  ],
  pagination: {
    total: 42,
    limit: 20,
    offset: 0,
    hasMore: true,
  },
}
```

### Update Conversation

```typescript
await client.ai.updateConversation("conv_abc123", {
  title: "Q1 Project Discussion",
  metadata: { projectId: "proj_123", quarter: "Q1" },
})
```

### Delete Conversation

```typescript
await client.ai.deleteConversation("conv_abc123")
```

### Chat with Conversation Context

You can also use conversations with the regular chat endpoint:

```typescript
// Chat continues existing conversation
const response = await client.ai.chat({
  conversationId: "conv_abc123",
  messages: [{ role: "user", content: "Follow up question..." }],
})
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
| POST | `/ai/chat` | Chat completion |
| POST | `/ai/chat/stream` | Streaming chat (SSE) |
| GET | `/ai/usage` | Get usage statistics |
| GET | `/ai/usage/records` | Get detailed usage records |
| GET | `/ai/rate-limit-status` | Get current rate limit state |
| GET | `/ai/models` | List available models |
| GET | `/ai/models/:provider/:model` | Get model info |
| POST | `/ai/count-tokens` | Count tokens for text |
| POST | `/ai/conversations` | Create conversation |
| GET | `/ai/conversations` | List conversations |
| GET | `/ai/conversations/:id` | Get conversation |
| PATCH | `/ai/conversations/:id` | Update conversation |
| DELETE | `/ai/conversations/:id` | Delete conversation |
| POST | `/ai/conversations/:id/messages` | Send message to conversation |

### Client Methods

```typescript
const ai = client.ai

// Chat
ai.chat(params: ChatInput): Promise<ChatOutput>
ai.stream(params: StreamInput): Promise<void>
ai.streamIterator(params: ChatInput): AsyncGenerator<ChatChunk>

// Conversation Persistence
ai.createConversation(params?: ConversationCreateInput): Promise<ConversationOutput>
ai.getConversation(id: string): Promise<ConversationOutput | null>
ai.listConversations(params?: ConversationListInput): Promise<ConversationListOutput>
ai.updateConversation(id: string, params: ConversationUpdateInput): Promise<ConversationOutput>
ai.deleteConversation(id: string): Promise<void>
ai.sendMessage(conversationId: string, content: string, options?: SendMessageOptions): Promise<ChatOutput>

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
// Message content can be text or multimodal
type MessageContent = string | Array<TextContent | ImageContent>

interface TextContent {
  type: "text"
  text: string
}

interface ImageContent {
  type: "image"
  image: string              // base64 data URL or http(s) URL
  mimeType?: string          // "image/jpeg", "image/png", etc.
  detail?: "low" | "high" | "auto"
}

interface ChatMessage {
  role: "user" | "system" | "assistant" | "tool"
  content: MessageContent
  toolCallId?: string        // For tool role messages
  toolCalls?: ToolCall[]     // For assistant messages with tool calls
  name?: string              // Optional name for the message author
}

interface ChatParams {
  messages: ChatMessage[]
  provider?: "openai" | "anthropic" | "google"
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  tools?: ToolDefinition[]
  toolChoice?: ToolChoice
  signal?: AbortSignal       // For request cancellation
  conversationId?: string    // Link to persisted conversation
}

interface ChatResponse {
  content: string
  usage: TokenUsage
  model: string
  provider: string
  finishReason: "stop" | "length" | "tool_calls" | "error"
  toolCalls?: ToolCall[]     // Present if model wants to call tools
}

interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

// Tool/Function calling types
interface ToolDefinition {
  type: "function"
  function: {
    name: string
    description?: string
    parameters?: Record<string, unknown>  // JSON Schema
    strict?: boolean
  }
}

interface ToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string  // JSON string
  }
}

type ToolChoice =
  | "auto"                                           // Model decides
  | "none"                                           // No tool calls
  | "required"                                       // Must call a tool
  | { type: "function"; function: { name: string } } // Call specific tool

// Conversation types
interface Conversation {
  id: string
  title?: string
  systemPrompt?: string
  messages: ChatMessage[]
  model?: string
  provider?: "openai" | "anthropic" | "google"
  metadata?: Record<string, unknown>
  totalTokens: number
  totalCost: number
  createdAt: string
  updatedAt: string
}
```

---

## Schema

The AI Gateway plugin creates three database entities when `trackUsage: true`:

### aiUsage

Tracks every AI request for billing and analytics.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| referenceId | string | User/Org ID for tracking |
| provider | string | Provider used (openai, anthropic, google) |
| model | string | Model used (gpt-5-mini, claude-sonnet-4-5, etc.) |
| inputTokens | int | Input/prompt token count |
| outputTokens | int | Output/completion token count |
| totalTokens | int | Total tokens (input + output) |
| cost | float | Calculated cost in USD |
| requestId | string? | Optional request ID for tracing |
| conversationId | string? | Link to conversation if used |
| metadata | json? | Custom metadata |
| createdAt | datetime | Record creation time |

### aiRateLimitState

Tracks rate limit state per reference for enforcing limits.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| referenceId | string | User/Org ID |
| minuteCount | int | Current minute request count |
| minuteStart | int | Minute window start timestamp |
| dayCount | int | Current day request count |
| dayStart | int | Day window start timestamp |
| monthTokens | int | Current month token count |
| monthStart | int | Month window start timestamp |

### aiConversation

Stores conversation history for persistence.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| referenceId | string | User/Org ID (owner) |
| title | string? | Conversation title |
| systemPrompt | string? | System prompt for this conversation |
| messages | json | Messages array (ChatMessage[]) |
| model | string? | Default model for this conversation |
| provider | string? | Default provider for this conversation |
| metadata | json? | Custom metadata |
| totalTokens | int | Total tokens used in conversation |
| totalCost | float | Total cost for conversation |
| createdAt | datetime | Creation time |
| updatedAt | datetime | Last update time |

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
  const response = await client.ai.chat({ messages, signal: controller.signal })
} catch (error) {
  switch (error.code) {
    case "RATE_LIMIT_EXCEEDED":
      // Show upgrade prompt or retry later
      console.log("Retry after:", error.retryAfter)
      break
    case "REQUEST_CANCELLED":
      // User cancelled the request
      console.log("Request was cancelled")
      break
    case "PROVIDER_ERROR":
      // Fallback to different provider
      break
    case "INVALID_MODEL":
      // Use default model
      break
    case "CONVERSATION_NOT_FOUND":
      // Handle missing conversation
      break
    case "INVALID_TOOL_CALL":
      // Handle malformed tool call
      break
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `RATE_LIMIT_EXCEEDED` | 429 | User exceeded rate limits |
| `REQUEST_CANCELLED` | 499 | Request was cancelled via AbortSignal |
| `PROVIDER_ERROR` | 502 | AI provider returned an error |
| `INVALID_MODEL` | 400 | Requested model not available |
| `INVALID_PROVIDER` | 400 | Provider not configured |
| `CONVERSATION_NOT_FOUND` | 404 | Conversation ID doesn't exist |
| `INVALID_TOOL_CALL` | 400 | Malformed tool definition or call |
| `UNAUTHORIZED` | 401 | User not authenticated |

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

## Advanced Features

### Automatic Retry with Exponential Backoff

AI Gateway automatically retries failed requests with exponential backoff:

```typescript
aiGateway({
  providers: { /* ... */ },
  retry: {
    attempts: 3,        // Max retry attempts (default: 3)
    delay: 1000,        // Initial delay in ms (default: 1000)
    multiplier: 2,      // Backoff multiplier (default: 2)
    maxDelay: 30000,    // Max delay cap in ms (default: 30000)
  },
})
```

**Retry behavior:**
- Retries on network errors and 5xx responses
- Does NOT retry on 4xx errors (bad request, rate limit)
- Adds ±10% jitter to prevent thundering herd
- Respects AbortSignal cancellation

### Provider Fallback

Configure multiple providers for high availability:

```typescript
aiGateway({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY },
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
  },
  defaultProvider: "openai",
  // On provider error, client can retry with different provider
})

// Client-side fallback
try {
  response = await client.ai.chat({ messages, provider: "openai" })
} catch (error) {
  if (error.code === "PROVIDER_ERROR") {
    response = await client.ai.chat({ messages, provider: "anthropic" })
  }
}
```

### Custom Reference ID for Multi-tenant

Track usage per organization, team, or custom identifier:

```typescript
aiGateway({
  referenceMode: "custom",
  getReferenceId: async (ctx) => {
    // Track by organization instead of user
    return ctx.session?.user?.organizationId || ctx.session?.user?.id
  },
})
```

---

## Production Checklist

- [ ] Set all provider API keys in environment
- [ ] Configure appropriate rate limits
- [ ] Enable usage tracking for cost monitoring
- [ ] Set up plan-based limits if using subscriptions
- [ ] Add error handling for rate limits, cancellation, and provider errors
- [ ] Use streaming for chat interfaces
- [ ] Monitor costs with `getUsage()` endpoint
- [ ] Consider fallback providers for high availability
- [ ] Use AbortController for user-cancellable operations
- [ ] Implement conversation persistence for chat history
