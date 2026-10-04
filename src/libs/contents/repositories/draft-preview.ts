import "server-only";

import { getPreview, type ReadEntry } from "@bh2980/cms/read";
import { DEFAULT_LOCALE, type Locale } from "@/libs/i18n/locales";
import { readMetadataString, readMetadataStringArray } from "../metadata";
import { excerptOf, isEvergreen, seoOfMemo, seoOfPost, titleOf, toCategory, toTag } from "../read-model";
import { normalizeSlug } from "../slug";
import type { Category, DraftMemo, DraftPost, Tag } from "../types/contents";

/**
 * M9-FE-1: 관리자 미리보기 전용 초안 조회.
 *
 * 왜 별도 모듈인가 — 공개 `ContentRepository`(특히 postgres 구현)는 계약상 초안을 절대
 * 반환하지 않는다. 그래서 CMS DB로 공개 저장소를 바꾸는 순간 초안 미리보기가 404가 된다.
 * 공개 저장소 계약을 넓히지 않고 관리자 전용 경로만 추가한다.
 *
 * 읽기는 라이브러리의 `getPreview`가 한다(최신 초안, 번역본은 원문의 공통 값과 합침). 관계는 공개된 대상만 풀리므로
 * 아직 공개되지 않은 태그·카테고리는 id를 그대로 보여 준다.
 *
 * 안전 경계:
 * - 호출자(`getPreviewPost`/`getPreviewMemo`)가 관리자 세션을 먼저 확인한다. `getPreview`도 관리자가 아니면 `null`이다.
 * - 이 모듈은 쓰기를 하지 않는다.
 */

/**
 * 표시 이름을 못 찾아도 미리보기는 막지 않는다. id를 그대로 보여 주는 편이
 * 편집자가 "왜 미리보기가 404인지"를 모르는 것보다 낫다.
 */
function resolveTags(entry: ReadEntry): Tag[] {
	const resolved = new Map((entry.relations.tagIds ?? []).map((relation) => [relation.id, toTag(relation)]));

	return readMetadataStringArray(entry.metadata, "tagIds").map(
		(tagId) => resolved.get(tagId) ?? { slug: tagId, label: tagId },
	);
}

/**
 * 분류가 아예 없는 초안 글은 공개 렌더가 성립하지 않으므로 null을 돌려 404로 끝낸다
 * (공개 `toPublishedPost`가 해석 불가 분류를 버리는 것과 같은 규칙).
 */
function resolveCategory(entry: ReadEntry): Category | null {
	const categoryId = readMetadataString(entry.metadata, "categoryId");
	if (!categoryId) return null;

	const relation = entry.relations.categoryId?.[0];
	return relation ? toCategory(relation) : { slug: categoryId, label: categoryId };
}

function toDraftPost(entry: ReadEntry): DraftPost | null {
	const category = resolveCategory(entry);
	if (!category) return null;

	const seo = seoOfPost(entry);

	return {
		status: "draft",
		slug: entry.slug,
		title: titleOf(entry),
		excerpt: excerptOf(entry),
		category,
		tags: resolveTags(entry),
		contentMdx: entry.mdx,
		isEvergreen: isEvergreen(entry),
		...(seo ? { seo } : {}),
	};
}

function toDraftMemo(entry: ReadEntry): DraftMemo {
	const seo = seoOfMemo(entry);

	return {
		status: "draft",
		slug: entry.slug,
		title: titleOf(entry),
		tags: resolveTags(entry),
		contentMdx: entry.mdx,
		...(seo ? { seo } : {}),
	};
}

/** working slug로 초안 글을 읽는다. 없거나 분류가 없으면 null. */
export async function getDraftPreviewPost(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<DraftPost | null> {
	const normalized = normalizeSlug(slug);
	if (!normalized) return null;
	const entry = await getPreview({ collection: "post", slug: normalized, locale });

	return entry ? toDraftPost(entry) : null;
}

/** working slug로 초안 메모를 읽는다. 없으면 null. */
export async function getDraftPreviewMemo(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<DraftMemo | null> {
	const normalized = normalizeSlug(slug);
	if (!normalized) return null;
	const entry = await getPreview({ collection: "memo", slug: normalized, locale });

	return entry ? toDraftMemo(entry) : null;
}
