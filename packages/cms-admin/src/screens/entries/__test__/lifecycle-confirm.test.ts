import { describe, expect, it } from "vitest";
import { LIFECYCLE_SUCCESS, lifecycleConfirm } from "../lifecycle-confirm";

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
			"이 글을 보관할까요? 공개가 종료됩니다. 공개본에서 이 글을 참조하는 콘텐츠가 2개 있습니다.",
		);
	});

	it("원문을 휴지통으로 보내면 휴지통에 없는 번역본 언어를 알린다", () => {
		const confirm = lifecycleConfirm("trash", source, []);
		expect(confirm).toEqual({
			title: "휴지통으로 이동",
			description: "이 글을 휴지통으로 이동할까요? 공개가 종료됩니다. EN 번역본도 함께 휴지통으로 이동합니다.",
			confirmLabel: "휴지통으로 이동",
			destructive: true,
		});
	});

	it("원문을 보관하면 번역본도 보관한다고 알린다", () => {
		expect(lifecycleConfirm("archive", source, []).description).toBe(
			"이 글을 보관할까요? 공개가 종료됩니다. 번역본도 함께 보관합니다.",
		);
	});

	it("번역본을 옮길 때는 묶음 안내가 없다", () => {
		expect(lifecycleConfirm("trash", translation, []).description).toBe(
			"이 번역본을 휴지통으로 이동할까요? 공개가 종료됩니다.",
		);
	});

	it("묻지 않는 전환도 끝나면 알릴 문구가 있다", () => {
		expect(LIFECYCLE_SUCCESS.unarchive).toBe("보관을 해제했습니다.");
		expect(LIFECYCLE_SUCCESS.restore).toBe("복원했습니다.");
	});
});
