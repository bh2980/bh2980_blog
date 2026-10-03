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

const diagram = defineBlock({
	name: "diagram",
	label: "다이어그램",
	syntax: { kind: "fence", lang: "diagram" },
	component: "Diagram",
	attributes: {},
	editor: { view: "node", insertable: true },
});

describe("사이트 설정의 본문 블록", () => {
	it("설정이 없으면 본체 블록만 쓴다", () => {
		expect(names(resolveBlocks(undefined))).toEqual(names(BUILTIN_BLOCKS));
		expect(names(BUILTIN_BLOCKS)).not.toContain("callout");
	});

	it("플러그인 블록 다음에 사이트 블록을 더한다", () => {
		const blocks = names(
			resolveBlocks({ plugins: [{ name: "diagram", blocks: [diagram] }, { name: "ai" }], blocks: [card] }),
		);
		expect(blocks.slice(-2)).toEqual(["diagram", "card"]);
		expect(blocks.slice(0, BUILTIN_BLOCKS.length)).toEqual(names(BUILTIN_BLOCKS));
	});

	it("더한 블록의 이름·문법·컴포넌트·편집 방식·자식을 검사한다", () => {
		const bad = (patch: object) => resolveBlocks({ blocks: [{ ...card, ...patch } as never] });
		expect(() => bad({ name: "Card" })).toThrow(/kebab/);
		expect(() => bad({ syntax: { kind: "text", directive: "card" } })).toThrow(/container, leaf or fence/);
		expect(() => bad({ syntax: { kind: "container", directive: "other" } })).toThrow(/directive must equal/);
		expect(() => bad({ component: "card" })).toThrow(/PascalCase/);
		expect(() => bad({ name: "image", syntax: { kind: "leaf", directive: "image" } })).toThrow(/already used/);
		expect(() => bad({ component: "Image" })).toThrow(/already used/);
		expect(() => bad({ editor: { view: "mark" } })).toThrow(/editor.view/);
		expect(() => bad({ children: { blocks: ["tab"] } })).toThrow(/added block with this parent/);
		expect(() => resolveBlocks({ blocks: [card, card] })).toThrow(/already used/);
	});

	it("코드 펜스 블록은 언어가 겹치지 않는다", () => {
		expect(() =>
			resolveBlocks({ blocks: [diagram, { ...diagram, name: "diagram-two", component: "DiagramTwo" }] }),
		).toThrow(/fence lang "diagram" is already used/);
		expect(() => resolveBlocks({ blocks: [{ ...diagram, syntax: { kind: "fence", lang: "Diagram" } }] })).toThrow(
			/lower-case/,
		);
	});

	it("자식 값 속성은 자식 블록에 그 속성이 있어야 한다", () => {
		const group = defineBlock({
			name: "group",
			label: "묶음",
			syntax: { kind: "container", directive: "group" },
			component: "Group",
			attributes: { first: { type: "string", label: "처음", childValue: "label" } },
			children: { blocks: ["item"] },
			editor: { view: "node" },
		});
		const item = defineBlock({
			name: "item",
			label: "항목",
			syntax: { kind: "container", directive: "item" },
			component: "Item",
			attributes: {},
			parent: "group",
			editor: { view: "node" },
		});
		expect(() => resolveBlocks({ blocks: [group, item] })).toThrow(/no child block has "label"/);
		const labeled = { ...item, attributes: { label: { type: "string" as const, label: "이름" } } };
		expect(names(resolveBlocks({ blocks: [group, labeled] })).slice(-2)).toEqual(["group", "item"]);
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
