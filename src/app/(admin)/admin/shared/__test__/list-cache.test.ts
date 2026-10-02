import type { ListEntriesItem } from "@bh2980/cms/adapters/postgres/content-store";
import { describe, expect, it } from "vitest";
import { applyOptimistic, type EntriesPage, type OptimisticContext } from "../list-cache";

const row = (id: string, patch: Partial<ListEntriesItem> = {}): ListEntriesItem => ({
	id,
	collection: "post",
	locale: "ko",
	translationGroupId: id,
	title: id,
	slug: id,
	status: "draft",
	version: 1,
	folderId: null,
	categoryId: null,
	category: null,
	tagIds: [],
	tags: [],
	hasUnpublishedChanges: false,
	scheduledAt: null,
	publishedAt: null,
	createdAt: new Date(0),
	updatedAt: new Date(0),
	trashedAt: null,
	...patch,
});

const page = (items: ListEntriesItem[], total = items.length): EntriesPage => ({ items, total });
const state: OptimisticContext["state"] = { statuses: [], folder: "all", includeDescendants: false };
const ids = (...values: string[]) => new Set(values);

describe("목록 낙관적 갱신", () => {
	it("휴지통 이동·영구 삭제·복원은 줄을 바로 빼고 전체 수를 줄인다", () => {
		for (const op of ["trash", "permanentDelete", "restore"] as const) {
			const next = applyOptimistic(page([row("a"), row("b"), row("c")], 30), op, ids("a", "c"), { state });
			expect(next.items.map((item) => item.id)).toEqual(["b"]);
			expect(next.total).toBe(28);
		}
	});

	it("상태 필터에서 빠지는 줄은 빼고, 남는 줄은 상태만 바꾼다", () => {
		const items = [row("a"), row("b")];
		expect(applyOptimistic(page(items), "archive", ids("a"), { state }).items[0]?.status).toBe("archived");
		const filtered = applyOptimistic(page(items), "archive", ids("a"), { state: { ...state, statuses: ["draft"] } });
		expect(filtered.items.map((item) => item.id)).toEqual(["b"]);
	});

	it("다른 폴더로 옮긴 줄은 지금 폴더 보기에서 빠진다", () => {
		const items = [row("a", { folderId: "f1" }), row("b", { folderId: "f1" })];
		const inFolder = { ...state, folder: "f1" };
		expect(
			applyOptimistic(page(items), "folder.move", ids("a"), { state: inFolder, params: { folderId: "f2" } }).items,
		).toHaveLength(1);
		expect(
			applyOptimistic(page(items), "folder.move", ids("a"), { state, params: { folderId: "f2" } }).items[0]?.folderId,
		).toBe("f2");
	});

	it("태그·카테고리는 이름까지 채워 바꾼다", () => {
		const tags = [{ id: "t1", title: "React" }];
		const added = applyOptimistic(page([row("a")]), "tags.add", ids("a"), { state, params: { tagIds: ["t1"] }, tags });
		expect(added.items[0]?.tags).toEqual([{ id: "t1", title: "React" }]);
		const removed = applyOptimistic(added, "tags.remove", ids("a"), { state, params: { tagIds: ["t1"] } });
		expect(removed.items[0]?.tagIds).toEqual([]);
		const categories = [{ id: "c1", title: "개발" }];
		const set = applyOptimistic(page([row("a")]), "category.set", ids("a"), {
			state,
			params: { categoryId: "c1" },
			categories,
		});
		expect(set.items[0]?.category).toEqual({ id: "c1", title: "개발" });
	});
});
