"use client";

export type BulkOp =
	| "tags.add"
	| "tags.remove"
	| "category.set"
	| "folder.move"
	| "archive"
	| "unarchive"
	| "trash"
	| "publish";
export type BulkItemResult =
	| { id: string; ok: true; version: number }
	| { id: string; ok: false; error: string };

export async function runBulk(
	op: BulkOp,
	items: { id: string; expectedVersion: number }[],
	params: { tagIds?: string[]; categoryId?: string | null; folderId?: string | null } = {},
): Promise<BulkItemResult[]> {
	const res = await fetch("/api/cms/v1/bulk", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ op, items, ...params }),
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.message || err.code || "일괄 작업 요청 실패");
	}
	const data = await res.json();
	return data.results as BulkItemResult[];
}

export const BULK_ERROR_LABEL: Record<string, string> = {
	conflict: "다른 곳에서 변경됨(버전 충돌)",
	not_found: "삭제되었거나 없음",
	invalid_input: "입력 오류",
	locked: "예약 중이라 수정 불가",
};
