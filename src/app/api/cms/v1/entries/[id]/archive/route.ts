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
		const archived = await store.archiveEntry({
			id,
			expectedVersion: body.expectedVersion,
		});

		return NextResponse.json(archived);
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
		const unarchived = await store.unarchiveEntry({
			id,
			expectedVersion,
		});

		return NextResponse.json(unarchived);
	} catch (error) {
		return handleApiError(error);
	}
}
