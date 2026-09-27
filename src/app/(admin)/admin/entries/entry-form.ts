import { isCollection } from "@/cms/core/collections";
import { type SchemaCollection, type StoredField, storedFields } from "@/cms/schema/derive";
import { formatSeoulDateTimeInput, parseSeoulDateTimeInput } from "@/libs/contents/published-at";

/** 폼 입력 하나의 값. 텍스트·한 개 관계·선택·날짜는 문자열(관계는 비면 `null`), 여러 개 관계는 배열이다. */
export type FormValue = string | string[] | null;

/**
 * 편집 화면이 다루는 초안 값(§5.2). 제목·주소·본문 외의 필드는 컬렉션 정의(v2 B1)에서 오며
 * 필드 이름을 키로 평평하게 둔다. 날짜 필드는 `datetime-local` 입력값(서울 시간)이다.
 */
export type EntryForm = { title: string; slug: string; mdx: string } & { [field: string]: FormValue };

/** 폼 일부 변경. 지정한 키만 바꾼다. */
export type EntryFormPatch = { readonly [field: string]: FormValue };

export const EMPTY_FORM: EntryForm = { title: "", slug: "", mdx: "" };

export interface EntryData {
	id: string;
	collection: string;
	status: "draft" | "published" | "archived" | "trashed";
	version: number;
	folderId: string | null;
	publishedAt?: string;
	workingSlug: string | null;
	publishedSlug: string | null;
	working: { metadata: Record<string, unknown>; mdx: string };
	published?: { metadata: Record<string, unknown>; mdx: string };
	schedule?: {
		pending: ScheduleInfo | null;
		last: ScheduleInfo | null;
		runnerConfigured: boolean;
	};
}

export interface ScheduleInfo {
	id: string;
	status: "pending" | "completed" | "cancelled" | "failed";
	scheduledAt: string;
	completedAt: string | null;
	failureCode: string | null;
	failureDetail: string | null;
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** 폼 값을 문자열로 읽는다. 없거나 배열이면 빈 문자열이다. */
export const formText = (form: EntryForm, name: string): string => text(form[name]);

/** 폼 값을 문자열 배열로 읽는다. */
export const formList = (form: EntryForm, name: string): string[] => {
	const value = form[name];
	return Array.isArray(value) ? value : [];
};

const fieldsOf = (collection: string): readonly StoredField[] =>
	isCollection(collection) ? storedFields(collection as SchemaCollection) : [];

/** 저장 값 → 입력 값. */
function toFormValue({ field }: StoredField, value: unknown): FormValue {
	switch (field.kind) {
		case "text":
			return text(value);
		case "relation":
			if (field.many) return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
			return text(value) || null;
		case "select":
			return typeof value === "string" && Object.hasOwn(field.options, value) ? value : field.defaultValue;
		case "datetime":
			return formatSeoulDateTimeInput(text(value) || null);
	}
}

export function formFromEntry(entry: EntryData): EntryForm {
	const metadata = entry.working.metadata ?? {};
	const form: EntryForm = { title: text(metadata.title), slug: entry.workingSlug ?? "", mdx: entry.working.mdx ?? "" };
	for (const stored of fieldsOf(entry.collection)) {
		if (stored.name === "title" || stored.field.hidden) continue;
		// 표시 발행일의 원천은 초안 메타데이터다. 없으면 이전 발행에서 정해진 값을 보여 준다(§5.5).
		const value =
			stored.name === "publishedAt" ? text(metadata.publishedAt) || entry.publishedAt : metadata[stored.name];
		form[stored.name] = toFormValue(stored, value);
	}
	return form;
}

/** 폼 값이 같은지 비교하는 지문. 복구본과 서버 저장본을 비교한다. */
export const formFingerprint = (form: EntryForm) => JSON.stringify(form);

/**
 * 폼 → 저장 메타데이터. 규칙은 컬렉션 정의에서 온다(v2 B1).
 *
 * - 필수 텍스트(제목)는 입력 그대로 저장한다. 선택 텍스트·관계는 비우면 키를 지워 공개 화면이 기본값으로 돌아가게 한다.
 * - 선택 필드는 기본값이면 새로 쓰지 않는다. 이미 저장된 값은 그대로 갱신한다.
 * - 조건부 필드에 딸린 값은 조건이 맞을 때만 남긴다.
 * - 입력을 그리지 않는 필드(`hidden`)는 저장된 값을 건드리지 않는다. 정의에 없는 키는 넣지 않는다.
 */
export function metadataFromForm(
	form: EntryForm,
	collection: string,
	base: Record<string, unknown> = {},
): { metadata: Record<string, unknown> } | { error: string } {
	const fields = fieldsOf(collection);
	const metadata: Record<string, unknown> = {};
	for (const { name } of fields) {
		if (Object.hasOwn(base, name)) metadata[name] = base[name];
	}
	const values: Record<string, FormValue> = { ...form };

	for (const { name, field, when } of fields) {
		if (field.hidden) continue;
		const active = !when || values[when.field] === when.value;
		const value = values[name];
		if (!active) {
			delete metadata[name];
			continue;
		}
		switch (field.kind) {
			case "text": {
				const raw = text(value);
				if (field.required) metadata[name] = raw;
				else if (raw.trim()) metadata[name] = raw.trim();
				else delete metadata[name];
				break;
			}
			case "relation":
				if (field.many) {
					if (Array.isArray(value) && value.length > 0) metadata[name] = value;
					else delete metadata[name];
				} else if (typeof value === "string" && value.trim()) metadata[name] = value.trim();
				else delete metadata[name];
				break;
			case "select": {
				const selected = typeof value === "string" && Object.hasOwn(field.options, value) ? value : field.defaultValue;
				if (selected !== field.defaultValue || Object.hasOwn(base, name)) metadata[name] = selected;
				else delete metadata[name];
				break;
			}
			case "datetime": {
				const raw = text(value);
				if (!raw) {
					delete metadata[name];
					break;
				}
				const iso = parseSeoulDateTimeInput(raw);
				if (!iso) return { error: `${field.label.replace(/\s*\(.*\)$/, "")} 값을 확인하세요.` };
				metadata[name] = iso;
				break;
			}
		}
	}
	return { metadata };
}
