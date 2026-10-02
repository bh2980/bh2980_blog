import "server-only";

import type { Entry, EntryMetadata } from "@/cms/adapters/postgres/content-store";
import { getCmsContentStore } from "@/cms/container";
import { isCollection } from "@/cms/core/collections";
import { mergeTranslationMetadata } from "@/cms/schema/derive";
import { DEFAULT_LOCALE, type Locale } from "@/libs/i18n/locales";
import { POLICY_EVERGREEN, readMetadataString, readMetadataStringArray } from "../metadata";
import { readSeoMetadata } from "../seo";
import { normalizeSlug } from "../slug";
import type { Category, DraftMemo, DraftPost, Tag } from "../types/contents";

/**
 * M9-FE-1: 관리자 미리보기 전용 초안 조회.
 *
 * 왜 별도 모듈인가 — 공개 `ContentRepository`(특히 postgres 구현)는 계약상 초안을 절대
 * 반환하지 않는다. 그래서 CMS DB로 공개 저장소를 바꾸는 순간 초안 미리보기가 404가 된다.
 * 공개 저장소 계약을 넓히지 않고 관리자 전용 경로만 추가한다.
 *
 * 안전 경계:
 * - 호출자(`getPreviewPost`/`getPreviewMemo`)가 관리자 세션을 먼저 확인한다. 이 모듈 자체는
 *   권한을 판정하지 않는다.
 * - 이 모듈은 쓰기를 하지 않는다.
 */

/** `collection:id` → 표시 이름. 분류 항목은 CMS가 자동 발행하므로 공개본에서 읽는다. */
type TaxonomyLabels = ReadonlyMap<string, string>;

// ponytail: 미리보기 1건당 taxonomy 1쿼리. 목록 미리보기를 추가하면 캐시가 필요하다.
async function loadTaxonomyLabels(): Promise<TaxonomyLabels> {
	const rows = await getCmsContentStore().listPublishedEntries({ collections: ["category", "tag"] });

	return new Map(
		rows.map((row) => [`${row.collection}:${row.id}`, readMetadataString(row.metadata, "title") ?? row.slug]),
	);
}

function resolveTags(metadata: EntryMetadata, labels: TaxonomyLabels): Tag[] {
	return readMetadataStringArray(metadata, "tagIds").map((tagId) => ({
		slug: tagId,
		label: labels.get(`tag:${tagId}`) ?? tagId,
	}));
}

/**
 * 표시 이름을 못 찾아도 미리보기는 막지 않는다. id를 그대로 보여 주는 편이
 * 편집자가 "왜 미리보기가 404인지"를 모르는 것보다 낫다.
 * 분류가 아예 없는 초안 글은 공개 렌더가 성립하지 않으므로 null을 돌려 404로 끝낸다
 * (공개 `toPost`가 해석 불가 분류를 버리는 것과 같은 규칙).
 */
function resolveCategory(metadata: EntryMetadata, labels: TaxonomyLabels): Category | null {
	const categoryId = readMetadataString(metadata, "categoryId");
	if (!categoryId) return null;

	return { slug: categoryId, label: labels.get(`category:${categoryId}`) ?? categoryId };
}

function toDraftPost(entry: Entry, slug: string, labels: TaxonomyLabels): DraftPost | null {
	const category = resolveCategory(entry.working.metadata, labels);
	if (!category) return null;

	const seo = readSeoMetadata(entry.working.metadata);

	return {
		status: "draft",
		slug,
		title: readMetadataString(entry.working.metadata, "title") ?? slug,
		excerpt: readMetadataString(entry.working.metadata, "summary") ?? "",
		category,
		tags: resolveTags(entry.working.metadata, labels),
		contentMdx: entry.working.mdx,
		isEvergreen: readMetadataString(entry.working.metadata, "policy") === POLICY_EVERGREEN,
		...(seo ? { seo } : {}),
	};
}

function toDraftMemo(entry: Entry, slug: string, labels: TaxonomyLabels): DraftMemo {
	const seo = readSeoMetadata(entry.working.metadata);

	return {
		status: "draft",
		slug,
		title: readMetadataString(entry.working.metadata, "title") ?? slug,
		tags: resolveTags(entry.working.metadata, labels),
		contentMdx: entry.working.mdx,
		...(seo ? { seo } : {}),
	};
}

/** working slug로 초안 글을 읽는다. 없거나 분류가 없으면 null. */
/**
 * 번역본 초안은 언어별 값만 가지므로 원문 초안의 공통 값(카테고리·태그·정책)과 합쳐 보여 준다(v2 B4).
 */
async function withSourceCommonFields(entry: Entry): Promise<Entry> {
	if (!entry.translationGroupId || entry.translationGroupId === entry.id || !isCollection(entry.collection))
		return entry;
	const source = await getCmsContentStore()
		.getEntry(entry.translationGroupId)
		.catch(() => null);
	if (!source) return entry;
	const metadata = mergeTranslationMetadata(entry.collection, source.working.metadata, entry.working.metadata);
	return { ...entry, working: { ...entry.working, metadata: metadata as EntryMetadata } };
}

export async function getDraftPreviewPost(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<DraftPost | null> {
	const normalized = normalizeSlug(slug);
	const found = await getCmsContentStore().getWorkingEntryBySlug({ collection: "post", slug: normalized, locale });
	if (!found) return null;
	const entry = await withSourceCommonFields(found);

	const postSlug = entry.workingSlug ?? normalized;

	return toDraftPost(entry, postSlug, await loadTaxonomyLabels());
}

/** working slug로 초안 메모를 읽는다. 없으면 null. */
export async function getDraftPreviewMemo(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<DraftMemo | null> {
	const normalized = normalizeSlug(slug);
	const found = await getCmsContentStore().getWorkingEntryBySlug({ collection: "memo", slug: normalized, locale });
	if (!found) return null;
	const entry = await withSourceCommonFields(found);

	const memoSlug = entry.workingSlug ?? normalized;

	return toDraftMemo(entry, memoSlug, await loadTaxonomyLabels());
}
