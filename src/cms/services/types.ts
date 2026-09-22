import type { Collection } from "../core/collections";
import type { CmsImageSource } from "../mdx/types";

export type Issue = {
	readonly code: string;
	readonly message?: string;
	/** 본문 위치를 알 수 있을 때만 채운다(이미지 경고 등). */
	readonly position?: { readonly line: number; readonly column: number };
};

export type { Collection };
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
	| {
			collection: "collection";
			slug: string | null;
			metadata: CollectionMetadata;
			mdx: string;
			folderId?: string | null;
	  };

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
	/** 본문 이미지 소스와 위치. 발행 전 검사가 비차단 경고를 만들 때 쓴다. */
	readonly imageSources: readonly CmsImageSource[];
};

export type ResolvedTargets = {
	targets: { id: string; isPublished: boolean; collection: string }[];
	/**
	 * 발행 전 검사의 이미지 경고가 미디어 상태를 본다.
	 * `status`·`storageKey`는 선택이다 — 호출자가 안 채우면 그 경고만 건너뛴다(차단하지 않는다).
	 */
	media: { id: string; status?: string; storageKey?: string | null }[];
};

export type WorkingCopy = {
	readonly collection: Collection;
	readonly slug: string | null;
	readonly metadata: { readonly [key: string]: unknown };
	readonly mdx: string;
	readonly version: number;
	readonly folderId: string | null;
};

export interface StorePort<T = unknown> {
	getWorkingReferences(params: { entryId: string }): Promise<Reference[]>;
	getWorking(params: { entryId: string }): Promise<WorkingCopy>;
	hasPendingSchedule(params: { entryId: string }): Promise<boolean>;
	archiveEntry(params: { id: string; expectedVersion: number }): Promise<{ version: number }>;
	unarchiveEntry(params: { id: string; expectedVersion: number }): Promise<{ version: number }>;
	trashEntry(params: { id: string; expectedVersion: number }): Promise<{ version: number }>;
	publishEntry(params: { id: string; expectedVersion: number }): Promise<{ version: number }>;

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
