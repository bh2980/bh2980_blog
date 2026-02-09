import type { Code, Root } from "mdast";
import type { DecorationItem } from "shiki";
import { visit } from "unist-util-visit";
import { fromCodeFenceToCodeBlockDocument } from "@/libs/annotation/code-block/code-fence-to-document";
import type {
	AnnotationConfig,
	CodeBlockDocument,
	InlineAnnotation,
	LineAnnotation,
} from "@/libs/annotation/code-block/types";
import { createAllowedRenderTagsFromConfig } from "./render-policy";

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

export type LineDecorationPayload =
	ReturnType<typeof toLineDecorationPayload> extends infer T ? Exclude<T, undefined> : never;
export type LineWrapperPayload =
	ReturnType<typeof toLineWrapperPayload> extends infer T ? Exclude<T, undefined> : never;

export type ShikiAnnotationPayload = {
	code: string;
	lang: CodeBlockDocument["lang"];
	meta: CodeBlockDocument["meta"];
	decorations: DecorationItem[];
	lineDecorations: LineDecorationPayload[];
	lineWrappers: LineWrapperPayload[];
};

export const fromCodeBlockDocumentToShikiAnnotationPayload = (document: CodeBlockDocument): ShikiAnnotationPayload => {
	const decorations: DecorationItem[] = [];
	const lineDecorations: LineDecorationPayload[] = [];
	const lineWrappers: LineWrapperPayload[] = [];
	const lineStartOffsets: number[] = [];
	let lineStart = 0;

	for (const line of document.lines) {
		lineStartOffsets.push(lineStart);
		lineStart += line.value.length + 1;
	}

	document.lines.forEach((line, lineNumber) => {
		const lineOffset = lineStartOffsets[lineNumber] ?? 0;
		for (const annotation of line.annotations) {
			const isLocalRange =
				annotation.range.start >= 0 &&
				annotation.range.end >= annotation.range.start &&
				annotation.range.end <= line.value.length;
			const decoration = buildInlineDecoration(lineNumber, {
				...annotation,
				range: isLocalRange
					? annotation.range
					: {
							start: annotation.range.start - lineOffset,
							end: annotation.range.end - lineOffset,
						},
			});
			if (decoration) decorations.push(decoration);
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

	return {
		code: document.lines.map((line) => line.value).join("\n"),
		lang: document.lang,
		meta: document.meta,
		decorations,
		lineDecorations,
		lineWrappers,
	};
};

export function remarkAnnotationToShikiDecoration(annotationConfig: AnnotationConfig) {
	const allowedRenderTags = createAllowedRenderTagsFromConfig(annotationConfig);

	return (tree: Root) => {
		visit(tree, "code", (node: Code) => {
			const document = fromCodeFenceToCodeBlockDocument(node, annotationConfig, { parseLineAnnotations: true });
			const payload = fromCodeBlockDocumentToShikiAnnotationPayload(document);

			node.value = payload.code;
			node.data ??= {};
			node.data.hProperties = {
				...node.data.hProperties,
				"data-decorations": JSON.stringify(payload.decorations),
				"data-line-decorations": JSON.stringify(payload.lineDecorations),
				"data-line-wrappers": JSON.stringify(payload.lineWrappers),
				"data-render-tags": JSON.stringify(allowedRenderTags),
				"data-lang": payload.lang,
				"data-meta": JSON.stringify(payload.meta),
			};
		});
	};
}

export const __testable__ = {
	fromCodeBlockDocumentToShikiAnnotationPayload,
};
