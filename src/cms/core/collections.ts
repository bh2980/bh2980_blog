export const COLLECTIONS = ["post", "memo", "category", "tag", "collection"] as const;
export type Collection = (typeof COLLECTIONS)[number];

/**
 * §5.2 저장 방식. `publish`는 초안과 공개본을 나누고 명시적 발행으로 공개한다.
 * `record`는 작은 폼에서 명시적으로 저장하면 곧바로 현재 값(공개)에 반영한다.
 */
export type CollectionWorkflow = "publish" | "record";

export type FieldType = "string" | "string[]";

export interface CollectionRelation {
	readonly field: string;
	readonly kind: "category" | "tag" | "entry";
}

export interface CollectionDefinition {
	readonly name: Collection;
	readonly label: string;
	readonly workflow: CollectionWorkflow;
	readonly fields: Readonly<Record<string, FieldType>>;
	readonly relations?: readonly CollectionRelation[];
}

const SEO_FIELDS = {
	seoTitle: "string",
	seoDescription: "string",
	canonicalUrl: "string",
	ogImageId: "string",
} as const satisfies Record<string, FieldType>;

export const COLLECTION_DEFINITIONS: Readonly<Record<Collection, CollectionDefinition>> = {
	post: {
		name: "post",
		label: "게시글",
		workflow: "publish",
		fields: {
			title: "string",
			summary: "string",
			categoryId: "string",
			tagIds: "string[]",
			publishedAt: "string",
			policy: "string",
			/** `policy: deprecated`일 때 독자를 안내할 최신 글(§6.4 "대체 글 관계"). */
			replacementPostId: "string",
			...SEO_FIELDS,
		},
		relations: [
			{ field: "categoryId", kind: "category" },
			{ field: "tagIds", kind: "tag" },
			{ field: "replacementPostId", kind: "entry" },
		],
	},
	memo: {
		name: "memo",
		label: "메모",
		workflow: "publish",
		fields: {
			title: "string",
			tagIds: "string[]",
			publishedAt: "string",
			...SEO_FIELDS,
		},
		relations: [{ field: "tagIds", kind: "tag" }],
	},
	category: {
		name: "category",
		label: "카테고리",
		workflow: "record",
		fields: { title: "string" },
	},
	tag: {
		name: "tag",
		label: "태그",
		workflow: "record",
		fields: { title: "string" },
	},
	collection: {
		name: "collection",
		label: "모음집",
		workflow: "record",
		fields: {
			title: "string",
			summary: "string",
			itemIds: "string[]",
		},
		relations: [{ field: "itemIds", kind: "entry" }],
	},
};

export function isCollection(val: unknown): val is Collection {
	return typeof val === "string" && (COLLECTIONS as readonly string[]).includes(val);
}

/** 명시적 저장이 곧 공개 반영인 분류용 컬렉션인가(§5.2 record workflow). */
export function isRecordCollection(val: unknown): boolean {
	return isCollection(val) && COLLECTION_DEFINITIONS[val].workflow === "record";
}

/** 본문을 쓰고 초안/발행을 나누는 콘텐츠 컬렉션. */
export const CONTENT_COLLECTIONS = COLLECTIONS.filter((c) => COLLECTION_DEFINITIONS[c].workflow === "publish");
