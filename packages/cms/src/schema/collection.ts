import type { BacklinkField, Field, SlugField, ValueField, ValueOf } from "./fields";

/**
 * §5.2 저장 방식. `publish`는 초안과 공개본을 나누고 명시적 발행으로 공개한다.
 * `record`는 작은 폼에서 명시적으로 저장하면 곧바로 현재 값(공개)에 반영한다.
 */
export type CollectionWorkflow = "publish" | "record";

/** 목록의 시스템 컬럼. 필드가 아니라 콘텐츠 자체의 값이다. */
export const SYSTEM_LIST_COLUMNS = ["status", "locale", "updatedAt", "createdAt", "publishedAt", "folder"] as const;
export type SystemListColumn = (typeof SYSTEM_LIST_COLUMNS)[number];

export interface LayoutGroup<Name extends string = string> {
	/** 속성 패널의 묶음 제목. 없으면 제목 없이 이어 그린다. */
	readonly group?: string;
	readonly fields: readonly Name[];
	/** 처음에 접어 둔다. */
	readonly collapsed?: boolean;
	/**
	 * 편집 화면 속성 칸에서 이 묶음을 그릴 탭 이름. 같은 이름의 묶음은 한 탭에 모이고, 없으면 기본 탭(`속성`)에 그린다.
	 */
	readonly tab?: string;
	/**
	 * 묶음 위에 그릴 미리보기 이름. 본체는 `search`(검색 결과·공유 미리보기, 값은 필드 역할 `seoTitle`·`seoDescription`·
	 * `ogImage`·`noindex`, 없으면 제목·`summary` 역할)를 준다. 다른 이름은 관리자 확장의 `groupPreviews`로 더한다.
	 */
	readonly preview?: string;
}

export interface CollectionSchema<
	Fields extends Readonly<Record<string, Field>> = Readonly<Record<string, Field>>,
	Workflow extends CollectionWorkflow = CollectionWorkflow,
> {
	readonly label: string;
	readonly workflow: Workflow;
	/** 본문(MDX)을 가지는가. `publish` 컬렉션만 본문을 쓴다. */
	readonly body: boolean;
	/**
	 * 필드 이름 → 정의. 꼭 `title` 텍스트 필드(`fields.text`)가 있어야 한다(`defineConfig`가 확인한다). 목록·검색·
	 * 관계 고르기·본문 링크·편집 화면 제목 칸이 이 필드를 쓴다.
	 */
	readonly fields: Fields;
	/**
	 * 공개 주소 모양(예: `/posts/:slug`). `:slug`를 꼭 한 번 쓴다. 본문의 내부 링크를 알아보고(발행 전 검사),
	 * 편집기가 링크를 만들 때 쓴다. 없으면 이 컬렉션은 본문 링크로 가리킬 수 없다.
	 */
	readonly path?: string;
	/**
	 * 관리자 사이드바 아이콘 이름(lucide, 예: `file-text`·`notebook-pen`·`tag`·`shapes`·`layers`·`folder`·`image`).
	 * 없거나 모르는 이름이면 저장 방식에 맞는 기본 아이콘이다.
	 */
	readonly icon?: string;
	/** 속성 패널 배치. 적지 않은 필드는 마지막 묶음 뒤에 선언 순서대로 그린다. */
	readonly layout?: readonly LayoutGroup[];
	readonly list: {
		/** 기본으로 보이는 목록 컬럼. 필드 이름 또는 시스템 컬럼. */
		readonly columns: readonly string[];
	};
}

/** 컬렉션을 정의한다. 배치·목록 컬럼에 적은 이름이 실제 필드인지 타입으로 확인한다. */
export function defineCollection<
	const Fields extends Readonly<Record<string, Field>>,
	const Workflow extends CollectionWorkflow,
>(
	schema: Omit<CollectionSchema<Fields, Workflow>, "body" | "layout" | "list" | "path"> & {
		path?: `/${string}:slug${string}`;
		body?: boolean;
		layout?: readonly LayoutGroup<Extract<keyof Fields, string>>[];
		list: { columns: readonly (Extract<keyof Fields, string> | SystemListColumn)[] };
	},
): CollectionSchema<Fields, Workflow> {
	return { ...schema, body: schema.body ?? schema.workflow === "publish" };
}

type Stored<Fields> = {
	[K in keyof Fields as Fields[K] extends SlugField | BacklinkField ? never : K]: Fields[K];
};

/** 조건부 필드에 딸린 필드를 최상위로 펼친다(저장 형식과 같다). */
type Nested<Fields> = {
	[K in keyof Fields]: Fields[K] extends { readonly kind: "conditional"; readonly values: infer V }
		? V[keyof V] extends infer Group
			? Group extends Readonly<Record<string, ValueField>>
				? Group
				: never
			: never
		: never;
}[keyof Fields];

type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void
	? I
	: never;

type FieldValue<F> = F extends { readonly kind: "conditional"; readonly discriminant: infer D }
	? ValueOf<D>
	: ValueOf<F>;

/**
 * 컬렉션 정의에서 만든 메타데이터 타입. 초안은 비어 있을 수 있으므로 모든 키가 선택이다.
 */
export type MetadataOf<S extends CollectionSchema> = {
	-readonly [K in keyof Stored<S["fields"]>]?: FieldValue<S["fields"][K]>;
} & {
	-readonly [K in keyof UnionToIntersection<Nested<S["fields"]>>]?: ValueOf<
		UnionToIntersection<Nested<S["fields"]>>[K]
	>;
};
