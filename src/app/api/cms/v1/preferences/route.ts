import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import type { JsonObject } from "@/cms/adapters/postgres/content-store";
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
		const existing = (await store.getPreferences({ userId: auth.userId })) ?? {};
		const existingColumns =
			existing.columnSettings && typeof existing.columnSettings === "object" && !Array.isArray(existing.columnSettings)
				? existing.columnSettings
				: {};
		const preferences = {
			...existing,
			...parsed.data,
			...(parsed.data.columnSettings ? { columnSettings: { ...existingColumns, ...parsed.data.columnSettings } } : {}),
		};
		await store.savePreferences({
			userId: auth.userId,
			preferences: preferences as JsonObject,
		});

		return NextResponse.json({ success: true, preferences });
	} catch (error) {
		return handleApiError(error);
	}
}
