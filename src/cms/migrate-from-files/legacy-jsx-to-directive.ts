/**
 * 레거시 JSX 표현을 §4.4 directive 저장 형식으로 바꾼다(M8-DA-1).
 *
 * **원칙: 원문을 최소로 건드린다.** AST에서 바꿀 노드의 **원문 구간**만 잘라내고 나머지는 바이트 그대로
 * 이어 붙인다(오프셋 스플라이스). 그래서 문단·공백·코드 펜스·frontmatter가 재직렬화로 변형되지 않는다.
 *
 * 변환 규칙(`CMS-M8-DA-1-CONVERSION-MEMO.md`):
 * - 등록 컴포넌트 → directive. 컨테이너 콜론 수는 `3 + 안에 중첩된 컨테이너 단계 수`(§4.4).
 * - 문단 안 줄 끝 `\`(mdast `break`) → `:br[]`. 문단이 한 줄로 합쳐진다.
 * - `IdeographicSpace` → 컴포넌트(span)만 걷어내고 **글자를 남긴다**. 독립 문단 간격이 사라지면 공개 렌더가 바뀐다.
 * - 모르는 JSX는 **건드리지 않고** `leftovers`에 기록한다(무음 변환 금지).
 *
 * directive 정의표(`@/cms/mdx/directives`)를 단일 원천으로 쓴다 — 저장 문법이 갈라지지 않는다.
 */

import type { RootContent } from "mdast";
import { DIRECTIVES, type DirectiveDefinition } from "@/cms/mdx/directives";
import { splitFrontmatter } from "@/cms/mdx/frontmatter";
import { parseMdxAst } from "@/cms/mdx/parse";

/** JSX 컴포넌트 이름 → directive 정의. */
const DIRECTIVE_BY_COMPONENT: ReadonlyMap<string, DirectiveDefinition> = new Map(
	DIRECTIVES.map((definition) => [definition.component, definition]),
);

/**
 * 이름은 폐기하지만 **글자는 남기는** 컴포넌트.
 * 값은 대체 글자다 — 간격용 독립 문단이라 요소를 지우면 공개 렌더의 빈 줄이 사라진다.
 */
const REPLACED_COMPONENTS: ReadonlyMap<string, string> = new Map([["IdeographicSpace", "\u3164"]]);

/** 정적 리터럴만 문자열 속성으로 옮긴다. 그 밖의 표현식은 옮기지 않고 기록한다. */
const STATIC_LITERAL = /^(?:true|false|-?\d+(?:\.\d+)?|"([^"\\]*)"|'([^'\\]*)')$/;

export type LegacyConversionCounts = Record<string, number>;

export type LegacyConversionResult = {
	/** 변환된 전체 문서(frontmatter 포함). */
	source: string;
	counts: LegacyConversionCounts;
	/** 등록된 이름인데 변환하지 못하고 남은 JSX 이름(중복 제거). */
	leftovers: string[];
};

type Edit = { start: number; end: number; text: string };

type JsxAttribute = {
	name?: string;
	value?: unknown;
	position?: { start?: { offset?: number }; end?: { offset?: number } };
};

type JsxNode = {
	type?: string;
	name?: string | null;
	attributes?: JsxAttribute[];
	children?: unknown[];
	position?: { start?: { offset?: number }; end?: { offset?: number } };
};

type Context = { counts: LegacyConversionCounts; leftovers: Set<string> };

const isJsx = (node: unknown): node is JsxNode => {
	const candidate = node as JsxNode | null;
	return (
		!!candidate &&
		(candidate.type === "mdxJsxFlowElement" || candidate.type === "mdxJsxTextElement") &&
		typeof candidate.name === "string"
	);
};

const isContainer = (node: JsxNode): boolean => {
	const definition = node.name ? DIRECTIVE_BY_COMPONENT.get(node.name) : undefined;
	return definition?.kind === "container";
};

const nodeRange = (node: JsxNode): { start: number; end: number } | null => {
	const start = node.position?.start?.offset;
	const end = node.position?.end?.offset;
	return typeof start === "number" && typeof end === "number" ? { start, end } : null;
};

/** 여는 태그의 `>` 위치. 따옴표 안의 `>`는 건너뛴다. */
const findTagEnd = (text: string, from: number): number => {
	let quote: string | null = null;
	for (let i = from; i < text.length; i += 1) {
		const char = text[i];
		if (quote) {
			if (char === quote) quote = null;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}
		if (char === ">") return i;
	}
	return text.length - 1;
};

/** 요소 원문 조각에서 여는 태그와 닫는 태그 **사이**의 구간. */
const innerRange = (text: string, name: string): { start: number; end: number } => {
	const openEnd = findTagEnd(text, 0);
	const closeStart = text.lastIndexOf(`</${name}`);
	return { start: openEnd + 1, end: closeStart < 0 ? text.length : closeStart };
};

/** 이 요소 안에 중첩된 컨테이너 단계 수(자기 자신 제외). */
const nestedContainerLevels = (node: JsxNode): number => {
	let max = 0;
	const walk = (children: unknown[]) => {
		for (const child of children) {
			if (isJsx(child)) {
				if (isContainer(child)) max = Math.max(max, 1 + nestedContainerLevels(child));
				walk(Array.isArray(child.children) ? child.children : []);
				continue;
			}
			const grandchildren = (child as { children?: unknown[] } | null)?.children;
			if (Array.isArray(grandchildren)) walk(grandchildren);
		}
	};
	walk(Array.isArray(node.children) ? node.children : []);
	return max;
};

/**
 * JSX 속성을 directive 속성 문자열로 만든다. 값은 **원문 그대로** 옮긴다(따옴표 안 문자 보존).
 * 불리언·정적 리터럴은 §4.4의 문자열 형식으로 정규화한다(`defaultOpen` → `defaultOpen="true"`).
 */
const formatAttributes = (node: JsxNode, definition: DirectiveDefinition, source: string, ctx: Context): string => {
	const parts: string[] = [];

	for (const attribute of node.attributes ?? []) {
		const name = attribute.name;
		if (!name) continue;
		if (!(name in definition.attributes)) {
			ctx.leftovers.add(`${definition.component}.${name}`);
			continue;
		}

		const range = attribute.position?.start?.offset;
		const raw = typeof range === "number" ? source.slice(range, attribute.position?.end?.offset) : "";
		const equals = raw.indexOf("=");
		const rawValue = equals < 0 ? "" : raw.slice(equals + 1).trim();

		if (rawValue.startsWith("{")) {
			const expression = rawValue.slice(1, -1).trim();
			const match = STATIC_LITERAL.exec(expression);
			if (!match) {
				ctx.leftovers.add(`${definition.component}.${name}=${expression}`);
				continue;
			}
			parts.push(`${name}="${match[1] ?? match[2] ?? expression}"`);
			continue;
		}

		if (rawValue === "") {
			// JSX 불리언 속성(`<Collapsible defaultOpen>`)은 참이다.
			parts.push(`${name}="true"`);
			continue;
		}

		parts.push(`${name}=${rawValue}`);
	}

	return parts.length > 0 ? `{${parts.join(" ")}}` : "";
};

/** 문단 안의 줄 끝 `\`(mdast `break`)와 등록 JSX를 directive로 바꾼다. */
const collectEdits = (nodes: unknown[], source: string, ctx: Context, edits: Edit[]): void => {
	for (const raw of nodes) {
		const node = raw as RootContent & JsxNode;

		if (isJsx(node)) {
			const name = node.name as string;
			const definition = DIRECTIVE_BY_COMPONENT.get(name);
			const replaced = REPLACED_COMPONENTS.get(name);
			const range = nodeRange(node);

			// 원문이 `<`가 아니면 directive에서 변환된 요소다(`parseMdxAst`가 둘 다 MDX 요소로 만든다).
			// 이미 목표 형식이므로 그대로 두고 안쪽만 본다 — 두 번 돌려도 내용이 망가지지 않는다.
			if (range && !source.startsWith("<", range.start)) {
				const nested = Array.isArray(node.children) ? node.children : [];
				collectEdits(nested, source, ctx, edits);
				continue;
			}

			if (definition && range) {
				edits.push({ start: range.start, end: range.end, text: buildDirective(node, definition, source, ctx) });
				ctx.counts[definition.name] = (ctx.counts[definition.name] ?? 0) + 1;
				continue;
			}
			if (replaced !== undefined && range) {
				edits.push({ start: range.start, end: range.end, text: replaced });
				ctx.counts[name] = (ctx.counts[name] ?? 0) + 1;
				continue;
			}
			// 모르는 JSX는 그대로 둔다. 안쪽도 건드리지 않는다(부분 변환이 더 위험하다).
			ctx.leftovers.add(name);
			continue;
		}

		if (node.type === "break") {
			const range = nodeRange(node);
			if (range) {
				edits.push({ start: range.start, end: range.end, text: ":br[]" });
				ctx.counts.br = (ctx.counts.br ?? 0) + 1;
			}
			continue;
		}

		const children = (node as { children?: unknown[] }).children;
		if (Array.isArray(children)) collectEdits(children, source, ctx, edits);
	}
};

/** 요소 하나를 directive 원문으로 만든다. 안쪽은 재귀로 다시 변환한다. */
const buildDirective = (node: JsxNode, definition: DirectiveDefinition, source: string, ctx: Context): string => {
	const name = node.name as string;
	const range = nodeRange(node);
	const text = range ? source.slice(range.start, range.end) : "";
	const attributes = formatAttributes(node, definition, source, ctx);

	if (definition.kind === "leaf") {
		return `::${definition.name}${attributes}`;
	}

	const { start, end } = innerRange(text, name);
	const inner = rewriteText(text.slice(start, end), ctx);

	if (definition.kind === "text") {
		// `:br`은 빈 라벨을 쓴다 — 뒤에 글자가 붙으면 이름이 삼켜진다(§9.1.5).
		return `:${definition.name}[${inner}]${attributes}`;
	}

	const colons = ":".repeat(3 + nestedContainerLevels(node));
	const body = inner.replace(/^\n+/, "").replace(/\s+$/, "");
	return body.length > 0
		? `${colons}${definition.name}${attributes}\n${body}\n${colons}`
		: `${colons}${definition.name}${attributes}\n${colons}`;
};

const applyEdits = (text: string, edits: Edit[]): string => {
	const sorted = [...edits].sort((a, b) => a.start - b.start);
	let out = "";
	let cursor = 0;

	for (const edit of sorted) {
		if (edit.start < cursor) throw new Error("겹치는 편집 구간이 있습니다.");
		out += text.slice(cursor, edit.start) + edit.text;
		cursor = edit.end;
	}

	return out + text.slice(cursor);
};

/** 문서 조각 하나를 변환한다(재귀 진입점). */
const rewriteText = (text: string, ctx: Context): string => {
	const edits: Edit[] = [];
	collectEdits(parseMdxAst(text).children, text, ctx, edits);
	return applyEdits(text, edits);
};

/** 문서 전체를 변환한다. frontmatter는 바이트 그대로 보존한다. */
export const convertLegacySource = (source: string): LegacyConversionResult => {
	const { body } = splitFrontmatter(source);
	const prefix = source.slice(0, source.length - body.length);
	const ctx: Context = { counts: {}, leftovers: new Set() };

	return { source: prefix + rewriteText(body, ctx), counts: ctx.counts, leftovers: [...ctx.leftovers] };
};
