import type { SeoMetadata } from "./types/contents";

/**
 * M7-FE-2: 공개 head용 SEO 값. 저장 위치는 CMS DB `entry_bodies.metadata`이며
 * 키 이름은 `seoTitle` / `seoDescription` / `canonicalUrl` / `ogImageId`다(O1 A6).
 *
 * 여기서는 metadata 레코드를 도메인 값으로 옮기기만 한다. 값이 없으면 키 자체를 만들지 않아
 * SEO를 입력하지 않은 글의 공개 객체 모양이 M7 이전과 동일하게 유지된다.
 */
const SEO_KEYS = ["seoTitle", "seoDescription", "canonicalUrl", "ogImageId"] as const;

function readMetadataString(metadata: Record<string, unknown>, key: string): string | null {
	const value = metadata[key];
	if (typeof value !== "string") return null;

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

/**
 * canonical로 쓸 수 있는 값만 통과시킨다.
 * - 사이트 내 경로: `/posts/hello`
 * - 절대 URL: `https://example.com/posts/hello`
 *
 * `javascript:` 같은 스킴이나 `//host`(프로토콜 상대)는 무시한다. 잘못된 값이 들어와도
 * canonical이 사라질 뿐 폴백 주소가 유지되므로 head가 깨지지 않는다.
 */
/** 경로 형식 canonical을 해석할 때만 쓰는 고정 origin. 실제 사이트 origin과 비교하지 않는다. */
const CANONICAL_PATH_BASE = "https://canonical.invalid";

/**
 * canonical로 쓸 수 있는 값만 통과시킨다.
 * - 사이트 내 경로: `/posts/hello`
 * - 절대 URL: `https://example.com/posts/hello`
 *
 * `javascript:` 같은 스킴이나 `//host`(프로토콜 상대)는 무시한다. 잘못된 값이 들어와도
 * canonical이 사라질 뿐 폴백 주소가 유지되므로 head가 깨지지 않는다.
 */
export function normalizeCanonicalUrl(value: string | null | undefined): string | null {
	if (!value) return null;

	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	if (trimmed.startsWith("//")) return null;

	if (trimmed.startsWith("/")) {
		// WHATWG URL 파서는 특수 스킴에서 `\`를 `/`로 본다. 그래서 `/\evil.example`은 `//evil.example`과
		// 같아져 프로토콜 상대 URL이 된다. 고정 origin으로 해석해 **같은 origin일 때만** 통과시키고,
		// 제어문자·공백은 파서가 인코딩/제거한 경로를 그대로 쓴다(R3 리뷰 P2).
		const resolved = new URL(trimmed, CANONICAL_PATH_BASE);

		if (resolved.origin !== CANONICAL_PATH_BASE) return null;

		return `${resolved.pathname}${resolved.search}${resolved.hash}`;
	}

	try {
		const url = new URL(trimmed);

		return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
	} catch {
		return null;
	}
}

export function readSeoMetadata(metadata: Record<string, unknown>): SeoMetadata | undefined {
	const title = readMetadataString(metadata, "seoTitle");
	const description = readMetadataString(metadata, "seoDescription");
	const canonicalUrl = normalizeCanonicalUrl(readMetadataString(metadata, "canonicalUrl"));
	const ogImageId = readMetadataString(metadata, "ogImageId");

	const seo: SeoMetadata = {};
	if (title) seo.title = title;
	if (description) seo.description = description;
	if (canonicalUrl) seo.canonicalUrl = canonicalUrl;
	if (ogImageId) seo.ogImageId = ogImageId;

	return Object.keys(seo).length > 0 ? seo : undefined;
}

/** SEO 키가 공개 metadata allowlist·컬렉션 레지스트리와 어긋나지 않는지 확인할 때 쓰는 목록. */
export const SEO_METADATA_KEYS: readonly string[] = SEO_KEYS;
