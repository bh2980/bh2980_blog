import type { Code, Root } from "mdast";
import type { DecorationItem } from "shiki";
import { visit } from "unist-util-visit";
import { buildCodeBlockDocumentFromCodeFence } from "@/libs/annotation/code-block/code-string-converter";
import type {
	AnnotationConfig,
	InlineAnnotation,
	LineAnnotation,
} from "@/libs/annotation/code-block/types";

const hasClass = (annotation: InlineAnnotation): annotation is InlineAnnotation & { class: string } =>
	"class" in annotation && typeof annotation.class === "string";

const hasRender = (annotation: InlineAnnotation): annotation is InlineAnnotation & { render: string } =>
	"render" in annotation && typeof annotation.render === "string";

const buildInlineDecoration = (lineNumber: number, annotation: InlineAnnotation): DecorationItem | undefined => {
	if (annotation.range.start >= annotation.range.end) return undefined;

	if (annotation.type === "inlineClass" && hasClass(annotation)) {
		return {
			start: { line: lineNumber, character: annotation.range.start },
			end: { line: lineNumber, character: annotation.range.end },
			properties: { class: annotation.class },
		};
	}

	if (annotation.type === "inlineWrap" && hasRender(annotation)) {
		const props: Record<string, string> = { "data-anno-render": annotation.render };
		for (const attr of annotation.attributes ?? []) {
			props[`data-anno-${attr.name}`] = JSON.stringify(attr.value);
		}

		return {
			start: { line: lineNumber, character: annotation.range.start },
			end: { line: lineNumber, character: annotation.range.end },
			properties: props,
		};
	}

	return undefined;
};

const toLineDecorationPayload = (annotation: LineAnnotation) => {
	if (annotation.type !== "lineClass") return undefined;
	if (!("class" in annotation) || typeof annotation.class !== "string") return undefined;

	return {
		type: annotation.type,
		typeId: annotation.typeId,
		tag: annotation.tag,
		name: annotation.name,
		range: annotation.range,
		order: annotation.order,
		class: annotation.class,
	};
};

const toLineWrapperPayload = (annotation: LineAnnotation) => {
	if (annotation.type !== "lineWrap") return undefined;
	if (!("render" in annotation) || typeof annotation.render !== "string") return undefined;

	return {
		type: annotation.type,
		typeId: annotation.typeId,
		tag: annotation.tag,
		name: annotation.name,
		range: annotation.range,
		order: annotation.order,
		render: annotation.render,
		attributes: annotation.attributes ?? [],
	};
};

export type LineDecorationPayload = ReturnType<typeof toLineDecorationPayload> extends infer T
	? Exclude<T, undefined>
	: never;
export type LineWrapperPayload = ReturnType<typeof toLineWrapperPayload> extends infer T ? Exclude<T, undefined> : never;

export function remarkAnnotationToShikiDecoration(annotationConfig: AnnotationConfig) {
	return (tree: Root) => {
		visit(tree, "code", (node: Code) => {
			const document = buildCodeBlockDocumentFromCodeFence(node, annotationConfig);
			const inlineDecorations: DecorationItem[] = [];
			const lineDecorations: LineDecorationPayload[] = [];
			const lineWrappers: LineWrapperPayload[] = [];

			document.lines.forEach((line, lineNumber) => {
				for (const annotation of line.annotations) {
					const decoration = buildInlineDecoration(lineNumber, annotation);
					if (decoration) inlineDecorations.push(decoration);
				}
			});

			document.annotations.forEach((annotation) => {
				const lineDecoration = toLineDecorationPayload(annotation);
				if (lineDecoration) {
					lineDecorations.push(lineDecoration);
					return;
				}

				const lineWrapper = toLineWrapperPayload(annotation);
				if (lineWrapper) {
					lineWrappers.push(lineWrapper);
				}
			});

			node.value = document.lines.map((line) => line.value).join("\n");
			node.data ??= {};
			node.data.hProperties = {
				...node.data.hProperties,
				"data-decorations": JSON.stringify(inlineDecorations),
				"data-line-decorations": JSON.stringify(lineDecorations),
				"data-line-wrappers": JSON.stringify(lineWrappers),
				"data-lang": document.lang,
				"data-meta": JSON.stringify(document.meta),
			};
		});
	};
}
