import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { getCmsContentStore } from "@/cms/container";
import { bulkBodySchema } from "@/cms/core/api";
import { createBulkService } from "@/cms/services/bulk-service";
import { handleApiError } from "../error-handler";
import { validateSameOrigin } from "../security";

export async function POST(request: NextRequest) {
	try {
		validateSameOrigin(request);
		await authGateway.verifyAdmin();

		const body = await request.json();
		const parsed = bulkBodySchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ code: "invalid_input", message: "Invalid request body", issues: parsed.error.issues },
				{ status: 400 },
			);
		}

		const bulk = createBulkService(getCmsContentStore());
		const result = await bulk.run(parsed.data);
		return NextResponse.json(result);
	} catch (error) {
		return handleApiError(error);
	}
}
