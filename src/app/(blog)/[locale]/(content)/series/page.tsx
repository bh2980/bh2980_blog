import type { Metadata } from "next";
import { SeriesListView, seriesListMetadata } from "../../../_views/series";
import { type LocaleParams, prefixedLocale } from "../../locale-param";

// 공개 목록을 요청 시점에 조회한다.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
	return seriesListMetadata(prefixedLocale((await params).locale));
}

export default async function LocalizedSeries({ params }: LocaleParams) {
	return <SeriesListView locale={prefixedLocale((await params).locale)} />;
}
