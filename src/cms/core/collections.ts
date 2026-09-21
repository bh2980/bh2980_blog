export const COLLECTIONS = ["post", "memo", "category", "tag", "collection"] as const;
export type Collection = (typeof COLLECTIONS)[number];

export interface CollectionRelation {
	readonly field: string;
	readonly kind: "category" | "tag" | "entry";
}

export interface CollectionDefinition {
	readonly name: Collection;
	readonly label: string;
	readonly isRecord?: boolean;
	readonly fields: Readonly<Record<string, string>>;
	readonly relations?: readonly CollectionRelation[];
}

export const COLLECTION_DEFINITIONS: Record<Collection, CollectionDefinition> = {
	post: {
		name: "post",
		label: "게시글",
		fields: {
			title: "string",
			summary: "string",
			categoryId: "string",
			tagIds: "string[]",
			publishedAt: "string",
			policy: "string",
		},
		relations: [
			{ field: "categoryId", kind: "category" },
			{ field: "tagIds", kind: "tag" },
		],
	},
	memo: {
		name: "memo",
		label: "메모",
		fields: {
			title: "string",
			tagIds: "string[]",
			publishedAt: "string",
		},
		relations: [{ field: "tagIds", kind: "tag" }],
	},
	category: {
		name: "category",
		label: "카테고리",
		isRecord: true,
		fields: { title: "string" },
	},
	tag: {
		name: "tag",
		label: "태그",
		isRecord: true,
		fields: { title: "string" },
	},
	collection: {
		name: "collection",
		label: "모음집",
		isRecord: true,
		fields: {
			title: "string",
			itemIds: "string[]",
		},
		relations: [{ field: "itemIds", kind: "entry" }],
	},
};

/** 기존 SCHEMA와의 100% 호환용 필드 타입 맵 */
export const COLLECTION_FIELD_SCHEMAS: Record<Collection, Record<string, string>> = {
	post: { ...COLLECTION_DEFINITIONS.post.fields },
	memo: { ...COLLECTION_DEFINITIONS.memo.fields },
	category: { ...COLLECTION_DEFINITIONS.category.fields },
	tag: { ...COLLECTION_DEFINITIONS.tag.fields },
	collection: { ...COLLECTION_DEFINITIONS.collection.fields },
};

export function isCollection(val: unknown): val is Collection {
	return typeof val === "string" && (COLLECTIONS as readonly string[]).includes(val);
}
