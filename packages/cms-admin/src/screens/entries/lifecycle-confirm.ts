import type { IncomingReferenceItem } from "@bh2980/cms/runtime";
import type { ConfirmRequest } from "../shared/confirm-dialog";
import { type EntryData, isTranslationEntry } from "./entry-form";

/** 편집 화면의 상태 전환(§5.3). */
export type LifecycleAction = "archive" | "unarchive" | "trash" | "restore";

/** 전환 확인창의 문구와 끝난 뒤 알릴 문구. */
export type LifecycleConfirm = Omit<ConfirmRequest, "onConfirm"> & { successMessage: string };

/**
 * 공개 상태가 바뀌는 전환의 확인 문구. 공개본에서 이 글을 쓰는 곳이 있으면 함께 알리고(§6.1),
 * 원문을 옮기면 같은 묶음의 번역본도 함께 옮겨진다고 알린다(v2 B4).
 */
export function lifecycleConfirm(
	action: LifecycleAction,
	entry: Pick<EntryData, "id" | "translationGroupId" | "translations"> | null,
	incomingReferences: readonly Pick<IncomingReferenceItem, "state">[],
): LifecycleConfirm {
	const publishedUsers = incomingReferences.filter((item) => item.state === "published").length;
	const usageNote =
		publishedUsers > 0 ? ` 이 글을 공개본에서 참조하는 콘텐츠가 ${publishedUsers}개 있습니다(속성 패널의 사용처).` : "";
	const otherLocales =
		entry && !isTranslationEntry(entry)
			? (entry.translations ?? [])
					.filter((member) => member.id !== entry.id && member.status !== "trashed")
					.map((member) => member.locale.toUpperCase())
			: [];
	const hasGroup = otherLocales.length > 0;

	switch (action) {
		case "archive":
			return {
				title: "보관",
				description: `공개가 종료되고 대기 중인 예약이 취소됩니다.${usageNote}${hasGroup ? " 번역본도 함께 보관합니다." : ""}`,
				confirmLabel: "보관",
				successMessage: "보관했습니다.",
			};
		case "unarchive":
			return {
				title: "보관 해제",
				description: "초안으로 돌아갑니다. 자동으로 다시 공개하지 않습니다.",
				confirmLabel: "보관 해제",
				successMessage: "보관을 해제했습니다.",
			};
		case "trash":
			return {
				title: "휴지통으로 이동",
				description: `공개가 종료되고 대기 중인 예약이 취소됩니다.${usageNote}${hasGroup ? ` 번역본(${otherLocales.join("·")})도 함께 휴지통으로 이동합니다.` : ""}`,
				confirmLabel: "휴지통으로 이동",
				destructive: true,
				successMessage: "휴지통으로 옮겼습니다.",
			};
		case "restore":
			return {
				title: "휴지통에서 복원",
				description: "초안으로 복원합니다. 다시 공개하려면 발행하세요.",
				confirmLabel: "복원",
				successMessage: "복원했습니다.",
			};
	}
}
