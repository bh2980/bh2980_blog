import { DEFAULT_LOCALE } from "@/libs/i18n/locales";
import { PostsView, postsMetadata } from "../../_views/lists";

// 공개 목록을 요청 시점에 조회한다(M7-BE-2).
export const dynamic = "force-dynamic";

export const metadata = postsMetadata(DEFAULT_LOCALE);

export default function BlogPage() {
	return <PostsView locale={DEFAULT_LOCALE} />;
}
