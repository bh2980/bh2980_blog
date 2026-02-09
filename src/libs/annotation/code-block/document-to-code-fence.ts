import type { Code } from "mdast";
import { type CommentSyntax, formatAnnotationComment, resolveCommentSyntax } from "./comment-syntax";
import { createAnnotationRegistry, resolveAnnotationTypeDefinition } from "./libs";
import type { AnnotationConfig, CodeBlockDocument } from "./types";

const fromLineValueToLeadingIndent = (lineValue: string) => {
	const match = lineValue.match(/^[\t ]*/);
	return match?.[0] ?? "";
};

const fromDocumentMetaToCodeFenceMeta = (meta: CodeBlockDocument["meta"]) => {
	return Object.entries(meta)
		.map(([key, value]) => {
			if (typeof value === "boolean") {
				return value ? key : "";
			}

			return `${key}=${JSON.stringify(value)}`;
		})
		.filter((item) => item.length > 0)
		.join(" ");
};

const fromAnnotationToCommentLine = (
	commentSyntax: CommentSyntax,
	annotation: {
		tag: string;
		name: string;
		range: { start: number; end: number };
		attributes?: { name: string; value: unknown }[];
	},
) => {
	const attrs = (annotation.attributes ?? [])
		.map((attr) => {
			if (typeof attr.value === "boolean") {
				return attr.value ? attr.name : "";
			}

			return `${attr.name}=${JSON.stringify(attr.value)}`;
		})
		.filter((item) => item.length > 0)
		.join(" ");

	const body = [`@${annotation.tag}`, annotation.name, `{${annotation.range.start}-${annotation.range.end}}`, attrs]
		.filter(Boolean)
		.join(" ");

	return formatAnnotationComment(commentSyntax, body);
};

export const fromCodeBlockDocumentToCodeFence = (
	document: CodeBlockDocument,
	annotationConfig: AnnotationConfig,
): Code => {
	createAnnotationRegistry(annotationConfig);
	const typeDefinition = resolveAnnotationTypeDefinition(annotationConfig);

	const commentSyntax = resolveCommentSyntax(document.lang);
	const lineAnnotationByStart = new Map<number, CodeBlockDocument["annotations"]>();

	for (const annotation of [...document.annotations].sort((a, b) => a.order - b.order)) {
		if (annotation.range.start >= annotation.range.end) continue;
		const bucket = lineAnnotationByStart.get(annotation.range.start) ?? [];
		bucket.push(annotation);
		lineAnnotationByStart.set(annotation.range.start, bucket);
	}

	const outputLines: string[] = [];
	const lineStartOffsets: number[] = [];
	let lineStart = 0;

	for (const line of document.lines) {
		lineStartOffsets.push(lineStart);
		lineStart += line.value.length + 1;
	}

	document.lines.forEach((line, lineIndex) => {
		const leadingIndent = fromLineValueToLeadingIndent(line.value);
		const lineOffset = lineStartOffsets[lineIndex] ?? 0;
		const lineAnnotations = lineAnnotationByStart.get(lineIndex) ?? [];
		for (const annotation of lineAnnotations) {
			outputLines.push(
				`${leadingIndent}${fromAnnotationToCommentLine(commentSyntax, {
					...annotation,
					tag: typeDefinition[annotation.type].tag,
				})}`,
			);
		}

		for (const annotation of [...line.annotations].sort((a, b) => a.order - b.order)) {
			const isLocalRange =
				annotation.range.start >= 0 &&
				annotation.range.end >= annotation.range.start &&
				annotation.range.end <= line.value.length;
			const localRange = isLocalRange
				? annotation.range
				: {
						start: annotation.range.start - lineOffset,
						end: annotation.range.end - lineOffset,
					};

			if (localRange.start >= localRange.end) continue;
			outputLines.push(
				`${leadingIndent}${fromAnnotationToCommentLine(commentSyntax, {
					...annotation,
					range: localRange,
					tag: typeDefinition[annotation.type].tag,
				})}`,
			);
		}

		outputLines.push(line.value);
	});

	return {
		type: "code",
		lang: document.lang,
		meta: fromDocumentMetaToCodeFenceMeta(document.meta),
		value: outputLines.join("\n"),
	};
};

export const __testable__ = {
	fromLineValueToLeadingIndent,
	fromDocumentMetaToCodeFenceMeta,
	fromAnnotationToCommentLine,
	fromCodeBlockDocumentToCodeFence,
};
