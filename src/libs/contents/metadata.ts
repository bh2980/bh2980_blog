/**
 * CMS 콘텐츠 metadata(`entry_bodies.metadata`)에서 공개 화면이 쓰는 값을 읽는다.
 * 공개본·초안 미리보기·SEO가 같은 규칙으로 읽도록 한곳에 둔다.
 */

/** 게시글 `policy` 선택 값(`src/cms.config.ts`). */
export const POLICY_EVERGREEN = "evergreen";
export const POLICY_DEPRECATED = "deprecated";

/** 앞뒤 공백을 걷어 낸 글자. 글자가 아니거나 비면 null이다. */
export function readMetadataString(metadata: Readonly<Record<string, unknown>>, key: string): string | null {
	const value = metadata[key];
	if (typeof value !== "string") return null;

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

/** 글자 목록. 배열이 아니면 빈 배열이고, 글자가 아니거나 빈 항목은 뺀다. */
export function readMetadataStringArray(metadata: Readonly<Record<string, unknown>>, key: string): string[] {
	const value = metadata[key];
	if (!Array.isArray(value)) return [];

	return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}
