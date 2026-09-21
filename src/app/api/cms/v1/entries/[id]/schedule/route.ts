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

		if (!body.scheduledAt) {
			return NextResponse.json(
				{ code: "invalid_input", message: "scheduledAt is required" },
				{ status: 400 },
			);
		}

		const scheduledAt = new Date(body.scheduledAt);
		if (isNaN(scheduledAt.getTime())) {
			return NextResponse.json(
				{ code: "invalid_input", message: "Invalid scheduledAt date" },
				{ status: 400 },
			);
		}

		const store = getCmsContentStore();
		const schedule = await store.createSchedule({
			entryId: id,
			expectedVersion: body.expectedVersion,
			scheduledAt,
		});

		return NextResponse.json(schedule);
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
		const scheduleId = searchParams.get("scheduleId");

		if (!scheduleId) {
			return NextResponse.json(
				{ code: "invalid_input", message: "scheduleId query parameter is required" },
				{ status: 400 },
			);
		}

		const store = getCmsContentStore();
		await store.cancelSchedule({
			scheduleId,
			entryId: id,
		});

		return new NextResponse(null, { status: 204 });
	} catch (error) {
		return handleApiError(error);
	}
}
