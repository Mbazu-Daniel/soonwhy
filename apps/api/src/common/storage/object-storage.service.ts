import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  BadRequestException,
  Injectable,
  Logger,
  type OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";

export interface ObjectStorageConfig {
  region: string;
  endpoint: string;
  forcePathStyle: boolean;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
  uploadUrlTtlSeconds: number;
  downloadUrlTtlSeconds: number;
}

const DEFAULT_UPLOAD_URL_TTL_SECONDS = 900;
const DEFAULT_DOWNLOAD_URL_TTL_SECONDS = 3600;

function envInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readStorageConfig(): ObjectStorageConfig | undefined {
  const endpoint =
    process.env.STORAGE_ENDPOINT?.trim() || process.env.R2_ENDPOINT?.trim();
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket =
    process.env.STORAGE_BUCKET?.trim() ||
    process.env.R2_BUCKET_NAME?.trim() ||
    process.env.R2_BUCKET?.trim();

  if (!endpoint && !accountId) return undefined;
  if (!bucket || !accessKeyId || !secretAccessKey) return undefined;

  const resolvedEndpoint =
    endpoint ?? `https://${accountId}.r2.cloudflarestorage.com`;
  const isCustomEndpoint = Boolean(endpoint);

  return {
    region: process.env.STORAGE_REGION?.trim() ?? "auto",
    endpoint: resolvedEndpoint,
    forcePathStyle:
      process.env.STORAGE_FORCE_PATH_STYLE?.trim().toLowerCase() === "true" ||
      isCustomEndpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: process.env.R2_PUBLIC_URL?.trim() || undefined,
    uploadUrlTtlSeconds: envInt(
      process.env.STORAGE_UPLOAD_URL_TTL_SECONDS,
      DEFAULT_UPLOAD_URL_TTL_SECONDS,
    ),
    downloadUrlTtlSeconds: envInt(
      process.env.STORAGE_DOWNLOAD_URL_TTL_SECONDS,
      DEFAULT_DOWNLOAD_URL_TTL_SECONDS,
    ),
  };
}

export class ObjectStorageNotConfigured extends BadRequestException {
  constructor() {
    super("object storage is not configured");
  }
}

export interface StoredObjectMeta {
  sizeBytes: number;
  contentType: string;
  etag: string | null;
}

export function buildKey(kind: string, targetId: string, fileName: string): string {
  const safeName = fileName.replace(/[^\w.+-]+/g, "_").slice(-120) || "file";
  return `uploads/${kind}/${targetId}/${randomUUID()}-${safeName}`;
}

@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private readonly logger = new Logger(ObjectStorageService.name);
  private readonly config = readStorageConfig();
  private readonly client = this.config
    ? new S3Client({
        region: this.config.region,
        endpoint: this.config.endpoint,
        forcePathStyle: this.config.forcePathStyle,
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
      })
    : null;

  async onModuleInit(): Promise<void> {
    if (!this.client) {
      this.logger.warn(
        "R2/STORAGE_* not configured; upload endpoints will answer 400",
      );
      return;
    }
    await this.allowBrowserUploads();
  }

  private async allowBrowserUploads(): Promise<void> {
    if (!this.client) return;
    const origins = new Set<string>();
    for (const value of [
      process.env.FRONTEND_URL,
      ...(process.env.CORS_ORIGINS?.split(",") ?? []),
    ]) {
      const trimmed = value?.trim();
      if (!trimmed) continue;
      try {
        origins.add(new URL(trimmed).origin);
      } catch {
        this.logger.warn(`Ignoring unparsable CORS origin: ${trimmed}`);
      }
    }
    if (origins.size === 0) return;

    try {
      await this.client.send(
        new PutBucketCorsCommand({
          Bucket: this.config?.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: [...origins],
                AllowedMethods: ["PUT", "GET", "HEAD"],
                AllowedHeaders: ["content-type"],
                ExposeHeaders: ["ETag"],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        }),
      );
      this.logger.log(`Bucket CORS allows: ${[...origins].join(", ")}`);
    } catch (error) {
      this.logger.warn(
        `Could not set bucket CORS (${(error as Error).message}); set it in the provider dashboard if browser uploads fail`,
      );
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  getUploadUrlTtlSeconds(): number {
    return this.config?.uploadUrlTtlSeconds ?? DEFAULT_UPLOAD_URL_TTL_SECONDS;
  }

  private requireClient(): S3Client {
    if (!this.client || !this.config) {
      throw new ObjectStorageNotConfigured();
    }
    return this.client;
  }

  /** Public link when a public base URL is configured, else endpoint+bucket+key. */
  publicUrl(key: string): string {
    const base = this.config?.publicBaseUrl?.replace(/\/$/, "");
    if (base) return `${base}/${key}`;
    const endpoint = this.config?.endpoint.replace(/\/$/, "");
    return `${endpoint}/${this.config?.bucket}/${key}`;
  }

  async presignUploadUrl(
    key: string,
    mimeType: string,
    sizeBytes?: number,
  ): Promise<string> {
    const client = this.requireClient();
    return getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: this.config?.bucket,
        Key: key,
        ContentType: mimeType,
        ...(sizeBytes === undefined ? {} : { ContentLength: sizeBytes }),
      }),
      { expiresIn: this.config?.uploadUrlTtlSeconds ?? DEFAULT_UPLOAD_URL_TTL_SECONDS },
    );
  }

  async presignDownloadUrl(key: string): Promise<string> {
    const client = this.requireClient();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: this.config?.bucket, Key: key }),
      { expiresIn: this.config?.downloadUrlTtlSeconds ?? DEFAULT_DOWNLOAD_URL_TTL_SECONDS },
    );
  }

  async headObject(key: string): Promise<StoredObjectMeta | null> {
    const client = this.requireClient();
    try {
      const res = await client.send(
        new HeadObjectCommand({ Bucket: this.config?.bucket, Key: key }),
      );
      return {
        sizeBytes: res.ContentLength ?? 0,
        contentType: res.ContentType ?? "application/octet-stream",
        etag: res.ETag ?? null,
      };
    } catch (error) {
      const status = (
        error as { $metadata?: { httpStatusCode?: number } }
      ).$metadata?.httpStatusCode;
      if (status === 404 || status === 403) return null;
      throw error;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const client = this.requireClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: this.config?.bucket, Key: key }),
    );
  }
}
