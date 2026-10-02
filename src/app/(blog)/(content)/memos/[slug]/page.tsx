import type { Metadata } from "next";
import { DEFAULT_LOCALE } from "@/libs/i18n/locales";
import { MemoDetailView, memoDetailMetadata } from "../../../_views/details";

type MemoPageProps = {
	params: Promise<{ slug: string }>;
};

// 공개 조회를 요청 시점에 수행한다(M7-BE-2).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: MemoPageProps): Promise<Metadata> {
	return memoDetailMetadata(DEFAULT_LOCALE, (await params).slug);
}

export default async function MemoPage({ params }: MemoPageProps) {
	return MemoDetailView({ locale: DEFAULT_LOCALE, slug: (await params).slug });
}
