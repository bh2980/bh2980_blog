import "server-only";

import type { ContentStore, PublishedEntryRecord } from "@/cms/adapters/postgres/content-store";
import { getCmsContentStore } from "@/cms/container";
import { isDefined } from "@/utils/is-defined";
import type { ContentRepository } from "../contracts/repository";
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

const POLICY_EVERGREEN = "evergreen";

function readMetadataString(metadata: Metadata, key: string): string | null {
	const value = metadata[key];
	if (typeof value !== "string") return null;

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function readMetadataStringArray(metadata: Metadata, key: string): string[] {
	const value = metadata[key];
	if (!Array.isArray(value)) return [];

	return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function toLabel(entry: PublishedEntryRecord): string {
	return readMetadataString(entry.metadata, "title") ?? entry.slug;
}

/**
 * 표시 발행일은 metadata(`publishedAt`, 이관된 표시 날짜)를 우선하고,
 * 없으면 DB가 발행 시점에 기록한 값을 쓴다. 둘 다 없으면 공개하지 않는다.
 */
function resolvePublishedAt(entry: PublishedEntryRecord): string | null {
	const fromMetadata = readMetadataString(entry.metadata, "publishedAt");
	if (fromMetadata) return fromMetadata;

	const fromColumn = entry.publishedAt ?? entry.firstPublishedAt;
	return fromColumn ? fromColumn.toISOString() : null;
}

function resolveTags(entry: PublishedEntryRecord, tagsById: ReadonlyMap<string, PublishedEntryRecord>): Tag[] {
	return readMetadataStringArray(entry.metadata, "tagIds")
		.map((tagId) => tagsById.get(tagId))
		.filter(isDefined<PublishedEntryRecord>)
		.map((tag) => ({ slug: tag.slug, label: toLabel(tag) }));
}

function toPost(
	entry: PublishedEntryRecord,
	categoriesById: ReadonlyMap<string, PublishedEntryRecord>,
	tagsById: ReadonlyMap<string, PublishedEntryRecord>,
): PublishedPost | null {
	const categoryId = readMetadataString(entry.metadata, "categoryId");
	const categoryEntry = categoryId ? categoriesById.get(categoryId) : undefined;

	// 기존 Keystatic 구현과 동일하게, 카테고리를 해석할 수 없는 글은 공개하지 않는다.
	if (!categoryEntry) return null;

	const publishedAt = resolvePublishedAt(entry);
	if (!publishedAt) return null;

	return {
		slug: entry.slug,
		status: "published",
		title: readMetadataString(entry.metadata, "title") ?? entry.slug,
		excerpt: readMetadataString(entry.metadata, "summary") ?? "",
		category: { slug: categoryEntry.slug, label: toLabel(categoryEntry) },
		tags: resolveTags(entry, tagsById),
		contentMdx: entry.mdx,
		publishedAt,
		isEvergreen: readMetadataString(entry.metadata, "policy") === POLICY_EVERGREEN,
	};
}

function toMemo(
	entry: PublishedEntryRecord,
	tagsById: ReadonlyMap<string, PublishedEntryRecord>,
): PublishedMemo | null {
	const publishedAt = resolvePublishedAt(entry);
	if (!publishedAt) return null;

	return {
		slug: entry.slug,
		status: "published",
		title: readMetadataString(entry.metadata, "title") ?? entry.slug,
		tags: resolveTags(entry, tagsById),
		contentMdx: entry.mdx,
		publishedAt,
	};
}

function toSeries(entry: PublishedEntryRecord, postsById: ReadonlyMap<string, PublishedPost>): Series {
	return {
		slug: entry.slug,
		label: toLabel(entry),
		items: readMetadataStringArray(entry.metadata, "itemIds")
			.map((itemId) => postsById.get(itemId))
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

	private async loadPostsById(): Promise<Map<string, PublishedPost>> {
		const [rows, taxonomy] = await Promise.all([
			this.getStore().listPublishedEntries({ collections: ["post"] }),
			this.loadTaxonomy(),
		]);
		const postsById = new Map<string, PublishedPost>();

		for (const row of rows) {
			const post = toPost(row, taxonomy.categoriesById, taxonomy.tagsById);
			if (post) postsById.set(row.id, post);
		}

		return postsById;
	}

	async getPost(slug: string): Promise<Post | null> {
		const lookup = await this.getStore().getPublishedEntryBySlug({
			collection: "post",
			slug,
			includeBody: true,
		});

		if (lookup.status === "not_found") return null;

		const { categoriesById, tagsById } = await this.loadTaxonomy();

		return toPost(lookup.entry, categoriesById, tagsById);
	}

	async getMemo(slug: string): Promise<Memo | null> {
		const lookup = await this.getStore().getPublishedEntryBySlug({
			collection: "memo",
			slug,
			includeBody: true,
		});

		if (lookup.status === "not_found") return null;

		const { tagsById } = await this.loadTaxonomy();

		return toMemo(lookup.entry, tagsById);
	}

	async listPosts(query: PostListQuery = {}): Promise<Post[]> {
		const [rows, taxonomy] = await Promise.all([
			this.getStore().listPublishedEntries({ collections: ["post"] }),
			this.loadTaxonomy(),
		]);

		const posts = rows
			.map((row) => toPost(row, taxonomy.categoriesById, taxonomy.tagsById))
			.filter(isDefined<PublishedPost>);

		return applyPostListQuery(posts, query);
	}

	async listPostSlugs(): Promise<string[]> {
		const rows = await this.getStore().listPublishedEntries({ collections: ["post"] });

		return rows.map((row) => row.slug);
	}

	async listMemos(query: MemoListQuery = {}): Promise<Memo[]> {
		const [rows, taxonomy] = await Promise.all([
			this.getStore().listPublishedEntries({ collections: ["memo"] }),
			this.loadTaxonomy(),
		]);

		const memos = rows.map((row) => toMemo(row, taxonomy.tagsById)).filter(isDefined<PublishedMemo>);

		return applyMemoListQuery(memos, query);
	}

	async listMemoSlugs(): Promise<string[]> {
		const rows = await this.getStore().listPublishedEntries({ collections: ["memo"] });

		return rows.map((row) => row.slug);
	}

	async listCategories(): Promise<Category[]> {
		const rows = await this.getStore().listPublishedEntries({ collections: ["category"] });

		return rows.map((row) => ({ slug: row.slug, label: toLabel(row) }));
	}

	async listTags(): Promise<Tag[]> {
		const rows = await this.getStore().listPublishedEntries({ collections: ["tag"] });

		return rows.map((row) => ({ slug: row.slug, label: toLabel(row) }));
	}

	async listSeries(): Promise<Series[]> {
		const [seriesRows, postsById] = await Promise.all([
			this.getStore().listPublishedEntries({ collections: ["collection"] }),
			this.loadPostsById(),
		]);

		return seriesRows.map((row) => toSeries(row, postsById));
	}

	async getSeries(slug: string): Promise<Series | null> {
		const seriesList = await this.listSeries();

		return seriesList.find((series) => series.slug === slug) ?? null;
	}
}
