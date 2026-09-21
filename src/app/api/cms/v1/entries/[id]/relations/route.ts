import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { getCmsContentStore } from "@/cms/container";
import { handleApiError } from "../../../error-handler";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
	try {
		await authGateway.verifyAdmin();

		const { id } = await context.params;
		const store = getCmsContentStore();

		// Check if target entry exists
		await store.getEntry(id);

		const relations = await store.getIncomingReferences({ targetId: id });
		return NextResponse.json({
			targetId: id,
			incomingReferences: relations,
			total: relations.length,
		});
	} catch (error) {
		return handleApiError(error);
	}
}
