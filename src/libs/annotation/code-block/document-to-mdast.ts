import { parse } from "acorn";
import type { Paragraph, PhrasingContent, Text } from "mdast";
import type {
	MdxJsxAttribute,
	MdxJsxAttributeValueExpression,
	MdxJsxFlowElement,
	MdxJsxTextElement,
} from "mdast-util-mdx-jsx";
import { createAnnotationRegistry, fromAnnotationsToEvents } from "./libs";
import type {
	AnnotationAttr,
	AnnotationConfig,
	AnnotationEvent,
	AnnotationRegistry,
	CodeBlockDocument,
	CodeBlockMetaValue,
	CodeBlockRoot,
	Line,
	MdastNodeLike,
} from "./types";

const DEFAULT_CODE_LANG = "text";

const createTextNode = (value: string): Text => ({
	type: "text",
	value,
});

const createMdastNode = (name: string, children: PhrasingContent[] = []) =>
	({ type: name, children }) as PhrasingContent;

type EstreeProgram = NonNullable<MdxJsxAttributeValueExpression["data"]>["estree"];

const toMdxAttrExpr = (value: unknown): MdxJsxAttributeValueExpression => {
	const json = JSON.stringify(value);

	const program = parse(`(${json})`, {
		ecmaVersion: "latest",
		sourceType: "module",
	});

	const firstStmt = program.body[0];
	if (!firstStmt || firstStmt.type !== "ExpressionStatement") {
		throw new Error("Failed to parse expression: not an ExpressionStatement");
	}

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
						expression: firstStmt.expression,
					},
				],
			} as unknown as EstreeProgram,
		},
	};
};

const toMdxAttrValue = (value: unknown): MdxJsxAttribute["value"] => {
	if (value === null) return toMdxAttrExpr(null);
	if (value == null || typeof value === "string") return value;
	return toMdxAttrExpr(value);
};

const createMdxJsxAttribute = (name: string, value: unknown): MdxJsxAttribute => ({
	type: "mdxJsxAttribute",
	name,
	value: toMdxAttrValue(value),
});

const createMdxJsxTextElementNode = (
	name: string,
	attributes: AnnotationAttr[] = [],
	children: PhrasingContent[] = [],
): MdxJsxTextElement => {
	return {
		type: "mdxJsxTextElement",
		name,
		attributes: attributes.map((attr) => createMdxJsxAttribute(attr.name, attr.value)),
		children,
	};
};

const fromLineToParagraph = (line: string, events: AnnotationEvent[], registry: AnnotationRegistry): Paragraph => {
	const paragraph: Paragraph = {
		type: "paragraph",
		children: [],
	};

	const stack: MdastNodeLike[] = [paragraph];
	let cursor = 0;

	for (const event of events) {
		if (cursor < event.pos) {
			const textNode = createTextNode(line.slice(cursor, event.pos));
			stack[stack.length - 1].children.push(textNode);
			cursor = event.pos;
		}

		if (event.kind === "open") {
			const annotation = event.anno;
			const node = registry.get(event.anno.name);
			if (!node) {
				continue;
			}

			if (node.type === "lineClass" || node.type === "lineWrap") {
				continue;
			}

			const mdastNode =
				node.source === "mdast"
					? createMdastNode(node.name, [])
					: createMdxJsxTextElementNode(node.name, annotation.attributes);

			stack[stack.length - 1].children.push(mdastNode);
			stack.push(mdastNode as MdastNodeLike);
		}

		if (event.kind === "close") {
			stack.pop();
		}
	}

	if (cursor !== line.length) {
		const textNode = createTextNode(line.slice(cursor));
		paragraph.children.push(textNode);
	}

	return paragraph;
};

const fromLinesToCodeBlockRoot = (
	lines: Line[],
	registry: AnnotationRegistry,
	options?: { lang?: string; meta?: Record<string, CodeBlockMetaValue> },
): CodeBlockRoot => {
	const lang = options?.lang?.trim() || DEFAULT_CODE_LANG;
	const meta = options?.meta ?? {};

	const codeBlock: CodeBlockRoot = {
		type: "mdxJsxFlowElement",
		name: "CodeBlock",
		children: [],
		attributes: [
			{ type: "mdxJsxAttribute", name: "lang", value: lang },
			{
				type: "mdxJsxAttribute",
				name: "meta",
				value: toMdxAttrExpr(meta),
			},
		],
	};

	const paragraph: Paragraph = {
		type: "paragraph",
		children: [],
	};
	const lineStartOffsets: number[] = [];
	let lineStart = 0;

	for (const line of lines) {
		lineStartOffsets.push(lineStart);
		lineStart += line.value.length + 1;
	}

	for (let idx = 0; idx < lines.length; idx += 1) {
		const line = lines[idx];
		if (!line) continue;
		const lineOffset = lineStartOffsets[idx] ?? 0;
		const localInlineAnnotations = line.annotations.map((annotation, order) => ({
			...annotation,
			range:
				annotation.range.start >= 0 &&
				annotation.range.end >= annotation.range.start &&
				annotation.range.end <= line.value.length
					? annotation.range
					: {
							start: annotation.range.start - lineOffset,
							end: annotation.range.end - lineOffset,
						},
			order,
		}));

		const inlineEvents = fromAnnotationsToEvents(localInlineAnnotations);
		const lineParagraph = fromLineToParagraph(line.value, inlineEvents, registry);
		paragraph.children.push(...lineParagraph.children);

		if (idx < lines.length - 1) {
			paragraph.children.push({ type: "break" });
		}
	}

	if (paragraph.children.length > 0) {
		codeBlock.children.push(paragraph);
	}

	return codeBlock;
};

export const fromCodeBlockDocumentToMdast = (
	document: CodeBlockDocument,
	annotationConfig: AnnotationConfig,
): CodeBlockRoot => {
	const registry = createAnnotationRegistry(annotationConfig);
	return fromLinesToCodeBlockRoot(document.lines, registry, {
		lang: document.lang,
		meta: document.meta,
	});
};

export const __testable__ = {
	fromLineToParagraph,
	fromLinesToCodeBlockRoot,
	toMdxAttrExpr,
	toMdxAttrValue,
	createTextNode,
	createMdastNode,
	createMdxJsxTextElementNode,
	fromCodeBlockDocumentToMdast,
};
