import type { Node, Paragraph } from "mdast";
import type { MdxJsxAttribute, MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import {
	composeEventsFromAnnotations,
	createAnnotationRegistry,
	createMdxJsxAttributeValueExpression,
	createMdastNode,
	createMdxJsxTextElementNode,
	createTextNode,
	hasChildren,
	isMDXJSXTextElement,
	isText,
} from "./libs";
import type {
	AnnotationAttr,
	AnnotationConfig,
	AnnotationEvent,
	AnnotationRegistry,
	CodeBlockDocument,
	CodeBlockMetaValue,
	CodeBlockRoot,
	InlineAnnotation,
	Line,
	LineAnnotation,
	MdastNodeLike,
} from "./types";

const DEFAULT_CODE_LANG = "text";

const buildLineFromParagraph = (p: Paragraph, registry: AnnotationRegistry): Line => {
	let pureCode = "";
	const annotations: InlineAnnotation[] = [];

	function recursiveBuildAnnotationInfo(node: Node) {
		if (isText(node)) {
			pureCode += node.value;
			return;
		}

		if (hasChildren(node)) {
			const start = pureCode.length;

			for (const child of node.children) {
				recursiveBuildAnnotationInfo(child);
			}

			const end = pureCode.length;
			const nodeType = node.type;

			const annotationKey = (isMDXJSXTextElement(node) ? node.name : nodeType) ?? "";
			const anno = registry.get(annotationKey);
			if (!anno || anno.type === "lineClass" || anno.type === "lineWrap") {
				return;
			}

			if (isMDXJSXTextElement(node)) {
				if (!node.name) {
					return;
				}

				const annoataion = {
					...anno,
					name: node.name,
					range: { start, end },
					order: annotations.length,
					// mdxJsxExpressionAttribute(스프레드)는 제외하고, named attribute는 값 타입 그대로 보존한다.
					attributes: node.attributes
						.filter(
							(attr): attr is MdxJsxAttribute & { name: string } => attr.type === "mdxJsxAttribute",
						)
						.map<AnnotationAttr>((attr) => ({ name: attr.name, value: attr.value })),
				};

				annotations.push(annoataion);
				return;
			}

			const annoataion = {
				...anno,
				name: nodeType,
				range: { start, end },
				order: annotations.length,
			};

			annotations.push(annoataion);
			return;
		}
	}

	recursiveBuildAnnotationInfo(p);

	return { value: pureCode, annotations };
};

const extractCodeBlockHeaderFromMdast = (
	mdxAst: CodeBlockRoot,
): Pick<CodeBlockDocument, "lang" | "meta"> => {
	const langAttr = mdxAst.attributes.find((node) => node.type === "mdxJsxAttribute" && node.name === "lang");
	const lang = langAttr?.type === "mdxJsxAttribute" && typeof langAttr.value === "string" ? langAttr.value : DEFAULT_CODE_LANG;
	const metaAttr = mdxAst.attributes.find((node) => node.type === "mdxJsxAttribute" && node.name === "meta");
	let meta: Record<string, CodeBlockMetaValue> = {};

	if (metaAttr?.type === "mdxJsxAttribute") {
		const rawMeta =
			typeof metaAttr.value === "string"
				? metaAttr.value
				: metaAttr.value && typeof metaAttr.value === "object" && "value" in metaAttr.value
					? metaAttr.value.value
					: undefined;

		if (typeof rawMeta === "string") {
			try {
				const parsed = JSON.parse(rawMeta);
				if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
					meta = parsed as Record<string, CodeBlockMetaValue>;
				}
			} catch {
				meta = {};
			}
		}
	}

	return { lang, meta };
};

const buildCodeBlockBodyFromMdast = (
	mdxAst: CodeBlockRoot,
	registry: AnnotationRegistry,
): Pick<CodeBlockDocument, "lines" | "annotations"> => {
	const lines: Line[] = [];
	const annotations: LineAnnotation[] = [];

	const visitFlowChildren = (nodes: CodeBlockRoot["children"]) => {
		nodes.forEach((childNode) => {
			if (childNode.type === "paragraph") {
				const line = buildLineFromParagraph(childNode, registry);
				lines.push(line);
				return;
			}

			if (childNode.type !== "mdxJsxFlowElement") {
				return;
			}

			if (!childNode.name || childNode.children.length === 0) {
				return;
			}

			const config = registry.get(childNode.name);
			if (!config || config.type === "inlineClass" || config.type === "inlineWrap") {
				return;
			}

			const start = lines.length;
			const flowAttributes = childNode.attributes
				.filter((attr): attr is MdxJsxAttribute & { name: string } => attr.type === "mdxJsxAttribute")
				.map<AnnotationAttr>((attr) => ({ name: attr.name, value: attr.value }));
			const annotation = {
				...config,
				range: {
					start,
					end: start,
				},
				order: annotations.length,
				attributes: flowAttributes.length > 0 ? flowAttributes : undefined,
			};

			annotations.push(annotation);
			visitFlowChildren(childNode.children as CodeBlockRoot["children"]);
			annotation.range.end = lines.length;
		});
	};

	visitFlowChildren(mdxAst.children);

	return { lines, annotations };
};

export const buildCodeBlockDocumentFromMdast = (
	mdxAst: CodeBlockRoot,
	annotationConfig: AnnotationConfig,
): CodeBlockDocument => {
	const registry = createAnnotationRegistry(annotationConfig);
	const { lang, meta } = extractCodeBlockHeaderFromMdast(mdxAst);
	const { lines, annotations } = buildCodeBlockBodyFromMdast(mdxAst, registry);

	return { lang, meta, lines, annotations };
};

const composeParagraphFromLine = (line: string, events: AnnotationEvent[], registry: AnnotationRegistry): Paragraph => {
	const paragraph: Paragraph = {
		type: "paragraph",
		children: [],
	};

	const stack: MdastNodeLike[] = [paragraph];
	let cursor = 0;

	for (const event of events) {
		// 만약 event의 pos가 이전 pos와 다르다면 textnode를 만들어서 현재 stack top의 자식으로 넣는다.
		// 이후 event.pos를 다음 pos로 변경한다.
		if (cursor < event.pos) {
			const textNode = createTextNode(line.slice(cursor, event.pos));
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
				source === "mdast" ? createMdastNode(name, []) : createMdxJsxTextElementNode(name, annotation.attributes);

			stack[stack.length - 1].children.push(mdastNode);
			stack.push(mdastNode as MdastNodeLike);
		}

		// events가 close라면 stacktop을 제거한다.
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

const composeCodeBlockRootFromLines = (
	lines: Line[],
	events: AnnotationEvent[],
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
				value: createMdxJsxAttributeValueExpression(meta),
			},
		],
	};

	const stack: (CodeBlockRoot | MdxJsxFlowElement)[] = [codeBlock];
	let cursor = 0;

	for (const event of events) {
		// pos 이전 라인들을 paragraph로 변환해 현재 stack top에 추가한다.
		if (cursor < event.pos) {
			for (let idx = cursor; idx < event.pos; idx += 1) {
				const line = lines[idx];
				if (!line) continue;
				const inlineEvents = composeEventsFromAnnotations(line.annotations);
				const paragraph = composeParagraphFromLine(line.value, inlineEvents, registry);
				stack[stack.length - 1]?.children.push(paragraph);
			}

			cursor = event.pos;
		}

		if (event.kind === "open") {
			const node = registry.get(event.anno.name);
			if (!node || (node.type !== "lineClass" && node.type !== "lineWrap")) {
				continue;
			}

			const flowNode: MdxJsxFlowElement = {
				type: "mdxJsxFlowElement",
				name: node.name,
				attributes: (event.anno.attributes ?? []).map((attr) => ({
					type: "mdxJsxAttribute",
					name: attr.name,
					value: attr.value as MdxJsxAttribute["value"],
				})),
				children: [],
			};

			stack[stack.length - 1]?.children.push(flowNode);
			stack.push(flowNode);
			continue;
		}

		if (event.kind === "close") {
			stack.pop();
		}
	}

	if (cursor < lines.length) {
		for (let idx = cursor; idx < lines.length; idx += 1) {
			const line = lines[idx];
			if (!line) continue;
			const inlineEvents = composeEventsFromAnnotations(line.annotations);
			const paragraph = composeParagraphFromLine(line.value, inlineEvents, registry);
			stack[stack.length - 1]?.children.push(paragraph);
		}
	}

	return codeBlock;
};

export const composeCodeBlockRootFromDocument = (
	document: CodeBlockDocument,
	annotationConfig: AnnotationConfig,
): CodeBlockRoot => {
	const registry = createAnnotationRegistry(annotationConfig);
	const lineAnnotationEvents = composeEventsFromAnnotations(document.annotations);
	return composeCodeBlockRootFromLines(document.lines, lineAnnotationEvents, registry, {
		lang: document.lang,
		meta: document.meta,
	});
};

export const __testable__ = {
	buildLineFromParagraph,
	extractCodeBlockHeaderFromMdast,
	buildCodeBlockBodyFromMdast,
	buildCodeBlockDocumentFromMdast,
	composeParagraphFromLine,
	composeCodeBlockRootFromLines,
	composeCodeBlockRootFromDocument,
};
