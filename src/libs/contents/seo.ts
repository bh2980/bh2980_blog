import { seoOf } from "@monti-cms/seo";
import type { SeoMetadata } from "./types/contents";

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

/**
 * 컬렉션 정의와 저장된 metadata에서 공개 head용 SEO 값을 읽는다(`seoOf`가 필드 역할로 값을 찾는다).
 * 값이 없으면 `undefined`라서 SEO를 입력하지 않은 글에는 `seo` 키 자체가 없다.
 *
 * `seoOf`는 비어 있는 제목·설명을 글 제목·요약으로 채워 주지만, 여기서는 **입력한 값만** 담는다
 * (폴백은 head를 만드는 쪽이 한다). 그래서 제목·요약을 빼고 넘긴다.
 */
export function toSeoMetadata(
	schema: Parameters<typeof seoOf>[0],
	metadata: Readonly<Record<string, unknown>>,
): SeoMetadata | undefined {
	const { title: _title, summary: _summary, ...explicit } = metadata;
	const values = seoOf(schema, explicit);
	const canonicalUrl = normalizeCanonicalUrl(values.canonical);

	const seo: SeoMetadata = {};
	if (values.title) seo.title = values.title;
	if (values.description) seo.description = values.description;
	if (canonicalUrl) seo.canonicalUrl = canonicalUrl;
	if (values.imageId) seo.ogImageId = values.imageId;
	if (values.noindex) seo.noindex = true;

	return Object.keys(seo).length > 0 ? seo : undefined;
}
