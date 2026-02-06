import type { Node, Paragraph } from "mdast";
import type { MdxJsxAttribute, MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import {
	composeEventsFromAnnotations,
	createAnnotationRegistry,
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
	CodeBlockRoot,
	InlineAnnotation,
	Line,
	LineAnnotation,
	MdastNodeLike,
} from "./types";

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
					// TODO : 추후 MdxJsxExpressionAttribute 혹은 value가 string이 아닐 경우 대응
					// (fields.object 쓸 경우에 들어올 것으로 보임. name이 없고 value만 존재
					attributes: node.attributes
						.filter(
							(attr): attr is MdxJsxAttribute & { name: string; value: string } =>
								attr.type === "mdxJsxAttribute" && typeof attr.value === "string",
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

const buildCodeBlockDocumentFromMdast = (
	mdxAst: CodeBlockRoot,
	annotationConfig: AnnotationConfig,
): CodeBlockDocument => {
	const lines: Line[] = [];
	const annotations: LineAnnotation[] = [];

	const registry = createAnnotationRegistry(annotationConfig);

	mdxAst.children.forEach((childNode) => {
		if (childNode.type === "paragraph") {
			const line = buildLineFromParagraph(childNode, registry);

			lines.push(line);

			return;
		}

		if (childNode.type === "mdxJsxFlowElement") {
			if (!childNode.name || childNode.children.length === 0) {
				return;
			}

			const config = registry.get(childNode.name);

			if (!config || config.type === "inlineClass" || config.type === "inlineWrap") {
				return;
			}

			const start = lines.length;

			childNode.children.forEach((node) => {
				if (node.type === "paragraph") {
					const line = buildLineFromParagraph(node, registry);
					lines.push(line);
				}
			});

			const end = lines.length;

			const annotation = {
				...config,
				range: {
					start,
					end,
				},
				order: annotations.length,
			};

			annotations.push(annotation);
		}
	});

	return { lines, annotations };
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
): CodeBlockRoot => {
	const codeBlock: CodeBlockRoot = {
		type: "mdxJsxFlowElement",
		name: "CodeBlock",
		children: [],
		attributes: [],
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
				attributes: [],
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

const composeCodeBlockRootFromDocument = (
	document: CodeBlockDocument,
	annotationConfig: AnnotationConfig,
): CodeBlockRoot => {
	const registry = createAnnotationRegistry(annotationConfig);
	const lineAnnotationEvents = composeEventsFromAnnotations(document.annotations);
	return composeCodeBlockRootFromLines(document.lines, lineAnnotationEvents, registry);
};

export const __testable__ = {
	buildLineFromParagraph,
	buildCodeBlockDocumentFromMdast,
	composeParagraphFromLine,
	composeCodeBlockRootFromLines,
	composeCodeBlockRootFromDocument,
};
