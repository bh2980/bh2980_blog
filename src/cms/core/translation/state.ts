import type { StoredUnit } from "./units";

/**
 * 번역본의 번역 상태(`entry_bodies.translation`, v3 §3.1). 원문은 `null`이다.
 * 번역본 MDX는 이 단위 목록과 원문 뼈대에서 만든 값이다.
 */
export interface TranslationState {
	readonly version: 1;
	readonly units: readonly StoredUnit[];
}

/** 번역 상태 크기 상한. 원문 조각과 번역을 함께 담아 본문 상한(2MiB)의 두 배로 둔다. */
export const MAX_TRANSLATION_BYTES = 4 * 1024 * 1024;
const MAX_UNITS = 5000;

const isUnit = (value: unknown): value is StoredUnit => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const unit = value as Record<string, unknown>;
	const keys = Object.keys(unit);
	return (
		keys.length === 3 &&
		typeof unit.key === "string" &&
		unit.key.length <= 500 &&
		typeof unit.source === "string" &&
		(unit.target === null || typeof unit.target === "string")
	);
};

/** 들어온 값을 번역 상태로 검증한다. 모양이 다르면 `null`이 아니라 오류로 본다(`undefined` 반환). */
export function parseTranslationState(value: unknown): TranslationState | null | undefined {
	if (value === null) return null;
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	const record = value as Record<string, unknown>;
	if (Object.keys(record).length !== 2 || record.version !== 1 || !Array.isArray(record.units)) return undefined;
	if (record.units.length > MAX_UNITS || !record.units.every(isUnit)) return undefined;
	if (new TextEncoder().encode(JSON.stringify(record)).length > MAX_TRANSLATION_BYTES) return undefined;
	return {
		version: 1,
		units: record.units.map((unit: StoredUnit) => ({ key: unit.key, source: unit.source, target: unit.target })),
	};
}
