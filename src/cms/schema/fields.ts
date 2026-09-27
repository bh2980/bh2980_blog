/**
 * 컬렉션 필드 빌더(v2 B1). Keystatic의 `fields.*`처럼 코드 한 곳에서 필드를 정의한다.
 *
 * 필드 정의는 서버와 브라우저가 함께 쓰므로 **JSON으로 직렬화할 수 있는 값만** 가진다.
 * 함수·React 컴포넌트·비밀 값을 넣지 않는다. 입력 교체(`input`)와 입력 옆 버튼(`actions`)은 이름으로만
 * 가리키고, 실제 구현은 클라이언트 입력 등록부와 서버 액션 등록부에 둔다.
 */

/** 관계 대상 컬렉션. `collections.ts`의 `COLLECTIONS`와 같다(순환 import를 피하려고 여기 둔다). */
export type RelationTarget = "post" | "memo" | "category" | "tag" | "collection";

/**
 * 언어별 값인가(v2 B4). `true`는 언어마다 따로 가지고, `"inherit"`는 원문 값을 기본으로 물려받되 바꿀 수 있다.
 * 표시가 없으면 번역 묶음이 공통으로 쓴다.
 */
export type Localized = boolean | "inherit";

interface BaseField {
	readonly label: string;
	/** 입력 아래 도움말. */
	readonly description?: string;
	/** `"publish"`면 발행(record 컬렉션은 저장) 때 비어 있으면 안 된다. 초안 저장은 막지 않는다. */
	readonly required?: "publish";
	readonly localized?: Localized;
	/** 입력 옆 버튼. 서버 액션 등록부의 이름이다(v2 D1). */
	readonly actions?: readonly string[];
	/** 기본 입력 대신 쓸 클라이언트 입력 등록부의 이름. */
	readonly input?: string;
	/** 저장·검증만 하고 속성 패널에 입력을 그리지 않는다. 저장된 값은 그대로 둔다. */
	readonly hidden?: boolean;
}

export interface TextField extends BaseField {
	readonly kind: "text";
	readonly multiline?: boolean;
	/** 최대 글자 수(유니코드 코드 포인트). */
	readonly max?: number;
	readonly placeholder?: string;
}

/** 주소. 메타데이터가 아니라 콘텐츠의 slug 열에 저장한다. */
export interface SlugField extends BaseField {
	readonly kind: "slug";
	/** `제목에서` 버튼과 자동 생성이 읽는 필드. */
	readonly from?: string;
	readonly placeholder?: string;
}

export interface RelationField extends BaseField {
	readonly kind: "relation";
	readonly to: RelationTarget;
	readonly many?: boolean;
	/** 없는 대상을 입력 옆에서 바로 만든다(v2 B2). */
	readonly createInline?: boolean;
	/** 고를 때 공개된 대상만 보여 준다. */
	readonly publishedOnly?: boolean;
	/** 공개되지 않은 대상도 발행을 막지 않는다(모음집 항목, v1 §6.4). */
	readonly allowUnpublished?: boolean;
	/** 여러 개일 때 순서를 사용자가 정한다. */
	readonly ordered?: boolean;
	readonly placeholder?: string;
}

export interface DateTimeField extends BaseField {
	readonly kind: "datetime";
	/** 지금보다 늦은 값을 고르지 못하게 한다(예약 기능 우회 방지, v1 §5.5). */
	readonly pastOnly?: boolean;
}

export interface SelectField<Option extends string = string> extends BaseField {
	readonly kind: "select";
	/** 값 → 라벨. 선언 순서가 보이는 순서다. */
	readonly options: Readonly<Record<Option, string>>;
	readonly defaultValue: Option;
}

/**
 * 선택 값에 따라 딸린 필드가 생기는 필드. 선택 값은 이 필드 이름으로, 딸린 필드는 각자 이름으로
 * 메타데이터 최상위에 저장한다(v1 저장 형식 유지). 딸린 값은 조건이 맞을 때만 남긴다.
 */
export interface ConditionalField<Option extends string = string> extends Omit<BaseField, "label" | "required"> {
	readonly kind: "conditional";
	readonly label: string;
	readonly discriminant: SelectField<Option>;
	readonly values: { readonly [K in Option]?: Readonly<Record<string, ValueField>> };
}

/** 값 하나를 저장하는 필드. */
export type ValueField = TextField | RelationField | DateTimeField | SelectField;
export type Field = ValueField | SlugField | ConditionalField;
export type FieldKind = Field["kind"];

type Options<F extends { kind: string }> = Omit<F, "kind">;

export const fields = {
	text: <const O extends Options<TextField>>(options: O) => ({ kind: "text", ...options }) as const,
	slug: <const O extends Options<SlugField>>(options: O) => ({ kind: "slug", ...options }) as const,
	relation: <const O extends Options<RelationField>>(options: O) => ({ kind: "relation", ...options }) as const,
	datetime: <const O extends Options<DateTimeField>>(options: O) => ({ kind: "datetime", ...options }) as const,
	select: <const O extends Options<SelectField>>(options: O) => ({ kind: "select", ...options }) as const,
	conditional: <const D extends SelectField, const V extends ConditionalField["values"]>(discriminant: D, values: V) =>
		({
			kind: "conditional",
			label: discriminant.label,
			...(discriminant.description ? { description: discriminant.description } : {}),
			discriminant,
			values,
		}) as const,
};

/** 필드 값의 저장 형식. */
export type StorageType = "string" | "string[]";

export const storageTypeOf = (field: ValueField): StorageType =>
	field.kind === "relation" && field.many ? "string[]" : "string";

/** 저장 값의 TypeScript 타입. */
export type ValueOf<F> = F extends RelationField
	? F["many"] extends true
		? readonly string[]
		: string
	: F extends { readonly kind: "select"; readonly options: infer Options }
		? keyof Options & string
		: F extends TextField | DateTimeField
			? string
			: never;
