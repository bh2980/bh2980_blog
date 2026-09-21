import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { getCmsContentStore } from "@/cms/container";
import { z } from "zod";
import { handleApiError } from "../error-handler";
import { validateSameOrigin } from "../security";

const createFolderSchema = z.object({
	collection: z.enum(["post", "memo", "category", "tag", "collection"]),
	name: z.string().min(1),
	parentId: z.string().uuid().nullable().optional().default(null),
	position: z.number().int().optional().default(0),
});

export async function GET(request: NextRequest) {
	try {
		await authGateway.verifyAdmin();

		const url = new URL(request.url);
		const collection = url.searchParams.get("collection");
		if (!collection) {
			return NextResponse.json({ code: "invalid_input", message: "collection is required" }, { status: 400 });
		}

		const store = getCmsContentStore();
		const folders = await store.listFolders({ collection });
		return NextResponse.json(folders);
	} catch (error) {
		return handleApiError(error);
	}
}

export async function POST(request: NextRequest) {
	try {
		validateSameOrigin(request);
		await authGateway.verifyAdmin();

		const body = await request.json();
		const parsed = createFolderSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ code: "invalid_input", message: "Invalid request body", issues: parsed.error.issues },
				{ status: 400 },
			);
		}

		const store = getCmsContentStore();
		const folder = await store.createFolder({
			collection: parsed.data.collection,
			name: parsed.data.name,
			parentId: parsed.data.parentId ?? null,
			position: parsed.data.position,
		});

		return NextResponse.json(folder, { status: 201 });
	} catch (error) {
		return handleApiError(error);
	}
}
