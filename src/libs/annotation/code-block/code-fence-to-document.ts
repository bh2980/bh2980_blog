import type { Code } from "mdast";
import { fromCommentSyntaxToAnnotationCommentPattern, resolveCommentSyntax } from "./comment-syntax";
import { ANNOTATION_TYPE_DEFINITION } from "./constants";
import { createAnnotationRegistry, resolveAnnotationTypeDefinition } from "./libs";
import type { AnnotationConfig, AnnotationRegistryItem, AnnotationType, CodeBlockDocument, LineAnnotation } from "./types";

const DEFAULT_CODE_LANG = "text";
const ATTR_RE = /([A-Za-z_][\w-]*)(?:\s*=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s]+)))?/g;

const parseUnquotedAttrValue = (raw: string): unknown => {
	try {
		return JSON.parse(raw);
	} catch {
		return raw;
	}
};
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const fromCodeFenceMetaToDocumentMeta = (meta: string): CodeBlockDocument["meta"] => {
	const parsed: CodeBlockDocument["meta"] = {};
	const input = meta.trim();
	let index = 0;

	const isWhitespace = (ch: string) => ch === " " || ch === "\t" || ch === "\n" || ch === "\r";

	const skipWhitespace = () => {
		while (index < input.length && isWhitespace(input[index])) index += 1;
	};

	const readKey = () => {
		const start = index;
		while (index < input.length) {
			const ch = input[index];
			if (ch === "=" || isWhitespace(ch)) break;
			index += 1;
		}
		return input.slice(start, index);
	};

	const readUnquotedValue = () => {
		const start = index;
		while (index < input.length && !isWhitespace(input[index])) index += 1;
		return input.slice(start, index);
	};

	const readQuotedValue = (quote: '"' | "'") => {
		index += 1;
		let value = "";

		while (index < input.length) {
			const ch = input[index];

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
				index += 1;
				return value;
			}

			value += ch;
			index += 1;
		}

		return value;
	};

	while (index < input.length) {
		skipWhitespace();
		if (index >= input.length) break;

		const key = readKey();
		if (!key) break;

		skipWhitespace();
		if (input[index] !== "=") {
			parsed[key] = true;
			continue;
		}

		index += 1;
		skipWhitespace();

		const firstChar = input[index];
		const raw = firstChar === '"' || firstChar === "'" ? readQuotedValue(firstChar) : readUnquotedValue();

		if (raw === "true") {
			parsed[key] = true;
			continue;
		}

		if (raw === "false") {
			parsed[key] = false;
			continue;
		}

		parsed[key] = raw;
	}

	return parsed;
};

const fromAttributeTextToAnnotationAttrs = (rest: string) => {
	const attrs: { name: string; value: unknown }[] = [];

	for (const match of rest.matchAll(ATTR_RE)) {
		const name = match[1];
		const doubleQuotedRaw = match[2];
		const singleQuotedRaw = match[3];
		const unquotedRaw = match[4];
		let value: unknown;

		if (doubleQuotedRaw === undefined && singleQuotedRaw === undefined && unquotedRaw === undefined) {
			value = true;
		} else if (typeof doubleQuotedRaw === "string" || typeof singleQuotedRaw === "string") {
			const raw = (doubleQuotedRaw ?? singleQuotedRaw ?? "").replace(/\\(["'\\])/g, "$1");
			value = raw;
		} else {
			value = parseUnquotedAttrValue(unquotedRaw ?? "");
		}

		attrs.push({ name, value });
	}

	return attrs;
};

const createTagToTypeMap = (annotationConfig: AnnotationConfig) => {
	const resolved = resolveAnnotationTypeDefinition(annotationConfig);
	const tagToType: Record<string, AnnotationType> = {};

	for (const [type, info] of Object.entries(ANNOTATION_TYPE_DEFINITION) as [AnnotationType, { tag: string }][]) {
		tagToType[info.tag] = type;
	}

	for (const [type, info] of Object.entries(resolved) as [AnnotationType, { tag: string }][]) {
		tagToType[info.tag] = type;
	}

	return tagToType;
};

const getStylePayload = (config: AnnotationRegistryItem) => {
	const raw = config as AnnotationRegistryItem & { class?: string; render?: string };
	if (typeof raw.class === "string") {
		return { class: raw.class };
	}

	if (typeof raw.render === "string") {
		return { render: raw.render };
	}

	return {};
};

const fromAnnotationCommentLineToParsedAnnotation = (line: string, pattern: RegExp) => {
	const match = line.match(pattern);
	if (!match?.groups) return;

	const start = Number(match.groups.start);
	const end = Number(match.groups.end);
	if (!Number.isFinite(start) || !Number.isFinite(end)) return;

	return {
		tag: match.groups.tag,
		name: match.groups.name,
		range: { start, end },
		attributes: fromAttributeTextToAnnotationAttrs(match.groups.attrs ?? ""),
	};
};

const fromCommentSyntaxToAnnotationStartMarkerPattern = (commentSyntax: { prefix: string; postfix: string }): RegExp => {
	const prefix = commentSyntax.prefix.trim();
	const postfix = commentSyntax.postfix.trim();
	const prefixPart = prefix ? `${escapeRegExp(prefix)}\\s*` : "";
	const postfixPart = postfix ? `\\s*${escapeRegExp(postfix)}` : "";

	return new RegExp(
		String.raw`^\s*${prefixPart}@(?<tag>[A-Za-z][\w-]*)\s+(?<name>[A-Za-z_][\w-]*)(?<attrs>.*?)${postfixPart}\s*$`,
	);
};

const fromCommentSyntaxToAnnotationEndMarkerPattern = (commentSyntax: { prefix: string; postfix: string }): RegExp => {
	const prefix = commentSyntax.prefix.trim();
	const postfix = commentSyntax.postfix.trim();
	const prefixPart = prefix ? `${escapeRegExp(prefix)}\\s*` : "";
	const postfixPart = postfix ? `\\s*${escapeRegExp(postfix)}` : "";

	return new RegExp(
		String.raw`^\s*${prefixPart}@end\s+(?<tag>[A-Za-z][\w-]*)\s+(?<name>[A-Za-z_][\w-]*)${postfixPart}\s*$`,
	);
};

const fromAnnotationStartMarkerLine = (line: string, pattern: RegExp) => {
	const match = line.match(pattern);
	if (!match?.groups) return;

	return {
		tag: match.groups.tag,
		name: match.groups.name,
		attributes: fromAttributeTextToAnnotationAttrs(match.groups.attrs ?? ""),
	};
};

const fromAnnotationEndMarkerLine = (line: string, pattern: RegExp) => {
	const match = line.match(pattern);
	if (!match?.groups) return;

	return {
		tag: match.groups.tag,
		name: match.groups.name,
	};
};

type PendingLineMarkerBase = {
	tag: string;
	name: string;
	startLineIndex: number;
	order: number;
	attributes: { name: string; value: unknown }[];
};

type PendingLineMarker = PendingLineMarkerBase &
	(
		| { type: "lineClass"; config: Extract<AnnotationRegistryItem, { type: "lineClass" }> }
		| { type: "lineWrap"; config: Extract<AnnotationRegistryItem, { type: "lineWrap" }> }
	);

export const fromCodeFenceToCodeBlockDocument = (
	codeNode: Code,
	annotationConfig: AnnotationConfig,
	options?: { parseLineAnnotations?: boolean },
): CodeBlockDocument => {
	const registry = createAnnotationRegistry(annotationConfig);
	const typeDefinition = resolveAnnotationTypeDefinition(annotationConfig);
	const tagToType = createTagToTypeMap(annotationConfig);
	const lang = codeNode.lang?.trim() || DEFAULT_CODE_LANG;
	const meta = fromCodeFenceMetaToDocumentMeta(codeNode.meta ?? "");
	const commentSyntax = resolveCommentSyntax(lang);
	const annotationLinePattern = fromCommentSyntaxToAnnotationCommentPattern(commentSyntax);
	const annotationStartMarkerPattern = fromCommentSyntaxToAnnotationStartMarkerPattern(commentSyntax);
	const annotationEndMarkerPattern = fromCommentSyntaxToAnnotationEndMarkerPattern(commentSyntax);
	const parseLineAnnotations = options?.parseLineAnnotations ?? true;

	const lines: CodeBlockDocument["lines"] = [];
	const annotations: CodeBlockDocument["annotations"] = [];
	const pendingInline: CodeBlockDocument["lines"][number]["annotations"] = [];
	const pendingLineMarkers: PendingLineMarker[] = [];
	const stagedInline: Array<{
		lineIndex: number;
		annotation: CodeBlockDocument["lines"][number]["annotations"][number];
	}> = [];
	let lineMarkerOrder = 0;

	const commitCodeLine = (lineText: string) => {
		const lineIndex = lines.length;
		lines.push({
			value: lineText,
			annotations: [],
		});

		for (const annotation of pendingInline) {
			stagedInline.push({
				lineIndex,
				annotation: { ...annotation },
			});
		}

		pendingInline.length = 0;
	};

	const pushLineMarkerAnnotation = (marker: PendingLineMarker, endLineIndex: number) => {
		if (marker.type === "lineClass") {
			const annotation: LineAnnotation = {
				...getStylePayload(marker.config),
				source: marker.config.source,
				priority: marker.config.priority,
				type: "lineClass",
				...typeDefinition.lineClass,
				name: marker.name,
				range: {
					start: marker.startLineIndex,
					end: endLineIndex,
				},
				order: marker.order,
				attributes: marker.attributes,
			};
			annotations.push(annotation);
			return;
		}

		const annotation: LineAnnotation = {
			...getStylePayload(marker.config),
			source: marker.config.source,
			priority: marker.config.priority,
			type: "lineWrap",
			...typeDefinition.lineWrap,
			name: marker.name,
			range: {
				start: marker.startLineIndex,
				end: endLineIndex,
			},
			order: marker.order,
			attributes: marker.attributes,
		};
		annotations.push(annotation);
	};

	for (const lineText of codeNode.value.split("\n")) {
		const parsed = fromAnnotationCommentLineToParsedAnnotation(lineText, annotationLinePattern);

		if (!parsed) {
			if (parseLineAnnotations) {
				const parsedEndMarker = fromAnnotationEndMarkerLine(lineText, annotationEndMarkerPattern);
				if (parsedEndMarker) {
					const type = tagToType[parsedEndMarker.tag];
					if (type === "lineClass" || type === "lineWrap") {
						let matchedIndex = -1;
						for (let idx = pendingLineMarkers.length - 1; idx >= 0; idx -= 1) {
							const marker = pendingLineMarkers[idx];
							if (!marker) continue;
							if (marker.tag !== parsedEndMarker.tag) continue;
							if (marker.name !== parsedEndMarker.name) continue;
							if (marker.type !== type) continue;
							matchedIndex = idx;
							break;
						}

							if (matchedIndex >= 0) {
								const [marker] = pendingLineMarkers.splice(matchedIndex, 1);
								if (marker) {
									pushLineMarkerAnnotation(marker, lines.length);
									continue;
								}
							}
					}
				}

					const parsedStartMarker = fromAnnotationStartMarkerLine(lineText, annotationStartMarkerPattern);
					if (parsedStartMarker) {
						const type = tagToType[parsedStartMarker.tag];
						const config = registry.get(parsedStartMarker.name);
						if (type === "lineClass" && config?.type === "lineClass") {
							pendingLineMarkers.push({
								tag: parsedStartMarker.tag,
								name: parsedStartMarker.name,
								type: "lineClass",
								config,
								startLineIndex: lines.length,
								order: lineMarkerOrder++,
								attributes: parsedStartMarker.attributes,
							});
							continue;
						}

						if (type === "lineWrap" && config?.type === "lineWrap") {
							pendingLineMarkers.push({
								tag: parsedStartMarker.tag,
								name: parsedStartMarker.name,
								type: "lineWrap",
								config,
								startLineIndex: lines.length,
								order: lineMarkerOrder++,
								attributes: parsedStartMarker.attributes,
							});
							continue;
						}
					}
				}

			commitCodeLine(lineText);
			continue;
		}

		const type = tagToType[parsed.tag];
		const config = registry.get(parsed.name);

		if (!type || !config || config.type !== type) {
			commitCodeLine(lineText);
			continue;
		}

		const base = {
			...getStylePayload(config),
			source: config.source,
			priority: config.priority,
			name: parsed.name,
			range: parsed.range,
			attributes: parsed.attributes,
		};

		if (type === "lineClass") {
			if (!parseLineAnnotations) {
				commitCodeLine(lineText);
				continue;
			}

			annotations.push({
				...base,
				type: "lineClass",
				...typeDefinition.lineClass,
				order: annotations.length,
			});
			continue;
		}

		if (type === "lineWrap") {
			if (!parseLineAnnotations) {
				commitCodeLine(lineText);
				continue;
			}

			annotations.push({
				...base,
				type: "lineWrap",
				...typeDefinition.lineWrap,
				order: annotations.length,
			});
			continue;
		}

		if (type === "inlineClass") {
			pendingInline.push({
				...base,
				type: "inlineClass",
				...typeDefinition.inlineClass,
				order: pendingInline.length,
			});
			continue;
		}

		pendingInline.push({
			...base,
			type: "inlineWrap",
			...typeDefinition.inlineWrap,
			order: pendingInline.length,
		});
	}

	for (const marker of pendingLineMarkers) {
		pushLineMarkerAnnotation(marker, lines.length);
	}

	let lineStart = 0;
	lines.forEach((line, lineIndex) => {
		const lineEnd = lineStart + line.value.length;

		const inlineForLine = stagedInline
			.filter((item) => item.lineIndex === lineIndex)
			.map((item, order) => {
				const localRange = item.annotation.range;
				const absRange = {
					start: lineStart + localRange.start,
					end: lineStart + localRange.end,
				};

				return {
					...item.annotation,
					range: absRange,
					order,
				};
			});

		line.annotations = inlineForLine;
		lineStart = lineEnd + 1;
	});

	return { lang, meta, lines, annotations };
};

export const __testable__ = {
	fromCodeFenceMetaToDocumentMeta,
	fromAttributeTextToAnnotationAttrs,
	fromAnnotationCommentLineToParsedAnnotation,
	fromCodeFenceToCodeBlockDocument,
};
