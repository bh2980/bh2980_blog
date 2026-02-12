import type { Break, Node, Paragraph, Text } from "mdast";
import type { MdxJsxAttribute, MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { resolveCommentSyntax } from "./comment-syntax";
import { createAnnotationRegistry, supportsAnnotationScope } from "./libs";
import type {
	AnnotationAttr,
	AnnotationConfig,
	AnnotationRegistry,
	AnnotationRegistryItem,
	CodeBlockDocument,
	CodeBlockMetaValue,
	InlineAnnotation,
	Line,
} from "./types";

const DEFAULT_CODE_LANG = "text";

const hasChildren = (node: Node): node is Node & { children: Node[] } => "children" in node;
const isText = (node: Node): node is Text => node.type === "text";
const isBreak = (node: Node): node is Break => node.type === "break";
const isMDXJSXTextElement = (node: Node): node is MdxJsxTextElement => node.type === "mdxJsxTextElement";

const isScopeAnnotationCommentLine = (
	lineText: string,
	commentSyntax: {
		prefix: string;
		postfix: string;
	},
) => {
	let body = lineText.trim();
	const prefix = commentSyntax.prefix.trim();
	const postfix = commentSyntax.postfix.trim();

	if (prefix.length > 0) {
		if (!body.startsWith(prefix)) return false;
		body = body.slice(prefix.length).trimStart();
	}

	if (postfix.length > 0) {
		if (!body.endsWith(postfix)) return false;
		body = body.slice(0, body.length - postfix.length).trimEnd();
	}

	return /^@(char|line|document)\s+[A-Za-z_][\w-]*(?:\s+\{[^}]+\})?(?:\s+.*)?$/.test(body);
};

const toInlineAnnotationFromConfig = ({
	config,
	name,
	range,
	order,
	attributes,
}: {
	config: AnnotationRegistryItem;
	name: string;
	range: { start: number; end: number };
	order: number;
	attributes?: AnnotationAttr[];
}): InlineAnnotation | undefined => {
	if (!supportsAnnotationScope(config, "char")) return;

	const base = {
		name,
		range,
		order,
		scope: "char" as const,
		source: config.source,
		priority: config.priority,
		attributes,
	};

	if (config.kind === "class") {
		return {
			...base,
			class: config.class ?? "",
		};
	}

	return {
		...base,
		render: config.render ?? name,
	};
};

const toDocAttrValue = (value: MdxJsxAttribute["value"]): unknown => {
	if (value === null) return true;
	if (value == null || typeof value === "string") return value;
	if (typeof value !== "object") return value;
	if (value.type !== "mdxJsxAttributeValueExpression" || typeof value.value !== "string") return value;

	try {
		return JSON.parse(value.value);
	} catch {
		return value.value;
	}
};

const fromParagraphToLine = (p: Paragraph, registry: AnnotationRegistry): Line => {
	let pureCode = "";
	const annotations: InlineAnnotation[] = [];

	function recursiveBuildAnnotationInfo(node: Node) {
		if (isText(node)) {
			pureCode += node.value;
			return;
		}

		if (isBreak(node)) {
			pureCode += "\n";
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
			if (!anno) {
				return;
			}

			if (isMDXJSXTextElement(node)) {
				if (!node.name) {
					return;
				}

				const annotation = toInlineAnnotationFromConfig({
					config: anno,
					name: node.name,
					range: { start, end },
					order: annotations.length,
					attributes: node.attributes
						.filter((attr): attr is MdxJsxAttribute & { name: string } => attr.type === "mdxJsxAttribute")
						.map<AnnotationAttr>((attr) => ({
							name: attr.name,
							value: toDocAttrValue(attr.value),
						})),
				});
				if (!annotation) return;

				annotations.push(annotation);
				return;
			}

			const annotation = toInlineAnnotationFromConfig({
				config: anno,
				name: nodeType,
				range: { start, end },
				order: annotations.length,
			});
			if (!annotation) return;

			annotations.push(annotation);
			return;
		}
	}

	recursiveBuildAnnotationInfo(p);

	return { value: pureCode, annotations };
};

const splitLineByHardBreak = (
	line: Line,
	commentSyntax: {
		prefix: string;
		postfix: string;
	},
): Line[] => {
	if (!line.value.includes("\n")) {
		return [line];
	}

	const chunks = line.value.split("\n");
	if (chunks.at(-1) === "" && isScopeAnnotationCommentLine(chunks.at(-2) ?? "", commentSyntax)) {
		chunks.pop();
	}
	const result: Line[] = [];
	let base = 0;

	for (const chunk of chunks) {
		const lineStart = base;
		const lineEnd = lineStart + chunk.length;

		const annotations = line.annotations
			.map((annotation, order) => {
				const segStart = Math.max(annotation.range.start, lineStart);
				const segEnd = Math.min(annotation.range.end, lineEnd);
				if (segStart >= segEnd) return null;

				return {
					...annotation,
					range: {
						start: segStart - lineStart,
						end: segEnd - lineStart,
					},
					order,
				};
			})
			.filter((annotation): annotation is Line["annotations"][number] => annotation !== null);

		result.push({
			value: chunk,
			annotations,
		});

		base = lineEnd + 1;
	}

	return result;
};

const toAbsoluteInlineRange = (lines: Line[]): Line[] => {
	const nextLines: Line[] = [];
	let lineStart = 0;

	for (const line of lines) {
		const annotations = line.annotations.map((annotation, order) => ({
			...annotation,
			range: {
				start: lineStart + annotation.range.start,
				end: lineStart + annotation.range.end,
			},
			order,
		}));

		nextLines.push({
			...line,
			annotations,
		});

		lineStart += line.value.length + 1;
	}

	return nextLines;
};

const fromMdxFlowElementToCodeHeader = (mdxAst: MdxJsxFlowElement): Pick<CodeBlockDocument, "lang" | "meta"> => {
	const langAttr = mdxAst.attributes.find((node) => node.type === "mdxJsxAttribute" && node.name === "lang");
	const lang =
		langAttr?.type === "mdxJsxAttribute" && typeof langAttr.value === "string" ? langAttr.value : DEFAULT_CODE_LANG;
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

const fromMdxFlowElementToCodeBody = (
	mdxAst: MdxJsxFlowElement,
	registry: AnnotationRegistry,
	commentSyntax: {
		prefix: string;
		postfix: string;
	},
): Pick<CodeBlockDocument, "lines" | "annotations"> => {
	const lines: Line[] = [];

	for (const childNode of mdxAst.children) {
		if (childNode.type !== "paragraph") {
			continue;
		}

		const line = fromParagraphToLine(childNode, registry);
		lines.push(...splitLineByHardBreak(line, commentSyntax));
	}

	return { lines: toAbsoluteInlineRange(lines), annotations: [] };
};

export const fromMdxFlowElementToCodeDocument = (
	mdxAst: MdxJsxFlowElement,
	annotationConfig: AnnotationConfig,
): CodeBlockDocument => {
	const registry = createAnnotationRegistry(annotationConfig);
	const { lang, meta } = fromMdxFlowElementToCodeHeader(mdxAst);
	const commentSyntax = resolveCommentSyntax(lang);
	const { lines, annotations } = fromMdxFlowElementToCodeBody(mdxAst, registry, commentSyntax);

	return { lang, meta, lines, annotations };
};

export const __testable__ = {
	fromParagraphToLine,
	fromMdxFlowElementToCodeHeader,
	fromMdxFlowElementToCodeBody,
	toDocAttrValue,
	fromMdxFlowElementToCodeDocument,
};
