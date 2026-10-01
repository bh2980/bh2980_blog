import type { ImportEntryItem } from "@/cms/adapters/postgres/content-store";
import { prepareSnapshot } from "@/cms/services/content-service";
import { keystaticPublishedAt } from "@/libs/contents/published-at";
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

/**
 * Keystatic의 datetime 필드가 **한국 시간을 UTC로 잘못 저장**했다(사용자 확인, 2026-09-23).
 *
 * 원본 frontmatter는 `2026-01-05T19:38:00.000Z`라고 적혀 있지만 실제 의도한 시각은 **19:38 KST**다.
 * 그대로 읽으면 `19:38Z` = 다음 날 04:38 KST가 되어, 발행 48편 중 25편의 표시 날짜가 하루 밀리고
 * RSS `pubDate`가 9시간 이동한다. wall-clock을 KST로 다시 붙인다.
 *
 * 파일 기반 조회(`keystatic` 저장소)도 같은 값을 써야 하므로 공유 모듈로 옮기고 여기서는 재수출만 한다.
 */
export { keystaticPublishedAt } from "@/libs/contents/published-at";

const metadataFor = (
	item: LegacyContentItem,
	ids: Record<LegacyKind, Map<string, string>>,
): { metadata: Record<string, unknown>; blocking: ImportPlanIssue[]; warnings: ImportPlanIssue[] } => {
	const blocking: ImportPlanIssue[] = [];
	const warnings: ImportPlanIssue[] = [];

	if (item.kind === "category" || item.kind === "tag") {
		return { metadata: { title: item.title }, blocking, warnings };
	}

	if (item.kind === "collection") {
		// CMS-SPEC §6: itemIds는 게시글(post)만을 대상으로 한다. 원본 모음집의 관계는 레거시
		// `meta.wiki.memo`(memo)라서 이관할 수 없다. 버리고 개수만 기록한다(사용자 결정, M9).
		if (item.itemSlugs.length > 0) {
			warnings.push({
				code: "dropped_collection_items",
				path: item.path,
				message: `모음집 항목 ${item.itemSlugs.length}개를 버린다(memo는 itemIds 대상이 아니다)`,
			});
		}
		return { metadata: { title: item.title }, blocking, warnings };
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
			},
			blocking,
			warnings,
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
			...(item.policy ? { policy: item.policy } : {}),
		},
		blocking,
		warnings,
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
			const { metadata, blocking: metadataIssues, warnings: metadataWarnings } = metadataFor(item, ids);
			blocking.push(...metadataIssues);
			warnings.push(...metadataWarnings);

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
			// 발행일은 `published_at` 칸 하나다. 초안도 원본 날짜를 넣어 두면 나중에 발행할 때 그대로 쓴다.
			const publishedAt = item.publishedAt ? new Date(keystaticPublishedAt(item.publishedAt) as string) : null;
			const isPublished = item.status === "published";

			items.push({
				id: ids[item.kind].get(item.slug) as string,
				collection: item.kind,
				slug: item.slug,
				status: isPublished ? "published" : "draft",
				publishedAt,
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
