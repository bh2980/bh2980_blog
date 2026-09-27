import type { Metadata } from "next";
import { MemoDetailView, memoDetailMetadata } from "../../../../_views/details";
import { type LocaleParams, prefixedLocale } from "../../../locale-param";

type Props = LocaleParams<{ slug: string }>;

// 공개 조회를 요청 시점에 수행한다(M7-BE-2).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale, slug } = await params;
	return memoDetailMetadata(prefixedLocale(locale), slug);
}

export default async function LocalizedMemo({ params }: Props) {
	const { locale, slug } = await params;
	return MemoDetailView({ locale: prefixedLocale(locale), slug });
}
