import { describe, expect, it } from "vitest";
import { defineBlock } from "../define";
import { BUILTIN_BLOCKS } from "../definitions";
import { resolveBlocks } from "../resolve";

const card = defineBlock({
	name: "card",
	label: "카드",
	syntax: { kind: "container", directive: "card" },
	component: "Card",
	attributes: {},
	editor: { view: "node", insertable: true },
});

const names = (blocks: readonly { name: string }[]) => blocks.map((block) => block.name);

describe("사이트 설정의 본문 블록", () => {
	it("설정이 없으면 내장 블록을 모두 쓴다", () => {
		expect(names(resolveBlocks(undefined))).toEqual(names(BUILTIN_BLOCKS));
	});

	it("끈 블록과 그 자식 전용 블록을 빼고, 사용자 블록을 뒤에 더한다", () => {
		const blocks = names(resolveBlocks({ disable: ["tabs", "mermaid"], custom: [card] }));
		expect(blocks).not.toContain("tabs");
		expect(blocks).not.toContain("tab");
		expect(blocks).not.toContain("mermaid");
		expect(blocks).toContain("callout");
		expect(blocks.at(-1)).toBe("card");
	});

	it("다른 기능이 기대는 블록은 끌 수 없다", () => {
		expect(() => resolveBlocks({ disable: ["untranslated" as never] })).toThrow(/cannot be turned off/);
		expect(() => resolveBlocks({ disable: ["image" as never] })).toThrow(/cannot be turned off/);
	});

	it("사용자 블록의 이름·문법·컴포넌트·편집 방식·자식을 검사한다", () => {
		const bad = (patch: object) => resolveBlocks({ custom: [{ ...card, ...patch } as never] });
		expect(() => bad({ name: "Card" })).toThrow(/kebab/);
		expect(() => bad({ syntax: { kind: "text", directive: "card" } })).toThrow(/container or leaf/);
		expect(() => bad({ syntax: { kind: "container", directive: "other" } })).toThrow(/directive must equal/);
		expect(() => bad({ component: "card" })).toThrow(/PascalCase/);
		expect(() => bad({ name: "callout", syntax: { kind: "container", directive: "callout" } })).toThrow(/already used/);
		expect(() => bad({ component: "Callout" })).toThrow(/already used/);
		expect(() => bad({ editor: { view: "mark" } })).toThrow(/editor.view/);
		expect(() => bad({ children: { blocks: ["tab"] } })).toThrow(/custom block with this parent/);
	});
});

describe("사용자 블록 발행 검사", () => {
	// 예시 설정(`test/cms.config.ts`)의 사용자 블록 `notice`(단계 선택 값)·`embed`(주소 필수).
	const issuesOf = async (mdx: string) => {
		const { prepareSnapshot } = await import("../../core/snapshot");
		const snapshot = await prepareSnapshot({
			collection: "memo",
			slug: "custom-blocks",
			metadata: { title: "사용자 블록" },
			mdx,
		});
		return snapshot.issues.map((issue) => issue.code);
	};

	it("선택 값 밖의 속성과 빠진 필수 속성을 막는다", async () => {
		expect(await issuesOf(':::notice{level="danger"}\n본문\n:::\n')).toContain("invalid_block_attribute");
		expect(await issuesOf("::embed\n")).toContain("missing_block_attribute");
		expect(await issuesOf(':::notice{level="warn"}\n본문\n:::\n\n::embed{url="https://example.com"}\n')).toEqual([]);
	});
});
