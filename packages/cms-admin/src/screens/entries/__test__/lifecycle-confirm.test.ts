import { describe, expect, it } from "vitest";
import { lifecycleConfirm } from "../lifecycle-confirm";

const source = {
	id: "src",
	translationGroupId: "src",
	translations: [
		{ id: "src", locale: "ko", status: "published", isSource: true },
		{ id: "en-1", locale: "en", status: "draft", isSource: false },
		{ id: "ja-1", locale: "ja", status: "trashed", isSource: false },
	],
} as never;
const translation = { id: "en-1", translationGroupId: "src", translations: [] } as never;

describe("상태 전환 확인 문구", () => {
	it("공개본에서 쓰는 곳만 세어 알린다", () => {
		const confirm = lifecycleConfirm("archive", null, [
			{ state: "published" },
			{ state: "published" },
			{ state: "draft" },
		] as never);
		expect(confirm.description).toBe(
			"공개가 종료되고 대기 중인 예약이 취소됩니다. 이 글을 공개본에서 참조하는 콘텐츠가 2개 있습니다(속성 패널의 사용처).",
		);
	});

	it("원문을 휴지통으로 보내면 휴지통에 없는 번역본 언어를 알린다", () => {
		const confirm = lifecycleConfirm("trash", source, []);
		expect(confirm).toEqual({
			title: "휴지통으로 이동",
			description: "공개가 종료되고 대기 중인 예약이 취소됩니다. 번역본(EN)도 함께 휴지통으로 이동합니다.",
			confirmLabel: "휴지통으로 이동",
			destructive: true,
			successMessage: "휴지통으로 옮겼습니다.",
		});
	});

	it("원문을 보관하면 번역본도 보관한다고 알린다", () => {
		expect(lifecycleConfirm("archive", source, []).description).toBe(
			"공개가 종료되고 대기 중인 예약이 취소됩니다. 번역본도 함께 보관합니다.",
		);
	});

	it("번역본을 옮길 때는 묶음 안내가 없다", () => {
		expect(lifecycleConfirm("trash", translation, []).description).toBe("공개가 종료되고 대기 중인 예약이 취소됩니다.");
	});

	it("보관 해제와 복원은 공개 상태를 되살리지 않는다고 알린다", () => {
		expect(lifecycleConfirm("unarchive", source, [{ state: "published" }] as never)).toEqual({
			title: "보관 해제",
			description: "초안으로 돌아갑니다. 자동으로 다시 공개하지 않습니다.",
			confirmLabel: "보관 해제",
			successMessage: "보관을 해제했습니다.",
		});
		expect(lifecycleConfirm("restore", null, [])).toEqual({
			title: "휴지통에서 복원",
			description: "초안으로 복원합니다. 다시 공개하려면 발행하세요.",
			confirmLabel: "복원",
			successMessage: "복원했습니다.",
		});
	});
});
