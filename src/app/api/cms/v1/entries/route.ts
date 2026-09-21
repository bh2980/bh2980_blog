import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { getCmsContentService, getCmsContentStore } from "@/cms/container";
import { createEntryBodySchema, listEntriesQuerySchema } from "@/cms/core/api";
import { handleApiError } from "../error-handler";
import { validateSameOrigin } from "../security";

export async function GET(request: NextRequest) {
	try {
		await authGateway.verifyAdmin();

		const url = new URL(request.url);
		const rawQuery: Record<string, unknown> = {};
		for (const [key, value] of url.searchParams.entries()) {
			rawQuery[key] = value;
		}

		const parsed = listEntriesQuerySchema.safeParse(rawQuery);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid query parameters", details: parsed.error.issues },
				{ status: 400 },
			);
		}

		const store = getCmsContentStore();
		const result = await store.listEntries({
			collection: parsed.data.collection,
			search: parsed.data.search,
			includeBody: parsed.data.includeBody,
			statuses: parsed.data.status,
			folderId: parsed.data.folderId,
			includeDescendants: parsed.data.includeDescendants,
			sort:
				parsed.data.sortField && parsed.data.sortDirection
					? { field: parsed.data.sortField, direction: parsed.data.sortDirection }
					: undefined,
			page: parsed.data.page,
			pageSize: parsed.data.pageSize,
		});

		return NextResponse.json(result);
	} catch (error) {
		return handleApiError(error);
	}
}

export async function POST(request: NextRequest) {
	try {
		validateSameOrigin(request);
		await authGateway.verifyAdmin();

		const body = await request.json();
		const parsed = createEntryBodySchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ code: "invalid_input", message: "Invalid request body", issues: parsed.error.issues },
				{ status: 400 },
			);
		}

		const service = getCmsContentService();
		const draftInput: any = {
			collection: parsed.data.collection,
			slug: parsed.data.slug ?? null,
			metadata: parsed.data.metadata as any,
			mdx: parsed.data.mdx ?? "",
		};
		if (parsed.data.folderId !== undefined) {
			draftInput.folderId = parsed.data.folderId;
		}
		const entry = (await service.createDraft(draftInput)) as { id: string; version: number };

		// Record 컬렉션(tag, category, collection)은 저장 즉시 published 상태로 발행 (명세 §5.2)
		if (["tag", "category", "collection"].includes(parsed.data.collection)) {
			const store = getCmsContentStore();
			const published = await store.publishEntry({ id: entry.id, expectedVersion: entry.version });
			return NextResponse.json(published, { status: 201 });
		}

		return NextResponse.json(entry, { status: 201 });
	} catch (error) {
		return handleApiError(error);
	}
}
