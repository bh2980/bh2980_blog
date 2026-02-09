import type { Code } from "mdast";
import { buildAnnotationCommentPattern, resolveCommentSyntax } from "./comment-syntax";
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

const parseCodeFenceMeta = (meta: string): CodeBlockDocument["meta"] => {
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

const parseAnnotationAttrs = (rest: string) => {
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

const parseRangeAnnotationComment = (line: string, pattern: RegExp) => {
	const match = line.match(pattern);
	if (!match?.groups) return;

	const start = Number(match.groups.start);
	const end = Number(match.groups.end);
	if (!Number.isFinite(start) || !Number.isFinite(end)) return;

	return {
		tag: match.groups.tag,
		name: match.groups.name,
		range: { start, end },
		attributes: parseAnnotationAttrs(match.groups.attrs ?? ""),
	};
};

const buildStartMarkerPattern = (commentSyntax: { prefix: string; postfix: string }): RegExp => {
	const prefix = commentSyntax.prefix.trim();
	const postfix = commentSyntax.postfix.trim();
	const prefixPart = prefix ? `${escapeRegExp(prefix)}\\s*` : "";
	const postfixPart = postfix ? `\\s*${escapeRegExp(postfix)}` : "";

	return new RegExp(
		String.raw`^\s*${prefixPart}@(?<tag>[A-Za-z][\w-]*)\s+(?<name>[A-Za-z_][\w-]*)(?<attrs>.*?)${postfixPart}\s*$`,
	);
};

const buildEndMarkerPattern = (commentSyntax: { prefix: string; postfix: string }): RegExp => {
	const prefix = commentSyntax.prefix.trim();
	const postfix = commentSyntax.postfix.trim();
	const prefixPart = prefix ? `${escapeRegExp(prefix)}\\s*` : "";
	const postfixPart = postfix ? `\\s*${escapeRegExp(postfix)}` : "";

	return new RegExp(
		String.raw`^\s*${prefixPart}@end\s+(?<tag>[A-Za-z][\w-]*)\s+(?<name>[A-Za-z_][\w-]*)${postfixPart}\s*$`,
	);
};

const parseStartMarkerComment = (line: string, pattern: RegExp) => {
	const match = line.match(pattern);
	if (!match?.groups) return;

	return {
		tag: match.groups.tag,
		name: match.groups.name,
		attributes: parseAnnotationAttrs(match.groups.attrs ?? ""),
	};
};

const parseEndMarkerComment = (line: string, pattern: RegExp) => {
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

type AnnotationTypeDefinition = ReturnType<typeof resolveAnnotationTypeDefinition>;
type AnnotationRegistry = ReturnType<typeof createAnnotationRegistry>;
type ParsedRangeAnnotation = ReturnType<typeof parseRangeAnnotationComment>;
type ParsedStartMarker = ReturnType<typeof parseStartMarkerComment>;
type ParsedEndMarker = ReturnType<typeof parseEndMarkerComment>;
type StagedInlineAnnotation = {
	lineIndex: number;
	annotation: CodeBlockDocument["lines"][number]["annotations"][number];
};
type CommentPatterns = {
	range: RegExp;
	startMarker: RegExp;
	endMarker: RegExp;
};

const pushLineMarkerAnnotation = (
	annotations: CodeBlockDocument["annotations"],
	marker: PendingLineMarker,
	endLineIndex: number,
	typeDefinition: AnnotationTypeDefinition,
) => {
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

const findPendingLineMarkerIndex = (
	pendingLineMarkers: PendingLineMarker[],
	parsedEndMarker: NonNullable<ParsedEndMarker>,
	type: "lineClass" | "lineWrap",
) => {
	for (let idx = pendingLineMarkers.length - 1; idx >= 0; idx -= 1) {
		const marker = pendingLineMarkers[idx];
		if (!marker) continue;
		if (marker.tag !== parsedEndMarker.tag) continue;
		if (marker.name !== parsedEndMarker.name) continue;
		if (marker.type !== type) continue;
		return idx;
	}

	return -1;
};

const tryCloseLineMarker = ({
	lineText,
	annotationEndMarkerPattern,
	tagToType,
	pendingLineMarkers,
	annotations,
	linesLength,
	typeDefinition,
}: {
	lineText: string;
	annotationEndMarkerPattern: RegExp;
	tagToType: Record<string, AnnotationType>;
	pendingLineMarkers: PendingLineMarker[];
	annotations: CodeBlockDocument["annotations"];
	linesLength: number;
	typeDefinition: AnnotationTypeDefinition;
}) => {
	const parsedEndMarker = parseEndMarkerComment(lineText, annotationEndMarkerPattern);
	if (!parsedEndMarker) return false;

	const type = tagToType[parsedEndMarker.tag];
	if (type !== "lineClass" && type !== "lineWrap") return false;

	const matchedIndex = findPendingLineMarkerIndex(pendingLineMarkers, parsedEndMarker, type);
	if (matchedIndex < 0) return false;

	const [marker] = pendingLineMarkers.splice(matchedIndex, 1);
	if (!marker) return false;

	pushLineMarkerAnnotation(annotations, marker, linesLength, typeDefinition);
	return true;
};

const tryOpenLineMarker = ({
	lineText,
	annotationStartMarkerPattern,
	tagToType,
	registry,
	pendingLineMarkers,
	linesLength,
	nextOrder,
}: {
	lineText: string;
	annotationStartMarkerPattern: RegExp;
	tagToType: Record<string, AnnotationType>;
	registry: AnnotationRegistry;
	pendingLineMarkers: PendingLineMarker[];
	linesLength: number;
	nextOrder: number;
}) => {
	const parsedStartMarker = parseStartMarkerComment(lineText, annotationStartMarkerPattern);
	if (!parsedStartMarker) return false;

	const type = tagToType[parsedStartMarker.tag];
	const config = registry.get(parsedStartMarker.name);
	if (type === "lineClass" && config?.type === "lineClass") {
		pendingLineMarkers.push({
			tag: parsedStartMarker.tag,
			name: parsedStartMarker.name,
			type: "lineClass",
			config,
			startLineIndex: linesLength,
			order: nextOrder,
			attributes: parsedStartMarker.attributes,
		});
		return true;
	}

	if (type === "lineWrap" && config?.type === "lineWrap") {
		pendingLineMarkers.push({
			tag: parsedStartMarker.tag,
			name: parsedStartMarker.name,
			type: "lineWrap",
			config,
			startLineIndex: linesLength,
			order: nextOrder,
			attributes: parsedStartMarker.attributes,
		});
		return true;
	}

	return false;
};

const commitCodeLine = ({
	lines,
	pendingInline,
	stagedInline,
	lineText,
}: {
	lines: CodeBlockDocument["lines"];
	pendingInline: CodeBlockDocument["lines"][number]["annotations"];
	stagedInline: StagedInlineAnnotation[];
	lineText: string;
}) => {
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

const pushRangeAnnotation = ({
	parsed,
	parseLineAnnotations,
	tagToType,
	registry,
	typeDefinition,
	annotations,
	pendingInline,
}: {
	parsed: NonNullable<ParsedRangeAnnotation>;
	parseLineAnnotations: boolean;
	tagToType: Record<string, AnnotationType>;
	registry: AnnotationRegistry;
	typeDefinition: AnnotationTypeDefinition;
	annotations: CodeBlockDocument["annotations"];
	pendingInline: CodeBlockDocument["lines"][number]["annotations"];
}) => {
	const type = tagToType[parsed.tag];
	const config = registry.get(parsed.name);
	if (!type || !config || config.type !== type) return false;

	const base = {
		...getStylePayload(config),
		source: config.source,
		priority: config.priority,
		name: parsed.name,
		range: parsed.range,
		attributes: parsed.attributes,
	};

	if (type === "lineClass") {
		if (!parseLineAnnotations) return false;
		annotations.push({
			...base,
			type: "lineClass",
			...typeDefinition.lineClass,
			order: annotations.length,
		});
		return true;
	}

	if (type === "lineWrap") {
		if (!parseLineAnnotations) return false;
		annotations.push({
			...base,
			type: "lineWrap",
			...typeDefinition.lineWrap,
			order: annotations.length,
		});
		return true;
	}

	if (type === "inlineClass") {
		pendingInline.push({
			...base,
			type: "inlineClass",
			...typeDefinition.inlineClass,
			order: pendingInline.length,
		});
		return true;
	}

	pendingInline.push({
		...base,
		type: "inlineWrap",
		...typeDefinition.inlineWrap,
		order: pendingInline.length,
	});
	return true;
};

const parseCodeLines = ({
	codeValue,
	parseLineAnnotations,
	patterns,
	tagToType,
	registry,
	typeDefinition,
}: {
	codeValue: string;
	parseLineAnnotations: boolean;
	patterns: CommentPatterns;
	tagToType: Record<string, AnnotationType>;
	registry: AnnotationRegistry;
	typeDefinition: AnnotationTypeDefinition;
}) => {
	const lines: CodeBlockDocument["lines"] = [];
	const annotations: CodeBlockDocument["annotations"] = [];
	const pendingInline: CodeBlockDocument["lines"][number]["annotations"] = [];
	const pendingLineMarkers: PendingLineMarker[] = [];
	const stagedInline: StagedInlineAnnotation[] = [];
	let lineMarkerOrder = 0;

	for (const lineText of codeValue.split("\n")) {
		const parsedRange = parseRangeAnnotationComment(lineText, patterns.range);
		if (parsedRange) {
			const consumed = pushRangeAnnotation({
				parsed: parsedRange,
				parseLineAnnotations,
				tagToType,
				registry,
				typeDefinition,
				annotations,
				pendingInline,
			});

			if (consumed) continue;
			commitCodeLine({ lines, pendingInline, stagedInline, lineText });
			continue;
		}

		if (parseLineAnnotations) {
			const closed = tryCloseLineMarker({
				lineText,
				annotationEndMarkerPattern: patterns.endMarker,
				tagToType,
				pendingLineMarkers,
				annotations,
				linesLength: lines.length,
				typeDefinition,
			});
			if (closed) continue;

			const opened = tryOpenLineMarker({
				lineText,
				annotationStartMarkerPattern: patterns.startMarker,
				tagToType,
				registry,
				pendingLineMarkers,
				linesLength: lines.length,
				nextOrder: lineMarkerOrder,
			});
			if (opened) {
				lineMarkerOrder += 1;
				continue;
			}
		}

		commitCodeLine({ lines, pendingInline, stagedInline, lineText });
	}

	for (const marker of pendingLineMarkers) {
		pushLineMarkerAnnotation(annotations, marker, lines.length, typeDefinition);
	}

	return { lines, annotations, stagedInline };
};

const applyAbsoluteInlineRanges = (lines: CodeBlockDocument["lines"], stagedInline: StagedInlineAnnotation[]) => {
	let lineStart = 0;

	lines.forEach((line, lineIndex) => {
		const lineEnd = lineStart + line.value.length;
		const inlineForLine = stagedInline
			.filter((item) => item.lineIndex === lineIndex)
			.map((item, order) => ({
				...item.annotation,
				range: {
					start: lineStart + item.annotation.range.start,
					end: lineStart + item.annotation.range.end,
				},
				order,
			}));

		line.annotations = inlineForLine;
		lineStart = lineEnd + 1;
	});
};

export const fromCodeFenceToCodeBlockDocument = (
	codeNode: Code,
	annotationConfig: AnnotationConfig,
	options?: { parseLineAnnotations?: boolean },
): CodeBlockDocument => {
	const registry = createAnnotationRegistry(annotationConfig);
	const typeDefinition = resolveAnnotationTypeDefinition(annotationConfig);
	const tagToType = createTagToTypeMap(annotationConfig);
	const lang = codeNode.lang?.trim() || DEFAULT_CODE_LANG;
	const meta = parseCodeFenceMeta(codeNode.meta ?? "");
	const commentSyntax = resolveCommentSyntax(lang);
	const patterns: CommentPatterns = {
		range: buildAnnotationCommentPattern(commentSyntax),
		startMarker: buildStartMarkerPattern(commentSyntax),
		endMarker: buildEndMarkerPattern(commentSyntax),
	};
	const parseLineAnnotations = options?.parseLineAnnotations ?? true;
	const parsed = parseCodeLines({
		codeValue: codeNode.value,
		parseLineAnnotations,
		patterns,
		tagToType,
		registry,
		typeDefinition,
	});

	applyAbsoluteInlineRanges(parsed.lines, parsed.stagedInline);
	return { lang, meta, lines: parsed.lines, annotations: parsed.annotations };
};

export const __testable__ = {
	parseCodeFenceMeta,
	parseAnnotationAttrs,
	parseRangeAnnotationComment,
	fromCodeFenceToCodeBlockDocument,
};
