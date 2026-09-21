import { annotationConfig } from "@/libs/annotation/code-block/constants";
import { fromCodeBlockDocumentToCodeFence } from "@/libs/annotation/code-block/document-to-code-fence";
import type { CodeBlockDocument } from "@/libs/annotation/code-block/types";
import { serializeFrontmatter } from "./frontmatter";
import { BLOCK_JSX_NAMES, INLINE_JSX_MARKS } from "./registry";
import type { CmsJsonValue, CmsMark, CmsNode } from "./types";

const MARK_ORDER = ["tooltip", "underline", "superscript", "subscript", "link", "bold", "italic", "strike", "code"];

const isIdent = (value: string) => /^[A-Za-z_][\w]*$/.test(value);

const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const escapeText = (value: string, inCode: boolean) => {
	if (inCode) return value;
	return value
		.replace(/\\/g, "\\\\")
		.replace(/`/g, "\\`")
		.replace(/\*/g, "\\*")
		.replace(/_/g, "\\_")
		.replace(/\[/g, "\\[")
		.replace(/\{/g, "\\{")
		.replace(/</g, "\\<");
};

const fenceTicks = (value: string) => {
	const runs = value.match(/`+/g)?.map((run) => run.length) ?? [];
	return Math.max(3, ...runs.map((size) => size + 1), 3);
};

const serializeFence = (language: string, meta: string, value: string) => {
	const ticks = "`".repeat(fenceTicks(value));
	const info = [language, meta].filter((part) => part.length > 0).join(" ");
	return `${ticks}${info}\n${value}\n${ticks}`;
};

const serializeJsValue = (value: CmsJsonValue): string => {
	if (value === null) return "null";
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "number") return String(value);
	if (typeof value === "string") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(serializeJsValue).join(", ")}]`;
	const entries = Object.entries(value).map(([key, item]) => {
		const printedKey = isIdent(key) ? key : JSON.stringify(key);
		return `${printedKey}: ${serializeJsValue(item)}`;
	});
	return `{${entries.join(", ")}}`;
};

const serializeJsxAttribute = (attribute: Record<string, CmsJsonValue>): string => {
	if (attribute.spread) {
		const expression = typeof attribute.expression === "string" ? attribute.expression : "...";
		return `{${expression}}`;
	}
	const name = typeof attribute.name === "string" ? attribute.name : "";
	if (!name) return "";
	if (attribute.expression != null && attribute.value === undefined) {
		return `${name}={${attribute.expression}}`;
	}
	const value = attribute.value;
	if (value === undefined) return name;
	if (typeof value === "string") return `${name}="${escapeAttr(value)}"`;
	return `${name}={${serializeJsValue(value)}}`;
};

const reservedAttrKeys = new Set([
	"name",
	"attributes",
	"language",
	"meta",
	"value",
	"codeDocument",
	"frontmatter",
	"level",
	"src",
	"alt",
	"href",
	"title",
	"checked",
	"start",
]);

const serializeJsxAttrs = (node: CmsNode): string => {
	const attributes = node.attrs?.attributes;
	const parts: string[] = [];
	if (Array.isArray(attributes)) {
		for (const item of attributes) {
			if (!item || typeof item !== "object" || Array.isArray(item)) continue;
			const printed = serializeJsxAttribute(item);
			if (printed) parts.push(printed);
		}
	} else if (node.attrs) {
		for (const [key, value] of Object.entries(node.attrs)) {
			if (reservedAttrKeys.has(key)) continue;
			parts.push(serializeJsxAttribute({ name: key, value }));
		}
	}
	return parts.length > 0 ? ` ${parts.join(" ")}` : "";
};

const jsxName = (node: CmsNode): string => {
	if (typeof node.attrs?.name === "string" && node.attrs.name.length > 0) return node.attrs.name;
	return node.type;
};

const markKey = (mark: CmsMark) => `${mark.type}:${JSON.stringify(mark.attrs ?? null)}`;

const sortedMarks = (marks: CmsMark[] | undefined): CmsMark[] =>
	[...(marks ?? [])].sort((left, right) => MARK_ORDER.indexOf(left.type) - MARK_ORDER.indexOf(right.type));

const openMark = (mark: CmsMark): string => {
	switch (mark.type) {
		case "tooltip":
			return `<Tooltip content="${escapeAttr(String(mark.attrs?.content ?? ""))}">`;
		case "underline":
			return "<u>";
		case "superscript":
			return "<sup>";
		case "subscript":
			return "<sub>";
		case "bold":
			return "<strong>";
		case "italic":
			return "<em>";
		case "strike":
			return "<del>";
		case "code":
			return "`";
		case "link":
			return "[";
		default:
			return "";
	}
};

const closeMark = (mark: CmsMark): string => {
	switch (mark.type) {
		case "tooltip":
			return "</Tooltip>";
		case "underline":
			return "</u>";
		case "superscript":
			return "</sup>";
		case "subscript":
			return "</sub>";
		case "bold":
			return "</strong>";
		case "italic":
			return "</em>";
		case "strike":
			return "</del>";
		case "code":
			return "`";
		case "link": {
			const href = String(mark.attrs?.href ?? "");
			const title = mark.attrs?.title;
			return typeof title === "string" && title.length > 0 ? `](${href} "${title}")` : `](${href})`;
		}
		default:
			return "";
	}
};

const serializeImage = (node: CmsNode): string => {
	const mediaId = node.attrs?.mediaId;
	const src = node.attrs?.src ? String(node.attrs.src) : "";
	const alt = node.attrs?.alt ? String(node.attrs.alt) : "";
	const width = node.attrs?.width ? String(node.attrs.width) : undefined;
	const align = node.attrs?.align ? String(node.attrs.align) : undefined;
	const caption = node.attrs?.caption ? String(node.attrs.caption) : undefined;

	// If it has mediaId or custom width/align/caption, serialize as <Image ... />
	if (mediaId || width || align || caption) {
		const props: string[] = [];
		if (mediaId) props.push(`mediaId="${escapeAttr(String(mediaId))}"`);
		if (src) props.push(`src="${escapeAttr(src)}"`);

		props.push(`alt="${escapeAttr(alt)}"`);
		if (width) props.push(`width="${escapeAttr(width)}"`);
		if (align) props.push(`align="${escapeAttr(align)}"`);
		if (caption) props.push(`caption="${escapeAttr(caption)}"`);

		return `<Image ${props.join(" ")} />`;
	}

	const title = node.attrs?.title;
	if (typeof title === "string" && title.length > 0) return `![${alt}](${src} "${title}")`;
	return `![${alt}](${src})`;
};

const encodeLeadingSpaces = (value: string, inCode: boolean): string => {
	const match = /^[ \t]+/.exec(value);
	if (!match) return escapeText(value, inCode);
	return `${"&#x20;".repeat(match[0].replace(/\t/g, " ").length)}${escapeText(value.slice(match[0].length), inCode)}`;
};

const serializeInlines = (nodes: CmsNode[], asParagraph = false): string => {
	let result = "";
	const active: CmsMark[] = [];
	let atLineStart = asParagraph;

	const closeTo = (index: number) => {
		while (active.length > index) {
			const mark = active.pop();
			if (mark) result += closeMark(mark);
		}
	};

	for (const node of nodes) {
		if (node.type === "hardBreak") {
			closeTo(0);
			result += "\\\n";
			atLineStart = true;
			continue;
		}
		if (node.type === "image") {
			closeTo(0);
			result += serializeImage(node);
			continue;
		}
		if (node.type === "mdxJsx" || BLOCK_JSX_NAMES.has(node.type) || INLINE_JSX_MARKS[node.type]) {
			closeTo(0);
			result += serializeJsx(node);
			continue;
		}
		if (node.type === "mdxExpression") {
			closeTo(0);
			result += `{${String(node.attrs?.value ?? "")}}`;
			continue;
		}
		if (node.type !== "text") {
			closeTo(0);
			if (node.content) result += serializeInlines(node.content);
			else if (node.text) result += escapeText(node.text, false);
			continue;
		}

		const wanted = sortedMarks(node.marks);
		let same = 0;
		while (
			same < active.length &&
			same < wanted.length &&
			markKey(active[same] ?? { type: "" }) === markKey(wanted[same] ?? { type: "" })
		) {
			same += 1;
		}
		closeTo(same);
		for (let index = same; index < wanted.length; index += 1) {
			const mark = wanted[index];
			if (!mark) continue;
			active.push(mark);
			result += openMark(mark);
		}
		const inCode = wanted.some((mark) => mark.type === "code");
		const text = node.text ?? "";
		result += atLineStart && !inCode ? encodeLeadingSpaces(text, inCode) : escapeText(text, inCode);
		atLineStart = false;
	}
	closeTo(0);
	if (!asParagraph) return result;
	// 문단이 `1. `로 시작하면 재파싱 시 순서 목록으로 해석되므로 목록 기호를 이스케이프한다.
	// 단, 백슬래시는 숫자가 아니라 마침표 앞에 붙여야 한다(`1\. `). `\1. `는 숫자를 이스케이프해 문자 그대로 남는다.
	const withEscapedListMarker = result.replace(/^(\s*)(\d+)\.(\s)/, "$1$2\\.$3");
	return withEscapedListMarker.replace(/^(\s*)([>#]|-{1,3}\s|\*{1,3}\s|```)/, "$1\\$2");
};

const serializeCodeBlock = (node: CmsNode, indent: string): string => {
	const attrs = node.attrs ?? {};
	let language = typeof attrs.language === "string" ? attrs.language : "";
	let meta = typeof attrs.meta === "string" ? attrs.meta : "";
	let value = typeof attrs.value === "string" ? attrs.value : "";

	if (value.length === 0 && attrs.codeDocument && typeof attrs.codeDocument === "object") {
		const fence = fromCodeBlockDocumentToCodeFence(
			attrs.codeDocument as unknown as CodeBlockDocument,
			annotationConfig,
		);
		language = fence.lang ?? language;
		meta = fence.meta ?? meta;
		value = fence.value;
	}

	const fence = serializeFence(language, meta, value);
	if (!indent) return fence;
	return fence
		.split("\n")
		.map((line) => indent + line)
		.join("\n");
};

const serializeJsx = (node: CmsNode, indent = ""): string => {
	const name = jsxName(node);
	const attrs = serializeJsxAttrs(node);
	const inner = serializeBlocks(node.content ?? [], "");
	if (!inner) return `${indent}<${name}${attrs} />`;
	return `${indent}<${name}${attrs}>\n\n${inner}\n\n${indent}</${name}>`;
};

const serializeList = (node: CmsNode, indent: string, ordered: boolean): string => {
	const start = typeof node.attrs?.start === "number" ? node.attrs.start : 1;
	return (node.content ?? [])
		.map((item, index) => {
			const checked = item.attrs?.checked;
			const task = typeof checked === "boolean" ? `[${checked ? "x" : " "}] ` : "";
			const marker = ordered ? `${start + index}. ${task}` : `- ${task}`;
			return serializeListItem(item, marker, indent);
		})
		.join("\n");
};

const serializeListItem = (item: CmsNode, marker: string, indent: string): string => {
	const blocks = item.content ?? [];
	const innerIndent = indent + " ".repeat(Math.max(marker.length, 2));
	if (blocks.length === 0) return `${indent}${marker}`.trimEnd();

	const [first, ...rest] = blocks;
	let head = `${indent}${marker}`;
	if (first?.type === "paragraph") {
		head += serializeInlines(first.content ?? [], true);
	} else if (first) {
		head += `\n${serializeBlock(first, innerIndent)}`;
	}

	const extra = rest.map((block) => {
		if (block.type === "paragraph") return `${innerIndent}${serializeInlines(block.content ?? [], true)}`;
		return serializeBlock(block, innerIndent);
	});
	// listItem 안의 블록이 여러 개면(loose list) 빈 줄로 분리해야 문단 경계가 유지된다.
	// 한 줄로 이어 붙이면 재파싱 시 하나의 문단으로 합쳐져 문단 구조가 사라진다.
	return [head, ...extra].join("\n\n");
};

const serializeTable = (node: CmsNode): string => {
	const rows = node.content ?? [];
	const serializedRows = rows.map((row) => {
		const cells = (row.content ?? []).map((cell) => serializeInlines(cell.content ?? []).replace(/\|/g, "\\|"));
		return `| ${cells.join(" | ")} |`;
	});
	if (serializedRows.length === 0) return "";
	const columnCount = rows[0]?.content?.length ?? 1;
	const separator = `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`;
	const [header, ...body] = serializedRows;
	return [header, separator, ...body].join("\n");
};

const serializeBlock = (node: CmsNode, indent = ""): string => {
	switch (node.type) {
		case "paragraph":
			return indent + serializeInlines(node.content ?? [], true);
		case "heading": {
			const level = typeof node.attrs?.level === "number" ? node.attrs.level : 2;
			return `${indent}${"#".repeat(level)} ${serializeInlines(node.content ?? [])}`;
		}
		case "codeBlock":
			return serializeCodeBlock(node, indent);
		case "math":
			return `${indent}$$\n${String(node.attrs?.value ?? "")}\n$$`;
		case "bulletList":
			return serializeList(node, indent, false);
		case "orderedList":
			return serializeList(node, indent, true);
		case "table":
			return serializeTable(node)
				.split("\n")
				.map((line) => indent + line)
				.join("\n");
		case "blockquote":
			return serializeBlocks(node.content ?? [], "")
				.split("\n")
				.map((line) => `${indent}>${line ? ` ${line}` : ""}`)
				.join("\n");
		case "horizontalRule":
			return `${indent}---`;
		case "image":
			return indent + serializeImage(node);
		case "html":
			return indent + String(node.attrs?.value ?? "");
		case "mdxEsm":
			return indent + String(node.attrs?.value ?? "");
		case "mdxExpression":
			return `${indent}{${String(node.attrs?.value ?? "")}}`;
		case "doc":
			return serializeBlocks(node.content ?? [], indent);
		default:
			if (BLOCK_JSX_NAMES.has(node.type) || node.type === "mdxJsx" || INLINE_JSX_MARKS[node.type]) {
				return serializeJsx(node, indent);
			}
			if (node.content) return serializeBlocks(node.content, indent);
			return "";
	}
};

const serializeBlocks = (nodes: CmsNode[], indent = ""): string =>
	nodes
		.map((node) => serializeBlock(node, indent))
		.filter((block) => block.length > 0)
		.join("\n\n");

export const serialize = (doc: unknown): string => {
	const node = doc as CmsNode;
	const body = serializeBlocks(node.type === "doc" ? (node.content ?? []) : [node]).trimEnd();
	const frontmatter = node.attrs?.frontmatter;
	if (frontmatter && typeof frontmatter === "object" && !Array.isArray(frontmatter)) {
		return `${serializeFrontmatter(frontmatter)}\n${body}\n`;
	}
	return body.length > 0 ? `${body}\n` : "";
};
