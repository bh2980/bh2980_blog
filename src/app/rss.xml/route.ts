import { DEFAULT_LOCALE } from "@/libs/i18n/locales";
import { buildRssResponse } from "../(blog)/_views/rss";

// 공개 피드를 요청 시점에 생성한다(M7-BE-2). 공개 조회 서비스가 초안·보관을 제외한다.
export const dynamic = "force-dynamic";

export function GET() {
	return buildRssResponse(DEFAULT_LOCALE);
}
