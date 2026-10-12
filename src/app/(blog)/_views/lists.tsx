import type { Metadata } from "next";
import { entryPath } from "@/libs/contents/entry-path";
import { SEOUL_TIME_ZONE } from "@/libs/contents/published-at";
import { listCategories } from "@/libs/contents/services/category";
import { listMemos } from "@/libs/contents/services/memo";
import { listPosts } from "@/libs/contents/services/post";
import type { Locale } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";
import { type MemoItem, MemoList } from "../(content)/memos/memo-list";
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

/** `yy. MM` (서울 시간 기준) */
function formatYearMonth(value: string) {
	const parts = new Intl.DateTimeFormat("ko-KR", {
		year: "2-digit",
		month: "2-digit",
		timeZone: SEOUL_TIME_ZONE,
	}).formatToParts(new Date(value));
	const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

	// 한국어 형식은 `2-digit`을 줘도 달을 한 자리로 돌려주므로 직접 채운다
	return `${pick("year")}. ${pick("month").padStart(2, "0")}`;
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
	const memos = await listMemos({}, locale);

	// 클라이언트 목록이 쓰는 값(주소·`yy. MM` 날짜)은 여기서 만들어 넘긴다
	const items: MemoItem[] = memos.list.map((memo) => ({
		slug: memo.slug,
		title: memo.title,
		href: entryPath(locale, "memo", memo.slug),
		date: memo.status === "published" ? formatYearMonth(memo.publishedAt) : "",
		tags: memo.tags.map((tag) => ({ slug: tag.slug, label: tag.label })),
	}));

	return <MemoList memos={items} />;
}
