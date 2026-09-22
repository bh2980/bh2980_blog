import { type NextRequest, NextResponse } from "next/server";
import { getContentRepository } from "@/libs/contents/get-content-repository";
import { publicEntryCollectionSchema, toPublicAddress, toPublicMemo, toPublicPost } from "@/libs/contents/public-api";
import { handlePublicApiError, publicJson } from "../../../errors";

interface RouteContext {
	params: Promise<{ collection: string; slug: string }>;
}

// 단건 조회도 요청 시점에 읽는다. 보관하면 다음 요청부터 404다.
export const dynamic = "force-dynamic";

/**
 * `GET /api/cms/v1/public/entries/:collection/:slug` — 공개본 단건.
 *
 * 과거 주소(alias)로 조회하면 정규 주소를 `address`로 알려준다(§10.1 "별칭은 정규 주소 정보를 반환").
 * 비공개·미존재는 404이며 둘을 구분해 알려주지 않는다.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
	try {
		const { collection, slug } = await context.params;

		const parsed = publicEntryCollectionSchema.safeParse(collection);
		if (!parsed.success) {
			return NextResponse.json(
				{ code: "invalid_input", message: `Unsupported collection: ${collection}` },
				{ status: 400 },
			);
		}
		if (!slug || slug.trim().length === 0) {
			return NextResponse.json({ code: "invalid_input", message: "slug is required" }, { status: 400 });
		}

		const repository = getContentRepository();
		const entry =
			parsed.data === "post"
				? await repository.getPost(slug).then((post) => (post ? toPublicPost(post, { includeBody: true }) : null))
				: await repository.getMemo(slug).then((memo) => (memo ? toPublicMemo(memo, { includeBody: true }) : null));

		if (!entry) {
			return NextResponse.json({ code: "not_found", message: "Not found" }, { status: 404 });
		}

		return publicJson({ entry, address: toPublicAddress(slug, entry.slug) });
	} catch (error) {
		return handlePublicApiError(error);
	}
}
