import "server-only";

import { contentPath, parseContentPath } from "@monti-cms/core/client";
import { DEFAULT_LOCALE, type Locale, localizePath } from "@/libs/i18n/locales";
import { getContentRepository } from "../get-content-repository";

const contentRepository = getContentRepository();

/**
 * 본문 내부 링크(`/posts/slug`, `/memos/slug`)를 이 언어 주소로 바꾸는 함수(v2 B4).
 * 같은 언어 번역본이 공개돼 있으면 그 주소로, 없으면 원래(기본 언어) 주소 그대로다. 본문은 고치지 않는다.
 * 어떤 주소가 글·메모를 가리키는지는 컬렉션 정의(`path`)가 정한다.
 */
export async function createLocalizedLinkResolver(locale: Locale): Promise<(href: string) => string> {
	if (locale === DEFAULT_LOCALE) return (href) => href;
	const addresses = await contentRepository.listLocalizedAddresses(locale);
	return (href) => {
		// 주소 뒤의 질의·해시는 그대로 두고, `/주소/?질의`처럼 닫는 슬래시가 질의 앞에 붙은 것도 질의 쪽으로 넘긴다.
		const [, pathname = "", rest = ""] = /^([^?#]*)(.*)$/.exec(href) ?? [];
		if (pathname.endsWith("/") && !rest) return href;
		const target = parseContentPath(pathname.replace(/\/$/, ""));
		if (!target || (target.collection !== "post" && target.collection !== "memo")) return href;
		const localized = addresses.get(`${target.collection}:${target.slug}`);
		if (!localized) return href;
		const path = contentPath(target.collection, encodeURIComponent(localized));
		if (!path) return href;
		return `${localizePath(locale, path)}${pathname.endsWith("/") ? "/" : ""}${rest}`;
	};
}
