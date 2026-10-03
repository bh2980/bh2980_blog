import { COLLECTIONS, CONTENT_COLLECTIONS, type Collection, isRecordCollection } from "../src/core/collections";
import { DEFAULT_LOCALE } from "../src/core/locales";
import { type StoredField, schemaOf, storedField, storedFields } from "../src/schema/derive";

/**
 * 설정과 상관없는 테스트(M10-1 재발 방지)가 쓰는 도우미. 컬렉션·필드 이름을 테스트에 적지 않고 지금 설정
 * (`@cms-config`)에서 찾는다. 같은 테스트가 블로그 예시 설정(`cms.config.ts`)과 다른 사이트 설정
 * (`other-site.config.ts`) 둘 다로 돈다. 라이브러리 약속인 제목 필드 `title`만 이름으로 쓴다.
 */

/** 본문이 있는 첫 발행 컬렉션. */
export const contentCollection: Collection = (() => {
	const found = CONTENT_COLLECTIONS.find((name) => schemaOf(name).body);
	if (!found) throw new Error("any-site: the config has no publish collection with a body");
	return found;
})();

/** 첫 분류용(record) 컬렉션. */
export const recordCollection: Collection = (() => {
	const found = COLLECTIONS.find((name) => isRecordCollection(name));
	if (!found) throw new Error("any-site: the config has no record collection");
	return found;
})();

export const defaultLocale = DEFAULT_LOCALE;

/** 제목 필드(라이브러리 약속상 이름은 `title`). */
export function titleFieldOf(collection: Collection) {
	const field = storedField(collection, "title")?.field;
	if (field?.kind !== "text") throw new Error(`any-site: ${collection} has no title text field`);
	return field;
}

/** 발행에 꼭 있어야 하는 저장 필드(조건부 필드 제외). */
export function requiredFields(collection: Collection): StoredField[] {
	return storedFields(collection).filter(
		({ field, when }) => !when && "required" in field && field.required === "publish",
	);
}

/** 처음 나오는 관계 필드(있으면). */
export function firstRelationField(collection: Collection): (StoredField & { to: Collection }) | undefined {
	for (const stored of storedFields(collection)) {
		if (stored.field.kind === "relation") return { ...stored, to: stored.field.to as Collection };
	}
	return undefined;
}

/** 처음 나오는 미디어 필드(있으면, `fields.media`). */
export function firstMediaField(collection: Collection): StoredField | undefined {
	return storedFields(collection).find((stored) => stored.field.kind === "media");
}

/** 미디어 필드가 있는 첫 컬렉션(본문이 있는 컬렉션 먼저). */
export const mediaFieldCollection: Collection | undefined = [
	...CONTENT_COLLECTIONS.filter((name) => schemaOf(name).body),
	...COLLECTIONS,
].find((name) => firstMediaField(name));

/**
 * 발행 필수값을 채운 메타데이터. 관계는 `relationTarget(대상 컬렉션)`이 돌려준 ID를 쓴다.
 * 텍스트는 `${이름표} value`, 선택은 첫 선택지다.
 */
export async function requiredMetadata(
	collection: Collection,
	title: string,
	relationTarget: (to: Collection) => Promise<string>,
): Promise<Record<string, string | string[]>> {
	const metadata: Record<string, string | string[]> = { title };
	for (const { name, field } of requiredFields(collection)) {
		if (name === "title") continue;
		if (field.kind === "text") metadata[name] = `${field.label} value`;
		else if (field.kind === "select") metadata[name] = Object.keys(field.options)[0] ?? "";
		else if (field.kind === "relation") {
			const id = await relationTarget(field.to as Collection);
			metadata[name] = field.many ? [id] : id;
		}
	}
	return metadata;
}
