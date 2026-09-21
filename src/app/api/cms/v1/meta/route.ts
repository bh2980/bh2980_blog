import { NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { COLLECTION_DEFINITIONS, COLLECTIONS } from "@/cms/core/collections";
import { getSerializableExtensionsSchema } from "@/cms/core/extensions-example";
import { handleApiError } from "../error-handler";

export async function GET() {
	try {
		await authGateway.verifyAdmin();

		return NextResponse.json({
			version: "v1",
			collections: COLLECTIONS,
			definitions: COLLECTION_DEFINITIONS,
			extensions: getSerializableExtensionsSchema(),
			features: {
				folders: true,
				references: true,
				search: true,
				templates: true,
			},
		});
	} catch (error) {
		return handleApiError(error);
	}
}
