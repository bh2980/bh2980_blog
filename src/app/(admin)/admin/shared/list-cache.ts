import type { ListEntriesItem } from "@bh2980/cms/adapters/postgres/content-store";
import type { BulkOp } from "@bh2980/cms/core/api";
import type { ListState } from "../list-state";

/** 목록 API 응답 한 페이지. */
export interface EntriesPage {
	items: ListEntriesItem[];
	total: number;
}

/** 목록 캐시 키. 휴지통 배지 등 목록과 함께 다시 받아야 하는 것도 이 접두어 아래에 둔다. */
export const ENTRIES_KEY = ["cms", "entries"] as const;
export const entriesKey = (apiQuery: string) => [...ENTRIES_KEY, "list", apiQuery] as const;
export const TRASH_COUNT_KEY = [...ENTRIES_KEY, "trash-count"] as const;
export const foldersKey = (collection: string) => ["cms", "folders", collection] as const;

export type OptimisticOp = BulkOp | "restore";

export interface OptimisticContext {
	state: Pick<ListState, "statuses" | "folder" | "includeDescendants">;
	params?: { tagIds?: string[]; categoryId?: string | null; folderId?: string | null };
	tags?: readonly { id: string; title: string }[];
	categories?: readonly { id: string; title: string }[];
}

/**
 * 작업 결과를 서버 응답 전에 목록에 미리 반영한다(낙관적 갱신). 확실히 아는 변화만 적용하고,
 * 나머지(보관 해제 뒤 상태 등)는 곧 이어지는 다시 받기에 맡긴다. 지금 필터에서 빠질 줄은 바로 뺀다.
 */
export function applyOptimistic(
	page: EntriesPage,
	op: OptimisticOp,
	ids: ReadonlySet<string>,
	context: OptimisticContext,
): EntriesPage {
	const { state, params = {} } = context;
	const hidesStatus = (status: ListEntriesItem["status"]) =>
		state.statuses.length > 0 && !(state.statuses as readonly string[]).includes(status);

	const patch = (item: ListEntriesItem): ListEntriesItem | null => {
		switch (op) {
			case "trash":
			case "permanentDelete":
			case "restore":
				return null;
			case "archive":
				return hidesStatus("archived") ? null : { ...item, status: "archived", scheduledAt: null };
			case "publish":
				return hidesStatus("published") ? null : { ...item, status: "published", hasUnpublishedChanges: false };
			case "folder.move": {
				const folderId = params.folderId ?? null;
				const leaves = state.folder !== "all" && !state.includeDescendants && folderId !== state.folder;
				return leaves ? null : { ...item, folderId };
			}
			case "tags.add": {
				const added = (params.tagIds ?? []).filter((id) => !item.tagIds.includes(id));
				const tagIds = [...item.tagIds, ...added];
				const tags = [
					...item.tags,
					...added.map((id) => ({ id, title: context.tags?.find((tag) => tag.id === id)?.title ?? id })),
				];
				return { ...item, tagIds, tags };
			}
			case "tags.remove": {
				const removed = new Set(params.tagIds ?? []);
				return {
					...item,
					tagIds: item.tagIds.filter((id) => !removed.has(id)),
					tags: item.tags.filter((tag) => !removed.has(tag.id)),
				};
			}
			case "category.set": {
				const categoryId = params.categoryId ?? null;
				const title = context.categories?.find((category) => category.id === categoryId)?.title;
				return {
					...item,
					categoryId,
					category: categoryId ? { id: categoryId, title: title ?? categoryId } : null,
				};
			}
			default:
				return item;
		}
	};

	let removed = 0;
	const items: ListEntriesItem[] = [];
	for (const item of page.items) {
		if (!ids.has(item.id)) {
			items.push(item);
			continue;
		}
		const next = patch(item);
		if (next) items.push(next);
		else removed += 1;
	}
	return { items, total: Math.max(0, page.total - removed) };
}
