import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { getCmsContentStore } from "@/cms/container";
import { exportBodySchema, exportQuerySchema } from "@/cms/core/api";
import { buildExportArchive, type ExportScope } from "@/cms/services/export-service";
import { handleApiError } from "../error-handler";
import { validateSameOrigin } from "../security";

const buildResponse = async (scope: ExportScope): Promise<Response> => {
	const store = getCmsContentStore();
	const snapshot = await store.readExportSnapshot();
	const exportedAt = new Date();
	const archive = buildExportArchive(snapshot, { scope, exportedAt });

	return new Response(archive.zip as unknown as BodyInit, {
		status: 200,
		headers: {
			"Content-Type": "application/zip",
			"Content-Disposition": `attachment; filename="cms-export-${scope}-${exportedAt.toISOString().replace(/[:.]/g, "-")}.zip"`,
			"Content-Length": String(archive.zip.byteLength),
			"X-Cms-Export-Digest": archive.digest,
			"X-Cms-Export-Scope": scope,
			"X-Cms-Export-Files": String(archive.manifest.counts.files),
			"Cache-Control": "no-store",
		},
	});
};

export async function GET(request: NextRequest) {
	try {
		await authGateway.verifyAdmin();

		const parsed = exportQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
		if (!parsed.success) {
			return NextResponse.json(
				{ code: "invalid_input", message: "Invalid export scope", issues: parsed.error.issues },
				{ status: 400 },
			);
		}

		return await buildResponse(parsed.data.scope);
	} catch (error) {
		return handleApiError(error);
	}
}

export async function POST(request: NextRequest) {
	try {
		validateSameOrigin(request);
		await authGateway.verifyAdmin();

		const raw = await request.json().catch(() => ({}));
		const parsed = exportBodySchema.safeParse(raw);
		if (!parsed.success) {
			return NextResponse.json(
				{ code: "invalid_input", message: "Invalid export scope", issues: parsed.error.issues },
				{ status: 400 },
			);
		}

		return await buildResponse(parsed.data.scope);
	} catch (error) {
		return handleApiError(error);
	}
}
