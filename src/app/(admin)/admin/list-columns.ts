import type { AdminListColumn, ListSortField } from "@bh2980/cms/core/api";
import { ADMIN_LIST_COLUMNS } from "@bh2980/cms/core/api";
import { isCollection, isRecordCollection } from "@bh2980/cms/core/collections";
import { schemaOf, storedField } from "@bh2980/cms/schema/derive";
import type { ListState } from "./list-state";

type DateFromKey = "createdFrom" | "updatedFrom" | "publishedFrom";
type DateToKey = "createdTo" | "updatedTo" | "publishedTo";

/** 컬럼 헤더 팝업이 보여 줄 필터 종류(v2 A1). */
export type ColumnFilter =
	| { kind: "text"; key: "titleContains" | "slugContains"; placeholder: string }
	| { kind: "status" }
	| { kind: "locale" }
	| { kind: "taxonomy"; key: "tagIds" | "categoryIds"; source: "tag" | "category" }
	| { kind: "date"; from: DateFromKey; to: DateToKey }
	| { kind: "none" };

export interface ColumnConfig {
	label: string;
	sortField?: ListSortField;
	filter: ColumnFilter;
}

/**
 * 컬럼별 라벨·정렬·필터를 정하는 한 곳. 헤더 팝업과 필터 칩이 이 표를 읽는다.
 * v2 B1(중앙 스키마)이 들어오면 컬렉션 스키마에서 이 표를 만든다.
 */
export const COLUMN_CONFIG: Record<AdminListColumn, ColumnConfig> = {
	title: {
		label: "제목",
		sortField: "title",
		filter: { kind: "text", key: "titleContains", placeholder: "제목에 포함된 글자" },
	},
	status: { label: "상태", filter: { kind: "status" } },
	locale: { label: "언어", filter: { kind: "locale" } },
	category: { label: "카테고리", filter: { kind: "taxonomy", key: "categoryIds", source: "category" } },
	tags: { label: "태그", filter: { kind: "taxonomy", key: "tagIds", source: "tag" } },
	updatedAt: {
		label: "수정일",
		sortField: "updatedAt",
		filter: { kind: "date", from: "updatedFrom", to: "updatedTo" },
	},
	publishedAt: {
		label: "발행일",
		sortField: "publishedAt",
		filter: { kind: "date", from: "publishedFrom", to: "publishedTo" },
	},
	createdAt: {
		label: "생성일",
		sortField: "createdAt",
		filter: { kind: "date", from: "createdFrom", to: "createdTo" },
	},
	slug: {
		label: "주소",
		sortField: "slug",
		filter: { kind: "text", key: "slugContains", placeholder: "주소에 포함된 글자" },
	},
	// 폴더는 사이드바 탐색으로 거른다.
	folder: { label: "폴더", filter: { kind: "none" } },
};

export const COLUMN_LABELS: Record<AdminListColumn, string> = Object.fromEntries(
	ADMIN_LIST_COLUMNS.map((column) => [column, COLUMN_CONFIG[column].label]),
) as Record<AdminListColumn, string>;

/**
 * 필드 컬럼 → 그 컬럼이 보여 주는 필드. 목록 API의 컬럼·필터 매개변수는 v1 그대로라
 * 이 표에 있는 필드만 목록 컬럼이 될 수 있다. 나머지 컬럼(상태·언어·날짜·폴더)은 콘텐츠 자체의 값이다.
 */
const FIELD_COLUMNS: Partial<Record<AdminListColumn, string>> = {
	title: "title",
	slug: "slug",
	category: "categoryId",
	tags: "tagIds",
};

const columnOf = (name: string): AdminListColumn | undefined =>
	(Object.keys(FIELD_COLUMNS) as AdminListColumn[]).find((column) => FIELD_COLUMNS[column] === name) ??
	((ADMIN_LIST_COLUMNS as readonly string[]).find((column) => column === name && !(column in FIELD_COLUMNS)) as
		| AdminListColumn
		| undefined);

/** 컬렉션에서 쓸 수 있는 컬럼과 기본 표시(§3.2). 컬렉션 정의(v2 B1)의 필드와 `list.columns`에서 만든다. */
export function columnsFor(collection: string): { available: AdminListColumn[]; defaults: AdminListColumn[] } {
	if (!isCollection(collection)) return { available: [...ADMIN_LIST_COLUMNS], defaults: ["title", "status"] };
	const schema = schemaOf(collection);
	const available = ADMIN_LIST_COLUMNS.filter((column) => {
		// record 컬렉션은 발행 없이 저장이 곧 공개다. 언어 열은 이름이 있는 언어를 보인다(v2 B4).
		if (column === "publishedAt") return schema.workflow === "publish";
		const field = FIELD_COLUMNS[column];
		return field === undefined || Object.hasOwn(schema.fields, field) || storedField(collection, field) !== undefined;
	});
	const defaults = schema.list.columns
		.map(columnOf)
		.filter((column): column is AdminListColumn => column !== undefined && available.includes(column));
	return { available, defaults };
}

/**
 * 이 컬렉션에서 실제로 쓸 수 있는 필터. record 컬렉션은 활성/휴지통뿐이고,
 * 휴지통 화면은 모든 항목이 휴지통 상태라 상태 필터가 없다.
 */
export function filterFor(collection: string, column: AdminListColumn, mode: "list" | "trash" = "list"): ColumnFilter {
	const filter = COLUMN_CONFIG[column].filter;
	if (filter.kind === "status" && (isRecordCollection(collection) || mode === "trash")) return { kind: "none" };
	// 분류 항목의 언어 열은 이름이 있는 언어를 보일 뿐이라 언어로 거르지 않는다.
	if (filter.kind === "locale" && isRecordCollection(collection)) return { kind: "none" };
	return filter;
}

/** 이 컬럼에 필터가 걸려 있는지. 숨긴 컬럼이어도 칩으로 계속 보인다. */
export function isColumnFiltered(state: ListState, filter: ColumnFilter): boolean {
	switch (filter.kind) {
		case "text":
			return state[filter.key].trim() !== "";
		case "status":
			return state.statuses.length > 0 || state.hasChanges || state.scheduled;
		case "taxonomy":
			return state[filter.key].length > 0;
		case "locale":
			return state.locales.length > 0;
		case "date":
			return Boolean(state[filter.from] || state[filter.to]);
		case "none":
			return false;
	}
}
