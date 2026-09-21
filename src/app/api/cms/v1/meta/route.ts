import { NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { handleApiError } from "../error-handler";

export async function GET() {
	try {
		await authGateway.verifyAdmin();

		return NextResponse.json({
			version: "v1",
			collections: ["post", "memo", "category", "tag", "collection"],
			features: {
				folders: true,
				references: true,
				search: true,
			},
		});
	} catch (error) {
		return handleApiError(error);
	}
}
