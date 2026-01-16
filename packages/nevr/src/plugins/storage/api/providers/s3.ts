// =============================================================================
// S3 STORAGE PROVIDER
// Supports AWS S3, Cloudflare R2, MinIO, and other S3-compatible services
// =============================================================================

import type { StorageProvider, S3ProviderConfig, PresignedUrl } from "../../types.js"
import { getLogger } from "../../../../logger.js"

// -----------------------------------------------------------------------------
// S3 SDK Type (minimal interface for dynamic import)
// -----------------------------------------------------------------------------

interface S3Client {
    send(command: unknown): Promise<unknown>
}

interface GetObjectCommand {
    new(input: { Bucket: string; Key: string }): unknown
}

interface PutObjectCommand {
    new(input: { Bucket: string; Key: string; ContentType: string; ContentLength: number }): unknown
}

interface DeleteObjectCommand {
    new(input: { Bucket: string; Key: string }): unknown
}

interface HeadObjectCommand {
    new(input: { Bucket: string; Key: string }): unknown
}

interface CopyObjectCommand {
    new(input: { Bucket: string; Key: string; CopySource: string }): unknown
}

interface GetSignedUrl {
    (client: S3Client, command: unknown, options: { expiresIn: number }): Promise<string>
}

// -----------------------------------------------------------------------------
// S3 Provider Implementation
// -----------------------------------------------------------------------------

/**
 * Create S3 storage provider
 */
export async function createS3Provider(config: S3ProviderConfig): Promise<StorageProvider> {
    let s3Client: S3Client
    let getSignedUrl: GetSignedUrl
    let GetObjectCommand: GetObjectCommand
    let PutObjectCommand: PutObjectCommand
    let DeleteObjectCommand: DeleteObjectCommand
    let HeadObjectCommand: HeadObjectCommand
    let CopyObjectCommand: CopyObjectCommand

    try {
        // Dynamic import AWS SDK v3
        // @ts-expect-error - AWS SDK may not be installed
        const clientModule = await import("@aws-sdk/client-s3")
        // @ts-expect-error - AWS SDK may not be installed
        const presignerModule = await import("@aws-sdk/s3-request-presigner")

        const S3Client = clientModule.S3Client
        GetObjectCommand = clientModule.GetObjectCommand
        PutObjectCommand = clientModule.PutObjectCommand
        DeleteObjectCommand = clientModule.DeleteObjectCommand
        HeadObjectCommand = clientModule.HeadObjectCommand
        CopyObjectCommand = clientModule.CopyObjectCommand
        getSignedUrl = presignerModule.getSignedUrl

        s3Client = new S3Client({
            region: config.region,
            credentials: config.accessKeyId && config.secretAccessKey ? {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            } : undefined,
            endpoint: config.endpoint,
            forcePathStyle: config.forcePathStyle,
        })
    } catch (error) {
        throw new Error(
            "[Storage] Failed to load AWS SDK. Install it with: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner"
        )
    }

    return {
        type: "s3",

        async getUploadUrl(key, options) {
            const command = new PutObjectCommand({
                Bucket: config.bucket,
                Key: key,
                ContentType: options.mimeType,
                ContentLength: options.size,
            })

            const url = await getSignedUrl(s3Client, command, {
                expiresIn: options.expiresIn,
            })

            return {
                url,
                method: "PUT",
                headers: {
                    "Content-Type": options.mimeType,
                    "Content-Length": String(options.size),
                },
                expiresAt: new Date(Date.now() + options.expiresIn * 1000),
                key,
            }
        },

        async getDownloadUrl(key, options) {
            const command = new GetObjectCommand({
                Bucket: config.bucket,
                Key: key,
            })

            const url = await getSignedUrl(s3Client, command, {
                expiresIn: options.expiresIn,
            })

            return {
                url,
                method: "GET",
                expiresAt: new Date(Date.now() + options.expiresIn * 1000),
                key,
            }
        },

        getPublicUrl(key) {
            if (config.publicUrlBase) {
                return `${config.publicUrlBase.replace(/\/$/, "")}/${key}`
            }

            if (config.endpoint) {
                // Custom endpoint (R2, MinIO)
                return `${config.endpoint}/${config.bucket}/${key}`
            }

            // Standard S3 URL
            return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`
        },

        async deleteFile(key) {
            try {
                const command = new DeleteObjectCommand({
                    Bucket: config.bucket,
                    Key: key,
                })
                await s3Client.send(command)
            } catch (error) {
                getLogger().error("[Storage] S3 delete failed:", error)
                throw error
            }
        },

        async fileExists(key) {
            try {
                const command = new HeadObjectCommand({
                    Bucket: config.bucket,
                    Key: key,
                })
                await s3Client.send(command)
                return true
            } catch (error: any) {
                if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
                    return false
                }
                throw error
            }
        },

        async copyFile(sourceKey, destKey) {
            try {
                const command = new CopyObjectCommand({
                    Bucket: config.bucket,
                    Key: destKey,
                    CopySource: `${config.bucket}/${sourceKey}`,
                })
                await s3Client.send(command)
            } catch (error) {
                getLogger().error("[Storage] S3 copy failed:", error)
                throw error
            }
        },
    }
}
