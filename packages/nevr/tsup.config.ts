import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    // CLI (builds with shebang via esbuild banner)
    "cli/index": "src/cli/index.ts",
    // Client
    "client/index": "src/client/index.ts",
    "client/react": "src/client/react.ts",
    // Adapters
    "adapters/index": "src/adapters/index.ts",
    "adapters/express": "src/adapters/express.ts",
    "adapters/hono": "src/adapters/hono.ts",
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
  },
  format: ["esm"],
  dts: true,
  clean: true,
  splitting: true,
  sourcemap: true,
  external: [
    "express",
    "hono",
    "@prisma/client",
    "react",
    "@nanostores/react",
  ],
})
