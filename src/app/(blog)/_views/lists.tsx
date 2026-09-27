import type { Metadata } from "next";
import { listCategories } from "@/libs/contents/services/category";
import { listMemos } from "@/libs/contents/services/memo";
import { listPosts } from "@/libs/contents/services/post";
import { listTags } from "@/libs/contents/services/tag";
import type { Locale } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";
import { MemoList } from "../(content)/memos/memo-list";
import { PostList } from "../(content)/posts/post-list";
import { openGraphLocale, sectionAlternates } from "./i18n-metadata";

/**
 * 게시글·메모 목록(v2 B4에서 언어를 받도록 옮겼다). 번역본이 공개된 글만 그 언어 목록에 보인다.
 * 기본 언어 주소(`/posts`)와 언어 접두사 주소(`/en/posts`)가 함께 쓴다.
 */
export function postsMetadata(locale: Locale): Metadata {
	const t = translator(locale);
	return {
		title: t("posts.title"),
		description: t("posts.description"),
		alternates: sectionAlternates(locale, "/posts"),
		openGraph: openGraphLocale(locale),
	};
}

export async function PostsView({ locale }: { locale: Locale }) {
	const [categories, posts] = await Promise.all([listCategories(locale), listPosts({}, locale)]);

	const categoriesWithCount = categories.list.map((category) => ({
		...category,
		count: posts.list.filter((post) => post.category.slug === category.slug).length,
	}));

	return <PostList categories={categoriesWithCount} posts={posts} />;
}

export function memosMetadata(locale: Locale): Metadata {
	const t = translator(locale);
	return {
		title: t("memos.metaTitle"),
		description: t("memos.description"),
		alternates: sectionAlternates(locale, "/memos"),
		openGraph: openGraphLocale(locale),
	};
}

export async function MemosView({ locale }: { locale: Locale }) {
	const [memos, tags] = await Promise.all([listMemos({}, locale), listTags(locale)]);

	return <MemoList memos={memos} tags={tags} />;
}
