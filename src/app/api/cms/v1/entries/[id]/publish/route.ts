import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { getCmsContentStore, getCmsMediaStore } from "@/cms/container";
import { publishEntryBodySchema } from "@/cms/core/api";
import { imageWarningsForPublish } from "@/cms/services/content-service";
import { handleApiError } from "../../../error-handler";
import { validateSameOrigin } from "../../../security";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
	try {
		validateSameOrigin(request);
		await authGateway.verifyAdmin();

		const { id } = await context.params;
		const body = await request.json();

		if (body.expectedVersion === undefined) {
			return NextResponse.json({ code: "version_required", message: "expectedVersion is required" }, { status: 428 });
		}
		const parsed = publishEntryBodySchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ code: "invalid_input", message: "Invalid request body", issues: parsed.error.issues },
				{ status: 400 },
			);
		}
		const publishedAt = parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : undefined;
		if (publishedAt && publishedAt.getTime() > Date.now()) {
			return NextResponse.json(
				{
					code: "invalid_input",
					message: "publishedAt cannot be in the future",
					issues: [{ code: "future_published_at", path: "publishedAt" }],
				},
				{ status: 400 },
			);
		}

		const store = getCmsContentStore();
		const working = await store.getWorking({ entryId: id });
		const warnings = await imageWarningsForPublish({
			collection: working.collection,
			slug: working.slug,
			metadata: working.metadata,
			mdx: working.mdx,
			getMediaAsset: (mediaId) => store.getMediaAsset(mediaId),
			headStorageKey: async (storageKey) => {
				try {
					const head = await getCmsMediaStore().headFile({ key: storageKey });
					return head !== null;
				} catch {
					return true;
				}
			},
		});
		const published = await store.publishEntry({
			id,
			expectedVersion: body.expectedVersion,
			publishedAt,
		});

		return NextResponse.json({ ...published, warnings });
	} catch (error) {
		return handleApiError(error);
	}
}
