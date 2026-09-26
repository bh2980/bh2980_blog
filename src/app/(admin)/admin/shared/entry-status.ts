import { formatSeoulDateTimeInput } from "@/libs/contents/published-at";

export type EntryStatus = "draft" | "published" | "archived" | "trashed";

export const STATUS_LABELS: Record<EntryStatus, string> = {
	draft: "초안",
	published: "발행됨",
	archived: "보관됨",
	trashed: "휴지통",
};

/**
 * 목록·편집 화면의 상태 문구(§5.3). 색상만으로 상태를 전달하지 않도록 항상 글자로 쓴다(§3.2).
 * 공개본과 다른 초안은 `발행됨 · 수정 중`, 대기 중인 예약은 `· 예약 <서울 시간>`을 붙인다.
 */
export function describeEntryStatus(entry: {
	status: EntryStatus;
	hasUnpublishedChanges?: boolean;
	scheduledAt?: string | Date | null;
}): string {
	let label = STATUS_LABELS[entry.status] ?? entry.status;
	if (entry.status === "published" && entry.hasUnpublishedChanges) label += " · 수정 중";
	if (entry.scheduledAt) {
		const when = formatSeoulDateTimeInput(entry.scheduledAt).replace("T", " ");
		label += ` · 예약 ${when}`;
	}
	return label;
}
