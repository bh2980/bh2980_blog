import "server-only";

import { DEFAULT_LOCALE, type Locale, localizePath } from "@/libs/i18n/locales";
import { getContentRepository } from "../get-content-repository";

const contentRepository = getContentRepository();

/**
 * 본문 내부 링크(`/posts/slug`, `/memos/slug`)를 이 언어 주소로 바꾸는 함수(v2 B4).
 * 같은 언어 번역본이 공개돼 있으면 그 주소로, 없으면 원래(기본 언어) 주소 그대로다. 본문은 고치지 않는다.
 */
export async function createLocalizedLinkResolver(locale: Locale): Promise<(href: string) => string> {
	if (locale === DEFAULT_LOCALE) return (href) => href;
	const addresses = await contentRepository.listLocalizedAddresses(locale);
	return (href) => {
		const match = /^\/(posts|memos)\/([^/?#]+)(\/?[?#].*)?$/.exec(href);
		if (!match) return href;
		let slug: string;
		try {
			slug = decodeURIComponent(match[2] ?? "").normalize("NFC");
		} catch {
			return href;
		}
		const collection = match[1] === "posts" ? "post" : "memo";
		const localized = addresses.get(`${collection}:${slug}`);
		if (!localized) return href;
		return `${localizePath(locale, `/${match[1]}/${encodeURIComponent(localized)}`)}${match[3] ?? ""}`;
	};
}
