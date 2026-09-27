import type { Metadata, Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { createLocalizedLinkResolver } from "@/libs/contents/services/localized-links";
import { getMemo, listMemoTranslations } from "@/libs/contents/services/memo";
import { getPost, listPosts, listPostTranslations } from "@/libs/contents/services/post";
import { normalizeSlug } from "@/libs/contents/slug";
import { type Locale, localizePath } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";
import { MemoDetailPageContent } from "../(content)/memos/[slug]/memo-detail-page-content";
import { PostDetailPageContent } from "../(content)/posts/[slug]/post-detail-page-content";
import { languageAlternates, openGraphLocale } from "./i18n-metadata";

/**
 * 게시글·메모 상세(v2 B4에서 언어를 받도록 옮겼다). 기본 언어 주소(`/posts/slug`)와
 * 언어 접두사 주소(`/en/posts/slug`)가 함께 쓴다. 그 언어 번역본이 공개돼 있지 않으면 404다
 * (원문을 대신 보여 주지 않는다 — 같은 내용이 여러 주소에 생기지 않게).
 */

type Section = { collection: "post" | "memo"; path: "/posts" | "/memos" };
const POSTS: Section = { collection: "post", path: "/posts" };
const MEMOS: Section = { collection: "memo", path: "/memos" };

/** 같은 번역 묶음에서 공개된 언어의 주소. */
async function translationPaths(section: Section, translationGroupId: string | undefined) {
	if (!translationGroupId) return [];
	const translations =
		section.collection === "post"
			? await listPostTranslations(translationGroupId)
			: await listMemoTranslations(translationGroupId);
	return translations.map((item) => ({
		locale: item.locale,
		path: localizePath(item.locale, `${section.path}/${item.slug}`),
	}));
}

function notFoundMetadata(locale: Locale): Metadata {
	return { title: translator(locale)("site.notFound"), robots: { index: false, follow: true } };
}

/**
 * 과거 주소(alias)로 들어온 요청은 정규 주소로 308 이동한다(M7 A8).
 *
 * Next는 동적 세그먼트를 **퍼센트 인코딩된 채로** 넘긴다(`%EB%B8%94…`). 조회는 리포지토리가
 * 디코딩해서 성공하는데 여기서 원문을 그대로 비교하면 한글 slug가 매번 alias로 오인되고,
 * 그 리다이렉트 대상(한글)이 `location` 헤더에 들어가 `ERR_INVALID_CHAR`로 500이 난다.
 * 조회와 같은 규칙으로 정규화한 뒤 비교하고, 헤더에는 인코딩해서 넘긴다.
 */
function redirectAlias(locale: Locale, section: Section, requested: string, canonical: string) {
	if (canonical !== normalizeSlug(requested)) {
		permanentRedirect(localizePath(locale, `${section.path}/${encodeURIComponent(canonical)}`) as Route);
	}
}

export async function postDetailMetadata(locale: Locale, slug: string): Promise<Metadata> {
	const post = await getPost(slug, locale);
	if (!post) return notFoundMetadata(locale);

	const url = localizePath(locale, `/posts/${post.slug}`);
	const title = post.seo?.title ?? post.title;
	const description = post.seo?.description ?? post.excerpt;
	const translations = await translationPaths(POSTS, post.translationGroupId);

	return {
		title,
		description,
		// 관리자가 canonical을 지정하면 canonical만 바꾸고, OG 주소는 이 페이지의 실제 주소를 유지한다(M7-FE-2).
		alternates: {
			canonical: post.seo?.canonicalUrl ?? url,
			...(translations.length > 1 ? { languages: languageAlternates(translations) } : {}),
		},
		openGraph: {
			type: "article",
			title,
			description,
			url,
			...openGraphLocale(
				locale,
				translations.map((item) => item.locale),
			),
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
		},
	};
}

export async function PostDetailView({ locale, slug }: { locale: Locale; slug: string }) {
	const post = await getPost(slug, locale);
	if (!post) return notFound();
	redirectAlias(locale, POSTS, slug, post.slug);

	const [postList, translations, resolveHref] = await Promise.all([
		listPosts({}, locale),
		translationPaths(POSTS, post.translationGroupId),
		createLocalizedLinkResolver(locale),
	]);

	return (
		<PostDetailPageContent
			post={post}
			postList={postList.list}
			locale={locale}
			detailPathnamePrefix={localizePath(locale, "/posts")}
			listPathname={localizePath(locale, "/posts")}
			languageLinks={translations.map((item) => ({ locale: item.locale, href: item.path }))}
			resolveHref={resolveHref}
		/>
	);
}

export async function memoDetailMetadata(locale: Locale, slug: string): Promise<Metadata> {
	const memo = await getMemo(slug, locale);
	if (!memo) return notFoundMetadata(locale);

	const url = localizePath(locale, `/memos/${memo.slug}`);
	const title = memo.seo?.title ?? memo.title;
	const description = memo.seo?.description;
	const translations = await translationPaths(MEMOS, memo.translationGroupId);

	return {
		title,
		...(description ? { description } : {}),
		alternates: {
			canonical: memo.seo?.canonicalUrl ?? url,
			...(translations.length > 1 ? { languages: languageAlternates(translations) } : {}),
		},
		openGraph: {
			type: "article",
			title,
			url,
			...(description ? { description } : {}),
			...openGraphLocale(
				locale,
				translations.map((item) => item.locale),
			),
		},
		twitter: {
			card: "summary_large_image",
			title,
			...(description ? { description } : {}),
		},
	};
}

export async function MemoDetailView({ locale, slug }: { locale: Locale; slug: string }) {
	const memo = await getMemo(slug, locale);
	if (!memo) return notFound();
	redirectAlias(locale, MEMOS, slug, memo.slug);

	const [translations, resolveHref] = await Promise.all([
		translationPaths(MEMOS, memo.translationGroupId),
		createLocalizedLinkResolver(locale),
	]);

	return (
		<MemoDetailPageContent
			memo={memo}
			locale={locale}
			listPathname={localizePath(locale, "/memos")}
			languageLinks={translations.map((item) => ({ locale: item.locale, href: item.path }))}
			resolveHref={resolveHref}
		/>
	);
}
