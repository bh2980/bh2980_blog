import { cmsConfig } from "../config/resolved";
import { schemaOf } from "../schema/derive";
import { COLLECTIONS, type Collection } from "./collections";

/**
 * 본문 내부 링크(§4.4·§6.2). 공개 주소 모양은 컬렉션 정의의 `path`(예: `/posts/:slug`)이고, 본문에는 일반 Markdown 링크
 * `[제목](/posts/글-slug)`로 저장한다. 발행 전 검사(링크 해석)와 편집기(링크 만들기)가 같은 규칙을 쓴다.
 */

interface PathRule {
	readonly collection: Collection;
	readonly prefix: string;
	readonly suffix: string;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PATH_RULES: readonly PathRule[] = COLLECTIONS.flatMap((collection) => {
	const path = schemaOf(collection).path;
	if (!path) return [];
	const [prefix = "", suffix = ""] = path.split(":slug");
	return [{ collection, prefix, suffix }];
});

const PATH_PATTERNS = PATH_RULES.map((rule) => ({
	collection: rule.collection,
	pattern: new RegExp(`^${escapeRegExp(rule.prefix)}([^/]+)${escapeRegExp(rule.suffix.replace(/\/$/, ""))}\\/?$`),
}));

/** 본문 링크로 가리킬 수 있는 컬렉션(`path`가 있는 컬렉션). */
export const LINKABLE_COLLECTIONS: readonly Collection[] = PATH_RULES.map((rule) => rule.collection);

/**
 * 콘텐츠의 공개 경로(기본 언어). 경로가 없는 컬렉션이거나 slug가 없으면 `null`이다.
 * 한글은 읽을 수 있게 그대로 두고 Markdown 링크를 깨는 문자만 인코딩한다.
 */
export function contentPath(collection: string, slug: string | null | undefined): string | null {
	const rule = PATH_RULES.find((candidate) => candidate.collection === collection);
	if (!rule || !slug) return null;
	return `${rule.prefix}${slug.replace(/[\s()<>]/g, (char) => encodeURIComponent(char))}${rule.suffix}`;
}

/** 경로(`URL.pathname`)가 가리키는 콘텐츠. 모르는 경로면 `null`이다. */
export function parseContentPath(pathname: string): { collection: Collection; slug: string } | null {
	for (const { collection, pattern } of PATH_PATTERNS) {
		const match = pattern.exec(pathname);
		if (!match) continue;
		let slug: string;
		try {
			slug = decodeURIComponent(match[1] ?? "").normalize("NFC");
		} catch {
			return null;
		}
		return slug && !slug.includes("/") ? { collection, slug } : null;
	}
	return null;
}

const siteUrl = cmsConfig.site?.url;
const SITE_HOSTS = new Set(
	[siteUrl ? new URL(siteUrl).hostname : undefined, ...(cmsConfig.site?.aliases ?? [])].filter((host): host is string =>
		Boolean(host),
	),
);

/** 본문 링크 주소가 이 사이트의 콘텐츠를 가리키면 그 대상. 경로(`/...`)와 사이트 주소로 적은 링크만 알아본다. */
export function parseInternalLink(url: string): { collection: Collection; slug: string; url: string } | null {
	let parsed: URL;
	try {
		parsed = new URL(url, siteUrl ?? "http://localhost");
	} catch {
		return null;
	}
	const relative = url.startsWith("/") && !url.startsWith("//");
	const sameSite =
		(url.startsWith("//") || /^[a-z][a-z\d+.-]*:/i.test(url)) &&
		(parsed.protocol === "http:" || parsed.protocol === "https:") &&
		SITE_HOSTS.has(parsed.hostname);
	if (!relative && !sameSite) return null;
	const target = parseContentPath(parsed.pathname);
	return target ? { ...target, url } : null;
}

/** 관리자 화면에 보이는 사이트 이름(`site.name`, 없으면 `site.url`의 호스트 이름). 둘 다 없으면 빈 글자. */
export const SITE_NAME = cmsConfig.site?.name ?? (siteUrl ? new URL(siteUrl).hostname : "");
