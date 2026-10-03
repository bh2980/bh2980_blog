import type { Root } from "mdast";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { remarkFenceBlocksToMdx } from "../remark-fence-blocks";

// 예시 설정(`test/cms.config.ts`)은 블록 확장의 코드 펜스 블록 `mermaid`·`chart`를 쓴다.
const run = (body: string): Root => {
	const processor = unified().use(remarkParse).use(remarkMdx).use(remarkFenceBlocksToMdx);
	return processor.runSync(processor.parse(body)) as Root;
};

describe("코드 펜스 블록의 공개 렌더", () => {
	it("더한 블록의 언어는 그 렌더러로 바꾸고 코드를 `source`로 넘긴다", () => {
		const [node] = run("```Mermaid\ngraph TD\n  A --> B\n```\n").children;
		expect(node).toMatchObject({
			type: "mdxJsxFlowElement",
			name: "Mermaid",
			attributes: [{ type: "mdxJsxAttribute", name: "source", value: "graph TD\n  A --> B" }],
			children: [],
		});
	});

	it("다른 언어의 코드 블록은 그대로 둔다", () => {
		const [node] = run("```ts\nconst a = 1;\n```\n").children;
		expect(node).toMatchObject({ type: "code", lang: "ts" });
	});

	it("더한 블록의 렌더러 이름은 본문 JSX로도 받는다", () => {
		expect(analyze('<Chart source="chart bar" />\n').errors).toEqual([]);
		expect(analyze("<Unknown />\n").errors.map((error) => error.message)).toEqual([
			"허용되지 않은 JSX 요소입니다: Unknown",
		]);
	});
});

describe("더한 블록의 자식 개수", () => {
	it("정의의 최소·최대 개수를 벗어나면 막는다", () => {
		const one = '<Tabs>\n<Tab label="하나">\n첫째\n</Tab>\n</Tabs>\n';
		expect(analyze(one).errors.map((error) => error.message)).toEqual(["Tabs는 2~8개의 Tab만 허용합니다."]);
		const two = '<Tabs>\n<Tab label="하나">\n첫째\n</Tab>\n<Tab label="둘">\n둘째\n</Tab>\n</Tabs>\n';
		expect(analyze(two).errors).toEqual([]);
	});
});
