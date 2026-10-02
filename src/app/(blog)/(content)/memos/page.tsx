import { DEFAULT_LOCALE } from "@/libs/i18n/locales";
import { MemosView, memosMetadata } from "../../_views/lists";

// 공개 목록을 요청 시점에 조회한다(M7-BE-2).
export const dynamic = "force-dynamic";

export const metadata = memosMetadata(DEFAULT_LOCALE);

export default function MemoPage() {
	return <MemosView locale={DEFAULT_LOCALE} />;
}
