import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    // Config
    config: "src/config.ts",
    // CLI (builds with shebang via esbuild banner)
    "cli/index": "src/cli/index.ts",
    // Generator
    "generator/index": "src/generator/index.ts",
    // Client
    "client/index": "src/client/index.ts",
    "client/react": "src/client/react.ts",
    // Adapters
    "adapters/index": "src/adapters/index.ts",
    "adapters/express": "src/adapters/express.ts",
    "adapters/hono": "src/adapters/hono.ts",
    "adapters/nextjs/index": "src/adapters/nextjs/index.ts",
    // Drivers
    "drivers/index": "src/drivers/index.ts",
    "drivers/prisma": "src/drivers/prisma.ts",
    // Plugins
    "plugins/index": "src/plugins/index.ts",
    "plugins/auth/index": "src/plugins/auth/index.ts",
    "plugins/auth/client": "src/plugins/auth/client.ts",
    "plugins/auth/plugins/username/index": "src/plugins/auth/plugins/username/index.ts",
    "plugins/auth/plugins/username/client": "src/plugins/auth/plugins/username/client.ts",
    "plugins/timestamps": "src/plugins/timestamps.ts",
    // RAG
    "rag/index": "src/rag/index.ts",
    // AI Gateway
    "ai-gateway/index": "src/ai-gateway/index.ts",
    "ai-gateway/client": "src/ai-gateway/client.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  splitting: true,
  sourcemap: true,
  external: [
    "express",
    "hono",
    "next",
    "next/server",
    "next/headers",
    "next/navigation",
    "@prisma/client",
    "react",
    "@nanostores/react",
  ],
})
