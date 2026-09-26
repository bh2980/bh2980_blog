import type { CmsImageSource } from "../mdx/types";
import type { Collection } from "./collections";

/**
 * CMS 도메인 타입. 저장소 구현·서비스·HTTP 계층이 함께 쓰며 어떤 계층에도 의존하지 않는다.
 */

export type Issue = {
	readonly code: string;
	readonly message?: string;
	/** 본문 문제의 위치. */
	readonly position?: { readonly line: number; readonly column: number };
	/** 메타데이터 문제의 필드 경로. */
	readonly path?: string;
	readonly ordinal?: number;
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
	replacementPostId?: string;
};
export type MemoMetadata = { title?: string; tagIds?: readonly string[]; publishedAt?: string };
export type CategoryMetadata = { title?: string };
export type TagMetadata = { title?: string };
export type CollectionMetadata = { title?: string; summary?: string; itemIds?: readonly string[] };

type InputFor<C extends Collection, M> = {
	collection: C;
	slug: string | null;
	metadata: M;
	mdx: string;
	folderId?: string | null;
};

export type ServiceInput =
	| InputFor<"post", PostMetadata>
	| InputFor<"memo", MemoMetadata>
	| InputFor<"category", CategoryMetadata>
	| InputFor<"tag", TagMetadata>
	| InputFor<"collection", CollectionMetadata>;

export type SaveDraftInput = ServiceInput & { expectedVersion: number };

export type InternalLinkSource = {
	readonly collection: "post" | "memo";
	readonly slug: string;
	readonly url: string;
	readonly position: { readonly line: number; readonly column: number };
};

export type ResolvedInternalLink = {
	readonly collection: "post" | "memo";
	readonly slug: string;
	readonly addressType: "current" | "alias" | "reservation" | "deleted" | "missing";
	readonly isPublished: boolean;
};

export type PreparedSnapshot = {
	readonly collection: Collection;
	readonly slug: string | null;
	readonly metadata: { readonly [key: string]: string | readonly string[] };
	readonly mdx: string;
	readonly schemaVersion: number;
	readonly contentHash: string;
	readonly references: readonly Reference[];
	/** 발행을 막는 문제. 초안 저장은 막지 않는다. */
	readonly issues: readonly Issue[];
	/** 발행을 막지 않는 안내(정의에 없는 블록 속성 등). */
	readonly warnings?: readonly Issue[];
	readonly internalLinks?: readonly InternalLinkSource[];
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
	internalLinks?: ResolvedInternalLink[];
};

export type WorkingCopy = {
	readonly collection: Collection;
	readonly slug: string | null;
	readonly metadata: { readonly [key: string]: unknown };
	readonly mdx: string;
	readonly version: number;
	readonly folderId: string | null;
};

export class ServiceError extends Error {
	constructor(
		public readonly code: string,
		public readonly issues?: readonly Issue[],
	) {
		super(code);
		this.name = "ServiceError";
	}
}
