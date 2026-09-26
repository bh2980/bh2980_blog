import { detectImageDimensionsAndType } from "@/cms/adapters/r2/media-store";
import type { AllowedImageMime, MediaStore } from "@/cms/adapters/r2/types";
import { ALLOWED_IMAGE_MIME_TYPES, MAX_MEDIA_BYTES, MAX_MEDIA_PIXELS } from "@/cms/core/api";
import { HttpError } from "../error-handler";

export const UPLOAD_URL_TTL_SECONDS = 600;

const EXTENSIONS: Record<AllowedImageMime, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"image/avif": "avif",
};

/** 파일 키의 확장자는 사용자가 준 파일명 대신 형식에서 정한다. */
export const extensionFor = (mimeType: AllowedImageMime) => EXTENSIONS[mimeType];

/**
 * 업로드된 staging 파일을 실제 바이트로 검사한다(§7.1): 크기, 형식(클라이언트 MIME을 믿지 않는다), 픽셀 수.
 * 실패하면 `HttpError`를 던진다.
 */
export async function inspectUploadedFile(mediaStore: MediaStore, stagingKey: string) {
	const head = await mediaStore.headFile({ key: stagingKey });
	if (!head) throw new HttpError(409, "upload_incomplete", "File has not been uploaded to storage yet");
	if (head.contentLength > MAX_MEDIA_BYTES) {
		throw new HttpError(413, "payload_too_large", "Uploaded file exceeds 10MiB limit");
	}
	const bytes = await mediaStore.readFile({ key: stagingKey, maxBytes: MAX_MEDIA_BYTES + 1 });
	const detected = detectImageDimensionsAndType(bytes);
	if (!detected || !(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(detected.mimeType)) {
		throw new HttpError(415, "unsupported_media_type", "Uploaded file is not a valid or allowed image format");
	}
	if (detected.width * detected.height > MAX_MEDIA_PIXELS) {
		throw new HttpError(413, "too_many_pixels", "Image exceeds the 40 megapixel limit");
	}
	return { head, detected };
}
