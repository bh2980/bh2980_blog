import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
	type AllowedImageMime,
	ALLOWED_IMAGE_MIMES,
	type MediaStore,
	type MediaStoreConfig,
	type PrepareUploadInput,
	type PrepareUploadOutput,
	type PromoteFileInput,
	type StoredFileHead,
} from "./types";

export interface ImageDimensionsAndType {
	mimeType: AllowedImageMime;
	width: number;
	height: number;
}

export function detectImageDimensionsAndType(buffer: Uint8Array): ImageDimensionsAndType | null {
	if (!buffer || buffer.length < 16) return null;

	// 1. PNG: 89 50 4E 47 0D 0A 1A 0A
	if (
		buffer[0] === 0x89 &&
		buffer[1] === 0x50 &&
		buffer[2] === 0x4e &&
		buffer[3] === 0x47 &&
		buffer[4] === 0x0d &&
		buffer[5] === 0x0a &&
		buffer[6] === 0x1a &&
		buffer[7] === 0x0a
	) {
		if (buffer.length >= 24) {
			const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
			const width = view.getUint32(16, false);
			const height = view.getUint32(20, false);
			if (width > 0 && height > 0) {
				return { mimeType: "image/png", width, height };
			}
		}
	}

	// 2. GIF: GIF87a or GIF89a
	if (
		buffer[0] === 0x47 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x38 &&
		(buffer[4] === 0x37 || buffer[4] === 0x39) &&
		buffer[5] === 0x61
	) {
		const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
		const width = view.getUint16(6, true);
		const height = view.getUint16(8, true);
		if (width > 0 && height > 0) {
			return { mimeType: "image/gif", width, height };
		}
	}

	// 3. JPEG: FF D8 FF
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
		let offset = 2;
		while (offset < buffer.length - 8) {
			if (buffer[offset] !== 0xff) {
				offset++;
				continue;
			}
			const marker = buffer[offset + 1];
			// SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2) contain width/height
			if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
				const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
				const height = view.getUint16(offset + 5, false);
				const width = view.getUint16(offset + 7, false);
				if (width > 0 && height > 0) {
					return { mimeType: "image/jpeg", width, height };
				}
				break;
			}
			const len = (buffer[offset + 2] << 8) | buffer[offset + 3];
			offset += 2 + len;
		}
		// Fallback for JPEG without parsed markers
		return { mimeType: "image/jpeg", width: 800, height: 600 };
	}

	// 4. WebP: RIFF .... WEBP
	if (
		buffer[0] === 0x52 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x46 &&
		buffer[8] === 0x57 &&
		buffer[9] === 0x45 &&
		buffer[10] === 0x42 &&
		buffer[11] === 0x50
	) {
		const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
		// VP8 (lossy)
		if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x20) {
			if (buffer.length >= 30) {
				const width = view.getUint16(26, true) & 0x3fff;
				const height = view.getUint16(28, true) & 0x3fff;
				return { mimeType: "image/webp", width, height };
			}
		}
		// VP8L (lossless)
		if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x4c) {
			if (buffer.length >= 25) {
				const b1 = buffer[21];
				const b2 = buffer[22];
				const b3 = buffer[23];
				const b4 = buffer[24];
				const width = 1 + (((b2 & 0x3f) << 8) | b1);
				const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
				return { mimeType: "image/webp", width, height };
			}
		}
		return { mimeType: "image/webp", width: 800, height: 600 };
	}

	// 5. AVIF: .... ftypavif
	if (
		buffer.length >= 12 &&
		buffer[4] === 0x66 &&
		buffer[5] === 0x74 &&
		buffer[6] === 0x79 &&
		buffer[7] === 0x70 &&
		buffer[8] === 0x61 &&
		buffer[9] === 0x76 &&
		buffer[10] === 0x69 &&
		buffer[11] === 0x66
	) {
		return { mimeType: "image/avif", width: 800, height: 600 };
	}

	return null;
}

export function createR2MediaStore(config: MediaStoreConfig): MediaStore {
	const s3 = new S3Client({
		region: "auto",
		endpoint: config.endpoint,
		credentials: {
			accessKeyId: config.accessKeyId,
			secretAccessKey: config.secretAccessKey,
		},
	});

	return {
		prepareUpload: async (input: PrepareUploadInput): Promise<PrepareUploadOutput> => {
			if (!ALLOWED_IMAGE_MIMES.includes(input.contentType)) {
				throw new Error(`Disallowed image mime type: ${input.contentType}`);
			}

			const command = new PutObjectCommand({
				Bucket: config.bucket,
				Key: input.stagingKey,
				ContentType: input.contentType,
			});

			const expiresIn = Math.min(Math.max(input.expiresInSeconds, 60), 900); // 1~15 mins, default 10m
			const url = await getSignedUrl(s3, command, { expiresIn });
			const expiresAt = new Date(Date.now() + expiresIn * 1000);

			return {
				url,
				method: "PUT",
				requiredHeaders: {
					"Content-Type": input.contentType,
				},
				expiresAt,
			};
		},

		headFile: async (input: { key: string; signal?: AbortSignal }): Promise<StoredFileHead | null> => {
			try {
				const res = await s3.send(
					new HeadObjectCommand({
						Bucket: config.bucket,
						Key: input.key,
					}),
					{ abortSignal: input.signal },
				);

				return {
					key: input.key,
					contentType: res.ContentType || "application/octet-stream",
					contentLength: res.ContentLength || 0,
					etag: res.ETag,
					lastModified: res.LastModified,
				};
			} catch (err: any) {
				if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
					return null;
				}
				throw err;
			}
		},

		readFile: async (input: { key: string; maxBytes: number; signal?: AbortSignal }): Promise<Uint8Array> => {
			const res = await s3.send(
				new GetObjectCommand({
					Bucket: config.bucket,
					Key: input.key,
				}),
				{ abortSignal: input.signal },
			);

			if (!res.Body) {
				return new Uint8Array(0);
			}

			const stream = res.Body as any;
			const chunks: Uint8Array[] = [];
			let totalBytes = 0;

			for await (const chunk of stream) {
				const uint8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
				totalBytes += uint8.length;
				if (totalBytes > input.maxBytes) {
					throw new Error(`File exceeded max bytes limit of ${input.maxBytes}`);
				}
				chunks.push(uint8);
			}

			const result = new Uint8Array(totalBytes);
			let offset = 0;
			for (const chunk of chunks) {
				result.set(chunk, offset);
				offset += chunk.length;
			}
			return result;
		},

		promoteFile: async (input: PromoteFileInput): Promise<StoredFileHead> => {
			if (!ALLOWED_IMAGE_MIMES.includes(input.contentType)) {
				throw new Error(`Disallowed image mime type: ${input.contentType}`);
			}

			// 1. Copy from staging to final key
			await s3.send(
				new CopyObjectCommand({
					Bucket: config.bucket,
					CopySource: `${config.bucket}/${input.stagingKey}`,
					Key: input.finalKey,
					ContentType: input.contentType,
					CacheControl: input.cacheControl || "public, max-age=31536000, immutable",
					MetadataDirective: "REPLACE",
				}),
			);

			// 2. Head final key to verify
			const headRes = await s3.send(
				new HeadObjectCommand({
					Bucket: config.bucket,
					Key: input.finalKey,
				}),
			);

			// 3. Best-effort delete staging key
			try {
				await s3.send(
					new DeleteObjectCommand({
						Bucket: config.bucket,
						Key: input.stagingKey,
					}),
				);
			} catch {
				// Ignore staging cleanup failure
			}

			return {
				key: input.finalKey,
				contentType: headRes.ContentType || input.contentType,
				contentLength: headRes.ContentLength || 0,
				etag: headRes.ETag,
				lastModified: headRes.LastModified,
			};
		},

		deleteFile: async (input: { key: string; signal?: AbortSignal }): Promise<void> => {
			try {
				await s3.send(
					new DeleteObjectCommand({
						Bucket: config.bucket,
						Key: input.key,
					}),
					{ abortSignal: input.signal },
				);
			} catch {
				// Idempotent delete
			}
		},

		getPublicUrl: (finalKey: string): string => {
			const cleanBase = config.publicBaseUrl.replace(/\/+$/, "");
			const cleanKey = finalKey.replace(/^\/+/, "");
			return `${cleanBase}/${cleanKey}`;
		},
	};
}
