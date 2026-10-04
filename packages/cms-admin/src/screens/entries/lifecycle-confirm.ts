import type { IncomingReferenceItem } from "@bh2980/cms/runtime";
import type { ConfirmRequest } from "../shared/confirm-dialog";
import { type EntryData, isTranslationEntry } from "./entry-form";

/** 편집 화면의 상태 전환(§5.3). */
export type LifecycleAction = "archive" | "unarchive" | "trash" | "restore";

/** 묻고 나서 하는 전환. 공개 글을 내리는 보관과 휴지통 이동만 묻는다. 보관 해제·복원은 바로 한다. */
export type ConfirmedLifecycleAction = Extract<LifecycleAction, "archive" | "trash">;

/** 전환의 이름. 버튼·"먼저 저장하세요" 안내가 같은 말을 쓴다. */
export const LIFECYCLE_LABEL: Record<LifecycleAction, string> = {
	archive: "보관",
	unarchive: "보관 해제",
	trash: "휴지통으로 이동",
	restore: "복원",
};

/** 전환이 끝난 뒤 알릴 문구. */
export const LIFECYCLE_SUCCESS: Record<LifecycleAction, string> = {
	archive: "보관했습니다.",
	unarchive: "보관을 해제했습니다.",
	trash: "휴지통으로 옮겼습니다.",
	restore: "복원했습니다.",
};

/**
 * 공개 글을 내리는 전환의 확인 문구. 공개본에서 이 글을 쓰는 곳이 있으면 함께 알리고(§6.1),
 * 원문을 옮기면 같은 묶음의 번역본도 함께 옮겨진다고 알린다(v2 B4).
 */
export function lifecycleConfirm(
	action: ConfirmedLifecycleAction,
	entry: Pick<EntryData, "id" | "translationGroupId" | "translations"> | null,
	incomingReferences: readonly Pick<IncomingReferenceItem, "state">[],
): Omit<ConfirmRequest, "onConfirm"> {
	const publishedUsers = incomingReferences.filter((item) => item.state === "published").length;
	const usageNote = publishedUsers > 0 ? ` 공개본에서 이 글을 참조하는 콘텐츠가 ${publishedUsers}개 있습니다.` : "";
	const isTranslation = entry !== null && isTranslationEntry(entry);
	const otherLocales =
		entry && !isTranslation
			? (entry.translations ?? [])
					.filter((member) => member.id !== entry.id && member.status !== "trashed")
					.map((member) => member.locale.toUpperCase())
			: [];
	const hasGroup = otherLocales.length > 0;
	const target = isTranslation ? "이 번역본을" : "이 글을";

	switch (action) {
		case "archive":
			return {
				title: LIFECYCLE_LABEL.archive,
				description: `${target} 보관할까요? 공개가 종료됩니다.${usageNote}${hasGroup ? " 번역본도 함께 보관합니다." : ""}`,
				confirmLabel: LIFECYCLE_LABEL.archive,
			};
		case "trash":
			return {
				title: LIFECYCLE_LABEL.trash,
				description: `${target} 휴지통으로 이동할까요? 공개가 종료됩니다.${usageNote}${hasGroup ? ` ${otherLocales.join("·")} 번역본도 함께 휴지통으로 이동합니다.` : ""}`,
				confirmLabel: LIFECYCLE_LABEL.trash,
				destructive: true,
			};
	}
}
