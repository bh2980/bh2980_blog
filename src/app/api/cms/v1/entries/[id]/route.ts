import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { getCmsContentService, getCmsContentStore } from "@/cms/container";
import { patchEntryBodySchema } from "@/cms/core/api";
import { handleApiError } from "../../error-handler";
import { validateSameOrigin } from "../../security";

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
		validateSameOrigin(request);
		await authGateway.verifyAdmin();

		const { id } = await context.params;
		const body = await request.json();

		if (body.expectedVersion === undefined) {
			return NextResponse.json(
				{ code: "version_required", message: "expectedVersion is required" },
				{ status: 428 },
			);
		}

		const parsed = patchEntryBodySchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ code: "invalid_input", message: "Invalid request body", issues: parsed.error.issues },
				{ status: 400 },
			);
		}

		const store = getCmsContentStore();
		const currentEntry = await store.getEntry(id);

		const service = getCmsContentService();
		const saveDraftInput: any = {
			collection: currentEntry.collection as any,
			expectedVersion: parsed.data.expectedVersion,
			slug: parsed.data.slug !== undefined ? parsed.data.slug : currentEntry.workingSlug,
			metadata:
				parsed.data.metadata !== undefined
					? (parsed.data.metadata as any)
					: currentEntry.working.metadata,
			mdx: parsed.data.mdx !== undefined ? parsed.data.mdx : currentEntry.working.mdx,
		};
		if (parsed.data.folderId !== undefined) {
			saveDraftInput.folderId = parsed.data.folderId;
		}
		const updated = (await service.saveDraft(id, saveDraftInput)) as { id: string; version: number };

		// Record 컬렉션(tag, category, collection)은 수정 즉시 published 상태로 재발행 (명세 §5.2)
		if (["tag", "category", "collection"].includes(currentEntry.collection)) {
			const published = await store.publishEntry({ id: updated.id, expectedVersion: updated.version });
			return NextResponse.json(published);
		}

		return NextResponse.json(updated);
	} catch (error) {
		return handleApiError(error);
	}
}

export async function DELETE(request: NextRequest, context: RouteContext) {
	try {
		validateSameOrigin(request);
		await authGateway.verifyAdmin();

		const { id } = await context.params;
		const { searchParams } = new URL(request.url);
		const expectedVersionStr = searchParams.get("expectedVersion");
		const permanent = searchParams.get("permanent") === "true";

		if (!expectedVersionStr) {
			return NextResponse.json(
				{ code: "version_required", message: "expectedVersion is required" },
				{ status: 428 },
			);
		}

		const expectedVersion = parseInt(expectedVersionStr, 10);
		if (isNaN(expectedVersion)) {
			return NextResponse.json(
				{ code: "invalid_input", message: "Invalid expectedVersion" },
				{ status: 400 },
			);
		}

		const store = getCmsContentStore();
		if (permanent) {
			await store.permanentDeleteEntry({ id, expectedVersion });
			return new NextResponse(null, { status: 204 });
		} else {
			const trashed = await store.trashEntry({ id, expectedVersion });
			return NextResponse.json(trashed);
		}
	} catch (error) {
		return handleApiError(error);
	}
}
