import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { getCmsContentStore } from "@/cms/container";
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
			return NextResponse.json(
				{ code: "version_required", message: "expectedVersion is required" },
				{ status: 428 },
			);
		}

		const store = getCmsContentStore();
		const published = await store.publishEntry({
			id,
			expectedVersion: body.expectedVersion,
			publishedAt: body.publishedAt ? new Date(body.publishedAt) : undefined,
		});

		return NextResponse.json(published);
	} catch (error) {
		return handleApiError(error);
	}
}
