import { notFound } from "next/navigation";
import { getPreviewPost, listPreviewPosts } from "@/libs/contents/services/post";
import { DEFAULT_LOCALE, isLocale, localizePath } from "@/libs/i18n/locales";
import { PostDetailPageContent } from "../../../posts/[slug]/post-detail-page-content";

type PreviewPostPageProps = {
	params: Promise<{ slug: string }>;
	/** 번역본 미리보기는 `?locale=en`처럼 언어를 준다(v2 B4). */
	searchParams: Promise<{ locale?: string }>;
};

export default async function PreviewPostPage({ params, searchParams }: PreviewPostPageProps) {
	const { slug } = await params;
	const requested = (await searchParams).locale;
	const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
	const post = await getPreviewPost(slug, locale);

	if (!post) {
		return notFound();
	}

	const postList = await listPreviewPosts();

	return (
		<PostDetailPageContent
			post={post}
			postList={postList.list}
			locale={locale}
			detailPathnamePrefix="/preview/posts"
			listPathname={localizePath(locale, "/posts")}
		/>
	);
}
