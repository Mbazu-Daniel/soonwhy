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

export interface StoredObjectMeta {
  sizeBytes: number;
  contentType: string;
  etag: string | null;
}
