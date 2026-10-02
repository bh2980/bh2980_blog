import { COLLECTIONS, isCollection } from "../core/collections";
import type { RelationTarget } from "../schema/derive";
import { schemaOf } from "../schema/derive";
import { type AiCheckKind, type AiSlot, SLOT_TARGETS } from "./definition";

/**
 * 대상 자리가 검사에 줄 수 있는 재료(v2 D). 검사 종류는 몇 개로 정해 두고, 자리는 재료만 알려 준다.
 * 서버(검사 실행)와 브라우저(검사 추가 목록)가 함께 쓴다.
 */
export interface TargetMaterial {
	/** 다른 항목이 이미 쓰는 값을 찾아볼 수 있다(주소 필드). */
	unique: boolean;
	/** 고를 수 있는 값 목록이 있다. `records`는 다른 컬렉션 항목, `select`는 필드의 선택 목록. */
	options: { kind: "records"; collection: RelationTarget } | { kind: "select" } | null;
	/** 결과를 실행해 볼 코드가 있다(코드 블록 규칙). */
	code: boolean;
	/** 결과와 비교할 원문 MDX가 있다(본문 번역). */
	structure: boolean;
}

const NONE: TargetMaterial = { unique: false, options: null, code: false, structure: false };

/** 필드 자리의 필드 정의. 컬렉션을 모르면 그 필드가 있는 첫 컬렉션의 정의를 쓴다. */
function fieldDefinition(target: string, collection?: string) {
	const candidates = collection && isCollection(collection) ? [collection] : COLLECTIONS;
	for (const name of candidates) {
		const field = schemaOf(name).fields[target];
		if (field) return field;
	}
	return undefined;
}

export function targetMaterial(slot: AiSlot, target: string, collection?: string): TargetMaterial {
	if (slot === "codeRules") return { ...NONE, code: true };
	if (slot === "body") return { ...NONE, structure: true };
	if (slot !== "field") return NONE;
	const field = fieldDefinition(target, collection);
	if (!field) return NONE;
	if (field.kind === "slug") return { ...NONE, unique: true };
	if (field.kind === "relation")
		return { ...NONE, options: { kind: "records", collection: field.to as RelationTarget } };
	if (field.kind === "select" || field.kind === "conditional") return { ...NONE, options: { kind: "select" } };
	return NONE;
}

/** 이 대상에서 고를 수 있는 검사. 형식·길이는 어디서나, 나머지는 재료가 있을 때만. */
export function availableChecks(slot: AiSlot, target: string, collection?: string): AiCheckKind[] {
	const material = targetMaterial(slot, target, collection);
	return [
		"pattern",
		"maxLength",
		...(material.unique ? (["unique"] as const) : []),
		...(material.options ? (["exists"] as const) : []),
		...(material.code ? (["regexRuns"] as const) : []),
		...(material.structure ? (["structure"] as const) : []),
	];
}

/** 알려진 대상인지(필드 자리는 컬렉션 정의에 있는 필드, 그 밖은 자리의 대상 목록). */
export const isKnownTarget = (slot: AiSlot, target: string) =>
	slot === "field" ? fieldDefinition(target) !== undefined : target in SLOT_TARGETS[slot];
