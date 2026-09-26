import { ALLOWED_IMAGE_MIME_TYPES, MAX_MEDIA_BYTES } from "../../core/api";

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/** 허용 형식·크기는 API 계약(`core/api`)이 원천이다. */
export const ALLOWED_IMAGE_MIMES: readonly AllowedImageMime[] = ALLOWED_IMAGE_MIME_TYPES;

export const MAX_MEDIA_BYTE_SIZE = MAX_MEDIA_BYTES;

export interface StoredFileHead {
	key: string;
	contentType: string;
	contentLength: number;
	etag?: string;
	lastModified?: Date;
}

export interface PrepareUploadInput {
	stagingKey: string;
	contentType: AllowedImageMime;
	expiresInSeconds: number;
	checksumSha256?: string;
}

export interface PrepareUploadOutput {
	url: string;
	method: "PUT";
	requiredHeaders: Record<string, string>;
	expiresAt: Date;
}

export interface PromoteFileInput {
	stagingKey: string;
	finalKey: string;
	expectedEtag?: string;
	contentType: AllowedImageMime;
	cacheControl?: string;
}

export interface MediaStoreConfig {
	accountId: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	endpoint: string;
	publicBaseUrl: string;
}

export interface MediaStore {
	prepareUpload(input: PrepareUploadInput): Promise<PrepareUploadOutput>;
	headFile(input: { key: string; signal?: AbortSignal }): Promise<StoredFileHead | null>;
	readFile(input: { key: string; maxBytes: number; signal?: AbortSignal }): Promise<Uint8Array>;
	promoteFile(input: PromoteFileInput): Promise<StoredFileHead>;
	deleteFile(input: { key: string; signal?: AbortSignal }): Promise<void>;
	getPublicUrl(finalKey: string): string;
}
