import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getCmsContentStore } from "@/cms/container";
import { handleApiError } from "../../../error-handler";

function verifySchedulerToken(request: NextRequest): boolean {
	const configuredToken = process.env.CMS_SCHEDULER_TOKEN;
	if (!configuredToken) return false;

	const authHeader = request.headers.get("authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) return false;

	const providedToken = authHeader.slice(7);
	if (providedToken.length !== configuredToken.length) return false;

	try {
		return timingSafeEqual(Buffer.from(providedToken), Buffer.from(configuredToken));
	} catch {
		return false;
	}
}

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
	try {
		if (!verifySchedulerToken(request)) {
			return NextResponse.json(
				{ code: "forbidden", message: "Invalid or missing CMS_SCHEDULER_TOKEN" },
				{ status: 403 },
			);
		}

		const { id } = await context.params;
		const store = getCmsContentStore();
		const result = await store.executeSchedulePublish({ scheduleId: id });

		return NextResponse.json(result);
	} catch (error) {
		return handleApiError(error);
	}
}
