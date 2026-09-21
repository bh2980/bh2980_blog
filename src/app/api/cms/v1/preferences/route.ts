import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { getCmsContentStore } from "@/cms/container";
import { preferencesBodySchema } from "@/cms/core/api";
import { handleApiError } from "../error-handler";

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
		const auth = await authGateway.verifyAdmin();
		const body = await request.json();

		const parsed = preferencesBodySchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid preferences body", details: parsed.error.issues },
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
