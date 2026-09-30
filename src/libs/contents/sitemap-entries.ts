import type { MetadataRoute } from "next";
import { DEFAULT_LOCALE, LOCALES, type Locale, localizePath } from "@/libs/i18n/locales";
import type { Memo, Post } from "./types/contents";

export type SitemapSource = {
	hostUrl: string;
	/** 모든 언어의 공개 글. 언어가 없으면 기본 언어로 본다. */
	posts: readonly Post[];
	memos: readonly Memo[];
};

type Item = { locale: Locale; group: string; path: string; lastModified?: string };

/**
 * M7-FE-2: sitemap 항목 생성. v2 B4부터 모든 언어의 주소를 한 파일에 담고, 같은 글의 번역본끼리
 * `alternates.languages`(hreflang)로 잇는다. 기본 언어 주소는 `x-default`다.
 *
 * - custom canonical(`seo.canonicalUrl`)을 지정한 글은 대표 주소를 다른 곳으로 선언한 것이므로 자기 sitemap에서 뺀다.
 * - 검색엔진에 숨긴 글(`seo.noindex`)도 뺀다.
 * - 공개 여부는 호출자가 이미 좁혀 놓은 목록을 신뢰한다(비공개 글은 여기 오지 않는다).
 * - 첫 화면·목록은 기본 언어와, 공개된 글이 하나라도 있는 언어만 넣는다.
 */
export function buildSitemapEntries({ hostUrl, posts, memos }: SitemapSource): MetadataRoute.Sitemap {
	const absolute = (path: string) => (path === "/" ? hostUrl : new URL(`${hostUrl}${path}`).toString());
	const toItems = (entries: readonly (Post | Memo)[], section: "/posts" | "/memos"): Item[] =>
		entries
			.filter((entry) => entry.status === "published" && !entry.seo?.canonicalUrl && !entry.seo?.noindex)
			.map((entry) => {
				const locale = entry.locale ?? DEFAULT_LOCALE;
				return {
					locale,
					group: `${section}:${entry.translationGroupId ?? entry.slug}`,
					path: localizePath(locale, `${section}/${entry.slug}`),
					lastModified: entry.status === "published" ? (entry.updatedAt ?? entry.publishedAt) : undefined,
				};
			});

	const items = [...toItems(posts, "/posts"), ...toItems(memos, "/memos")];
	const locales = LOCALES.filter((locale) => locale === DEFAULT_LOCALE || items.some((item) => item.locale === locale));

	const languagesOf = (members: readonly Item[]) => {
		if (members.length < 2) return undefined;
		const languages: Record<string, string> = {};
		for (const member of members) languages[member.locale] = absolute(member.path);
		const fallback = members.find((member) => member.locale === DEFAULT_LOCALE);
		if (fallback) languages["x-default"] = absolute(fallback.path);
		return { languages };
	};

	const sections = ["/", "/posts", "/memos"].flatMap((path) => {
		const members = locales.map((locale) => ({ locale, group: path, path: localizePath(locale, path) }));
		return members.map((member) => {
			const alternates = languagesOf(members);
			return { url: absolute(member.path), ...(alternates ? { alternates } : {}) };
		});
	});

	const entries = items.map<MetadataRoute.Sitemap[number]>((item) => {
		const alternates = languagesOf(items.filter((other) => other.group === item.group));
		return {
			url: absolute(item.path),
			lastModified: item.lastModified,
			...(alternates ? { alternates } : {}),
		};
	});

	return [...sections, ...entries];
}
