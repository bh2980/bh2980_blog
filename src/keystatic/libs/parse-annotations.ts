import { parse } from "acorn";
import type { Break, Paragraph, PhrasingContent, Root, Text } from "mdast";
import type {
	MdxJsxAttribute,
	MdxJsxAttributeValueExpression,
	MdxJsxFlowElement,
	MdxJsxTextElement,
} from "mdast-util-mdx-jsx";
import { SKIP, visit } from "unist-util-visit";
import { isDefined } from "@/utils/is-defined";
import { EDITOR_CODE_BLOCK_NAME } from "../fields/mdx/components/code-block";
import { EDITOR_MERMAID_NAME } from "../fields/mdx/components/mermaid";
import {
	ANNOTATION_TAG_PREFIX,
	ANNOTATION_TYPE_BY_TAG,
	type AnnotationAttr,
	type AnnotationConfig,
	type AnnotationRegistry,
	type AnnotationTag,
	type AnnotationType,
	buildAnnotationHelper,
} from "./serialize-annotations";

export type FenceMetaValue = string | boolean;

export type LineRange = { start: number; end: number };

export type LineAnnotationBase = {
	type: AnnotationType;
	tag: AnnotationTag;
	name: string;
	range: LineRange;
	priority: number;
	attributes?: AnnotationAttr[];
};

export type ClassLineAnnotation = LineAnnotationBase & {
	class: string;
};

export type RenderLineAnnotation = LineAnnotationBase & {
	render: string;
};

export type LineAnnotation = ClassLineAnnotation | RenderLineAnnotation;

export type LineMeta = {
	lineNumber: number;
	value: string;
	annotations: LineAnnotation[];
};

export type EventKind = "open" | "close";

export type AnnotationEvent = {
	pos: number; // line offset
	kind: EventKind; // 같은 pos면 close 먼저
	anno: LineAnnotation; // 원본 참조 or 동일 구조
};

// children을 가지는 PhrasingContent만 추출 (text 제외)
type PhrasingParent = Extract<PhrasingContent, { children: PhrasingContent[] }>;

// 스택에 올릴 수 있는 노드(= children을 직접 push 할 대상)
export type MdastNodeLike = Root | MdxJsxTextElement | PhrasingParent;

const TYPE_RE = /@(?<tag>dec|mark|line|block)/;
const NAME_RE = /(?<name>\w+)/;
const RANGE_RE = /{(?<range>\d+-\d+)}/;

const ATTR_RE = /([A-Za-z_][\w-]*)\s*=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s]+))/g;

const ANNOTATION_RE = new RegExp(`${TYPE_RE.source} ${NAME_RE.source} ${RANGE_RE.source}`);

const buildBreakNode = (): Break => ({
	type: "break",
});

const buildTextNode = (value: string): Text => ({
	type: "text",
	value,
});

const buildMdastNode = (name: string, children: PhrasingContent[] = []) =>
	({ type: name, children }) as PhrasingContent;

const buildMdxJsxAttribute = (name: string, value: any): MdxJsxAttribute => ({
	type: "mdxJsxAttribute",
	name,
	value,
});

const buildMdxJsxTextElementNode = (
	name: string,
	attributes: AnnotationAttr[] = [],
	children: PhrasingContent[] = [],
): MdxJsxTextElement => {
	return {
		type: "mdxJsxTextElement",
		name,
		attributes: attributes.map((attr) => buildMdxJsxAttribute(attr.name, JSON.stringify(attr.value))),
		children,
	};
};

const buildMdxJsxAttributeValueExpression = (value: unknown): MdxJsxAttributeValueExpression => {
	const json = JSON.stringify(value);

	const program = parse(`(${json})`, {
		ecmaVersion: "latest",
		sourceType: "module",
	});

	const firstStmt = program.body[0];
	if (!firstStmt || firstStmt.type !== "ExpressionStatement") {
		throw new Error("Failed to parse expression: not an ExpressionStatement");
	}

	const expression = firstStmt.expression;

	return {
		type: "mdxJsxAttributeValueExpression",
		value: json,
		data: {
			estree: {
				type: "Program",
				sourceType: "module",
				body: [
					{
						type: "ExpressionStatement",
						expression,
					},
				] as any,
			},
		},
	};
};

const buildEvents = (annotations: LineAnnotation[]) => {
	const event = annotations
		.flatMap((anntation) => {
			const startEvent: AnnotationEvent = { kind: "open", anno: anntation, pos: anntation.range.start };
			const endEvent: AnnotationEvent = { kind: "close", anno: anntation, pos: anntation.range.end };

			if (startEvent.pos === endEvent.pos) {
				return [];
			}

			return [startEvent, endEvent];
		})
		.sort((a, b) => {
			if (a.pos !== b.pos) {
				return a.pos - b.pos;
			}

			if (a.kind !== b.kind) {
				return a.kind.localeCompare(b.kind);
			}

			if (a.kind === "open" && a.anno.range.end !== b.anno.range.end) {
				return b.anno.range.end - a.anno.range.end;
			}

			if (a.kind === "close" && a.anno.range.start !== b.anno.range.start) {
				return b.anno.range.start - a.anno.range.start;
			}

			if (a.anno.type !== b.anno.type) {
				return a.anno.type - b.anno.type;
			}

			return a.anno.priority - b.anno.priority;
		});

	return event;
};

export function parseFenceMeta(meta: string): Record<string, FenceMetaValue> {
	const parsed: Record<string, FenceMetaValue> = {};
	const input = meta.trim();
	let index = 0;

	const isWhitespace = (ch: string) => ch === " " || ch === "\t" || ch === "\n" || ch === "\r";

	const skipWhitespace = () => {
		while (index < input.length && isWhitespace(input[index]!)) index++;
	};

	const readKey = () => {
		const start = index;
		while (index < input.length) {
			const ch = input[index]!;
			if (ch === "=" || isWhitespace(ch)) break;
			index++;
		}
		return input.slice(start, index);
	};

	const readUnquotedValue = () => {
		const start = index;
		while (index < input.length && !isWhitespace(input[index]!)) index++;
		return input.slice(start, index);
	};

	const readQuotedValue = (quote: '"' | "'") => {
		index++; // skip opening quote
		let value = "";

		while (index < input.length) {
			const ch = input[index]!;

			// minimal escapes: \" \' \\ \n \t
			if (ch === "\\") {
				const next = input[index + 1];
				if (next == null) break;

				if (next === "n") value += "\n";
				else if (next === "t") value += "\t";
				else value += next;

				index += 2;
				continue;
			}

			if (ch === quote) {
				index++; // skip closing quote
				return value;
			}

			value += ch;
			index++;
		}

		// quote not closed; return collected text
		return value;
	};

	while (index < input.length) {
		skipWhitespace();
		if (index >= input.length) break;

		const key = readKey();
		if (!key) break;

		skipWhitespace();

		// Flag token: `showLineNumbers`
		if (input[index] !== "=") {
			parsed[key] = true;
			continue;
		}

		index++; // skip '='
		skipWhitespace();

		const firstChar = input[index];
		const value = firstChar === '"' || firstChar === "'" ? readQuotedValue(firstChar) : readUnquotedValue();

		parsed[key] = value;
	}

	return parsed;
}

function parseAttrs(rest: string) {
	const attrs: AnnotationAttr[] = [];
	for (const m of rest.matchAll(ATTR_RE)) {
		const key = m[1];
		const raw = m[2] ?? m[3] ?? m[4] ?? "";

		// 따옴표 안 이스케이프만 1차 해제 (\" , \', \\)
		const unescaped = raw.replace(/\\(["'\\])/g, "$1");

		// "json stringify로 무조건 감싼다" 정책이면 여기서 JSON.parse 시도하면 편함
		// 실패하면 문자열로 둠
		let value: unknown = unescaped;
		try {
			value = JSON.parse(unescaped);
		} catch {
			/* keep string */
		}

		attrs.push({ name: key, value });
	}
	return attrs;
}

// TODO : 추후 파싱 시 검증 로직 추가
const parseAnnotation = (annotationStr: string, config: AnnotationConfig): LineAnnotation | undefined => {
	const { annoRegistry: annotationMap } = buildAnnotationHelper(config);

	try {
		const result = annotationStr.match(ANNOTATION_RE);
		if (!result?.groups) return;

		const { tag, name, range: rangeStr } = result.groups as { tag: AnnotationTag; name: string; range: string };

		const type = ANNOTATION_TYPE_BY_TAG[tag];

		const [start, end] = rangeStr.split("-").map(Number);
		const range = { start, end };

		// ANNOTATION_RE가 range까지만 캡처한다는 가정이면,
		// range 이후를 잘라 attrs로 파싱
		const idx = annotationStr.indexOf(rangeStr);
		const rest = idx >= 0 ? annotationStr.slice(idx + rangeStr.length) : "";
		const attributes = parseAttrs(rest);
		const config = annotationMap.get(name);

		if (!isDefined(config)) {
			return;
		}

		if (!isDefined(config.priority)) {
			return;
		}

		const lineAnnotation = { ...config, type, tag, name, range, attributes };

		return lineAnnotation;
	} catch {
		return;
	}
};

export const parseCodeToAnnotationLines = (code: string, lang: string, config: AnnotationConfig) => {
	// TODO : 추후 lang을 보고 지정
	const commentPrefix = "//";
	const commentPostfix = "";

	const isAnnotationComment = (line: string) => line.startsWith(`${commentPrefix} ${ANNOTATION_TAG_PREFIX}`);

	let lineNo = 0;
	const lines = [];

	let annotations: LineAnnotation[] = [];

	for (const line of code.split("\n")) {
		if (isAnnotationComment(line)) {
			const annotation = parseAnnotation(line, config);
			if (annotation) {
				annotations.push(annotation);
			}
		} else {
			const lineMeta = {
				lineNumber: lineNo++,
				value: `${line}`,
				annotations,
			};

			lines.push(lineMeta);
			annotations = [];
		}
	}

	return lines;
};

// TODO : 추후 검증 로직 추가
const buildLineAst = (line: string, events: AnnotationEvent[], registry: AnnotationRegistry): PhrasingContent[] => {
	if (line.length === 0) return [];

	const root: MdastNodeLike = { type: "root", children: [] };
	const stack: MdastNodeLike[] = [root];

	let cursor = 0;

	for (const event of events) {
		// 만약 event의 pos가 이전 pos와 다르다면 textnode를 만들어서 현재 stack top의 자식으로 넣는다.
		// 이후 event.pos를 다음 pos로 변경한다.
		if (cursor < event.pos) {
			const textNode = buildTextNode(line.slice(cursor, event.pos));
			stack[stack.length - 1].children.push(textNode);
			cursor = event.pos;
		}

		// event가 open라면 해당하는 노드를 만들고 노드를 stacktop의 children으로 넣고 stack에도 넣는다.
		if (event.kind === "open") {
			const annotation = event.anno;
			const node = registry.get(event.anno.name);
			if (!node) {
				continue;
			}

			const { name, source } = node;

			const mdastNode =
				source === "mdast" ? buildMdastNode(name, []) : buildMdxJsxTextElementNode(name, annotation.attributes);

			stack[stack.length - 1].children.push(mdastNode);
			stack.push(mdastNode as MdastNodeLike);
		}

		// events가 close라면 stacktop을 제거한다.
		if (event.kind === "close") {
			stack.pop();
		}
	}

	if (cursor !== line.length) {
		const textNode = buildTextNode(line.slice(cursor));
		root.children.push(textNode);
	}

	// root.children.push(buildBreakNode());

	return root.children as PhrasingContent[];
};

const buildParagraphAst = (rawCode: string, lang: string, config: AnnotationConfig) => {
	const { annoRegistry: registry } = buildAnnotationHelper(config);
	const paragraph: Paragraph = {
		type: "paragraph",
		children: [],
	};

	const lines = parseCodeToAnnotationLines(rawCode, lang, config);

	lines.forEach((line) => {
		const events = buildEvents(line.annotations);
		const lineAst = buildLineAst(line.value, events, registry);

		paragraph.children = [...paragraph.children, ...lineAst, buildBreakNode()];
	});

	paragraph.children.pop();

	return paragraph;
};

export function walkOnlyInsideCodeFence(mdxAst: Root, annotationConfig: AnnotationConfig) {
	visit(mdxAst, "code", (node, index, parent) => {
		const lang = node.lang ?? "text";
		if (lang === "mermaid") return;

		const meta = parseFenceMeta(node.meta ?? "");
		const rawCodeWithAnnotations = node.value;

		const paragraph = buildParagraphAst(rawCodeWithAnnotations, lang, annotationConfig);

		const langAttr = buildMdxJsxAttribute("lang", lang);
		const metaValue = buildMdxJsxAttributeValueExpression(meta);
		const metaAttr = buildMdxJsxAttribute("meta", metaValue);

		const codeBlockNode: MdxJsxFlowElement = {
			type: "mdxJsxFlowElement",
			attributes: [metaAttr, langAttr],
			name: EDITOR_CODE_BLOCK_NAME,
			children: [paragraph],
		};

		if (parent && isDefined(index)) parent.children.splice(index, 1, codeBlockNode);

		return [SKIP, index];
	});
}

export function walkOnlyMermaidCodeFence(mdxAst: Root) {
	buildAnnotationHelper({});

	visit(mdxAst, "code", (node, index, parent) => {
		const lang = node.lang ?? "text";
		if (lang !== "mermaid") return;

		const rawCode = node.value;

		const paragraphChildren = [];

		for (const line of rawCode.split("\n")) {
			const lineText = buildTextNode(line);

			const breakText = buildBreakNode();

			paragraphChildren.push(lineText, breakText);
		}

		paragraphChildren.pop();

		const paragraph: Paragraph = {
			type: "paragraph",
			children: paragraphChildren,
		};

		const mermaidNode: MdxJsxFlowElement = {
			type: "mdxJsxFlowElement",
			name: EDITOR_MERMAID_NAME,
			children: [paragraph],
			attributes: [],
		};

		if (parent && isDefined(index)) parent.children.splice(index, 1, mermaidNode);

		return [SKIP, index];
	});
}

export const __testable__ = {
	buildLineAst,
	buildEvents,
};
