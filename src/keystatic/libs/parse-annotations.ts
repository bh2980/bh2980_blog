import type { Break, PhrasingContent, Root, Text } from "mdast";
import type { MdxJsxAttribute, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";
import { isDefined } from "@/utils/is-defined";
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

export type LineRange = { start: number; end: number };

export type LineAnnotation = {
	type: AnnotationType;
	name: string;
	range: LineRange;
	priority: number;
	attributes?: AnnotationAttr[];
};

export type LineMeta = {
	lineNumber: number;
	value: string;
	annotations: LineAnnotation[];
};

type MetaValue = string | number | boolean | null;

type Range =
	| { start: number; end: number } // {6-21}
	| { start: number }; // {3}

type ParsedMeta = {
	kv: Record<string, MetaValue>;
	ranges: Range[];
};

const TYPE_RE = /@(?<tag>dec|mark|line|block)/;
const NAME_RE = /(?<name>\w+)/;
const RANGE_RE = /{(?<range>\d+-\d+)}/;

const ATTR_RE = /([A-Za-z_][\w-]*)\s*=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s]+))/g;

const ANNOTATION_RE = new RegExp(`${TYPE_RE.source} ${NAME_RE.source} ${RANGE_RE.source}`);

const META_RE = /(?<key>\w+)(?:=(?<val>(?:"[^"]*"|'[^']*'|[^\s]+)))?|(?<range>\{[^}]*\})/g;

function parseMetaValue(raw: string | undefined): MetaValue {
	if (raw == null) return true; // flag
	try {
		return JSON.parse(raw);
	} catch {
		return raw;
	}
}

function parseRange(raw: string): Range | undefined {
	// raw: "{6-21}" 또는 "{3}" (공백 허용)
	const s = raw.trim();

	// {n}
	let m = s.match(/^\{\s*(-?\d+)\s*\}$/);
	if (m) {
		const start = Number(m[1]);
		if (!Number.isFinite(start)) return undefined;
		return { start };
	}

	// {a-b}
	m = s.match(/^\{\s*(-?\d+)\s*-\s*(-?\d+)\s*\}$/);
	if (m) {
		const start = Number(m[1]);
		const end = Number(m[2]);
		if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
		return { start, end };
	}

	return undefined;
}

export function parseFenceMeta(meta?: string | null): ParsedMeta {
	const out: ParsedMeta = { kv: {}, ranges: [] };
	if (!meta) return out;

	for (const m of meta.matchAll(META_RE)) {
		const g = m.groups as { key?: string; val?: string; range?: string } | undefined;
		if (!g) continue;

		if (g.range) {
			const r = parseRange(g.range);
			if (r) out.ranges.push(r);
			continue;
		}

		if (g.key) {
			out.kv[g.key] = parseMetaValue(g.val);
		}
	}

	return out;
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
const parseAnnotation = (annotationStr: string): LineAnnotation | undefined => {
	const { annoRegistry: annotationMap } = buildAnnotationHelper();

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
		const priority = annotationMap.get(name)?.priority;

		if (!isDefined(priority)) {
			return;
		}

		const lineAnnotation = { type, name, range, attributes, priority };

		return lineAnnotation;
	} catch {
		return;
	}
};

export type EventKind = "open" | "close";

export type AnnotationEvent = {
	pos: number; // line offset
	kind: EventKind; // 같은 pos면 close 먼저
	anno: LineAnnotation; // 원본 참조 or 동일 구조
};

export const buildEvents = (annotations: LineAnnotation[]) => {
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

const buildBreakNode = (): Break => ({
	type: "break",
});

const buildTextNode = (value: string): Text => ({
	type: "text",
	value,
});

const buildMdastNode = (name: string, children: PhrasingContent[] = []) =>
	({ type: name, children }) as PhrasingContent;

const buildMdxJsxAttribute = (name: string, value: string): MdxJsxAttribute => ({
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

// children을 가지는 PhrasingContent만 추출 (text 제외)
type PhrasingParent = Extract<PhrasingContent, { children: PhrasingContent[] }>;

// 스택에 올릴 수 있는 노드(= children을 직접 push 할 대상)
export type MdastNodeLike = Root | MdxJsxTextElement | PhrasingParent;

export const buildLineAst = (line: string, events: AnnotationEvent[], registry: AnnotationRegistry) => {
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

	return root.children;
};

const parseLine = (code: string, lang: string) => {
	// TODO : 추후 lang을 보고 지정
	const commentPrefix = "//";
	const commentPostfix = "";

	const isAnnotationComment = (line: string) => line.startsWith(`${commentPrefix} ${ANNOTATION_TAG_PREFIX}`);

	let lineNo = 0;
	const lines = [];

	let annotations = [];

	for (const line of code.split("\n")) {
		if (isAnnotationComment(line)) {
			const annotation = parseAnnotation(line);
			if (annotation) {
				annotations.push(annotation);
			}
		} else {
			const lineMeta = {
				lineNumber: lineNo++,
				value: line,
				annotations,
			};

			lines.push(lineMeta);
			annotations = [];
		}
	}

	return lines;
};

export function walkOnlyInsideCodeFence(mdxAst: Root, annotationConfig: AnnotationConfig) {
	buildAnnotationHelper(annotationConfig);

	visit(mdxAst, "code", (node, index, parent) => {
		const lang = node.lang ?? "text";
		const rawMeta = node.meta;
		const rawCodeWithAnnotations = node.value;

		let meta: ParsedMeta | undefined;

		if (rawMeta) {
			meta = parseFenceMeta(rawMeta);
		}

		const lines = parseLine(rawCodeWithAnnotations, lang);

		for (const line of lines) {
		}
	});
}

// {
//     "type": "mdxJsxFlowElement",
//     "name": "CodeBlock",
//     "attributes": [
//         {
//             "type": "mdxJsxAttribute",
//             "name": "meta",
//             "value": {
//                 "type": "mdxJsxAttributeValueExpression",
//                 "value": "{\"showLineNumbers\":false}"
//             }
//         },
//         {
//             "type": "mdxJsxAttribute",
//             "name": "useLineNumber",
//             "value": {
//                 "type": "mdxJsxAttributeValueExpression",
//                 "value": "false"
//             }
//         },
//         {
//             "type": "mdxJsxAttribute",
//             "name": "lang",
//             "value": "ts-tags"
//         }
//     ],
//     "children": [
//         {
//             "type": "paragraph",
//             "children": [
//                 {
//                     "type": "text",
//                     "value": "const he"
//                 },
//                 {
//                     "type": "mdxJsxTextElement",
//                     "name": "Tooltip",
//                     "attributes": [
//                         {
//                             "type": "mdxJsxAttribute",
//                             "name": "content",
//                             "value": "cpmstemt"
//                         }
//                     ],
//                     "children": [
//                         {
//                             "type": "text",
//                             "value": "llo = \"hel"
//                         }
//                     ]
//                 },
//                 {
//                     "type": "text",
//                     "value": "lo\";"
//                 },
//                 {
//                     "type": "break"
//                 },
//                 {
//                     "type": "break"
//                 },
//                 {
//                     "type": "text",
//                     "value": "\t\tconsole.l"
//                 },
//                 {
//                     "type": "mdxJsxTextElement",
//                     "name": "u",
//                     "attributes": [],
//                     "children": [
//                         {
//                             "type": "text",
//                             "value": "og(hello)"
//                         }
//                     ]
//                 },
//                 {
//                     "type": "text",
//                     "value": ";"
//                 }
//             ]
//         }
//     ]
// }
