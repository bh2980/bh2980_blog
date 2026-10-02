import type { Metadata } from "next";
import { MemosView, memosMetadata } from "../../../_views/lists";
import { type LocaleParams, prefixedLocale } from "../../locale-param";

// 공개 목록을 요청 시점에 조회한다(M7-BE-2).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
	return memosMetadata(prefixedLocale((await params).locale));
}

export default async function LocalizedMemos({ params }: LocaleParams) {
	return <MemosView locale={prefixedLocale((await params).locale)} />;
}
