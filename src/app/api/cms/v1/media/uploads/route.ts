import { randomUUID } from "node:crypto";
import { getCmsContentStore, getCmsMediaStore } from "@/cms/container";
import { ALLOWED_IMAGE_MIME_TYPES, MAX_MEDIA_BYTES, mediaUploadBodySchema } from "@/cms/core/api";
import { HttpError } from "../../error-handler";
import { adminRoute, json, parseWith, readJsonBody } from "../../handler";
import { extensionFor, UPLOAD_URL_TTL_SECONDS } from "../media-files";

/**
 * 업로드 준비(§7.2). 서버가 허용 형식·크기와 파일 키를 정하고 제한된 시간의 직접 업로드 URL을 준다.
 * 자격 증명은 브라우저에 가지 않고 파일 본문은 앱 서버를 거치지 않는다.
 */
export const POST = adminRoute(async ({ request }) => {
	const raw = (await readJsonBody(request)) as { mimeType?: unknown; original?: { mimeType?: unknown } };
	// §10.1: 허용하지 않는 파일 형식은 415다(형식 오류 400과 구분한다).
	for (const mimeType of [raw?.mimeType, raw?.original?.mimeType]) {
		if (mimeType !== undefined && !(ALLOWED_IMAGE_MIME_TYPES as readonly unknown[]).includes(mimeType)) {
			throw new HttpError(415, "unsupported_media_type", `Allowed image types: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`);
		}
	}
	const body = parseWith(mediaUploadBodySchema, raw);
	for (const file of [body, body.original]) {
		if (file && file.byteSize > MAX_MEDIA_BYTES) {
			throw new HttpError(413, "payload_too_large", `File size exceeds the 10MiB limit (${file.byteSize} bytes)`);
		}
	}

	const mediaId = randomUUID();
	const stagingKey = `staging/${mediaId}/${randomUUID()}.${extensionFor(body.mimeType)}`;
	const originalStagingKey = body.original
		? `staging/${mediaId}/original-${randomUUID()}.${extensionFor(body.original.mimeType)}`
		: null;

	await getCmsContentStore().createMediaAsset({
		id: mediaId,
		filename: body.filename,
		mimeType: body.mimeType,
		byteSize: body.byteSize,
		stagingKey,
		...(body.original && originalStagingKey
			? {
					original: {
						mimeType: body.original.mimeType,
						byteSize: body.original.byteSize,
						stagingKey: originalStagingKey,
					},
				}
			: {}),
	});

	const mediaStore = getCmsMediaStore();
	const presigned = await mediaStore.prepareUpload({
		stagingKey,
		contentType: body.mimeType,
		expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
	});
	const original =
		body.original && originalStagingKey
			? await mediaStore.prepareUpload({
					stagingKey: originalStagingKey,
					contentType: body.original.mimeType,
					expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
				})
			: null;

	const describe = (upload: typeof presigned) => ({
		uploadUrl: upload.url,
		method: upload.method,
		requiredHeaders: upload.requiredHeaders,
		expiresAt: upload.expiresAt.toISOString(),
	});
	return json(
		{ mediaId, ...describe(presigned), ...(original ? { original: describe(original) } : {}) },
		{ status: 201 },
	);
});
