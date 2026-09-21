import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { getCmsContentStore } from "@/cms/container";
import { createTemplateBodySchema, templateCollectionSchema } from "@/cms/core/api";
import { handleApiError } from "../error-handler";
import { validateSameOrigin } from "../security";

export async function GET(request: NextRequest) {
	try {
		await authGateway.verifyAdmin();

		const { searchParams } = new URL(request.url);
		const rawCollection = searchParams.get("forCollection") || undefined;
		let forCollection: "post" | "memo" | undefined;
		if (rawCollection) {
			const parsed = templateCollectionSchema.safeParse(rawCollection);
			if (!parsed.success) {
				return NextResponse.json(
					{ code: "invalid_input", message: "Invalid forCollection query parameter" },
					{ status: 400 },
				);
			}
			forCollection = parsed.data;
		}

		const store = getCmsContentStore();
		const templates = await store.listTemplates({ forCollection });

		return NextResponse.json({ items: templates });
	} catch (error) {
		return handleApiError(error);
	}
}

export async function POST(request: NextRequest) {
	try {
		validateSameOrigin(request);
		await authGateway.verifyAdmin();

		const body = await request.json();
		const parsed = createTemplateBodySchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ code: "invalid_input", message: "Invalid request body", issues: parsed.error.issues },
				{ status: 400 },
			);
		}

		const store = getCmsContentStore();
		const template = await store.createTemplate(parsed.data);

		return NextResponse.json(template, { status: 201 });
	} catch (error) {
		return handleApiError(error);
	}
}
