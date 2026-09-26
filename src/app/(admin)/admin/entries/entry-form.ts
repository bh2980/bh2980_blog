import { formatSeoulDateTimeInput, parseSeoulDateTimeInput } from "@/libs/contents/published-at";

/** 편집 화면이 다루는 초안 값. 발행에 영향을 주는 필드를 모두 담는다(§5.2). */
export interface EntryForm {
	title: string;
	slug: string;
	mdx: string;
	summary: string;
	/** `datetime-local` 입력값(서울 시간). 비면 발행 시각을 쓴다. */
	publishDate: string;
	categoryId: string | null;
	tagIds: string[];
	seoTitle: string;
	seoDescription: string;
	canonicalUrl: string;
	/** 게시글 정책(§5.3). */
	policy: "normal" | "evergreen" | "deprecated";
	/** `deprecated`일 때 안내할 대체 글(§6.4). */
	replacementPostId: string | null;
}

export const EMPTY_FORM: EntryForm = {
	title: "",
	slug: "",
	mdx: "",
	summary: "",
	publishDate: "",
	categoryId: null,
	tagIds: [],
	seoTitle: "",
	seoDescription: "",
	canonicalUrl: "",
	policy: "normal",
	replacementPostId: null,
};

export interface EntryData {
	id: string;
	collection: string;
	status: "draft" | "published" | "archived" | "trashed";
	version: number;
	folderId: string | null;
	publishedAt?: string;
	workingSlug: string | null;
	publishedSlug: string | null;
	working: { metadata: Record<string, unknown>; mdx: string };
	published?: { metadata: Record<string, unknown>; mdx: string };
	schedule?: {
		pending: ScheduleInfo | null;
		last: ScheduleInfo | null;
		runnerConfigured: boolean;
	};
}

export interface ScheduleInfo {
	id: string;
	status: "pending" | "completed" | "cancelled" | "failed";
	scheduledAt: string;
	completedAt: string | null;
	failureCode: string | null;
	failureDetail: string | null;
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

export function formFromEntry(entry: EntryData): EntryForm {
	const metadata = entry.working.metadata ?? {};
	return {
		title: text(metadata.title),
		slug: entry.workingSlug ?? "",
		mdx: entry.working.mdx ?? "",
		summary: text(metadata.summary),
		// 표시 발행일의 원천은 초안 메타데이터다. 없으면 이전 발행에서 정해진 값을 보여 준다(§5.5).
		publishDate: formatSeoulDateTimeInput(text(metadata.publishedAt) || entry.publishedAt || null),
		categoryId: text(metadata.categoryId) || null,
		tagIds: Array.isArray(metadata.tagIds) ? metadata.tagIds.filter((id): id is string => typeof id === "string") : [],
		seoTitle: text(metadata.seoTitle),
		seoDescription: text(metadata.seoDescription),
		canonicalUrl: text(metadata.canonicalUrl),
		policy: metadata.policy === "evergreen" || metadata.policy === "deprecated" ? metadata.policy : "normal",
		replacementPostId: text(metadata.replacementPostId) || null,
	};
}

/** 폼 값이 같은지 비교하는 지문. 복구본과 서버 저장본을 비교한다. */
export const formFingerprint = (form: EntryForm) => JSON.stringify(form);

/**
 * 폼 → 저장 메타데이터. 비운 선택 필드는 키를 지워 공개 화면이 기본값(제목·요약)으로 돌아가게 한다.
 * 컬렉션에 없는 필드는 넣지 않는다(서버가 허용 필드만 받는다).
 */
export function metadataFromForm(
	form: EntryForm,
	collection: string,
	base: Record<string, unknown> = {},
): { metadata: Record<string, unknown> } | { error: string } {
	const metadata: Record<string, unknown> = { ...base, title: form.title };
	const optional = (key: string, value: string | null, allowed: boolean) => {
		if (allowed && value?.trim()) metadata[key] = value.trim();
		else delete metadata[key];
	};
	const isPost = collection === "post";
	const isContent = isPost || collection === "memo";
	optional("summary", form.summary, isPost);
	optional("categoryId", form.categoryId, isPost);
	optional("seoTitle", form.seoTitle, isContent);
	optional("seoDescription", form.seoDescription, isContent);
	optional("canonicalUrl", form.canonicalUrl, isContent);
	// 정책은 기본값(`normal`)이면 새로 쓰지 않는다. 이미 저장된 값은 그대로 갱신한다.
	if (isPost && (form.policy !== "normal" || "policy" in base)) metadata.policy = form.policy;
	else delete metadata.policy;
	optional("replacementPostId", form.replacementPostId, isPost && form.policy === "deprecated");
	if (isContent && form.tagIds.length > 0) metadata.tagIds = form.tagIds;
	else delete metadata.tagIds;

	if (isContent && form.publishDate) {
		const publishedAt = parseSeoulDateTimeInput(form.publishDate);
		if (!publishedAt) return { error: "발행 일시를 확인하세요." };
		metadata.publishedAt = publishedAt;
	} else {
		delete metadata.publishedAt;
	}
	return { metadata };
}
