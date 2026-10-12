import type { Metadata } from "next";
import { DEFAULT_LOCALE } from "@/libs/i18n/locales";
import { SeriesDetailView, seriesDetailMetadata } from "../../../_views/series";

type SeriesPageProps = {
	params: Promise<{ slug: string }>;
};

// 공개 조회를 요청 시점에 수행한다.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: SeriesPageProps): Promise<Metadata> {
	return seriesDetailMetadata(DEFAULT_LOCALE, (await params).slug);
}

export default async function SeriesDetailPage({ params }: SeriesPageProps) {
	return SeriesDetailView({ locale: DEFAULT_LOCALE, slug: (await params).slug });
}
