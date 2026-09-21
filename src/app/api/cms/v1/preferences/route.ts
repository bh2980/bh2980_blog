import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { getCmsContentStore } from "@/cms/container";
import { preferencesBodySchema } from "@/cms/core/api";
import { handleApiError } from "../error-handler";
import { validateSameOrigin } from "../security";

export async function GET() {
	try {
		const auth = await authGateway.verifyAdmin();
		const store = getCmsContentStore();

		const prefs = await store.getPreferences({ userId: auth.userId });
		return NextResponse.json(prefs ?? {});
	} catch (error) {
		return handleApiError(error);
	}
}

export async function PUT(request: NextRequest) {
	try {
		validateSameOrigin(request);
		const auth = await authGateway.verifyAdmin();
		const body = await request.json();

		const parsed = preferencesBodySchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ code: "invalid_input", message: "Invalid preferences body", issues: parsed.error.issues },
				{ status: 400 },
			);
		}

		const store = getCmsContentStore();
		await store.savePreferences({
			userId: auth.userId,
			preferences: parsed.data as any,
		});

		return NextResponse.json({ success: true, preferences: parsed.data });
	} catch (error) {
		return handleApiError(error);
	}
}
