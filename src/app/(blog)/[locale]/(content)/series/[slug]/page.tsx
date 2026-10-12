import type { Metadata } from "next";
import { SeriesDetailView, seriesDetailMetadata } from "../../../../_views/series";
import { type LocaleParams, prefixedLocale } from "../../../locale-param";

type Props = LocaleParams<{ slug: string }>;

// 공개 조회를 요청 시점에 수행한다.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale, slug } = await params;
	return seriesDetailMetadata(prefixedLocale(locale), slug);
}

export default async function LocalizedSeriesDetail({ params }: Props) {
	const { locale, slug } = await params;
	return SeriesDetailView({ locale: prefixedLocale(locale), slug });
}
