import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { getCmsContentStore, getCmsMediaStore } from "@/cms/container";
import { handleApiError } from "../../error-handler";
import { validateSameOrigin } from "../../security";

export async function DELETE(
	request: NextRequest,
	context: { params: Promise<{ id: string }> },
) {
	try {
		validateSameOrigin(request);
		await authGateway.verifyAdmin();

		const { id } = await context.params;
		if (!id) {
			return NextResponse.json(
				{ code: "invalid_input", message: "media id is required" },
				{ status: 400 },
			);
		}

		const store = getCmsContentStore();
		const media = await store.getMediaAsset(id);
		if (!media) {
			return NextResponse.json(
				{ code: "not_found", message: "Media asset not found" },
				{ status: 404 },
			);
		}

		// 1. Delete in DB (throws 'in_use' CmsError if referenced in any entries)
		await store.deleteMediaAsset(id);

		// 2. Delete files in R2 storage
		const mediaStore = getCmsMediaStore();
		if (media.storageKey) {
			await mediaStore.deleteFile({ key: media.storageKey });
		}
		if (media.stagingKey) {
			await mediaStore.deleteFile({ key: media.stagingKey });
		}

		return NextResponse.json({ success: true, id });
	} catch (error) {
		return handleApiError(error);
	}
}
