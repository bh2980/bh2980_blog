import type { Metadata } from "next";
import { resolvePublicMediaUrl } from "@/cms/mdx/public-image-resolver";
import type { SeoMetadata } from "@/libs/contents/types/contents";
import { type Locale, localizePath } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";

type MessageKey = Parameters<ReturnType<typeof translator>>[0];

const SITE_NAME = "bh2980.dev";
const AUTHOR = "bh2980";

/** 글·메모 상세가 검색 정보에 쓰는 값. */
export interface ArticleFacts {
	title: string;
	description?: string;
	locale: Locale;
	/** 이 언어 주소(`/posts/slug` 등). */
	path: string;
	publishedAt?: string;
	updatedAt?: string;
	section?: string;
	tags: readonly string[];
	seo?: SeoMetadata;
}

/**
 * 검색 숨김(robots)과 OG 글 정보(발행·수정 시각, 분류, 태그, 글쓴이). 제목·설명·주소는 호출자가 채운다.
 */
export function articleMetadata(facts: ArticleFacts): Pick<Metadata, "robots"> & {
	openGraph: Record<string, unknown>;
} {
	return {
		...(facts.seo?.noindex ? { robots: { index: false, follow: true } } : {}),
		openGraph: {
			type: "article",
			...(facts.publishedAt ? { publishedTime: facts.publishedAt } : {}),
			...(facts.updatedAt ? { modifiedTime: facts.updatedAt } : {}),
			...(facts.section ? { section: facts.section } : {}),
			...(facts.tags.length > 0 ? { tags: [...facts.tags] } : {}),
			authors: [AUTHOR],
		},
	};
}

/** `</script>`로 끝나지 않게 `<`를 이스케이프한다. */
const toJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

/**
 * 구글 구조화 데이터(JSON-LD): 글(BlogPosting)과 경로(BreadcrumbList). 검색에 숨긴 글은 내지 않는다.
 * 사이트 주소(`HOST_URL`)가 없으면 절대 주소를 만들 수 없어 그리지 않는다.
 */
export async function ArticleStructuredData({
	facts,
	list,
}: {
	facts: ArticleFacts;
	/** 목록 화면 이름과 주소(경로의 두 번째 칸). */
	list: { name: MessageKey; path: string };
}) {
	const host = process.env.HOST_URL;
	if (!host || facts.seo?.noindex) return null;
	const absolute = (path: string) => new URL(path, host).toString();
	const url = absolute(facts.path);
	const image = facts.seo?.ogImageId ? await resolvePublicMediaUrl(facts.seo.ogImageId) : null;
	const t = translator(facts.locale);

	const article = {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		headline: facts.title,
		...(facts.description ? { description: facts.description } : {}),
		inLanguage: facts.locale,
		url,
		mainEntityOfPage: { "@type": "WebPage", "@id": url },
		...(facts.publishedAt ? { datePublished: facts.publishedAt } : {}),
		...(facts.updatedAt || facts.publishedAt ? { dateModified: facts.updatedAt ?? facts.publishedAt } : {}),
		...(facts.section ? { articleSection: facts.section } : {}),
		...(facts.tags.length > 0 ? { keywords: facts.tags.join(", ") } : {}),
		...(image ? { image: [image.url] } : {}),
		author: { "@type": "Person", name: AUTHOR, url: absolute("/") },
		publisher: { "@type": "Person", name: AUTHOR, url: absolute("/") },
	};
	const breadcrumb = {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: [
			{ "@type": "ListItem", position: 1, name: SITE_NAME, item: absolute(localizePath(facts.locale, "/")) },
			{ "@type": "ListItem", position: 2, name: t(list.name), item: absolute(list.path) },
			{ "@type": "ListItem", position: 3, name: facts.title, item: url },
		],
	};

	return (
		<>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD는 스크립트 본문으로만 넣을 수 있다 */}
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJson(article) }} />
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD는 스크립트 본문으로만 넣을 수 있다 */}
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJson(breadcrumb) }} />
		</>
	);
}
