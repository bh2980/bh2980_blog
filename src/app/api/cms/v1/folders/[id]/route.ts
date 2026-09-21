import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { getCmsContentStore } from "@/cms/container";
import { z } from "zod";
import { handleApiError } from "../../error-handler";
import { validateSameOrigin } from "../../security";

const updateFolderSchema = z.object({
	expectedVersion: z.number({
		error: "version_required",
	}),
	name: z.string().min(1).optional(),
	parentId: z.string().uuid().nullable().optional(),
	position: z.number().int().optional(),
});

interface RouteContext {
	params: Promise<{ id: string }>;
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

		const parsed = updateFolderSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ code: "invalid_input", message: "Invalid request body", issues: parsed.error.issues },
				{ status: 400 },
			);
		}

		const store = getCmsContentStore();
		const folder = await store.updateFolder({
			id,
			expectedVersion: parsed.data.expectedVersion,
			name: parsed.data.name,
			parentId: parsed.data.parentId,
			position: parsed.data.position,
		});
		return NextResponse.json(folder);
	} catch (error) {
		return handleApiError(error);
	}
}

export async function DELETE(request: NextRequest, context: RouteContext) {
	try {
		validateSameOrigin(request);
		await authGateway.verifyAdmin();

		const { id } = await context.params;
		const url = new URL(request.url);
		const expectedVersionParam = url.searchParams.get("expectedVersion");
		const expectedVersion = expectedVersionParam ? parseInt(expectedVersionParam, 10) : undefined;

		const store = getCmsContentStore();
		await store.deleteFolder({ id, expectedVersion });

		return NextResponse.json({ success: true });
	} catch (error) {
		return handleApiError(error);
	}
}
