import type { Metadata } from "next";
import { PostsView, postsMetadata } from "../../../_views/lists";
import { type LocaleParams, prefixedLocale } from "../../locale-param";

// 공개 목록을 요청 시점에 조회한다(M7-BE-2).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
	return postsMetadata(prefixedLocale((await params).locale));
}

export default async function LocalizedPosts({ params }: LocaleParams) {
	return <PostsView locale={prefixedLocale((await params).locale)} />;
}
