import { notFound } from "next/navigation";
import { getPreviewMemo } from "@/libs/contents/services/memo";
import { DEFAULT_LOCALE, isLocale, localizePath } from "@/libs/i18n/locales";
import { MemoDetailPageContent } from "../../../memos/[slug]/memo-detail-page-content";

type PreviewMemoPageProps = {
	params: Promise<{ slug: string }>;
	/** 번역본 미리보기는 `?locale=en`처럼 언어를 준다(v2 B4). */
	searchParams: Promise<{ locale?: string }>;
};

export default async function PreviewMemoPage({ params, searchParams }: PreviewMemoPageProps) {
	const { slug } = await params;
	const requested = (await searchParams).locale;
	const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
	const memo = await getPreviewMemo(slug, locale);

	if (!memo) {
		return notFound();
	}

	return <MemoDetailPageContent memo={memo} locale={locale} listPathname={localizePath(locale, "/memos")} />;
}
