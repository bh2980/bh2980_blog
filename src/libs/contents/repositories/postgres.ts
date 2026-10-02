import "server-only";

import type { ContentStore, PublishedEntryRecord } from "@/cms/adapters/postgres/content-store";
import { getCmsContentStore } from "@/cms/container";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/libs/i18n/locales";
import { isDefined } from "@/utils/is-defined";
import type { ContentRepository } from "../contracts/repository";
import { POLICY_DEPRECATED, POLICY_EVERGREEN, readMetadataString, readMetadataStringArray } from "../metadata";
import { readSeoMetadata } from "../seo";
import { normalizeSlug } from "../slug";
import type { Category, Memo, Post, PublishedMemo, PublishedPost, Series, Tag } from "../types/contents";
import type { MemoListQuery, PostListQuery } from "../types/query";

/**
 * M7-BE-1: CMS DB의 공개본만 읽는 ContentRepository 구현.
 *
 * - 초안·보관·휴지통은 반환하지 않는다(O1 A3). 호출자의 status 필터와 무관하게 공개본만 나온다.
 * - 과거 주소(alias)로 조회하면 정규 current slug를 가진 항목을 반환한다(O1 A4/A8).
 *   호출자는 `entry.slug !== 요청 slug`인 경우 308로 보낸다.
 * - 목록 결과의 `contentMdx`는 빈 문자열이다. 본문은 상세 조회(getPost/getMemo)에서만 읽는다.
 *   (목록마다 전 본문을 전송하면 페이지 페이로드가 커진다. 소비자는 상세 조회만 본문을 쓴다.)
 * - DB·환경 오류는 삼키지 않고 그대로 throw한다. 호출자는 이를 5xx로 처리한다(O1 A3).
 */
type Metadata = Record<string, unknown>;

/** record 컬렉션(카테고리·태그·모음집)의 언어별 값. 없으면 기본 언어 값을 쓴다(v2 B4). */
function readLocalizedString(metadata: Metadata, key: string, locale: Locale): string | null {
	if (locale !== DEFAULT_LOCALE) {
		const translations = metadata.translations;
		if (translations && typeof translations === "object" && !Array.isArray(translations)) {
			const values = (translations as Record<string, unknown>)[locale];
			if (values && typeof values === "object" && !Array.isArray(values)) {
				const value = readMetadataString(values as Metadata, key);
				if (value) return value;
			}
		}
	}
	return readMetadataString(metadata, key);
}

function toLabel(entry: PublishedEntryRecord, locale: Locale = DEFAULT_LOCALE): string {
	return readLocalizedString(entry.metadata, "title", locale) ?? entry.slug;
}

const asLocale = (value: string): Locale => (isLocale(value) ? value : DEFAULT_LOCALE);

/** 발행일은 처음 발행할 때 DB가 기록한 값이다. 없으면 공개하지 않는다. */
function resolvePublishedAt(entry: PublishedEntryRecord): string | null {
	return entry.publishedAt ? entry.publishedAt.toISOString() : null;
}

function resolveTags(entry: PublishedEntryRecord, tagsById: ReadonlyMap<string, PublishedEntryRecord>): Tag[] {
	const locale = asLocale(entry.locale);
	return readMetadataStringArray(entry.metadata, "tagIds")
		.map((tagId) => tagsById.get(tagId))
		.filter(isDefined<PublishedEntryRecord>)
		.map((tag) => ({ slug: tag.slug, label: toLabel(tag, locale) }));
}

/**
 * 같은 번역 묶음에서 이 언어의 공개본을 찾는다. 없으면 원문(묶음 ID의 콘텐츠)을 쓴다(v2 B4).
 * 관계 필드(대체 글·모음집 항목)는 원문 ID를 가리키므로 이 규칙으로 언어에 맞춘다.
 */
function pickForLocale(
	groupId: string,
	locale: Locale,
	rowsByGroup: ReadonlyMap<string, readonly PublishedEntryRecord[]>,
	fallbackToSource: boolean,
): PublishedEntryRecord | undefined {
	const members = rowsByGroup.get(groupId) ?? [];
	return (
		members.find((row) => row.locale === locale) ??
		(fallbackToSource ? members.find((row) => row.id === groupId) : undefined)
	);
}

function groupRows(rows: readonly PublishedEntryRecord[]): Map<string, PublishedEntryRecord[]> {
	const byGroup = new Map<string, PublishedEntryRecord[]>();
	for (const row of rows) byGroup.set(row.translationGroupId, [...(byGroup.get(row.translationGroupId) ?? []), row]);
	return byGroup;
}

function resolveDeprecation(
	entry: PublishedEntryRecord,
	postsByGroup: ReadonlyMap<string, readonly PublishedEntryRecord[]> | undefined,
): PublishedPost["deprecation"] | undefined {
	if (readMetadataString(entry.metadata, "policy") !== POLICY_DEPRECATED) return undefined;
	const replacementId = readMetadataString(entry.metadata, "replacementPostId");
	// 같은 언어 번역본이 공개돼 있으면 그 글로, 없으면 원문으로 안내한다.
	const replacement =
		replacementId && postsByGroup
			? pickForLocale(replacementId, asLocale(entry.locale), postsByGroup, true)
			: undefined;
	return {
		replacement: replacement
			? { slug: replacement.slug, title: toLabel(replacement), locale: asLocale(replacement.locale) }
			: null,
	};
}

function toPost(
	entry: PublishedEntryRecord,
	categoriesById: ReadonlyMap<string, PublishedEntryRecord>,
	tagsById: ReadonlyMap<string, PublishedEntryRecord>,
	postsByGroup?: ReadonlyMap<string, readonly PublishedEntryRecord[]>,
): PublishedPost | null {
	const categoryId = readMetadataString(entry.metadata, "categoryId");
	const categoryEntry = categoryId ? categoriesById.get(categoryId) : undefined;

	// 기존 Keystatic 구현과 동일하게, 카테고리를 해석할 수 없는 글은 공개하지 않는다.
	if (!categoryEntry) return null;

	const publishedAt = resolvePublishedAt(entry);
	if (!publishedAt) return null;

	// SEO 미입력 글이면 seo 키 자체를 만들지 않는다(M7-FE-2).
	const seo = readSeoMetadata(entry.metadata);
	const deprecation = resolveDeprecation(entry, postsByGroup);

	return {
		slug: entry.slug,
		locale: asLocale(entry.locale),
		translationGroupId: entry.translationGroupId,
		status: "published",
		title: readMetadataString(entry.metadata, "title") ?? entry.slug,
		excerpt: readMetadataString(entry.metadata, "summary") ?? "",
		category: { slug: categoryEntry.slug, label: toLabel(categoryEntry, asLocale(entry.locale)) },
		tags: resolveTags(entry, tagsById),
		contentMdx: entry.mdx,
		publishedAt,
		updatedAt: entry.updatedAt.toISOString(),
		isEvergreen: readMetadataString(entry.metadata, "policy") === POLICY_EVERGREEN,
		...(deprecation ? { deprecation } : {}),
		...(seo ? { seo } : {}),
	};
}

function toMemo(
	entry: PublishedEntryRecord,
	tagsById: ReadonlyMap<string, PublishedEntryRecord>,
): PublishedMemo | null {
	const publishedAt = resolvePublishedAt(entry);
	if (!publishedAt) return null;

	const seo = readSeoMetadata(entry.metadata);

	return {
		slug: entry.slug,
		locale: asLocale(entry.locale),
		translationGroupId: entry.translationGroupId,
		status: "published",
		title: readMetadataString(entry.metadata, "title") ?? entry.slug,
		tags: resolveTags(entry, tagsById),
		contentMdx: entry.mdx,
		publishedAt,
		updatedAt: entry.updatedAt.toISOString(),
		...(seo ? { seo } : {}),
	};
}

/**
 * 모음집. 항목은 원문 ID이고, 이 언어의 번역본이 공개된 글만 보여 준다(v2 B4). 기본 언어는 원문 그대로다.
 */
function toSeries(
	entry: PublishedEntryRecord,
	postsByGroup: ReadonlyMap<string, PublishedPost>,
	locale: Locale,
): Series {
	const description = readLocalizedString(entry.metadata, "summary", locale);
	return {
		slug: entry.slug,
		label: toLabel(entry, locale),
		...(description ? { description } : {}),
		items: readMetadataStringArray(entry.metadata, "itemIds")
			.map((itemId) => postsByGroup.get(itemId))
			.filter(isDefined<PublishedPost>),
	};
}

function applyPostListQuery(posts: PublishedPost[], query: PostListQuery): PublishedPost[] {
	return posts.filter((post) => {
		if (query.category && post.category.slug !== query.category) return false;
		if (query.tag && !post.tags.some((tag) => tag.slug === query.tag)) return false;

		return true;
	});
}

function applyMemoListQuery(memos: PublishedMemo[], query: MemoListQuery): PublishedMemo[] {
	return memos.filter((memo) => {
		if (query.tag && !memo.tags.some((tag) => tag.slug === query.tag)) return false;

		return true;
	});
}

export class PostgresRepository implements ContentRepository {
	constructor(private readonly getStore: () => ContentStore = getCmsContentStore) {}

	private async loadTaxonomy(): Promise<{
		categoriesById: Map<string, PublishedEntryRecord>;
		tagsById: Map<string, PublishedEntryRecord>;
	}> {
		const rows = await this.getStore().listPublishedEntries({ collections: ["category", "tag"] });
		const categoriesById = new Map<string, PublishedEntryRecord>();
		const tagsById = new Map<string, PublishedEntryRecord>();

		for (const row of rows) {
			if (row.collection === "category") {
				categoriesById.set(row.id, row);
			} else if (row.collection === "tag") {
				tagsById.set(row.id, row);
			}
		}

		return { categoriesById, tagsById };
	}

	/** 모든 언어의 공개 게시글을 번역 묶음별로 묶는다. 대체 글을 언어에 맞출 때 쓴다(v2 B4). */
	private async loadPostGroups(): Promise<Map<string, PublishedEntryRecord[]>> {
		return groupRows(await this.getStore().listPublishedEntries({ collections: ["post"] }));
	}

	async getPost(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<Post | null> {
		const normalized = normalizeSlug(slug);
		// 빌드 수집 단계에서 빈 slug로 들어올 수 있다. 저장소를 부르지 않고 404로 끝낸다
		// (파일 기반 경로의 `read("")`가 null을 돌려주던 동작과 같다).
		if (!normalized) return null;

		const lookup = await this.getStore().getPublishedEntryBySlug({
			collection: "post",
			slug: normalized,
			includeBody: true,
			locale,
		});

		if (lookup.status === "not_found") return null;

		const [{ categoriesById, tagsById }, postsByGroup] = await Promise.all([
			this.loadTaxonomy(),
			readMetadataString(lookup.entry.metadata, "policy") === POLICY_DEPRECATED
				? this.loadPostGroups()
				: Promise.resolve(undefined),
		]);

		return toPost(lookup.entry, categoriesById, tagsById, postsByGroup);
	}

	async getMemo(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<Memo | null> {
		const normalized = normalizeSlug(slug);
		// 빌드 수집 단계에서 빈 slug로 들어올 수 있다. 저장소를 부르지 않고 404로 끝낸다.
		if (!normalized) return null;

		const lookup = await this.getStore().getPublishedEntryBySlug({
			collection: "memo",
			slug: normalized,
			includeBody: true,
			locale,
		});

		if (lookup.status === "not_found") return null;

		const { tagsById } = await this.loadTaxonomy();

		return toMemo(lookup.entry, tagsById);
	}

	async listPosts(query: PostListQuery = {}, locale: Locale = DEFAULT_LOCALE): Promise<Post[]> {
		const [allRows, taxonomy] = await Promise.all([
			this.getStore().listPublishedEntries({ collections: ["post"] }),
			this.loadTaxonomy(),
		]);

		const postsByGroup = groupRows(allRows);
		const posts = allRows
			.filter((row) => row.locale === locale)
			.map((row) => toPost(row, taxonomy.categoriesById, taxonomy.tagsById, postsByGroup))
			.filter(isDefined<PublishedPost>);

		return applyPostListQuery(posts, query);
	}

	async listPostSlugs(locale: Locale = DEFAULT_LOCALE): Promise<string[]> {
		const rows = await this.getStore().listPublishedEntries({ collections: ["post"], locale });

		return rows.map((row) => row.slug);
	}

	async listMemos(query: MemoListQuery = {}, locale: Locale = DEFAULT_LOCALE): Promise<Memo[]> {
		const [rows, taxonomy] = await Promise.all([
			this.getStore().listPublishedEntries({ collections: ["memo"], locale }),
			this.loadTaxonomy(),
		]);

		const memos = rows.map((row) => toMemo(row, taxonomy.tagsById)).filter(isDefined<PublishedMemo>);

		return applyMemoListQuery(memos, query);
	}

	async listMemoSlugs(locale: Locale = DEFAULT_LOCALE): Promise<string[]> {
		const rows = await this.getStore().listPublishedEntries({ collections: ["memo"], locale });

		return rows.map((row) => row.slug);
	}

	async listCategories(locale: Locale = DEFAULT_LOCALE): Promise<Category[]> {
		const rows = await this.getStore().listPublishedEntries({ collections: ["category"] });

		return rows.map((row) => ({ slug: row.slug, label: toLabel(row, locale) }));
	}

	async listTags(locale: Locale = DEFAULT_LOCALE): Promise<Tag[]> {
		const rows = await this.getStore().listPublishedEntries({ collections: ["tag"] });

		return rows.map((row) => ({ slug: row.slug, label: toLabel(row, locale) }));
	}

	async listSeries(locale: Locale = DEFAULT_LOCALE): Promise<Series[]> {
		const [seriesRows, posts] = await Promise.all([
			this.getStore().listPublishedEntries({ collections: ["collection"] }),
			this.listPosts({}, locale),
		]);
		const postsByGroup = new Map(
			posts
				.filter((post): post is PublishedPost => post.status === "published")
				.map((post) => [post.translationGroupId ?? post.slug, post]),
		);

		return seriesRows.map((row) => toSeries(row, postsByGroup, locale));
	}

	async getSeries(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<Series | null> {
		const seriesList = await this.listSeries(locale);

		return seriesList.find((series) => series.slug === slug) ?? null;
	}

	async listTranslations(
		collection: "post" | "memo",
		translationGroupId: string,
	): Promise<{ locale: Locale; slug: string }[]> {
		const rows = await this.getStore().listPublishedEntries({ collections: [collection] });

		return rows
			.filter((row) => row.translationGroupId === translationGroupId && isLocale(row.locale))
			.map((row) => ({ locale: asLocale(row.locale), slug: row.slug }));
	}

	async listLocalizedAddresses(locale: Locale): Promise<Map<string, string>> {
		const addresses = new Map<string, string>();
		if (locale === DEFAULT_LOCALE) return addresses;
		const rows = await this.getStore().listPublishedEntries({ collections: ["post", "memo"] });
		for (const [, members] of groupRows(rows)) {
			const base = members.find((row) => row.locale === DEFAULT_LOCALE);
			const localized = members.find((row) => row.locale === locale);
			if (base && localized) addresses.set(`${base.collection}:${base.slug}`, localized.slug);
		}
		return addresses;
	}
}
