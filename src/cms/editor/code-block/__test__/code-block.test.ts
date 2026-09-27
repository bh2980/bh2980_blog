import { Editor } from "@tiptap/core";
import type { DecorationSet } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { codeBlockConverter } from "../../converters/code-block";
import type { ConverterContext } from "../../converters/types";
import { CmsCodeBlock } from "../code-block-extension";
import { codeBlockHighlightPluginKey, getShikiHighlighter } from "../highlight-plugin";
import { handleEnterKey, handleModAKey, handlePaste, handleTabKey, isComposing } from "../keys";
import type { CodeBlockAnnotationItem } from "../types";

let editor: Editor | null = null;

const dummyCtx: ConverterContext = {
	blockToTiptap: () => ({}),
	tiptapBlockToCms: () => [],
	isMappableBlock: () => true,
	isMappableInline: () => true,
	inlineToTiptap: () => [],
	inlineToCms: () => [],
};

afterEach(() => {
	editor?.destroy();
	editor = null;
});

const createTestEditor = (code = "const a = 1;", attrs = {}) => {
	editor = new Editor({
		extensions: [StarterKit.configure({ codeBlock: false }), CmsCodeBlock],
		content: {
			type: "doc",
			content: [
				{
					type: "codeBlock",
					attrs: { language: "ts", ...attrs },
					content: code.length > 0 ? [{ type: "text", text: code }] : [],
				},
			],
		},
	});
	return editor;
};

describe("C5 코드 블록: 키보드 처리 및 IME 제외", () => {
	it("IME 조합 중에는 키 이벤트를 가로채지 않고 브라우저에 넘긴다", () => {
		const instance = createTestEditor();
		const view = instance.view;

		const fakeComposingEvent = { isComposing: true, keyCode: 229 } as unknown as KeyboardEvent;
		expect(isComposing(view, fakeComposingEvent)).toBe(true);

		const fakeNonComposingEvent = { isComposing: false, keyCode: 13 } as unknown as KeyboardEvent;
		expect(isComposing(view, fakeNonComposingEvent)).toBe(false);

		// IME 조합 중 실행 시 false 반환
		expect(handleEnterKey(view, fakeComposingEvent)).toBe(false);
		expect(handleTabKey(view, fakeComposingEvent, false)).toBe(false);
		expect(handleModAKey(view, fakeComposingEvent)).toBe(false);
	});

	it("Tab: 단일 커서 위치에서 탭 문자를 삽입한다", () => {
		const instance = createTestEditor("hello");
		const view = instance.view;

		// 'hello' 뒤(pos: 6)에 커서 위치
		instance.commands.setTextSelection(6);

		const tabEvent = new KeyboardEvent("keydown", { key: "Tab" });
		const handled = handleTabKey(view, tabEvent, false);

		expect(handled).toBe(true);
		expect(instance.state.doc.child(0).textContent).toBe("hello\t");
	});

	it("Tab/Shift-Tab: 여러 줄 선택 시 들여쓰기와 내어쓰기를 수행한다", () => {
		const multiline = "line1\nline2\nline3";
		const instance = createTestEditor(multiline);
		const view = instance.view;

		// line1부터 line2까지 선택 (pos 1부터 pos 12까지)
		instance.commands.setTextSelection({ from: 1, to: 12 });

		// Tab 들여쓰기
		const tabEvent = new KeyboardEvent("keydown", { key: "Tab" });
		expect(handleTabKey(view, tabEvent, false)).toBe(true);
		expect(instance.state.doc.child(0).textContent).toBe("\tline1\n\tline2\nline3");

		// Shift-Tab 내어쓰기
		const shiftTabEvent = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true });
		expect(handleTabKey(view, shiftTabEvent, true)).toBe(true);
		expect(instance.state.doc.child(0).textContent).toBe("line1\nline2\nline3");
	});

	it("Enter: 현재 줄의 들여쓰기를 다음 줄에도 유지한다", () => {
		const indented = "\t\tconst x = 10;";
		const instance = createTestEditor(indented);
		const view = instance.view;

		// 줄 끝으로 커서 이동
		instance.commands.setTextSelection(indented.length + 1);

		const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
		expect(handleEnterKey(view, enterEvent)).toBe(true);

		expect(instance.state.doc.child(0).textContent).toBe("\t\tconst x = 10;\n\t\t");
	});

	it("Mod-a: 코드 블록 밖의 문서를 포함하지 않고 코드 블록 안만 전체 선택한다", () => {
		editor = new Editor({
			extensions: [StarterKit.configure({ codeBlock: false }), CmsCodeBlock],
			content: {
				type: "doc",
				content: [
					{ type: "paragraph", content: [{ type: "text", text: "상단 문단" }] },
					{ type: "codeBlock", content: [{ type: "text", text: "코드1\n코드2" }] },
					{ type: "paragraph", content: [{ type: "text", text: "하단 문단" }] },
				],
			},
		});
		const view = editor.view;

		// 코드 블록 내부로 커서 이동
		// 상단 문단 크기: 1(open) + 4("상단 문단") + 1(close) = 6
		// 코드 블록 시작 pos: 7, 텍스트 시작: 8, 텍스트 끝: 15
		editor.commands.setTextSelection(9);

		const modAEvent = new KeyboardEvent("keydown", { key: "a", metaKey: true });
		expect(handleModAKey(view, modAEvent)).toBe(true);

		const { from, to } = editor.state.selection;
		expect(from).toBe(8);
		expect(to).toBe(15);
		expect(editor.state.doc.textBetween(from, to, "\n")).toBe("코드1\n코드2");
	});

	it("Paste: \\r\\n을 \\n으로 정규화하고 서식 없는 텍스트로만 붙여넣는다", () => {
		const instance = createTestEditor("");
		const view = instance.view;

		instance.commands.setTextSelection(1);

		const clipboardData = {
			getData: (type: string) => {
				if (type === "text/plain") return "line1\r\nline2\r\nline3";
				if (type === "text/html") return "<b>line1</b><p>line2</p>";
				return "";
			},
		};

		const pasteEvent = new Event("paste") as ClipboardEvent;
		Object.defineProperty(pasteEvent, "clipboardData", { value: clipboardData });

		expect(handlePaste(view, pasteEvent)).toBe(true);
		expect(instance.state.doc.child(0).textContent).toBe("line1\nline2\nline3");
	});
});

describe("C5 코드 블록: 주석 변환 및 바이트 불변", () => {
	it("주석 없는 일반 코드는 toTiptap → toCms 왕복 시 바이트 불변이다", () => {
		const raw = "const greeting = 'hello world';\nconsole.log(greeting);\n";
		const cmsNode = {
			type: "codeBlock",
			attrs: { language: "ts", meta: 'title="hello.ts"', value: raw },
		};

		const tiptapNode = codeBlockConverter.toTiptap(cmsNode, dummyCtx);
		expect(tiptapNode.attrs?.annotations).toEqual([]);
		expect(tiptapNode.attrs?.annotationsDisabled).toBe(false);

		const roundtrip = codeBlockConverter.toCms(tiptapNode, dummyCtx);
		expect(roundtrip).toHaveLength(1);
		expect(roundtrip[0]?.attrs?.value).toBe(raw);
		expect(roundtrip[0]?.attrs?.language).toBe("ts");
		expect(roundtrip[0]?.attrs?.meta).toBe('title="hello.ts"');
	});

	it("지원하지 않는 주석(@line collapse 등)은 원문 value를 그대로 두고 주석 UI를 비활성화한다", () => {
		const rawWithLineAnno = [
			'title="advanced.ts"',
			"// @line collapse",
			"function secret() {",
			"  return 42;",
			"}",
			"// @line collapse end",
		].join("\n");

		const cmsNode = {
			type: "codeBlock",
			attrs: { language: "ts", value: rawWithLineAnno },
		};

		const tiptapNode = codeBlockConverter.toTiptap(cmsNode, dummyCtx);
		// 데이터 손실 방지: 원문 코드가 content에 그대로 남고, annotationsDisabled가 true
		expect(tiptapNode.attrs?.annotationsDisabled).toBe(true);
		expect(tiptapNode.content?.[0]?.text).toBe(rawWithLineAnno);

		const roundtrip = codeBlockConverter.toCms(tiptapNode, dummyCtx);
		expect(roundtrip[0]?.attrs?.value).toBe(rawWithLineAnno);
	});

	it("지원하는 주석(@char u, @char Tooltip)을 clean text와 attrs.annotations로 분리하고 왕복한다", () => {
		const rawAnnotated = ["// @char u {0-4}", '// @char Tooltip {6-10} content="안내 문구"', "const test = 100;"].join(
			"\n",
		);

		const cmsNode = {
			type: "codeBlock",
			attrs: { language: "ts", value: rawAnnotated },
		};

		const tiptapNode = codeBlockConverter.toTiptap(cmsNode, dummyCtx);
		expect(tiptapNode.attrs?.annotationsDisabled).toBe(false);

		// 본문은 주석 코멘트가 제거된 깨끗한 코드
		expect(tiptapNode.content?.[0]?.text).toBe("const test = 100;");

		const annos = tiptapNode.attrs?.annotations as CodeBlockAnnotationItem[];
		expect(annos).toHaveLength(2);
		expect(annos[0]?.type).toBe("underline");
		expect(annos[0]?.from).toBe(0);
		expect(annos[0]?.to).toBe(5);

		expect(annos[1]?.type).toBe("tooltip");
		expect(annos[1]?.from).toBe(6);
		expect(annos[1]?.to).toBe(11);
		expect(annos[1]?.content).toBe("안내 문구");

		// 편집되지 않은 문서는 원본 바이트 그대로 왕복
		const roundtrip = codeBlockConverter.toCms(tiptapNode, dummyCtx);
		expect(roundtrip[0]?.attrs?.value).toBe(rawAnnotated);
	});

	it("실제 Tiptap 스키마 getJSON을 지나도 미편집 주석 원문을 그대로 보존한다", () => {
		const raw = "// @char u {0-2}\nabc";
		const mapped = codeBlockConverter.toTiptap({ type: "codeBlock", attrs: { language: "ts", value: raw } }, dummyCtx);
		editor = new Editor({
			extensions: [StarterKit.configure({ codeBlock: false }), CmsCodeBlock],
			content: { type: "doc", content: [mapped] },
		});
		const json = editor?.getJSON().content?.[0];
		expect(json?.attrs?.cleanCode).toBe("abc");
		expect(codeBlockConverter.toCms(json ?? {}, dummyCtx)[0]?.attrs?.value).toBe(raw);
	});

	it("언어를 바꾸면 옛 언어 주석을 재사용하지 않고 새 주석 구문을 만든다", () => {
		const raw = "// @char u {0-2}\nabc";
		const mapped = codeBlockConverter.toTiptap({ type: "codeBlock", attrs: { language: "ts", value: raw } }, dummyCtx);
		const changed = { ...mapped, attrs: { ...mapped.attrs, language: "python" } };
		const saved = codeBlockConverter.toCms(changed, dummyCtx)[0];
		expect(saved?.attrs?.value).not.toBe(raw);
		expect(String(saved?.attrs?.value)).toContain("# @char u");
		const loaded = codeBlockConverter.toTiptap(saved, dummyCtx);
		expect(loaded.attrs?.annotations).toHaveLength(1);
	});

	it("meta의 명시적 false와 알 수 없는 속성을 제목 수정 후에도 보존한다", async () => {
		const { parseMeta, formatMeta } = await import("../meta");
		const parsed = parseMeta('title="a.ts" focus=false lnum=false');
		expect(parsed.showLineNumbers).toBe(false);
		const formatted = formatMeta({ title: "b.ts", showLineNumbers: parsed.showLineNumbers, raw: parsed.raw });
		expect(formatted).toContain("focus=false");
		expect(formatted).toContain("lnum=false");
	});

	it("둘째 줄의 이른 위치 주석을 줄 로컬 범위로 저장한다", () => {
		const value = "abc\nabcdefghijklmnopqrstuvwxyz";
		const node = {
			type: "codeBlock",
			attrs: { language: "ts", annotations: [{ id: "a", type: "underline", from: 5, to: 8 }] },
			content: [{ type: "text", text: value }],
		};
		const saved = codeBlockConverter.toCms(node, dummyCtx)[0];
		const mapped = codeBlockConverter.toTiptap(saved, dummyCtx);
		expect((mapped.attrs?.annotations as CodeBlockAnnotationItem[])[0]?.from).toBe(5);
		expect((mapped.attrs?.annotations as CodeBlockAnnotationItem[])[0]?.to).toBe(8);
	});

	it("새 주석 추가 시 document-to-code-fence 구문으로 저장한다", () => {
		const tiptapNode = {
			type: "codeBlock",
			attrs: {
				language: "ts",
				annotations: [
					{ id: "1", type: "underline", from: 0, to: 5 },
					{ id: "2", type: "tooltip", from: 6, to: 10, content: "변수명" },
				],
				annotationsDisabled: false,
			},
			content: [{ type: "text", text: "const item = 1;" }],
		};

		const cmsNodes = codeBlockConverter.toCms(tiptapNode, dummyCtx);
		expect(cmsNodes).toHaveLength(1);
		const value = cmsNodes[0]?.attrs?.value as string;

		expect(value).toContain("// @char u {0-4}");
		expect(value).toContain('// @char Tooltip {6-9} content="변수명"');
		expect(value).toContain("const item = 1;");
	});
});

describe("C5 코드 블록: 편집 시 주석 오프셋 트랜잭션 매핑", () => {
	it("텍스트 앞쪽에 글자를 추가하면 주석의 오프셋이 뒤로 밀린다", () => {
		const initialAnnotations: CodeBlockAnnotationItem[] = [{ id: "1", type: "underline", from: 6, to: 10 }];

		const instance = createTestEditor("const item = 1;", {
			annotations: initialAnnotations,
		});

		// 맨 앞에 'export ' (7자) 삽입
		instance.commands.insertContentAt(1, "export ");

		const codeBlock = instance.state.doc.child(0);
		const updatedAnnotations = codeBlock.attrs.annotations as CodeBlockAnnotationItem[];

		expect(updatedAnnotations).toHaveLength(1);
		// 6 + 7 = 13, 10 + 7 = 17
		expect(updatedAnnotations[0]?.from).toBe(13);
		expect(updatedAnnotations[0]?.to).toBe(17);
	});

	it("주석 범위 내부를 편집하면 주석의 to 오프셋이 확장된다", () => {
		const initialAnnotations: CodeBlockAnnotationItem[] = [
			{ id: "1", type: "tooltip", from: 6, to: 10, content: "변수" },
		];

		const instance = createTestEditor("const item = 1;", {
			annotations: initialAnnotations,
		});

		// pos 1은 codeBlock 시작. codeBlock 텍스트 시작은 pos 1.
		// 'item'은 텍스트 오프셋 6~10이므로 문서 pos 기준으로는 1 + 6 = 7.
		// 'item' 뒤(pos 11)에 'Extended' (8자) 추가
		instance.commands.insertContentAt(1 + 10, "Extended");

		const codeBlock = instance.state.doc.child(0);
		const updatedAnnotations = codeBlock.attrs.annotations as CodeBlockAnnotationItem[];

		expect(updatedAnnotations).toHaveLength(1);
		expect(updatedAnnotations[0]?.from).toBe(6);
		expect(updatedAnnotations[0]?.to).toBe(18);
	});

	it("주석 범위를 완전히 삭제하면 해당 주석이 목록에서 제거된다", () => {
		const initialAnnotations: CodeBlockAnnotationItem[] = [{ id: "1", type: "underline", from: 6, to: 10 }];

		const instance = createTestEditor("const item = 1;", {
			annotations: initialAnnotations,
		});

		// 'const item' (pos 1부터 pos 11까지) 삭제
		instance.commands.deleteRange({ from: 1, to: 11 });

		const codeBlock = instance.state.doc.child(0);
		const updatedAnnotations = codeBlock.attrs.annotations as CodeBlockAnnotationItem[];

		// 오프셋이 0으로 축소되어 삭제됨
		expect(updatedAnnotations).toHaveLength(0);
	});

	it("shiki 지연 로드 및 구문 하이라이팅이 텍스트 변경 없이 dual theme 데코레이션을 생성한다", async () => {
		const highlighter = await getShikiHighlighter();
		expect(highlighter).toBeDefined();

		const code = "const message: string = 'hello';";
		const tokens = highlighter.codeToTokensWithThemes(code, {
			lang: "typescript",
			themes: {
				light: "one-light",
				dark: "one-dark-pro",
			},
		});

		expect(tokens.length).toBeGreaterThan(0);
		const firstToken = tokens[0]?.[0];
		expect(firstToken?.content).toBe("const");
		expect(firstToken?.variants?.light?.color).toBeDefined();
		expect(firstToken?.variants?.dark?.color).toBeDefined();

		// 하이라이팅 데코레이션이 텍스트 본문(순수 텍스트)을 오염시키지 않는다
		const instance = createTestEditor(code, { language: "ts" });
		expect(instance.state.doc.child(0).textContent).toBe(code);
	});

	it("여러 줄 코드의 Shiki 토큰 오프셋을 한 번만 더해 둘째 줄에 데코레이션한다", async () => {
		const code = "const a = 1;\nconst b = 2;";
		const instance = createTestEditor(code, { language: "ts" });
		await vi.waitFor(() => {
			const plugin = codeBlockHighlightPluginKey.get(instance.state);
			const decorations = plugin?.props.decorations?.call(plugin, instance.state) as DecorationSet | undefined;
			const secondConst = decorations
				?.find(14, 19)
				.find((decoration) => decoration.from === 14 && decoration.to === 19);
			expect(secondConst).toBeDefined();
		});
	});
});
