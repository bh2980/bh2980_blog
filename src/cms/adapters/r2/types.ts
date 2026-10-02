import {
	ALLOWED_FILE_MIME_TYPES,
	ALLOWED_IMAGE_MIME_TYPES,
	type AllowedFileMime,
	MAX_MEDIA_BYTES,
} from "../../core/api";

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];
/** 저장소가 받는 형식: 이미지와 첨부 파일(v3). */
export type AllowedMediaMime = AllowedImageMime | AllowedFileMime;

/** 허용 형식·크기는 API 계약(`core/api`)이 원천이다. */
export const ALLOWED_IMAGE_MIMES: readonly AllowedImageMime[] = ALLOWED_IMAGE_MIME_TYPES;
export const ALLOWED_MEDIA_MIMES: readonly AllowedMediaMime[] = [
	...ALLOWED_IMAGE_MIME_TYPES,
	...ALLOWED_FILE_MIME_TYPES,
];

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
	contentType: AllowedMediaMime;
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
	contentType: AllowedMediaMime;
	cacheControl?: string;
	/** 첨부 파일은 원래 이름으로 내려받게 한다(`attachment; filename*=…`). */
	contentDisposition?: string;
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
	/** 파일 앞 `bytes`바이트만 읽는다(첨부 파일 형식 확인). 없는 구현은 `readFile`로 대신한다. */
	readPrefix?(input: { key: string; bytes: number; signal?: AbortSignal }): Promise<Uint8Array>;
	promoteFile(input: PromoteFileInput): Promise<StoredFileHead>;
	deleteFile(input: { key: string; signal?: AbortSignal }): Promise<void>;
	getPublicUrl(finalKey: string): string;
}
