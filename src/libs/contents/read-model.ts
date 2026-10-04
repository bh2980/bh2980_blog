import { SUMMARY_ROLE, valueWithRole } from "@bh2980/cms";
import type { ReadEntry, ReadRelation } from "@bh2980/cms/read";
import { memo as memoSchema, post as postSchema } from "@/cms.config";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/libs/i18n/locales";
import { POLICY_DEPRECATED, POLICY_EVERGREEN, readMetadataString } from "./metadata";
import { toSeoMetadata } from "./seo";
import type { Category, PublishedMemo, PublishedPost, Tag } from "./types/contents";

/**
 * 라이브러리 읽기 API(`@bh2980/cms/read`)의 `ReadEntry`를 이 블로그의 글·메모 모양으로 옮긴다.
 * 공개 저장소(`repositories/postgres.ts`), 미리보기 초안(`repositories/draft-preview.ts`), 공개 JSON API(`public-api.ts`)가 함께 쓴다.
 * 서버 설정(`cms.server.ts`)도 읽으므로 저장소·`server-only` 모듈을 import하지 않는다.
 */

export const asLocale = (value: string): Locale => (isLocale(value) ? value : DEFAULT_LOCALE);

/** 관계 대상의 표시 이름. 이름이 없으면 주소(slug)다. */
export const relationLabel = (relation: ReadRelation): string => relation.title?.trim() || relation.slug;

export const toTag = (relation: ReadRelation): Tag => ({ slug: relation.slug, label: relationLabel(relation) });

export const toCategory = (relation: ReadRelation): Category => ({
	slug: relation.slug,
	label: relationLabel(relation),
});

/** 공개된 태그만, 고른 순서대로. */
export const tagsOf = (entry: ReadEntry): Tag[] => (entry.relations.tagIds ?? []).map(toTag);

/** 카테고리를 해석할 수 없으면(없거나 공개되지 않음) `null`이다. */
export function categoryOf(entry: ReadEntry): Category | null {
	const relation = entry.relations.categoryId?.[0];
	return relation ? toCategory(relation) : null;
}

export const titleOf = (entry: ReadEntry): string => readMetadataString(entry.metadata, "title") ?? entry.slug;

/** 요약 역할 필드의 값. 없으면 빈 문자열이다. */
export const excerptOf = (entry: ReadEntry): string => valueWithRole(postSchema, SUMMARY_ROLE, entry.metadata).trim();

export const isEvergreen = (entry: ReadEntry): boolean =>
	readMetadataString(entry.metadata, "policy") === POLICY_EVERGREEN;

/** `policy: deprecated`인 글의 대체 글 안내. 대체 글은 관계가 이 언어 번역본(없으면 원문)으로 골라 준다. */
export function deprecationOf(entry: ReadEntry): PublishedPost["deprecation"] | undefined {
	if (readMetadataString(entry.metadata, "policy") !== POLICY_DEPRECATED) return undefined;
	const replacement = entry.relations.replacementPostId?.[0];
	return {
		replacement: replacement
			? { slug: replacement.slug, title: relationLabel(replacement), locale: asLocale(replacement.locale) }
			: null,
	};
}

export const seoOfPost = (entry: ReadEntry) => toSeoMetadata(postSchema, entry.metadata);
export const seoOfMemo = (entry: ReadEntry) => toSeoMetadata(memoSchema, entry.metadata);

/** 발행일은 처음 발행할 때 DB가 기록한 값이다. 없으면 공개하지 않는다. */
const publishedAtOf = (entry: ReadEntry): string | null => entry.publishedAt?.toISOString() ?? null;

/**
 * 공개 게시글. 카테고리를 해석할 수 없거나 발행일이 없으면 공개하지 않는다(`null`).
 * SEO 미입력 글이면 `seo` 키 자체를 만들지 않는다.
 */
export function toPublishedPost(entry: ReadEntry): PublishedPost | null {
	const category = categoryOf(entry);
	if (!category) return null;

	const publishedAt = publishedAtOf(entry);
	if (!publishedAt) return null;

	const seo = seoOfPost(entry);
	const deprecation = deprecationOf(entry);

	return {
		slug: entry.slug,
		locale: asLocale(entry.locale),
		translationGroupId: entry.translationGroupId,
		status: "published",
		title: titleOf(entry),
		excerpt: excerptOf(entry),
		category,
		tags: tagsOf(entry),
		contentMdx: entry.mdx,
		publishedAt,
		updatedAt: entry.updatedAt.toISOString(),
		isEvergreen: isEvergreen(entry),
		...(deprecation ? { deprecation } : {}),
		...(seo ? { seo } : {}),
	};
}

export function toPublishedMemo(entry: ReadEntry): PublishedMemo | null {
	const publishedAt = publishedAtOf(entry);
	if (!publishedAt) return null;

	const seo = seoOfMemo(entry);

	return {
		slug: entry.slug,
		locale: asLocale(entry.locale),
		translationGroupId: entry.translationGroupId,
		status: "published",
		title: titleOf(entry),
		tags: tagsOf(entry),
		contentMdx: entry.mdx,
		publishedAt,
		updatedAt: entry.updatedAt.toISOString(),
		...(seo ? { seo } : {}),
	};
}
