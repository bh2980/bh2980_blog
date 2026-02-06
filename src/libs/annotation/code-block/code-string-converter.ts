import type { Code } from "mdast";
import { ANNOTATION_TYPE_DEFINITION } from "./constants";
import { createAnnotationRegistry, resolveAnnotationTypeDefinition } from "./libs";
import type { AnnotationConfig, AnnotationRegistryItem, AnnotationType, CodeBlockDocument } from "./types";

const DEFAULT_CODE_LANG = "text";
const ATTR_RE = /([A-Za-z_][\w-]*)\s*=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s]+))/g;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getCommentPrefix = (lang: string) => {
	const normalized = lang.trim().toLowerCase();
	if (normalized === "python" || normalized === "yaml" || normalized === "toml" || normalized === "bash") {
		return "#";
	}

	if (normalized === "sql") {
		return "--";
	}

	return "//";
};

const parseMeta = (meta: string): CodeBlockDocument["meta"] => {
	const parsed: CodeBlockDocument["meta"] = {};
	const input = meta.trim();
	let index = 0;

	const isWhitespace = (ch: string) => ch === " " || ch === "\t" || ch === "\n" || ch === "\r";

	const skipWhitespace = () => {
		while (index < input.length && isWhitespace(input[index]!)) index += 1;
	};

	const readKey = () => {
		const start = index;
		while (index < input.length) {
			const ch = input[index]!;
			if (ch === "=" || isWhitespace(ch)) break;
			index += 1;
		}
		return input.slice(start, index);
	};

	const readUnquotedValue = () => {
		const start = index;
		while (index < input.length && !isWhitespace(input[index]!)) index += 1;
		return input.slice(start, index);
	};

	const readQuotedValue = (quote: '"' | "'") => {
		index += 1;
		let value = "";

		while (index < input.length) {
			const ch = input[index]!;

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

const serializeMeta = (meta: CodeBlockDocument["meta"]) => {
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

const parseAttributes = (rest: string) => {
	const attrs: { name: string; value: string }[] = [];

	for (const match of rest.matchAll(ATTR_RE)) {
		const name = match[1];
		const raw = match[2] ?? match[3] ?? match[4] ?? "";
		const value = raw.replace(/\\(["'\\])/g, "$1");
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

const parseAnnotationLine = (line: string, commentPrefix: string) => {
	const pattern = new RegExp(
		String.raw`^\s*${escapeRegExp(commentPrefix)}\s*@(?<tag>[A-Za-z][\w-]*)\s+(?<name>[A-Za-z_][\w-]*)\s+\{(?<start>\d+)-(?<end>\d+)\}(?<attrs>.*)$`,
	);

	const match = line.match(pattern);
	if (!match?.groups) return;

	const start = Number(match.groups.start);
	const end = Number(match.groups.end);
	if (!Number.isFinite(start) || !Number.isFinite(end)) return;

	return {
		tag: match.groups.tag,
		name: match.groups.name,
		range: { start, end },
		attributes: parseAttributes(match.groups.attrs ?? ""),
	};
};

const serializeAnnotationLine = (
	commentPrefix: string,
	annotation: { tag: string; name: string; range: { start: number; end: number }; attributes?: { name: string; value: unknown }[] },
) => {
	const attrs = (annotation.attributes ?? [])
		.map((attr) => `${attr.name}=${JSON.stringify(attr.value)}`)
		.join(" ");

	return [commentPrefix, `@${annotation.tag}`, annotation.name, `{${annotation.range.start}-${annotation.range.end}}`, attrs]
		.filter(Boolean)
		.join(" ");
};

export const buildCodeBlockDocumentFromCodeFence = (
	codeNode: Code,
	annotationConfig: AnnotationConfig,
): CodeBlockDocument => {
	const registry = createAnnotationRegistry(annotationConfig);
	const typeDefinition = resolveAnnotationTypeDefinition(annotationConfig);
	const tagToType = createTagToTypeMap(annotationConfig);
	const lang = codeNode.lang?.trim() || DEFAULT_CODE_LANG;
	const meta = parseMeta(codeNode.meta ?? "");
	const commentPrefix = getCommentPrefix(lang);

	const lines: CodeBlockDocument["lines"] = [];
	const annotations: CodeBlockDocument["annotations"] = [];
	const pendingInline: CodeBlockDocument["lines"][number]["annotations"] = [];

	for (const lineText of codeNode.value.split("\n")) {
		const parsed = parseAnnotationLine(lineText, commentPrefix);

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

export const composeCodeFenceFromCodeBlockDocument = (
	document: CodeBlockDocument,
	annotationConfig: AnnotationConfig,
): Code => {
	createAnnotationRegistry(annotationConfig);
	const typeDefinition = resolveAnnotationTypeDefinition(annotationConfig);

	const commentPrefix = getCommentPrefix(document.lang);
	const lineAnnotationByStart = new Map<number, CodeBlockDocument["annotations"]>();

	for (const annotation of [...document.annotations].sort((a, b) => a.order - b.order)) {
		if (annotation.range.start >= annotation.range.end) continue;
		const bucket = lineAnnotationByStart.get(annotation.range.start) ?? [];
		bucket.push(annotation);
		lineAnnotationByStart.set(annotation.range.start, bucket);
	}

	const outputLines: string[] = [];

	document.lines.forEach((line, lineIndex) => {
		const lineAnnotations = lineAnnotationByStart.get(lineIndex) ?? [];
		for (const annotation of lineAnnotations) {
			outputLines.push(
				serializeAnnotationLine(commentPrefix, {
					...annotation,
					tag: typeDefinition[annotation.type].tag,
				}),
			);
		}

		for (const annotation of [...line.annotations].sort((a, b) => a.order - b.order)) {
			if (annotation.range.start >= annotation.range.end) continue;
			outputLines.push(
				serializeAnnotationLine(commentPrefix, {
					...annotation,
					tag: typeDefinition[annotation.type].tag,
				}),
			);
		}

		outputLines.push(line.value);
	});

	return {
		type: "code",
		lang: document.lang,
		meta: serializeMeta(document.meta),
		value: outputLines.join("\n"),
	};
};

export const __testable__ = {
	buildCodeBlockDocumentFromCodeFence,
	composeCodeFenceFromCodeBlockDocument,
};
