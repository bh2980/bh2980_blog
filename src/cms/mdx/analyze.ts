import type { Root, RootContent } from "mdast";
import {
	estreeToJson,
	hasSpread,
	isCallExpression,
	isIdentifierExpression,
	isStaticEstree,
	programExpression,
} from "./expressions";
import { parseYamlMapping, splitFrontmatter } from "./frontmatter";
import { positionOf } from "./jsx";
import { parseMdxAst } from "./parse";
import { COLUMNS_MAX, COLUMNS_MIN, EVENT_HANDLER_NAME, TABS_MAX, TABS_MIN } from "./registry";
import type { CmsMdxAnalysis, CmsMdxError } from "./types";

type VisitNode =
	| Root
	| RootContent
	| { type: string; position?: { start?: { line?: number; column?: number } }; [key: string]: unknown };

const namedJsxChildren = (node: VisitNode, name: string) => {
	const children = "children" in node && Array.isArray(node.children) ? node.children : [];
	const found: unknown[] = [];
	const walk = (nodes: unknown[]) => {
		for (const child of nodes) {
			const current = child as { type?: string; name?: string; children?: unknown[] };
			if ((current.type === "mdxJsxFlowElement" || current.type === "mdxJsxTextElement") && current.name === name) {
				found.push(child);
				continue;
			}
			if (current.type === "paragraph" && Array.isArray(current.children)) {
				walk(current.children);
			}
		}
	};
	walk(children);
	return found;
};

type ErrorTarget = VisitNode | { position?: { start?: { line?: number; column?: number } } };

const pushError = (errors: CmsMdxError[], message: string, node: ErrorTarget) => {
	errors.push({ message, position: positionOf(node) });
};

const validateExpression = (errors: CmsMdxError[], estree: unknown, node: ErrorTarget, source: string) => {
	const expression = programExpression(estree);
	if (hasSpread(expression)) {
		pushError(errors, "본문에서 spread 속성은 허용되지 않습니다.", node);
		return;
	}
	if (isCallExpression(expression)) {
		pushError(errors, "본문에서 함수 호출은 허용되지 않습니다.", node);
		return;
	}
	if (isIdentifierExpression(expression)) {
		pushError(errors, "본문에서 변수 참조는 허용되지 않습니다.", node);
		return;
	}
	if (!isStaticEstree(expression)) {
		pushError(errors, `지원하지 않는 표현식입니다: ${source}`, node);
		return;
	}
	estreeToJson(expression);
};

const validateAttributes = (errors: CmsMdxError[], node: VisitNode) => {
	const attributes = "attributes" in node && Array.isArray(node.attributes) ? node.attributes : [];
	for (const raw of attributes) {
		const attribute = raw as {
			type?: string;
			name?: string;
			value?: { type?: string; value?: string; data?: { estree?: unknown } } | string;
			position?: { start?: { line?: number; column?: number } };
		};
		const target = attribute.position ? attribute : node;

		if (attribute.type === "mdxJsxExpressionAttribute") {
			pushError(errors, "본문에서 spread 속성은 허용되지 않습니다.", target);
			continue;
		}

		if (attribute.type !== "mdxJsxAttribute") continue;

		if (attribute.name && EVENT_HANDLER_NAME.test(attribute.name)) {
			pushError(errors, `이벤트 핸들러 속성은 허용되지 않습니다: ${attribute.name}`, target);
		}

		if (typeof attribute.value === "string" || attribute.value == null) continue;
		if (attribute.value.type !== "mdxJsxAttributeValueExpression") continue;

		validateExpression(errors, attribute.value.data?.estree, target, attribute.value.value ?? "");
	}
};

const validateNode = (errors: CmsMdxError[], node: VisitNode) => {
	if (node.type === "mdxjsEsm") {
		pushError(errors, "본문에서 import/export는 허용되지 않습니다.", node);
	}

	if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
		const value = typeof node.value === "string" ? node.value : "";
		validateExpression(errors, (node.data as { estree?: unknown } | undefined)?.estree, node, value);
	}

	if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
		validateAttributes(errors, node);
		if (node.name === "Tabs") {
			const count = namedJsxChildren(node, "Tab").length;
			if (count < TABS_MIN || count > TABS_MAX) {
				pushError(errors, `Tabs는 ${TABS_MIN}~${TABS_MAX}개의 Tab만 허용합니다.`, node);
			}
		}
		if (node.name === "Columns") {
			const count = namedJsxChildren(node, "Column").length;
			if (count < COLUMNS_MIN || count > COLUMNS_MAX) {
				pushError(errors, `Columns는 ${COLUMNS_MIN}~${COLUMNS_MAX}개의 Column만 허용합니다.`, node);
			}
		}
	}

	const children = "children" in node && Array.isArray(node.children) ? node.children : [];
	for (const child of children) {
		validateNode(errors, child as VisitNode);
	}
};

export const analyze = (mdx: string, name?: string): CmsMdxAnalysis => {
	const { raw, body } = splitFrontmatter(mdx);
	const errors: CmsMdxError[] = [];
	let tree: Root | null = null;
	let frontmatter: CmsMdxAnalysis["frontmatter"] = null;

	if (raw != null) {
		frontmatter = parseYamlMapping(raw);
	}

	try {
		tree = parseMdxAst(body);
		validateNode(errors, tree);
	} catch (error) {
		const message = error instanceof Error ? error.message : "MDX 구문을 분석할 수 없습니다.";
		errors.push({ message, position: { line: 1, column: 1 } });
	}

	return {
		source: mdx,
		errors,
		name,
		frontmatter,
		tree,
	};
};
