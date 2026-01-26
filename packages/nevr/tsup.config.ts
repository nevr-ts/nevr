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
    "plugins/auth/plugins/magic-link/index": "src/plugins/auth/plugins/magic-link/index.ts",
    "plugins/auth/plugins/magic-link/client": "src/plugins/auth/plugins/magic-link/client.ts",
    "plugins/auth/plugins/two-factor/index": "src/plugins/auth/plugins/two-factor/index.ts",
    "plugins/auth/plugins/two-factor/client": "src/plugins/auth/plugins/two-factor/client.ts",
    "plugins/auth/plugins/phone-number/index": "src/plugins/auth/plugins/phone-number/index.ts",
    "plugins/auth/plugins/phone-number/client": "src/plugins/auth/plugins/phone-number/client.ts",
    "plugins/auth/plugins/anonymous/index": "src/plugins/auth/plugins/anonymous/index.ts",
    "plugins/auth/plugins/anonymous/client": "src/plugins/auth/plugins/anonymous/client.ts",
    "plugins/timestamps": "src/plugins/timestamps.ts",
    "plugins/payment/index": "src/plugins/payment/index.ts",
    "plugins/payment/client": "src/plugins/payment/client.ts",
    "plugins/organization/index": "src/plugins/organization/index.ts",
    "plugins/organization/client": "src/plugins/organization/client.ts",
    "plugins/storage/index": "src/plugins/storage/index.ts",
    "plugins/storage/client": "src/plugins/storage/client.ts",
    // RAG
    "rag/index": "src/rag/index.ts",
    "rag/client": "src/rag/client.ts",
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
