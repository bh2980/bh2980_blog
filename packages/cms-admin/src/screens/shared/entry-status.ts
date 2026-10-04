export type EntryStatus = "draft" | "published" | "archived" | "trashed";

export const STATUS_LABELS: Record<EntryStatus, string> = {
	draft: "초안",
	published: "발행됨",
	archived: "보관됨",
	trashed: "휴지통",
};

/**
 * 목록·편집 화면의 상태 문구(§5.3). 색상만으로 상태를 전달하지 않도록 항상 글자로 쓴다(§3.2).
 * 공개본과 다른 초안은 `발행됨 · 수정 중`이다.
 */
export function describeEntryStatus(entry: { status: EntryStatus; hasUnpublishedChanges?: boolean }): string {
	let label = STATUS_LABELS[entry.status] ?? entry.status;
	if (entry.status === "published" && entry.hasUnpublishedChanges) label += " · 수정 중";
	return label;
}
