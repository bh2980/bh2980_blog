export type Issue = {
	readonly code: string;
	readonly message?: string;
};

export type Collection = "post" | "memo" | "category" | "tag" | "collection";
export type ReferenceKind = "entry" | "media" | "category" | "tag";

export type ReferenceOccurrence =
	| { readonly type: "mdx"; readonly line: number; readonly column: number }
	| { readonly type: "metadata"; readonly path: string; readonly ordinal?: number };

export type Reference = {
	readonly kind: ReferenceKind;
	readonly targetId: string;
	readonly isStale: boolean;
	readonly occurrences: readonly ReferenceOccurrence[];
};

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type PostMetadata = {
	title?: string;
	summary?: string;
	categoryId?: string;
	tagIds?: readonly string[];
	publishedAt?: string;
	policy?: string;
};
export type MemoMetadata = { title?: string; tagIds?: readonly string[]; publishedAt?: string };
export type CategoryMetadata = { title?: string };
export type TagMetadata = { title?: string };
export type CollectionMetadata = { title?: string; itemIds?: readonly string[] };

export type ServiceInput =
	| { collection: "post"; slug: string | null; metadata: PostMetadata; mdx: string; folderId?: string | null }
	| { collection: "memo"; slug: string | null; metadata: MemoMetadata; mdx: string; folderId?: string | null }
	| { collection: "category"; slug: string | null; metadata: CategoryMetadata; mdx: string; folderId?: string | null }
	| { collection: "tag"; slug: string | null; metadata: TagMetadata; mdx: string; folderId?: string | null }
	| { collection: "collection"; slug: string | null; metadata: CollectionMetadata; mdx: string; folderId?: string | null };

export type SaveDraftInput = ServiceInput extends infer U
	? U extends { collection: Collection }
		? U & { expectedVersion: number; folderId?: string | null }
		: never
	: never;

export type PreparedSnapshot = {
	readonly collection: Collection;
	readonly slug: string | null;
	readonly metadata: { readonly [key: string]: string | readonly string[] };
	readonly mdx: string;
	readonly schemaVersion: number;
	readonly contentHash: string;
	readonly references: readonly Reference[];
	readonly issues: readonly Issue[];
};

export type ResolvedTargets = {
	targets: { id: string; isPublished: boolean; collection: string }[];
	media: { id: string }[];
};

export interface StorePort<T = unknown> {
	getWorkingReferences(params: { entryId: string }): Promise<Reference[]>;
	createEntryWithReferences(params: {
		snapshot: PreparedSnapshot;
		references: readonly Reference[];
		folderId?: string | null;
	}): Promise<T>;
	saveWorkingWithReferences(params: {
		entryId: string;
		expectedVersion: number;
		snapshot: PreparedSnapshot;
		references: readonly Reference[];
		folderId?: string | null;
	}): Promise<T>;
}

export class ServiceError extends Error {
	constructor(public readonly code: string) {
		super(code);
		this.name = "ServiceError";
	}
}
