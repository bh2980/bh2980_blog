import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { getCmsContentStore } from "@/cms/container";
import { z } from "zod";
import { handleApiError } from "../../error-handler";

const updateFolderSchema = z.object({
	name: z.string().min(1).optional(),
	parentId: z.string().nullable().optional(),
	position: z.number().int().optional(),
});

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
	try {
		await authGateway.verifyAdmin();

		const { id } = await context.params;
		const body = await request.json();
		const parsed = updateFolderSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 });
		}

		const store = getCmsContentStore();
		const folder = await store.updateFolder({ id, ...parsed.data });
		return NextResponse.json(folder);
	} catch (error) {
		return handleApiError(error);
	}
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
	try {
		await authGateway.verifyAdmin();

		const { id } = await context.params;
		const store = getCmsContentStore();
		await store.deleteFolder({ id });

		return NextResponse.json({ success: true });
	} catch (error) {
		return handleApiError(error);
	}
}
