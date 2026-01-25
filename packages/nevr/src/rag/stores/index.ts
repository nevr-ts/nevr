// =============================================================================
// VECTOR STORES
// Registry and factory for vector stores
// =============================================================================

export * from "./types.js"
export { InMemoryVectorStore } from "./memory.js"
export { PrismaPgvectorStore, type PrismaPgvectorConfig } from "./prisma-pgvector.js"

import type { VectorStore, VectorStoreConfig } from "./types.js"
import { VectorStoreError } from "./types.js"
import { InMemoryVectorStore } from "./memory.js"
import { PrismaPgvectorStore, type PrismaPgvectorConfig } from "./prisma-pgvector.js"

/**
 * Custom store registry for user-defined stores
 */
const customStores = new Map<string, new (config: VectorStoreConfig) => VectorStore>()

/**
 * Register a custom vector store
 * 
 * @example
 * ```typescript
 * registerStore("pinecone", PineconeVectorStore)
 * 
 * const store = getVectorStore({ type: "pinecone", connection: { ... } })
 * ```
 */
export function registerStore(
    name: string,
    StoreClass: new (config: VectorStoreConfig) => VectorStore
): void {
    customStores.set(name, StoreClass)
}

/**
 * Get a vector store by configuration
 * 
 * @example
 * ```typescript
 * // In-memory (development)
 * const memory = getVectorStore({ type: "memory" })
 * 
 * // Prisma pgvector (production)
 * const postgres = getVectorStore({ type: "prisma-pgvector", connection: { ... } })
 * 
 * // Custom
 * const custom = getVectorStore({ type: "my-store", connection: { ... } })
 * ```
 */
export function getVectorStore(config: VectorStoreConfig): VectorStore {
    const { type } = config

    // Check built-in stores
    switch (type) {
        case "memory":
            return new InMemoryVectorStore(config)
        case "prisma-pgvector":
            return new PrismaPgvectorStore(config as PrismaPgvectorConfig)
        case "pinecone":
            throw new VectorStoreError(
                "pinecone store requires @nevr/pinecone package. Install with: npm install @nevr/pinecone",
                type
            )
    }

    // Check custom stores
    const CustomStore = customStores.get(type)
    if (CustomStore) {
        return new CustomStore(config)
    }

    throw new VectorStoreError(
        `Unknown store type: "${type}". Built-in: memory. Optional: prisma-pgvector, pinecone`,
        type
    )
}

/**
 * Check if a store type is available
 */
export function hasStore(type: string): boolean {
    return type === "memory" || type === "prisma-pgvector" || customStores.has(type)
}

/**
 * List available stores
 */
export function listStores(): string[] {
    return ["memory", "prisma-pgvector", ...customStores.keys()]
}
