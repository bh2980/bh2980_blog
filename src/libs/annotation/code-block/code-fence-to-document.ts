import type { Code } from "mdast";
import { resolveCommentSyntax } from "./comment-syntax";
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

const buildRangeAnnotationPattern = (commentSyntax: { prefix: string; postfix: string }): RegExp => {
	const prefix = commentSyntax.prefix.trim();
	const postfix = commentSyntax.postfix.trim();
	const prefixPart = prefix ? `${escapeRegExp(prefix)}\\s*` : "";
	const postfixPart = postfix ? `\\s*${escapeRegExp(postfix)}` : "";

	return new RegExp(
		String.raw`^\s*${prefixPart}@(?<tag>[A-Za-z][\w-]*)\s+(?<name>[A-Za-z_][\w-]*)\s+\{(?<start>\d+)-(?<end>\d+)\}(?<attrs>.*?)${postfixPart}\s*$`,
	);
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

const parseStartMarkerComment = (line: string, pattern: RegExp) => {
	const match = line.match(pattern);
	if (!match?.groups) return;

	return {
		tag: match.groups.tag,
		name: match.groups.name,
		attributes: parseAnnotationAttrs(match.groups.attrs ?? ""),
	};
};

type PendingLineMarkerBase = {
	tag: string;
	name: string;
	order: number;
	attributes: { name: string; value: unknown }[];
};

type PendingLineWrapMarker = PendingLineMarkerBase & {
	type: "lineWrap";
	startLineIndex: number;
	config: Extract<AnnotationRegistryItem, { type: "lineWrap" }>;
};

type PendingSingleLineClass = PendingLineMarkerBase & {
	type: "lineClass";
	targetLineIndex: number;
	config: Extract<AnnotationRegistryItem, { type: "lineClass" }>;
};

type AnnotationTypeDefinition = ReturnType<typeof resolveAnnotationTypeDefinition>;
type AnnotationRegistry = ReturnType<typeof createAnnotationRegistry>;
type ParsedRangeAnnotation = ReturnType<typeof parseRangeAnnotationComment>;
type ParsedStartMarker = ReturnType<typeof parseStartMarkerComment>;
type StagedInlineAnnotation = {
	lineIndex: number;
	annotation: CodeBlockDocument["lines"][number]["annotations"][number];
};
type CommentPatterns = {
	range: RegExp;
	startMarker: RegExp;
};

const pushLineWrapMarkerAnnotation = (
	annotations: CodeBlockDocument["annotations"],
	marker: PendingLineWrapMarker,
	endLineIndex: number,
	typeDefinition: AnnotationTypeDefinition,
) => {
	const annotation: LineAnnotation = {
		...getStylePayload(marker.config),
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
	pendingLineMarkers: PendingLineWrapMarker[],
	target: { tag: string; name: string },
) => {
	for (let idx = pendingLineMarkers.length - 1; idx >= 0; idx -= 1) {
		const marker = pendingLineMarkers[idx];
		if (!marker) continue;
		if (marker.tag !== target.tag) continue;
		if (marker.name !== target.name) continue;
		return idx;
	}

	return -1;
};

const tryOpenLineMarker = ({
	lineText,
	annotationStartMarkerPattern,
	tagToType,
	registry,
	pendingLineMarkers,
	pendingSingleLineClasses,
	annotations,
	typeDefinition,
	linesLength,
	nextOrder,
}: {
	lineText: string;
	annotationStartMarkerPattern: RegExp;
	tagToType: Record<string, AnnotationType>;
	registry: AnnotationRegistry;
	pendingLineMarkers: PendingLineWrapMarker[];
	pendingSingleLineClasses: PendingSingleLineClass[];
	annotations: CodeBlockDocument["annotations"];
	typeDefinition: AnnotationTypeDefinition;
	linesLength: number;
	nextOrder: number;
}) => {
	const parsedStartMarker = parseStartMarkerComment(lineText, annotationStartMarkerPattern);
	if (!parsedStartMarker) return false;

	const type = tagToType[parsedStartMarker.tag];
	const hasEndAttr = parsedStartMarker.attributes.some((attr) => attr.name === "end" && attr.value === true);
	const markerAttributes = parsedStartMarker.attributes.filter((attr) => attr.name !== "end");
	const config = registry.get(parsedStartMarker.name);

	if (hasEndAttr) {
		if (type === "lineClass") return true;
		if (type !== "lineWrap") return false;

		const matchedIndex = findPendingLineMarkerIndex(pendingLineMarkers, {
			tag: parsedStartMarker.tag,
			name: parsedStartMarker.name,
		});
		if (matchedIndex < 0) return true;

		const [marker] = pendingLineMarkers.splice(matchedIndex, 1);
		if (!marker) return true;

		pushLineWrapMarkerAnnotation(annotations, marker, linesLength, typeDefinition);
		return true;
	}

	if (type === "lineClass" && config?.type === "lineClass") {
		pendingSingleLineClasses.push({
			tag: parsedStartMarker.tag,
			name: parsedStartMarker.name,
			type: "lineClass",
			config,
			targetLineIndex: linesLength,
			order: nextOrder,
			attributes: markerAttributes,
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
			attributes: markerAttributes,
		});
		return true;
	}

	return false;
};

const commitCodeLine = ({
	lines,
	annotations,
	typeDefinition,
	pendingInline,
	pendingSingleLineClasses,
	stagedInline,
	lineText,
}: {
	lines: CodeBlockDocument["lines"];
	annotations: CodeBlockDocument["annotations"];
	typeDefinition: AnnotationTypeDefinition;
	pendingInline: CodeBlockDocument["lines"][number]["annotations"];
	pendingSingleLineClasses: PendingSingleLineClass[];
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

	for (let idx = pendingSingleLineClasses.length - 1; idx >= 0; idx -= 1) {
		const marker = pendingSingleLineClasses[idx];
		if (!marker || marker.targetLineIndex !== lineIndex) continue;

		const annotation: LineAnnotation = {
			...getStylePayload(marker.config),
			priority: marker.config.priority,
			type: "lineClass",
			...typeDefinition.lineClass,
			name: marker.name,
			range: {
				start: lineIndex,
				end: lineIndex + 1,
			},
			order: annotations.length,
			attributes: marker.attributes,
		};

		annotations.push(annotation);
		pendingSingleLineClasses.splice(idx, 1);
	}
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
		if (config.type !== "inlineClass") return false;
		pendingInline.push({
			...base,
			source: config.source,
			type: "inlineClass",
			...typeDefinition.inlineClass,
			order: pendingInline.length,
		});
		return true;
	}

	if (config.type !== "inlineWrap") return false;
	pendingInline.push({
		...base,
		source: config.source,
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
	const pendingLineMarkers: PendingLineWrapMarker[] = [];
	const pendingSingleLineClasses: PendingSingleLineClass[] = [];
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
			commitCodeLine({
				lines,
				annotations,
				typeDefinition,
				pendingInline,
				pendingSingleLineClasses,
				stagedInline,
				lineText,
			});
			continue;
		}

		if (parseLineAnnotations) {
			const opened = tryOpenLineMarker({
				lineText,
				annotationStartMarkerPattern: patterns.startMarker,
				tagToType,
				registry,
				pendingLineMarkers,
				pendingSingleLineClasses,
				annotations,
				typeDefinition,
				linesLength: lines.length,
				nextOrder: lineMarkerOrder,
			});
			if (opened) {
				lineMarkerOrder += 1;
				continue;
			}
		}

		commitCodeLine({
			lines,
			annotations,
			typeDefinition,
			pendingInline,
			pendingSingleLineClasses,
			stagedInline,
			lineText,
		});
	}

	for (const marker of pendingLineMarkers) {
		pushLineWrapMarkerAnnotation(annotations, marker, lines.length, typeDefinition);
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
		range: buildRangeAnnotationPattern(commentSyntax),
		startMarker: buildStartMarkerPattern(commentSyntax),
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
