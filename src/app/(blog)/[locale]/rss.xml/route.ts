import { buildRssResponse } from "../../_views/rss";
import { type LocaleParams, prefixedLocale } from "../locale-param";

// 언어별 공개 피드(v2 B4). 그 언어 번역본이 공개된 글만 담는다.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: LocaleParams) {
	return buildRssResponse(prefixedLocale((await params).locale));
}
