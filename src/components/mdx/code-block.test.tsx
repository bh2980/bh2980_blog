import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Annotation } from "@/libs/remark/remark-code-block-annotation";
import type { AnnotationConfig, AnnotationRule, ResolvedAnnotation } from "./code-block";
import { DEFAULT_ANNOTATION_CONFIG, __testables } from "./code-block";
import { codeToTokens } from "shiki";

vi.mock("shiki", () => ({
	codeToTokens: vi.fn(),
}));

const codeToTokensMock = vi.mocked(codeToTokens);
const {
	buildPositionedTokens,
	splitTokensByBoundaries,
	normalizeAnnotations,
	buildAnnotationTree,
	splitTreeByLines,
	buildLineRanges,
	wrapLineWithAnnotations,
	renderTree,
	tokenizeAnnotatedCode,
	renderAnnotatedLines,
} = __testables;

describe("code-block internal helpers", () => {
	beforeEach(() => {
		codeToTokensMock.mockReset();
	});

	it("buildPositionedTokens가 토큰을 평탄화하고 개행 경계를 주입한다", () => {
		const code = "let a = 1\nconst b = 2";
		const codeblock = [
			[{ content: "let " }, { content: "a" }, { content: " = 1" }],
			[{ content: "const " }, { content: "b" }, { content: " = 2" }],
		];
		const tokens = buildPositionedTokens(codeblock, code);
		expect(tokens.map((token) => token.content).join("")).toBe(code);

		const newlineIndex = code.indexOf("\n");
		const newlineToken = tokens.find((token) => token.content === "\n");
		expect(newlineToken?.start).toBe(newlineIndex);
		expect(newlineToken?.end).toBe(newlineIndex + 1);
	});

	it("buildPositionedTokens는 개행이 없으면 개행 토큰을 추가하지 않는다", () => {
		const code = "const value = 42";
		const codeblock = [[{ content: "const " }, { content: "value" }, { content: " = 42" }]];
		const tokens = buildPositionedTokens(codeblock, code);
		expect(tokens.some((token) => token.content === "\n")).toBe(false);
	});

	it("splitTokensByBoundaries는 모든 경계에서 토큰을 분할한다", () => {
		const tokens = [{ content: "hello", start: 0, end: 5 }];
		const split = splitTokensByBoundaries(tokens, new Set([2, 4]));
		expect(split.map((token) => token.content)).toEqual(["he", "ll", "o"]);
		expect(split.map((token) => [token.start, token.end])).toEqual([
			[0, 2],
			[2, 4],
			[4, 5],
		]);
	});

	it("normalizeAnnotations는 규칙 순서를 따르고 잘못된 범위는 건너뛴다", () => {
		const annotations: Annotation[] = [
			{
				type: "mdxJsxTextElement",
				name: "Tooltip",
				attributes: [
					{ type: "mdxJsxAttribute", name: "content", value: "tip" },
				],
				start: 0,
				end: 2,
			},
			{ type: "strong", start: 2, end: 4 },
			{ type: "emphasis", start: 5, end: 5 },
		];

		const rules: AnnotationRule[] = [
			{
				kind: "mark",
				name: "first",
				match: (annotation) => annotation.type === "strong" || annotation.type === "mdxJsxTextElement",
				data: () => ({ source: "first" }),
			},
			{
				kind: "mark",
				name: "second",
				match: () => true,
			},
		];

		const normalized = normalizeAnnotations(annotations, rules);
		expect(normalized).toHaveLength(2);
		expect(normalized[0].name).toBe("first");
		expect(normalized[0].order).toBe(0);
		expect(normalized[0].data).toEqual({ source: "first" });
		expect(normalized[1].name).toBe("first");
		expect(normalized[1].order).toBe(0);
	});

	it("buildAnnotationTree와 splitTreeByLines는 줄을 넘어도 mark 래핑을 유지한다", () => {
		const code = "ab\ncd";
		const codeblock = [[{ content: "ab" }], [{ content: "cd" }]];
		const positioned = buildPositionedTokens(codeblock, code);
		const markAnnotation: ResolvedAnnotation = {
			kind: "mark",
			start: 0,
			end: code.length,
			raw: { type: "strong", start: 0, end: code.length },
			order: 0,
		};

		const tree = buildAnnotationTree(positioned, [markAnnotation], code.length);
		const lines = splitTreeByLines(tree);

		expect(lines).toHaveLength(2);
		expect(lines[0][0].kind).toBe("mark");
		expect(lines[0][0].children[0].kind).toBe("token");
		expect(lines[0][0].children[0].token.content).toBe("ab");
		expect(lines[1][0].kind).toBe("mark");
		expect(lines[1][0].children[0].token.content).toBe("cd");
	});

	it("buildLineRanges는 마지막 개행을 포함한 범위를 만든다", () => {
		const code = "a\nb\n";
		const ranges = buildLineRanges(code);
		expect(ranges).toEqual([
			{ start: 0, end: 1 },
			{ start: 2, end: 3 },
			{ start: 4, end: 4 },
		]);
	});

	it("wrapLineWithAnnotations는 규칙 인덱스 순으로 래퍼를 적용한다", () => {
		const Wrapper = (name: string) => ({ children }: { children: ReactNode }) => (
			<span data-name={name}>{children}</span>
		);

		const wrappers: ResolvedAnnotation[] = [
			{
				kind: "wrapper",
				start: 0,
				end: 10,
				raw: { type: "text", start: 0, end: 10 },
				order: 1,
				wrap: Wrapper("outer-second"),
			},
			{
				kind: "wrapper",
				start: 0,
				end: 10,
				raw: { type: "text", start: 0, end: 10 },
				order: 0,
				wrap: Wrapper("outer-first"),
			},
		];

		const rendered = renderToStaticMarkup(<>{wrapLineWithAnnotations("X", wrappers, "line")}</>);
		expect(rendered).toBe(
			"<span data-name=\"outer-first\"><span data-name=\"outer-second\">X</span></span>",
		);
	});

	it("renderTree는 토큰 스타일을 병합하고 inline annotation을 전달받는다", () => {
		const inlineAnnotation: ResolvedAnnotation = {
			kind: "inline",
			start: 0,
			end: 2,
			raw: { type: "text", start: 0, end: 2 },
			order: 0,
		};
		const getTokenProps = vi.fn().mockReturnValue({ className: "token", style: { fontWeight: 700 } });

		const nodes = [
			{
				kind: "token",
				token: { content: "hi", start: 0, end: 2, color: "red" },
			},
		];

		const rendered = renderTree(nodes, "t", [inlineAnnotation], getTokenProps);
		const element = rendered[0] as ReactElement;

		expect(getTokenProps).toHaveBeenCalledWith({
			token: nodes[0].token,
			annotations: [inlineAnnotation],
		});
		expect(element.props.className).toBe("token");
		expect(element.props.style).toEqual({ color: "red", fontWeight: 700 });
	});

	it("tokenizeAnnotatedCode는 shiki의 토큰 메타데이터를 반환한다", async () => {
		codeToTokensMock.mockResolvedValue({
			tokens: [[{ content: "ab" }]],
			fg: "#fff",
			bg: "#000",
		});

		const result = await tokenizeAnnotatedCode({
			code: "ab",
			lang: "javascript",
			annotationList: [],
			annotationConfig: DEFAULT_ANNOTATION_CONFIG,
		});

		expect(result.tokenMeta).toEqual({ fg: "#fff", bg: "#000" });
		expect(result.lines).toHaveLength(1);
	});

	it("renderAnnotatedLines는 라인/래퍼/인라인 속성을 모두 적용한다", () => {
		const wrapper: ResolvedAnnotation = {
			kind: "wrapper",
			start: 0,
			end: 2,
			raw: { type: "text", start: 0, end: 2 },
			order: 0,
			wrap: ({ children }: { children: ReactNode }) => <span data-wrap="yes">{children}</span>,
		};

		const lines = [
			[
				{
					kind: "token",
					token: { content: "ab", start: 0, end: 2 },
				},
			],
			[
				{
					kind: "token",
					token: { content: "cd", start: 3, end: 5 },
				},
			],
		];

		const lineRanges = [
			{ start: 0, end: 2 },
			{ start: 3, end: 5 },
		];

		const inlineAnnotations: ResolvedAnnotation[] = [
			{
				kind: "inline",
				start: 0,
				end: 2,
				raw: { type: "text", start: 0, end: 2 },
				order: 0,
			},
		];

		const blockAnnotations: ResolvedAnnotation[] = [
			{
				kind: "block",
				start: 0,
				end: 2,
				raw: { type: "text", start: 0, end: 2 },
				order: 0,
			},
		];

		const config: AnnotationConfig = {
			rules: [],
			getLineProps: ({ blockAnnotations: blocks }) => ({
				"data-block-count": String(blocks.length),
				className: blocks.length ? "has-block" : undefined,
			}),
			getTokenProps: ({ annotations }) => ({
				"data-inline-count": String(annotations.length),
			}),
		};

		const rendered = renderToStaticMarkup(
			<>
				{renderAnnotatedLines({
					lines,
					lineRanges,
					useLineNumber: true,
					inlineAnnotations,
					blockAnnotations,
					wrapperAnnotations: [wrapper],
					config,
				})}
			</>,
		);

		const expected =
			"<span class=\"line has-block\" data-block-count=\"1\"><span data-wrap=\"yes\"><span data-inline-count=\"1\">ab</span></span>\n</span><span class=\"line\" data-block-count=\"0\"><span data-inline-count=\"0\">cd</span></span>";
		expect(rendered).toBe(expected);
	});

	it("inline/mark/block/wrapper가 well-nested로 겹칠 때 렌더링이 유지된다", () => {
		const code = "abcd";
		const codeblock = [[{ content: "abcd" }]];
		const positioned = buildPositionedTokens(codeblock, code);

		const Mark = (name: string) => ({ children }: { children: ReactNode }) => (
			<span data-mark={name}>{children}</span>
		);

		const annotations: ResolvedAnnotation[] = [
			{
				kind: "wrapper",
				start: 0,
				end: 4,
				raw: { type: "text", start: 0, end: 4 },
				order: 0,
				wrap: ({ children }: { children: ReactNode }) => <span data-wrap="line">{children}</span>,
			},
			{
				kind: "block",
				start: 0,
				end: 4,
				raw: { type: "text", start: 0, end: 4 },
				order: 0,
			},
			{
				kind: "mark",
				start: 0,
				end: 4,
				raw: { type: "strong", start: 0, end: 4 },
				order: 0,
				wrap: Mark("outer"),
			},
			{
				kind: "mark",
				start: 1,
				end: 3,
				raw: { type: "emphasis", start: 1, end: 3 },
				order: 1,
				wrap: Mark("inner"),
			},
			{
				kind: "inline",
				start: 2,
				end: 3,
				raw: { type: "text", start: 2, end: 3 },
				order: 0,
			},
		];

		const boundaries = new Set<number>();
		for (const annotation of annotations) {
			boundaries.add(annotation.start);
			boundaries.add(annotation.end);
		}

		const splitTokens = splitTokensByBoundaries(positioned, boundaries);
		const tree = buildAnnotationTree(
			splitTokens,
			annotations.filter((annotation) => annotation.kind === "mark"),
			code.length,
		);
		const lines = splitTreeByLines(tree);
		const lineRanges = buildLineRanges(code);

		const config: AnnotationConfig = {
			rules: [],
			getLineProps: ({ blockAnnotations }) => ({
				"data-block-count": String(blockAnnotations.length),
			}),
			getTokenProps: ({ annotations: inline }) => ({
				"data-inline-count": String(inline.length),
			}),
		};

		const rendered = renderToStaticMarkup(
			<>
				{renderAnnotatedLines({
					lines,
					lineRanges,
					useLineNumber: true,
					inlineAnnotations: annotations.filter((annotation) => annotation.kind === "inline"),
					blockAnnotations: annotations.filter((annotation) => annotation.kind === "block"),
					wrapperAnnotations: annotations.filter((annotation) => annotation.kind === "wrapper"),
					config,
				})}
			</>,
		);

		const expected =
			"<span class=\"line\" data-block-count=\"1\"><span data-wrap=\"line\"><span data-mark=\"outer\"><span data-inline-count=\"0\">a</span><span data-mark=\"inner\"><span data-inline-count=\"0\">b</span><span data-inline-count=\"1\">c</span></span><span data-inline-count=\"0\">d</span></span></span></span>";
		expect(rendered).toBe(expected);
	});
});
