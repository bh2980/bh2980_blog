import { describe, expect, it } from "vitest";
import { type AiSharedStore, getSharedView, loadSharedTexts, updateShared } from "../shared";

/** 공통 문구 한 줄을 들고 있는 저장소. 버전이 다르면 막는다. */
function memoryStore(): AiSharedStore & { saved: unknown } {
	let row: { value: unknown; version: number } | null = null;
	return {
		get saved() {
			return row?.value;
		},
		getAiSettings: async () => row,
		saveAiSettings: async ({ expectedVersion, value }) => {
			if ((row?.version ?? 0) !== expectedVersion) throw new Error("conflict");
			row = { value, version: expectedVersion + 1 };
			return row.version;
		},
	};
}

// 예시 설정(`test/cms.config.ts`)의 공통 문구: `styleGuide`(기본값 빈 글).
describe("공통 문구(M8-4)", () => {
	it("고친 문구만 저장하고, 기본값과 같으면 지운다(되돌리기)", async () => {
		const store = memoryStore();
		expect((await getSharedView(store)).items).toEqual([
			{ key: "styleGuide", label: "문체 가이드", defaultText: "", text: "", overridden: false },
		]);
		const saved = await updateShared(store, 0, { texts: { styleGuide: "'~다'체" } });
		expect(saved.items[0]).toMatchObject({ text: "'~다'체", overridden: true });
		expect(await loadSharedTexts(store)).toEqual({ styleGuide: "'~다'체" });

		await updateShared(store, 1, { texts: { styleGuide: "" } });
		expect(store.saved).toEqual({});
	});

	it("정의에 없는 이름은 막는다", async () => {
		await expect(updateShared(memoryStore(), 0, { texts: { nope: "x" } })).rejects.toMatchObject({
			code: "ai_invalid_input",
		});
	});
});
