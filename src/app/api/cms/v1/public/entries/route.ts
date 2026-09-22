import type { NextRequest } from "next/server";
import { getContentRepository } from "@/libs/contents/get-content-repository";
import {
	type PublicEntryDto,
	paginate,
	publicEntriesQuerySchema,
	toPublicMemo,
	toPublicPost,
} from "@/libs/contents/public-api";
import { isDefined } from "@/utils/is-defined";
import { handlePublicApiError, publicError, publicJson } from "../errors";

// 공개 목록은 요청 시점에 읽는다(M7-BE-2와 같은 원칙). 캐시하지 않는다.
export const dynamic = "force-dynamic";

/**
 * `GET /api/cms/v1/public/entries` — 공개본 목록.
 *
 * 관리자 세션을 요구하지 않는다. 응답에는 관리자 전용 필드가 없고 초안·보관·휴지통은 나오지 않는다.
 */
export async function GET(request: NextRequest) {
	try {
		const url = new URL(request.url);
		const rawQuery: Record<string, unknown> = {};
		for (const [key, value] of url.searchParams.entries()) {
			rawQuery[key] = value;
		}

		const parsed = publicEntriesQuerySchema.safeParse(rawQuery);
		if (!parsed.success) {
			return publicError("invalid_input", "Invalid query parameters");
		}

		const { collection, category, tag, page, pageSize } = parsed.data;
		const repository = getContentRepository();

		const entries: (PublicEntryDto | null)[] =
			collection === "post"
				? (
						await repository.listPosts({
							status: "published",
							...(category ? { category } : {}),
							...(tag ? { tag } : {}),
						})
					).map((post) => toPublicPost(post, { includeBody: false }))
				: (await repository.listMemos({ status: "published", ...(tag ? { tag } : {}) })).map((memo) =>
						toPublicMemo(memo, { includeBody: false }),
					);

		return publicJson(paginate(entries.filter(isDefined<PublicEntryDto>), page, pageSize));
	} catch (error) {
		return handlePublicApiError(error);
	}
}
