import { describe, expect, it } from "vitest";
import { isExplorerMode, listStateToApiQuery, listStateToSearchParams, parseListState } from "../list-state";

describe("관리자 목록 상태(§3.2)", () => {
	it("round-trips filters through the URL", () => {
		const url = new URLSearchParams(
			"collection=memo&folder=f1&descendants=1&search=리액트&status=published&changes=1&tag=t1&tag=t2&updatedFrom=2026-01-01&sortField=publishedAt&sortDirection=asc&page=2&pageSize=50",
		);
		const state = parseListState(url);
		expect(state).toMatchObject({
			collection: "memo",
			folder: "f1",
			includeDescendants: true,
			search: "리액트",
			status: "published",
			hasChanges: true,
			tagIds: ["t1", "t2"],
			updatedFrom: "2026-01-01",
			sortField: "publishedAt",
			sortDirection: "asc",
			page: 2,
			pageSize: 50,
			explicit: { pageSize: true, sort: true },
		});
		expect(parseListState(listStateToSearchParams(state))).toMatchObject({
			...state,
			explicit: { pageSize: true, sort: true },
		});
	});

	it("ignores invalid values instead of sending them to the API", () => {
		const state = parseListState(new URLSearchParams("collection=nope&status=deleted&pageSize=30&createdFrom=어제"));
		expect(state).toMatchObject({ collection: "post", status: "", pageSize: 25, createdFrom: "" });
	});

	it("builds the API query with OR-able repeats and Seoul day boundaries", () => {
		const state = parseListState(
			new URLSearchParams(
				"collection=post&folder=unfiled&tag=t1&tag=t2&category=c1&publishedFrom=2026-03-01&publishedTo=2026-03-01",
			),
		);
		const query = listStateToApiQuery(state);
		expect(query.get("folderId")).toBe("null");
		expect(query.getAll("tagId")).toEqual(["t1", "t2"]);
		expect(query.getAll("categoryId")).toEqual(["c1"]);
		expect(query.get("publishedFrom")).toBe("2026-02-28T15:00:00.000Z");
		expect(query.get("publishedTo")).toBe("2026-03-01T14:59:59.999Z");
	});

	it("shows folders only when no search or filter narrows the list", () => {
		expect(isExplorerMode(parseListState(new URLSearchParams("collection=post")))).toBe(true);
		expect(isExplorerMode(parseListState(new URLSearchParams("collection=post&search=a")))).toBe(false);
		expect(isExplorerMode(parseListState(new URLSearchParams("collection=post&folder=unfiled")))).toBe(false);
	});
});
