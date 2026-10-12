import { DEFAULT_LOCALE } from "@/libs/i18n/locales";
import { SeriesListView, seriesListMetadata } from "../../_views/series";

// 공개 목록을 요청 시점에 조회한다.
export const dynamic = "force-dynamic";

export const metadata = seriesListMetadata(DEFAULT_LOCALE);

export default function SeriesPage() {
	return <SeriesListView locale={DEFAULT_LOCALE} />;
}
