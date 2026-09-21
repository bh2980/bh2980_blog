import type { ImportEntryItem } from "@/cms/adapters/postgres/content-store";
import { prepareSnapshot } from "@/cms/services/content-service";
import type { LegacyContentItem, LegacyCorpus, LegacyKind } from "./legacy-parser";
import { stableId } from "./stable-id";

export interface ImportPlanIssue {
	code: string;
	path: string;
	message: string;
}

export interface ImportPlanCounts {
	posts: number;
	memos: number;
	categories: number;
	tags: number;
	collections: number;
	published: number;
	draft: number;
	items: number;
}

export interface ImportPlan {
	items: ImportEntryItem[];
	blocking: ImportPlanIssue[];
	warnings: ImportPlanIssue[];
	counts: ImportPlanCounts;
	/** kind → slug → 안정 ID. 보고서·검증에 쓴다. */
	ids: Record<LegacyKind, Map<string, string>>;
}

const emptyIdMap = (): Record<LegacyKind, Map<string, string>> => ({
	post: new Map(),
	memo: new Map(),
	category: new Map(),
	tag: new Map(),
	collection: new Map(),
});

const metadataFor = (
	item: LegacyContentItem,
	ids: Record<LegacyKind, Map<string, string>>,
): { metadata: Record<string, unknown>; blocking: ImportPlanIssue[] } => {
	const blocking: ImportPlanIssue[] = [];
	// 초안도 원본 발행일을 작업본 메타데이터에만 남긴다(공개 시각 컬럼은 null).
	const publishedAt = item.publishedAt ?? undefined;

	if (item.kind === "category" || item.kind === "tag") {
		return { metadata: { title: item.title }, blocking };
	}

	if (item.kind === "collection") {
		const itemIds: string[] = [];
		for (const memoSlug of item.itemSlugs) {
			const memoId = ids.memo.get(memoSlug);
			if (!memoId) {
				blocking.push({
					code: "missing_collection_item",
					path: item.path,
					message: `모음집 항목을 찾을 수 없습니다: ${memoSlug}`,
				});
				continue;
			}
			itemIds.push(memoId);
		}
		return { metadata: { title: item.title, ...(itemIds.length > 0 ? { itemIds } : {}) }, blocking };
	}

	const tagIds: string[] = [];
	for (const tagSlug of item.tagSlugs) {
		const tagId = ids.tag.get(tagSlug);
		if (!tagId) {
			blocking.push({ code: "missing_tag", path: item.path, message: `태그를 찾을 수 없습니다: ${tagSlug}` });
			continue;
		}
		tagIds.push(tagId);
	}

	if (item.kind === "memo") {
		return {
			metadata: {
				title: item.title,
				...(tagIds.length > 0 ? { tagIds } : {}),
				...(publishedAt ? { publishedAt } : {}),
			},
			blocking,
		};
	}

	const categoryId = item.categorySlug ? ids.category.get(item.categorySlug) : undefined;
	if (item.categorySlug && !categoryId) {
		blocking.push({
			code: "missing_category",
			path: item.path,
			message: `카테고리를 찾을 수 없습니다: ${item.categorySlug}`,
		});
	}
	if (!item.categorySlug) {
		blocking.push({ code: "missing_category", path: item.path, message: "게시글에 카테고리가 없습니다." });
	}
	const summary = item.frontmatter.excerpt;
	return {
		metadata: {
			title: item.title,
			...(typeof summary === "string" && summary.trim().length > 0 ? { summary: summary.trim() } : {}),
			...(categoryId ? { categoryId } : {}),
			...(tagIds.length > 0 ? { tagIds } : {}),
			...(publishedAt ? { publishedAt } : {}),
			...(item.policy ? { policy: item.policy } : {}),
		},
		blocking,
	};
};

/**
 * 기존 파일 목록을 적재 계획으로 바꾼다.
 * - ID는 파일 경로 기반 UUIDv5로 고정한다(재실행해도 같은 ID).
 * - published 항목은 working+published 본문을 함께 만들고, draft는 working만 만든다.
 * - 본문 해시·참조는 `prepareSnapshot`을 재사용해 편집기/API와 같은 규칙을 쓴다.
 */
export async function buildImportPlan(corpus: LegacyCorpus): Promise<ImportPlan> {
	const ids = emptyIdMap();
	const blocking: ImportPlanIssue[] = [];
	const warnings: ImportPlanIssue[] = [];

	const groups: { kind: LegacyKind; items: LegacyContentItem[] }[] = [
		{ kind: "category", items: corpus.categories },
		{ kind: "tag", items: corpus.tags },
		{ kind: "collection", items: corpus.collections },
		{ kind: "memo", items: corpus.memos },
		{ kind: "post", items: corpus.posts },
	];

	for (const group of groups) {
		const seen = new Set<string>();
		for (const item of group.items) {
			if (seen.has(item.slug)) {
				blocking.push({ code: "duplicate_slug", path: item.path, message: `중복 slug: ${item.slug}` });
				continue;
			}
			seen.add(item.slug);
			ids[group.kind].set(item.slug, stableId(group.kind, item.path));
		}
	}

	const items: ImportEntryItem[] = [];
	for (const group of groups) {
		for (const item of group.items) {
			const { metadata, blocking: metadataIssues } = metadataFor(item, ids);
			blocking.push(...metadataIssues);

			// inspect와 apply가 같은 기준으로 막도록 빈 본문을 여기서도 blocking으로 본다.
			if ((item.kind === "post" || item.kind === "memo") && item.mdx.trim().length === 0) {
				blocking.push({ code: "empty_body", path: item.path, message: "본문이 비어 있습니다." });
			}

			const snapshot = await prepareSnapshot({
				collection: item.kind,
				slug: item.slug,
				metadata,
				mdx: item.mdx,
			});

			for (const issue of snapshot.issues) {
				const entry: ImportPlanIssue = {
					code: issue.code,
					path: item.path,
					message: issue.message ?? "",
				};
				if (issue.code === "mdx_error") blocking.push(entry);
				else warnings.push(entry);
			}

			if (item.status !== "published" && item.publishedAt === null) {
				warnings.push({ code: "draft_without_date", path: item.path, message: "status 누락(초안)으로 처리" });
			}

			const body = {
				metadata: snapshot.metadata,
				mdx: snapshot.mdx,
				schemaVersion: snapshot.schemaVersion,
				contentHash: snapshot.contentHash,
			};
			const publishedAt = item.publishedAt ? new Date(item.publishedAt) : null;
			const isPublished = item.status === "published";

			items.push({
				id: ids[item.kind].get(item.slug) as string,
				collection: item.kind,
				slug: item.slug,
				status: isPublished ? "published" : "draft",
				publishedAt: isPublished ? publishedAt : null,
				working: body,
				...(isPublished ? { published: body } : {}),
				references: snapshot.references,
			});
		}
	}

	return {
		items,
		blocking,
		warnings,
		counts: {
			posts: corpus.posts.length,
			memos: corpus.memos.length,
			categories: corpus.categories.length,
			tags: corpus.tags.length,
			collections: corpus.collections.length,
			published: items.filter((item) => item.status === "published").length,
			draft: items.filter((item) => item.status === "draft").length,
			items: items.length,
		},
		ids,
	};
}
