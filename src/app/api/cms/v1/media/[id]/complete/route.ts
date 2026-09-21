import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { detectImageDimensionsAndType } from "@/cms/adapters/r2/media-store";
import {
	ALLOWED_IMAGE_MIMES,
	type AllowedImageMime,
	MAX_MEDIA_BYTE_SIZE,
} from "@/cms/adapters/r2/types";
import { getCmsContentStore, getCmsMediaStore } from "@/cms/container";
import { handleApiError } from "../../../error-handler";
import { validateSameOrigin } from "../../../security";

export async function POST(
	request: NextRequest,
	context: { params: Promise<{ id: string }> },
) {
	try {
		validateSameOrigin(request);
		await authGateway.verifyAdmin();

		const { id: mediaId } = await context.params;
		if (!mediaId) {
			return NextResponse.json(
				{ code: "invalid_input", message: "media id is required" },
				{ status: 400 },
			);
		}

		const store = getCmsContentStore();
		const media = await store.getMediaAsset(mediaId);
		if (!media) {
			return NextResponse.json(
				{ code: "not_found", message: "Media asset not found" },
				{ status: 404 },
			);
		}

		if (media.status === "ready") {
			// Idempotent success
			const mediaStore = getCmsMediaStore();
			const publicUrl = mediaStore.getPublicUrl(media.storageKey!);
			return NextResponse.json({
				mediaId: media.id,
				status: "ready",
				publicUrl,
				width: media.width,
				height: media.height,
				byteSize: media.byteSize,
				mimeType: media.mimeType,
			});
		}

		if (!media.stagingKey) {
			return NextResponse.json(
				{ code: "upload_incomplete", message: "No staging key found for media asset" },
				{ status: 409 },
			);
		}

		const mediaStore = getCmsMediaStore();
		// 1. HeadObject: check file existence and byte size
		const head = await mediaStore.headFile({ key: media.stagingKey });
		if (!head) {
			return NextResponse.json(
				{ code: "upload_incomplete", message: "File has not been uploaded to storage yet" },
				{ status: 409 },
			);
		}

		if (head.contentLength > MAX_MEDIA_BYTE_SIZE) {
			await store.failMediaAsset(mediaId);
			return NextResponse.json(
				{ code: "payload_too_large", message: `Uploaded file exceeds 10MiB limit` },
				{ status: 413 },
			);
		}

		// 2. Read first chunk or full file to inspect magic bytes & dimensions
		const fileBytes = await mediaStore.readFile({
			key: media.stagingKey,
			maxBytes: MAX_MEDIA_BYTE_SIZE + 1,
		});

		const detected = detectImageDimensionsAndType(fileBytes);
		if (!detected || !ALLOWED_IMAGE_MIMES.includes(detected.mimeType)) {
			await store.failMediaAsset(mediaId);
			return NextResponse.json(
				{
					code: "unsupported_media_type",
					message: "Uploaded file is not a valid or allowed image format",
				},
				{ status: 415 },
			);
		}

		// 3. Promote from stagingKey to finalKey (immutable)
		const ext = media.filename.split(".").pop()?.toLowerCase() || "bin";
		const finalKey = `media/${mediaId}/${randomUUID()}.${ext}`;

		await mediaStore.promoteFile({
			stagingKey: media.stagingKey,
			finalKey,
			expectedEtag: head.etag,
			contentType: detected.mimeType,
		});

		// 4. Update DB status to ready
		const updated = await store.completeMediaAsset({
			id: mediaId,
			storageKey: finalKey,
			mimeType: detected.mimeType,
			byteSize: head.contentLength,
			width: detected.width,
			height: detected.height,
		});

		const publicUrl = mediaStore.getPublicUrl(finalKey);

		return NextResponse.json({
			mediaId: updated.id,
			status: "ready",
			publicUrl,
			width: updated.width,
			height: updated.height,
			byteSize: updated.byteSize,
			mimeType: updated.mimeType,
		});
	} catch (error) {
		return handleApiError(error);
	}
}
