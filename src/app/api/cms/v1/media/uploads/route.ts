import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import {
	ALLOWED_IMAGE_MIMES,
	type AllowedImageMime,
	MAX_MEDIA_BYTE_SIZE,
} from "@/cms/adapters/r2/types";
import { getCmsContentStore, getCmsMediaStore } from "@/cms/container";
import { handleApiError } from "../../error-handler";
import { validateSameOrigin } from "../../security";

export async function POST(request: NextRequest) {
	try {
		validateSameOrigin(request);
		await authGateway.verifyAdmin();

		const body = await request.json();
		const { filename, mimeType, byteSize } = body ?? {};

		if (!filename || typeof filename !== "string") {
			return NextResponse.json(
				{ code: "invalid_input", message: "filename is required" },
				{ status: 400 },
			);
		}

		if (!mimeType || !ALLOWED_IMAGE_MIMES.includes(mimeType as AllowedImageMime)) {
			return NextResponse.json(
				{
					code: "unsupported_media_type",
					message: `Disallowed or invalid image MIME type: ${mimeType}. Allowed: ${ALLOWED_IMAGE_MIMES.join(", ")}`,
				},
				{ status: 415 },
			);
		}

		if (!byteSize || typeof byteSize !== "number" || byteSize <= 0) {
			return NextResponse.json(
				{ code: "invalid_input", message: "byteSize must be a positive integer" },
				{ status: 400 },
			);
		}

		if (byteSize > MAX_MEDIA_BYTE_SIZE) {
			return NextResponse.json(
				{
					code: "payload_too_large",
					message: `File size exceeds the 10MiB limit (${byteSize} bytes)`,
				},
				{ status: 413 },
			);
		}

		const mediaId = randomUUID();
		const ext = filename.split(".").pop()?.toLowerCase() || "bin";
		const stagingKey = `staging/${mediaId}/${randomUUID()}.${ext}`;

		const store = getCmsContentStore();
		await store.createMediaAsset({
			id: mediaId,
			filename,
			mimeType,
			byteSize,
			stagingKey,
		});

		const mediaStore = getCmsMediaStore();
		const presigned = await mediaStore.prepareUpload({
			stagingKey,
			contentType: mimeType as AllowedImageMime,
			expiresInSeconds: 600, // 10 minutes
		});

		return NextResponse.json(
			{
				mediaId,
				uploadUrl: presigned.url,
				method: presigned.method,
				requiredHeaders: presigned.requiredHeaders,
				expiresAt: presigned.expiresAt.toISOString(),
			},
			{ status: 201 },
		);
	} catch (error) {
		return handleApiError(error);
	}
}
