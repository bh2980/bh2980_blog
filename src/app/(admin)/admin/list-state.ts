import type { ListSortField, PageSize } from "@/cms/core/api";
import { type Collection, isCollection } from "@/cms/core/collections";
import { schemaOf } from "@/cms/schema/derive";
import { parseSeoulDateTimeInput } from "@/libs/contents/published-at";
import { isLocale, type Locale } from "@/libs/i18n/locales";
import type { EntryStatus } from "./shared/entry-status";

/** 목록에서 거를 수 있는 상태. 휴지통은 전용 화면(v2 A3)에서만 본다. */
export type ListStatus = Exclude<EntryStatus, "trashed">;
export const LIST_STATUSES: readonly ListStatus[] = ["draft", "published", "archived"];

/**
 * 관리자 목록 상태(§3.2). 폴더·검색·필터·정렬·페이지를 URL에 반영해 뒤로 가기로 복구한다.
 * 페이지 크기·정렬 기본값과 컬럼은 컬렉션별 사용자 설정에 저장한다.
 */
export interface ListState {
	collection: Collection;
	/**
	 * `all`은 최상위(폴더의 뿌리), 그 밖은 폴더 ID다(§3.3). 탐색 모드에서 최상위는 최상위 폴더와 폴더 밖 항목만 보여 준다.
	 * 예전 주소의 `unfiled`(미분류)는 최상위로 읽는다.
	 */
	folder: string;
	includeDescendants: boolean;
	search: string;
	includeBody: boolean;
	/** 컬럼 헤더 필터: 제목만·주소만 부분 일치(v2 A1). */
	titleContains: string;
	slugContains: string;
	/** 비어 있으면 휴지통을 뺀 전체다. 여러 값은 OR다. */
	statuses: ListStatus[];
	hasChanges: boolean;
	scheduled: boolean;
	tagIds: string[];
	categoryIds: string[];
	/** 콘텐츠 언어(v2 B4). 비어 있으면 모든 언어다. */
	locales: Locale[];
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
	titleContains: "",
	slugContains: "",
	statuses: [],
	hasChanges: false,
	scheduled: false,
	tagIds: [],
	categoryIds: [],
	locales: [],
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

export const DATE_KEYS = [
	"createdFrom",
	"createdTo",
	"updatedFrom",
	"updatedTo",
	"publishedFrom",
	"publishedTo",
] as const;
const SORT_FIELDS = ["updatedAt", "createdAt", "publishedAt", "title", "slug"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseListState(
	params: URLSearchParams,
): ListState & { explicit: { pageSize: boolean; sort: boolean } } {
	const collection = params.get("collection");
	const pageSize = Number(params.get("pageSize"));
	const page = Number(params.get("page"));
	const sortField = params.get("sortField") ?? "";
	const statuses = [...new Set(params.getAll("status"))].filter((status): status is ListStatus =>
		(LIST_STATUSES as readonly string[]).includes(status),
	);
	const state: ListState = {
		...DEFAULT_LIST_STATE,
		collection: isCollection(collection) ? collection : "post",
		folder: !params.get("folder") || params.get("folder") === "unfiled" ? "all" : (params.get("folder") as string),
		includeDescendants: params.get("descendants") === "1",
		search: params.get("search") ?? "",
		includeBody: params.get("body") === "1",
		titleContains: params.get("title") ?? "",
		slugContains: params.get("slug") ?? "",
		statuses,
		hasChanges: params.get("changes") === "1",
		scheduled: params.get("scheduled") === "1",
		tagIds: params.getAll("tag"),
		categoryIds: params.getAll("category"),
		locales: [...new Set(params.getAll("locale"))].filter(isLocale),
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

/** 검색·필터·정렬을 URL 질의로 쓴다. */
function appendFilterParams(params: URLSearchParams, state: ListState) {
	const set = (key: string, value: string, fallback: string) => {
		if (value !== fallback) params.set(key, value);
	};
	set("search", state.search, "");
	if (state.includeBody) params.set("body", "1");
	set("title", state.titleContains, "");
	set("slug", state.slugContains, "");
	for (const status of state.statuses) params.append("status", status);
	if (state.hasChanges) params.set("changes", "1");
	if (state.scheduled) params.set("scheduled", "1");
	for (const id of state.tagIds) params.append("tag", id);
	for (const id of state.categoryIds) params.append("category", id);
	for (const locale of state.locales) params.append("locale", locale);
	for (const key of DATE_KEYS) set(key, state[key], "");
	params.set("sortField", state.sortField);
	params.set("sortDirection", state.sortDirection);
}

/** 기본값과 같은 값은 URL에 쓰지 않는다. */
export function listStateToSearchParams(state: ListState): URLSearchParams {
	const params = new URLSearchParams({ collection: state.collection });
	if (state.folder !== "all") params.set("folder", state.folder);
	if (state.includeDescendants) params.set("descendants", "1");
	appendFilterParams(params, state);
	if (state.page !== 1) params.set("page", String(state.page));
	params.set("pageSize", String(state.pageSize));
	return params;
}

const seoulDayBoundary = (date: string, end: boolean) => {
	const parsed = parseSeoulDateTimeInput(`${date}T${end ? "23:59" : "00:00"}`);
	if (!parsed) return null;
	return end ? new Date(Date.parse(parsed) + 59_999).toISOString() : parsed;
};

/**
 * 목록 API(`GET /entries`) 질의. 같은 필터의 여러 값은 OR, 다른 필터끼리는 AND다.
 * `trash`면 휴지통 항목만 부른다(v2 A3 휴지통 화면).
 * 발행형 컬렉션(글·메모)은 번역 묶음당 한 줄로 부른다. 휴지통은 번역본 하나만 복구할 수 있게 항목별로 둔다.
 */
export function listStateToApiQuery(state: ListState, options: { trash?: boolean } = {}): URLSearchParams {
	const query = new URLSearchParams({
		collection: state.collection,
		sortField: state.sortField,
		sortDirection: state.sortDirection,
		page: String(state.page),
		pageSize: String(state.pageSize),
	});
	if (!options.trash && schemaOf(state.collection).workflow === "publish") query.set("group", "translation");
	if (!options.trash) {
		// 탐색 모드는 현재 위치에 바로 든 항목만, 검색·필터나 "하위 폴더 포함"은 현재 위치 아래 전체를 본다.
		const flat = !isExplorerMode(state);
		if (state.folder === "all") {
			if (!flat) query.set("folderId", "null");
		} else {
			query.set("folderId", state.folder);
			if (flat) query.set("includeDescendants", "true");
		}
	}
	if (state.search.trim()) query.set("search", state.search.trim());
	if (state.includeBody) query.set("includeBody", "true");
	if (state.titleContains.trim()) query.set("titleContains", state.titleContains.trim());
	if (state.slugContains.trim()) query.set("slugContains", state.slugContains.trim());
	if (options.trash) query.append("status", "trashed");
	else for (const status of state.statuses) query.append("status", status);
	if (state.hasChanges) query.set("hasChanges", "true");
	if (state.scheduled) query.set("scheduled", "true");
	for (const id of state.tagIds) query.append("tagId", id);
	for (const id of state.categoryIds) query.append("categoryId", id);
	for (const locale of state.locales) query.append("locale", locale);
	for (const key of DATE_KEYS) {
		if (!state[key]) continue;
		const boundary = seoulDayBoundary(state[key], key.endsWith("To"));
		if (boundary) query.set(key, boundary);
	}
	return query;
}

/** 검색을 뺀 헤더 필터 수. */
export const activeFilterCount = (state: ListState) =>
	[
		state.titleContains.trim(),
		state.slugContains.trim(),
		state.statuses.length > 0,
		state.hasChanges,
		state.scheduled,
		state.tagIds.length > 0,
		state.categoryIds.length > 0,
		state.locales.length > 0,
		...DATE_KEYS.map((key) => state[key]),
	].filter(Boolean).length;

/**
 * 폴더 탐색 모드: 검색·필터가 없고 "하위 폴더 포함"을 끄면, 파일 탐색기처럼 현재 위치의 하위 폴더와 바로 든 항목만 보여 준다.
 * 그 밖에는 현재 위치 아래의 모든 항목을 폴더 구분 없이 평평하게 보여 준다.
 */
export function isExplorerMode(state: ListState): boolean {
	return !state.search.trim() && activeFilterCount(state) === 0 && !state.includeDescendants;
}

/** 모든 검색·필터를 지운 상태(정렬·폴더·페이지 크기는 유지). */
export function clearFilters(state: ListState): ListState {
	return {
		...state,
		search: "",
		includeBody: false,
		titleContains: "",
		slugContains: "",
		statuses: [],
		hasChanges: false,
		scheduled: false,
		tagIds: [],
		categoryIds: [],
		locales: [],
		createdFrom: "",
		createdTo: "",
		updatedFrom: "",
		updatedTo: "",
		publishedFrom: "",
		publishedTo: "",
		page: 1,
	};
}
