export type AllowedImageMime =
	| "image/jpeg"
	| "image/png"
	| "image/webp"
	| "image/gif"
	| "image/avif";

export const ALLOWED_IMAGE_MIMES: readonly AllowedImageMime[] = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"image/avif",
];

export const MAX_MEDIA_BYTE_SIZE = 10 * 1024 * 1024; // 10 MiB

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
