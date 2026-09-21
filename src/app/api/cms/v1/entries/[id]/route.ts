import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { getCmsContentService, getCmsContentStore } from "@/cms/container";
import { patchEntryBodySchema } from "@/cms/core/api";
import { handleApiError } from "../../error-handler";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
	try {
		await authGateway.verifyAdmin();

		const { id } = await context.params;
		const store = getCmsContentStore();
		const entry = await store.getEntry(id);

		return NextResponse.json(entry);
	} catch (error) {
		return handleApiError(error);
	}
}

export async function PATCH(request: NextRequest, context: RouteContext) {
	try {
		await authGateway.verifyAdmin();

		const { id } = await context.params;
		const body = await request.json();

		if (body.expectedVersion === undefined) {
			return NextResponse.json(
				{ error: "version_required", code: "version_required" },
				{ status: 428 },
			);
		}

		const parsed = patchEntryBodySchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid request body", details: parsed.error.issues },
				{ status: 400 },
			);
		}

		const store = getCmsContentStore();
		const currentEntry = await store.getEntry(id);

		const service = getCmsContentService();
		const updated = await service.saveDraft(id, {
			collection: currentEntry.collection as any,
			expectedVersion: parsed.data.expectedVersion,
			slug: parsed.data.slug !== undefined ? parsed.data.slug : currentEntry.workingSlug,
			metadata:
				parsed.data.metadata !== undefined
					? (parsed.data.metadata as any)
					: currentEntry.working.metadata,
			mdx: parsed.data.mdx !== undefined ? parsed.data.mdx : currentEntry.working.mdx,
		} as any);

		if (parsed.data.folderId !== undefined) {
			await store.moveEntryToFolder({
				entryId: id,
				folderId: parsed.data.folderId,
				expectedVersion: (updated as any).version,
			});
		}

		return NextResponse.json(updated);
	} catch (error) {
		return handleApiError(error);
	}
}
