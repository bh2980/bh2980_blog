import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { getCmsContentStore } from "@/cms/container";
import { patchTemplateBodySchema } from "@/cms/core/api";
import { handleApiError } from "../../error-handler";
import { validateSameOrigin } from "../../security";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
	try {
		await authGateway.verifyAdmin();

		const { id } = await context.params;
		const store = getCmsContentStore();
		const template = await store.getTemplate(id);

		return NextResponse.json(template);
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
		const parsed = patchTemplateBodySchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ code: "invalid_input", message: "Invalid request body", issues: parsed.error.issues },
				{ status: 400 },
			);
		}

		const store = getCmsContentStore();
		const updated = await store.updateTemplate({
			id,
			expectedVersion: parsed.data.expectedVersion,
			name: parsed.data.name,
			forCollection: parsed.data.forCollection,
			mdx: parsed.data.mdx,
		});

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
		const expectedVersion = expectedVersionStr ? parseInt(expectedVersionStr, 10) : undefined;

		if (expectedVersionStr && isNaN(expectedVersion!)) {
			return NextResponse.json(
				{ code: "invalid_input", message: "Invalid expectedVersion query parameter" },
				{ status: 400 },
			);
		}

		const store = getCmsContentStore();
		await store.deleteTemplate({ id, expectedVersion });

		return NextResponse.json({ ok: true });
	} catch (error) {
		return handleApiError(error);
	}
}
