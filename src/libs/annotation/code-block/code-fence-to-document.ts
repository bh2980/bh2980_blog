import type { Code } from "mdast";
import { fromCommentSyntaxToAnnotationCommentPattern, resolveCommentSyntax } from "./comment-syntax";
import { ANNOTATION_TYPE_DEFINITION } from "./constants";
import { createAnnotationRegistry, resolveAnnotationTypeDefinition } from "./libs";
import type { AnnotationConfig, AnnotationRegistryItem, AnnotationType, CodeBlockDocument } from "./types";

const DEFAULT_CODE_LANG = "text";
const ATTR_RE = /([A-Za-z_][\w-]*)(?:\s*=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s]+)))?/g;

const parseUnquotedAttrValue = (raw: string): unknown => {
	try {
		return JSON.parse(raw);
	} catch {
		return raw;
	}
};

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

		if (
			doubleQuotedRaw === undefined &&
			singleQuotedRaw === undefined &&
			unquotedRaw === undefined
		) {
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

export const fromCodeFenceToCodeBlockDocument = (
	codeNode: Code,
	annotationConfig: AnnotationConfig,
): CodeBlockDocument => {
	const registry = createAnnotationRegistry(annotationConfig);
	const typeDefinition = resolveAnnotationTypeDefinition(annotationConfig);
	const tagToType = createTagToTypeMap(annotationConfig);
	const lang = codeNode.lang?.trim() || DEFAULT_CODE_LANG;
	const meta = fromCodeFenceMetaToDocumentMeta(codeNode.meta ?? "");
	const commentSyntax = resolveCommentSyntax(lang);
	const annotationLinePattern = fromCommentSyntaxToAnnotationCommentPattern(commentSyntax);

	const lines: CodeBlockDocument["lines"] = [];
	const annotations: CodeBlockDocument["annotations"] = [];
	const pendingInline: CodeBlockDocument["lines"][number]["annotations"] = [];

	for (const lineText of codeNode.value.split("\n")) {
		const parsed = fromAnnotationCommentLineToParsedAnnotation(lineText, annotationLinePattern);

		if (!parsed) {
			lines.push({
				value: lineText,
				annotations: pendingInline.map((annotation, order) => ({ ...annotation, order })),
			});
			pendingInline.length = 0;
			continue;
		}

		const type = tagToType[parsed.tag];
		const config = registry.get(parsed.name);

		if (!type || !config || config.type !== type) {
			lines.push({
				value: lineText,
				annotations: pendingInline.map((annotation, order) => ({ ...annotation, order })),
			});
			pendingInline.length = 0;
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
			annotations.push({
				...base,
				type: "lineClass",
				...typeDefinition.lineClass,
				order: annotations.length,
			});
			continue;
		}

		if (type === "lineWrap") {
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

	return { lang, meta, lines, annotations };
};

export const __testable__ = {
	fromCodeFenceMetaToDocumentMeta,
	fromAttributeTextToAnnotationAttrs,
	fromAnnotationCommentLineToParsedAnnotation,
	fromCodeFenceToCodeBlockDocument,
};
