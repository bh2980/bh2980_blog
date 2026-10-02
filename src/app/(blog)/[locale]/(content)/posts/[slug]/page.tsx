import type { Metadata } from "next";
import { PostDetailView, postDetailMetadata } from "../../../../_views/details";
import { type LocaleParams, prefixedLocale } from "../../../locale-param";

type Props = LocaleParams<{ slug: string }>;

// 공개 조회를 요청 시점에 수행한다(M7-BE-2).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale, slug } = await params;
	return postDetailMetadata(prefixedLocale(locale), slug);
}

export default async function LocalizedPost({ params }: Props) {
	const { locale, slug } = await params;
	return PostDetailView({ locale: prefixedLocale(locale), slug });
}
