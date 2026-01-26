import type { JSX } from "react";
import { codeToTokens } from "shiki";
import type { Annotation } from "@/libs/contents/remark";
import { Tooltip } from "./tooltip";

type CodeblockProps = {
	code: string;
	annotations: string;
	lang:
		| "bash"
		| "css"
		| "docker"
		| "go"
		| "graphql"
		| "java"
		| "javascript"
		| "json"
		| "jsx"
		| "markdown"
		| "python"
		| "rust"
		| "scss"
		| "sql"
		| "tsx"
		| "typescript"
		| "yaml"
		| "text";
	useLineNumber: boolean;
	title: string;
};

type StyleKind = "del" | "strong" | "em" | "u";

type PositionedToken = {
	content: string;
	color?: string;
	fontStyle?: number;
	start: number;
	end: number;
};

type NormalizedAnnotation =
	| {
			kind: "style";
			style: StyleKind;
			start: number;
			end: number;
	  }
	| {
			kind: "tooltip";
			content: string;
			start: number;
			end: number;
	  };

type TreeNode =
	| {
			kind: "token";
			token: PositionedToken;
			start: number;
			end: number;
	  }
	| {
			kind: "style";
			style: StyleKind;
			children: TreeNode[];
			start: number;
			end: number;
	  }
	| {
			kind: "tooltip";
			content: string;
			children: TreeNode[];
			start: number;
			end: number;
	  };

const STYLE_OUTER_PRIORITY: Record<StyleKind, number> = {
	u: 0,
	em: 1,
	strong: 2,
	del: 3,
};

const STYLE_TAGS: Record<StyleKind, "del" | "strong" | "em" | "u"> = {
	del: "del",
	strong: "strong",
	em: "em",
	u: "u",
};

const extractTooltipContent = (annotation: Extract<Annotation, { type: "mdxJsxTextElement" }>) => {
	const attr = annotation.attributes.find((a) => a.type === "mdxJsxAttribute" && a.name === "content");
	return typeof attr?.value === "string" ? attr.value : "";
};

const buildPositionedTokens = (
	codeblock: { content: string; color?: string; fontStyle?: number }[][],
	codeStr: string,
) => {
	const tokens: PositionedToken[] = [];
	let offset = 0;

	for (const line of codeblock) {
		for (const token of line) {
			if (!token.content) continue;
			const start = offset;
			const end = start + token.content.length;
			tokens.push({ content: token.content, color: token.color, fontStyle: token.fontStyle, start, end });
			offset = end;
		}

		if (offset < codeStr.length && codeStr[offset] === "\n") {
			tokens.push({ content: "\n", start: offset, end: offset + 1 });
			offset += 1;
		}
	}

	return tokens;
};

const splitTokensByBoundaries = (tokens: PositionedToken[], boundaries: Set<number>) => {
	const boundaryList = Array.from(boundaries).sort((a, b) => a - b);
	const splitTokens: PositionedToken[] = [];

	for (const token of tokens) {
		const cuts = boundaryList.filter((b) => b > token.start && b < token.end);
		if (cuts.length === 0) {
			splitTokens.push(token);
			continue;
		}

		const points = [token.start, ...cuts, token.end].sort((a, b) => a - b);
		for (let i = 0; i < points.length - 1; i += 1) {
			const start = points[i];
			const end = points[i + 1];
			if (start === end) continue;
			const sliceStart = start - token.start;
			const sliceEnd = end - token.start;
			const content = token.content.slice(sliceStart, sliceEnd);
			if (!content) continue;
			splitTokens.push({ content, color: token.color, fontStyle: token.fontStyle, start, end });
		}
	}

	return splitTokens;
};

const normalizeAnnotations = (annotationList: Annotation[]) => {
	const normalized: NormalizedAnnotation[] = [];

	for (const annotation of annotationList) {
		if (annotation.start >= annotation.end) continue;

		if (annotation.type === "delete") {
			normalized.push({ kind: "style", style: "del", start: annotation.start, end: annotation.end });
			continue;
		}

		if (annotation.type === "strong") {
			normalized.push({ kind: "style", style: "strong", start: annotation.start, end: annotation.end });
			continue;
		}

		if (annotation.type === "emphasis") {
			normalized.push({ kind: "style", style: "em", start: annotation.start, end: annotation.end });
			continue;
		}

		if (annotation.type === "mdxJsxTextElement" && annotation.name === "u") {
			normalized.push({ kind: "style", style: "u", start: annotation.start, end: annotation.end });
			continue;
		}

		if (annotation.type === "mdxJsxTextElement" && annotation.name === "Tooltip") {
			normalized.push({
				kind: "tooltip",
				content: extractTooltipContent(annotation),
				start: annotation.start,
				end: annotation.end,
			});
		}
	}

	return normalized;
};

const buildAnnotationTree = (segments: PositionedToken[], annotations: NormalizedAnnotation[], codeLength: number) => {
	const root = { kind: "root" as const, children: [] as TreeNode[], start: 0, end: codeLength };
	const stack: {
		kind: "root" | "style" | "tooltip";
		children: TreeNode[];
		start: number;
		end: number;
		style?: StyleKind;
		content?: string;
	}[] = [root];
	const startMap = new Map<number, NormalizedAnnotation[]>();

	for (const annotation of annotations) {
		const list = startMap.get(annotation.start) ?? [];
		list.push(annotation);
		startMap.set(annotation.start, list);
	}

	for (const list of startMap.values()) {
		list.sort((a, b) => {
			if (a.end !== b.end) return b.end - a.end;
			const priorityA = a.kind === "tooltip" ? -1 : STYLE_OUTER_PRIORITY[a.style];
			const priorityB = b.kind === "tooltip" ? -1 : STYLE_OUTER_PRIORITY[b.style];
			return priorityA - priorityB;
		});
	}

	for (const segment of segments) {
		const toOpen = startMap.get(segment.start);
		if (toOpen) {
			for (const annotation of toOpen) {
				if (annotation.kind === "style") {
					const node = {
						kind: "style" as const,
						style: annotation.style,
						start: annotation.start,
						end: annotation.end,
						children: [] as TreeNode[],
					};
					stack[stack.length - 1].children.push(node);
					stack.push(node);
					continue;
				}

				const node = {
					kind: "tooltip" as const,
					content: annotation.content,
					start: annotation.start,
					end: annotation.end,
					children: [] as TreeNode[],
				};
				stack[stack.length - 1].children.push(node);
				stack.push(node);
			}
		}

		stack[stack.length - 1].children.push({ kind: "token", token: segment, start: segment.start, end: segment.end });

		while (stack.length > 1 && stack[stack.length - 1].end === segment.end) {
			stack.pop();
		}
	}

	return root.children;
};

const renderNodes = (nodes: TreeNode[], keyPrefix: string) => {
	return nodes.map((node, index) => renderNode(node, `${keyPrefix}-${index}`));
};

const renderNode = (node: TreeNode, key: string): JSX.Element => {
	if (node.kind === "token") {
		return (
			<span key={key} style={node.token.color ? { color: node.token.color } : undefined}>
				{node.token.content}
			</span>
		);
	}

	if (node.kind === "style") {
		const Tag = STYLE_TAGS[node.style];
		return <Tag key={key}>{renderNodes(node.children, key)}</Tag>;
	}

	return (
		<Tooltip key={key} content={node.content}>
			{renderNodes(node.children, key)}
		</Tooltip>
	);
};

export const Codeblock = async ({ code, annotations, lang, useLineNumber, title }: CodeblockProps) => {
	const codeStr = JSON.parse(code);
	const annotationList = JSON.parse(annotations) as Annotation[];

	const { tokens: codeblock } = await codeToTokens(codeStr, { lang, theme: "dark-plus" });
	const positionedTokens = buildPositionedTokens(codeblock, codeStr);
	const boundaries = new Set<number>();
	for (const annotation of annotationList) {
		boundaries.add(annotation.start);
		boundaries.add(annotation.end);
	}
	const splitTokens = splitTokensByBoundaries(positionedTokens, boundaries);
	const normalizedAnnotations = normalizeAnnotations(annotationList);
	const tree = buildAnnotationTree(splitTokens, normalizedAnnotations, codeStr.length);

	return (
		<pre style={{ whiteSpace: "pre", overflowX: "auto" }}>
			<code>{renderNodes(tree, "code")}</code>
		</pre>
	);
};
