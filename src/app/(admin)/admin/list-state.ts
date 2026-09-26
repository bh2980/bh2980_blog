import type { ListSortField, PageSize } from "@/cms/core/api";
import { type Collection, isCollection } from "@/cms/core/collections";
import { parseSeoulDateTimeInput } from "@/libs/contents/published-at";
import type { EntryStatus } from "./shared/entry-status";

/**
 * 관리자 목록 상태(§3.2). 폴더·검색·필터·정렬·페이지를 URL에 반영해 뒤로 가기로 복구한다.
 * 페이지 크기·정렬 기본값과 컬럼은 컬렉션별 사용자 설정에 저장한다.
 */
export interface ListState {
	collection: Collection;
	/** `all`은 전체, `unfiled`는 미분류, 그 밖은 폴더 ID다(§3.3). */
	folder: string;
	includeDescendants: boolean;
	search: string;
	includeBody: boolean;
	/** 빈 문자열이면 휴지통을 뺀 전체다. */
	status: "" | EntryStatus;
	hasChanges: boolean;
	scheduled: boolean;
	tagIds: string[];
	categoryIds: string[];
	/** `YYYY-MM-DD`(서울 날짜). */
	createdFrom: string;
	createdTo: string;
	updatedFrom: string;
	updatedTo: string;
	publishedFrom: string;
	publishedTo: string;
	sortField: ListSortField;
	sortDirection: "asc" | "desc";
	page: number;
	pageSize: PageSize;
}

export const DEFAULT_LIST_STATE: Omit<ListState, "collection"> = {
	folder: "all",
	includeDescendants: false,
	search: "",
	includeBody: false,
	status: "",
	hasChanges: false,
	scheduled: false,
	tagIds: [],
	categoryIds: [],
	createdFrom: "",
	createdTo: "",
	updatedFrom: "",
	updatedTo: "",
	publishedFrom: "",
	publishedTo: "",
	sortField: "updatedAt",
	sortDirection: "desc",
	page: 1,
	pageSize: 25,
};

const DATE_KEYS = ["createdFrom", "createdTo", "updatedFrom", "updatedTo", "publishedFrom", "publishedTo"] as const;
const STATUSES = ["draft", "published", "archived", "trashed"];
const SORT_FIELDS = ["updatedAt", "createdAt", "publishedAt", "title", "slug"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseListState(
	params: URLSearchParams,
): ListState & { explicit: { pageSize: boolean; sort: boolean } } {
	const collection = params.get("collection");
	const pageSize = Number(params.get("pageSize"));
	const page = Number(params.get("page"));
	const status = params.get("status") ?? "";
	const sortField = params.get("sortField") ?? "";
	const state: ListState = {
		...DEFAULT_LIST_STATE,
		collection: isCollection(collection) ? collection : "post",
		folder: params.get("folder") || "all",
		includeDescendants: params.get("descendants") === "1",
		search: params.get("search") ?? "",
		includeBody: params.get("body") === "1",
		status: STATUSES.includes(status) ? (status as EntryStatus) : "",
		hasChanges: params.get("changes") === "1",
		scheduled: params.get("scheduled") === "1",
		tagIds: params.getAll("tag"),
		categoryIds: params.getAll("category"),
		sortField: SORT_FIELDS.includes(sortField) ? (sortField as ListSortField) : DEFAULT_LIST_STATE.sortField,
		sortDirection: params.get("sortDirection") === "asc" ? "asc" : "desc",
		page: Number.isInteger(page) && page > 0 ? page : 1,
		pageSize: pageSize === 50 || pageSize === 100 ? pageSize : 25,
	};
	for (const key of DATE_KEYS) {
		const value = params.get(key) ?? "";
		state[key] = DATE_PATTERN.test(value) ? value : "";
	}
	return { ...state, explicit: { pageSize: params.has("pageSize"), sort: params.has("sortField") } };
}

/** 기본값과 같은 값은 URL에 쓰지 않는다. */
export function listStateToSearchParams(state: ListState): URLSearchParams {
	const params = new URLSearchParams({ collection: state.collection });
	const set = (key: string, value: string, fallback: string) => {
		if (value !== fallback) params.set(key, value);
	};
	set("folder", state.folder, "all");
	if (state.includeDescendants) params.set("descendants", "1");
	set("search", state.search, "");
	if (state.includeBody) params.set("body", "1");
	set("status", state.status, "");
	if (state.hasChanges) params.set("changes", "1");
	if (state.scheduled) params.set("scheduled", "1");
	for (const id of state.tagIds) params.append("tag", id);
	for (const id of state.categoryIds) params.append("category", id);
	for (const key of DATE_KEYS) set(key, state[key], "");
	params.set("sortField", state.sortField);
	params.set("sortDirection", state.sortDirection);
	set("page", String(state.page), "1");
	params.set("pageSize", String(state.pageSize));
	return params;
}

const seoulDayBoundary = (date: string, end: boolean) => {
	const parsed = parseSeoulDateTimeInput(`${date}T${end ? "23:59" : "00:00"}`);
	if (!parsed) return null;
	return end ? new Date(Date.parse(parsed) + 59_999).toISOString() : parsed;
};

/** 목록 API(`GET /entries`) 질의. 같은 필터의 여러 값은 OR, 다른 필터끼리는 AND다. */
export function listStateToApiQuery(state: ListState): URLSearchParams {
	const query = new URLSearchParams({
		collection: state.collection,
		sortField: state.sortField,
		sortDirection: state.sortDirection,
		page: String(state.page),
		pageSize: String(state.pageSize),
	});
	if (state.folder === "unfiled") query.set("folderId", "null");
	else if (state.folder !== "all") {
		query.set("folderId", state.folder);
		if (state.includeDescendants) query.set("includeDescendants", "true");
	}
	if (state.search.trim()) query.set("search", state.search.trim());
	if (state.includeBody) query.set("includeBody", "true");
	if (state.status) query.append("status", state.status);
	if (state.hasChanges) query.set("hasChanges", "true");
	if (state.scheduled) query.set("scheduled", "true");
	for (const id of state.tagIds) query.append("tagId", id);
	for (const id of state.categoryIds) query.append("categoryId", id);
	for (const key of DATE_KEYS) {
		if (!state[key]) continue;
		const boundary = seoulDayBoundary(state[key], key.endsWith("To"));
		if (boundary) query.set(key, boundary);
	}
	return query;
}

/** 폴더 탐색 모드: 검색·필터가 없을 때 현재 폴더의 하위 폴더를 목록 위에 보여 준다. */
export function isExplorerMode(state: ListState): boolean {
	return (
		!state.search.trim() &&
		!state.status &&
		!state.hasChanges &&
		!state.scheduled &&
		state.tagIds.length === 0 &&
		state.categoryIds.length === 0 &&
		DATE_KEYS.every((key) => !state[key]) &&
		state.folder !== "unfiled"
	);
}

export const activeFilterCount = (state: ListState) =>
	[
		state.status,
		state.hasChanges,
		state.scheduled,
		state.tagIds.length > 0,
		state.categoryIds.length > 0,
		...DATE_KEYS.map((key) => state[key]),
	].filter(Boolean).length;
