import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Root } from "mdast";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { describe, expect, it } from "vitest";
import { parseMdxAst } from "@/cms/mdx/parse";
import { remarkDemoteUnknownDirectives, remarkDirectivesToMdx } from "@/cms/mdx/remark-directives";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const DIRECTIVE_TYPES = ["containerDirective", "leafDirective", "textDirective"];

/**
 * directive 두 플러그인의 **순서**를 공개 체인과 같게 둔 최소 재현 체인이다(demote → 변환).
 * 공개 체인 전체(수식·차트·mermaid·breaks·gfm·toc)는 여기 없다 — 49편 실등가성은 실제
 * `MDX_REMARK_PLUGINS`를 쓰는 `directive-render.test.tsx`가 검사한다.
 */
const renderTree = (body: string): Root => {
	const processor = unified()
		.use(remarkParse)
		.use(remarkMdx)
		.use(remarkGfm)
		.use(remarkDirective)
		.use(remarkDemoteUnknownDirectives)
		.use(remarkDirectivesToMdx);

	const file = new VFile({ value: body });
	const tree = processor.parse(file);
	processor.runSync(tree, file);

	return tree as Root;
};

const collectDirectiveNames = (tree: Root): string[] => {
	const names: string[] = [];
	visit(tree, DIRECTIVE_TYPES, (node) => {
		names.push((node as { name?: string }).name ?? "");
	});
	return names;
};

const collectJsx = (
	tree: Root,
): {
	type: string;
	name: string | null;
	attributes: Record<string, string | null>;
	position?: { start?: { line?: number } };
}[] => {
	const found: {
		type: string;
		name: string | null;
		attributes: Record<string, string | null>;
		position?: { start?: { line?: number } };
	}[] = [];
	visit(tree, ["mdxJsxTextElement", "mdxJsxFlowElement"], (node) => {
		const element = node as {
			type: string;
			name?: string | null;
			attributes?: { name?: string; value?: unknown }[];
			position?: { start?: { line?: number } };
		};
		const attributes: Record<string, string | null> = {};
		for (const attribute of element.attributes ?? []) {
			if (!attribute.name) continue;
			attributes[attribute.name] = typeof attribute.value === "string" ? attribute.value : null;
		}
		found.push({ type: element.type, name: element.name ?? null, attributes, position: element.position });
	});
	return found;
};

const collectText = (tree: Root): string => {
	const parts: string[] = [];
	visit(tree, "text", (node) => {
		parts.push((node as { value: string }).value);
	});
	return parts.join("");
};

const corpusFiles = (): string[] => {
	const contents = path.join(ROOT, "src", "contents");
	return ["posts", "memos"].flatMap((kind) =>
		readdirSync(path.join(contents, kind))
			.filter((file) => file.endsWith(".mdx"))
			.map((file) => path.join(contents, kind, file)),
	);
};

describe("미등록 directive 되돌리기", () => {
	// 실측된 레거시 오탐 2건. 되돌리지 않으면 이 글자들이 조용히 사라진다.
	it.each([
		["openai/gpt-oss-120b:free를 쓴다.", ":free를"],
		["비율이 1:1로 맞는다.", ":1로"],
	])("%s → %s 를 본문 글자로 보존한다", (body, expected) => {
		const tree = parseMdxAst(body);

		expect(collectDirectiveNames(tree)).toEqual([]);
		expect(collectText(tree)).toContain(expected);
	});

	it("미등록 컨테이너는 안쪽까지 원문 그대로 보존한다", () => {
		const body = ":::unknown\n안쪽 :free를 그대로\n:::";
		const tree = parseMdxAst(body);

		expect(collectDirectiveNames(tree)).toEqual([]);
		expect(collectText(tree)).toBe(body);
	});
});

describe("등록 directive 처리", () => {
	it("CMS 분석 트리도 등록 이름을 MDX 요소로 바꾼다(참조 수집·검증이 한 shape에서 돈다)", () => {
		const tree = parseMdxAst(':::callout{title="제목"}\n본문\n:::');

		// 저장 문자열은 그대로이고, 분석기가 보는 트리만 공개 체인과 같은 모양이 된다.
		expect(collectDirectiveNames(tree)).toEqual([]);
		expect(collectJsx(tree)).toEqual([
			expect.objectContaining({ type: "mdxJsxFlowElement", name: "Callout", attributes: { title: "제목" } }),
		]);
	});

	it("분석 트리와 공개 렌더 트리가 같은 요소를 낸다", () => {
		const body = [
			':::text-align{align="center"}',
			"가운데 문단",
			":::",
			"",
			"문장 안의 :u[밑줄] 과 줄바꿈:br[] 다음",
			"",
			'::image{mediaId="abc" width="60%"}',
		].join("\n");

		expect(collectJsx(parseMdxAst(body))).toEqual(collectJsx(renderTree(body)));
	});

	it("공개 렌더는 등록 이름을 MDX 요소로 바꾼다", () => {
		const tree = renderTree(
			[
				':::text-align{align="center"}',
				"가운데 문단",
				":::",
				"",
				"문장 안의 :u[밑줄] 과 :sup[위]·:sub[아래] 그리고 줄바꿈:br[] 다음",
				"",
				'::image{mediaId="abc" alt="설명" width="60%"}',
			].join("\n"),
		);

		// demote가 먼저 돌았으므로 남은 directive 노드는 없다.
		expect(collectDirectiveNames(tree)).toEqual([]);

		const jsx = collectJsx(tree);
		expect(jsx.map((element) => element.name)).toEqual(["TextAlign", "u", "sup", "sub", "br", "Image"]);
		expect(jsx[0]).toMatchObject({ type: "mdxJsxFlowElement", attributes: { align: "center" } });
		expect(jsx[5]).toMatchObject({ type: "mdxJsxFlowElement", attributes: { mediaId: "abc", width: "60%" } });
	});

	it("변환한 요소가 directive의 본문 위치를 보존한다(경고·참조 위치)", () => {
		const body = ["첫 문단", "", "둘째 줄 :u[밑줄] 끝", "", '::image{mediaId="abc"}'].join("\n");
		const jsx = collectJsx(parseMdxAst(body));

		// 위치를 복사하지 않으면 이미지 경고·미디어 참조 위치가 늘 1:1로 보고된다.
		expect(jsx.find((element) => element.name === "Image")).toMatchObject({ position: { start: { line: 5 } } });
		expect(jsx.find((element) => element.name === "u")).toMatchObject({ position: { start: { line: 3 } } });
	});

	it("불리언 거짓은 속성을 만들지 않는다('false'가 truthy가 되는 함정 회피)", () => {
		const [withFalse] = collectJsx(renderTree('::image{mediaId="abc" decorative="false"}'));
		const [withTrue] = collectJsx(renderTree('::image{mediaId="abc" decorative}'));
		const [withLiteralTrue] = collectJsx(renderTree('::image{mediaId="abc" decorative="true"}'));

		expect(withFalse.attributes).not.toHaveProperty("decorative");
		expect(withTrue.attributes).toMatchObject({ decorative: null });
		expect(withLiteralTrue.attributes).toMatchObject({ decorative: null });
	});
});

describe("레거시 코퍼스 불변식", () => {
	const files = corpusFiles();

	it("49편을 모두 파싱한다", () => {
		expect(files.length).toBe(49);
	});

	it("미등록 이름이 directive로 남지 않는다(0건)", () => {
		const offenders: string[] = [];
		for (const file of files) {
			const names = collectDirectiveNames(parseMdxAst(readFileSync(file, "utf8")));
			if (names.length > 0) offenders.push(`${path.relative(ROOT, file)}: ${names.join(", ")}`);
		}

		expect(offenders).toEqual([]);
	});

	it("실측된 오탐 2건이 본문에 그대로 남아 있다", () => {
		const free = readFileSync(path.join(ROOT, "src/contents/posts/블로그를-검색하는-벡터-rag-만들기.mdx"), "utf8");
		const ratio = readFileSync(
			path.join(ROOT, "src/contents/posts/코드-블럭에-툴팁을-띄우고-싶었을-뿐인데.mdx"),
			"utf8",
		);

		expect(collectText(parseMdxAst(free))).toContain(":free를");
		expect(collectText(parseMdxAst(ratio))).toContain(":1로");
	});
});
