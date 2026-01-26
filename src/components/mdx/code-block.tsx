import { Folder } from "lucide-react";
import { codeToTokens } from "shiki";
import type { Annotation } from "@/libs/contents/remark";
import { cn } from "@/utils/cn";
import { CopyButton } from "./code-handler";
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
	meta: string;
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

const STYLE_BY_TYPE: Record<string, StyleKind> = {
	delete: "del",
	strong: "strong",
	emphasis: "em",
};

const STYLE_TAGS: Record<StyleKind, "del" | "strong" | "em" | "u"> = {
	del: "del",
	strong: "strong",
	em: "em",
	u: "u",
};

// Tooltip content 속성만 추출.
const extractTooltipContent = (annotation: Extract<Annotation, { type: "mdxJsxTextElement" }>) => {
	const attr = annotation.attributes.find((a) => a.type === "mdxJsxAttribute" && a.name === "content");
	return typeof attr?.value === "string" ? attr.value : "";
};

// shiki 토큰(줄 단위)을 코드 전체 기준 start/end를 가진 토큰으로 변환.
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

// annotation 경계(start/end)에서 토큰을 잘라 범위가 정확히 맞도록 조정.
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

// mdast annotation을 렌더링에 필요한 형태(style/tooltip)로 정규화.
const normalizeAnnotations = (annotationList: Annotation[]) => {
	const normalized: NormalizedAnnotation[] = [];

	for (const annotation of annotationList) {
		if (annotation.start >= annotation.end) continue;

		const style = STYLE_BY_TYPE[annotation.type];
		if (style) {
			normalized.push({ kind: "style", style, start: annotation.start, end: annotation.end });
			continue;
		}

		if (annotation.type === "mdxJsxTextElement") {
			if (annotation.name === "u") {
				normalized.push({ kind: "style", style: "u", start: annotation.start, end: annotation.end });
				continue;
			}
			if (annotation.name === "Tooltip") {
				normalized.push({
					kind: "tooltip",
					content: extractTooltipContent(annotation),
					start: annotation.start,
					end: annotation.end,
				});
			}
		}
	}

	return normalized;
};

// 정규화된 annotation을 토큰에 적용해 중첩 트리를 만든다.
const buildAnnotationTree = (segments: PositionedToken[], annotations: NormalizedAnnotation[], codeLength: number) => {
	const root = { children: [] as TreeNode[], start: 0, end: codeLength };
	const stack: Array<{ children: TreeNode[]; start: number; end: number }> = [root];
	const startMap = new Map<number, NormalizedAnnotation[]>();

	for (const annotation of annotations) {
		const list = startMap.get(annotation.start) ?? [];
		list.push(annotation);
		startMap.set(annotation.start, list);
	}

	const outerPriority = (annotation: NormalizedAnnotation) =>
		annotation.kind === "tooltip" ? -1 : STYLE_OUTER_PRIORITY[annotation.style];

	for (const list of startMap.values()) {
		list.sort((a, b) => (a.end !== b.end ? b.end - a.end : outerPriority(a) - outerPriority(b)));
	}

	for (const segment of segments) {
		const toOpen = startMap.get(segment.start);
		if (toOpen) {
			for (const annotation of toOpen) {
				if (annotation.kind === "style") {
					const node: TreeNode = {
						kind: "style",
						style: annotation.style,
						start: annotation.start,
						end: annotation.end,
						children: [],
					};
					stack[stack.length - 1].children.push(node);
					stack.push(node);
					continue;
				}

				const node: TreeNode = {
					kind: "tooltip",
					content: annotation.content,
					start: annotation.start,
					end: annotation.end,
					children: [],
				};
				stack[stack.length - 1].children.push(node);
				stack.push(node);
			}
		}

		stack[stack.length - 1].children.push({ kind: "token", token: segment });

		while (stack.length > 1 && stack[stack.length - 1].end === segment.end) {
			stack.pop();
		}
	}

	return root.children;
};

// 트리를 재귀적으로 JSX로 변환.
const renderTree = (nodes: TreeNode[], keyPrefix: string) =>
	nodes.map((node, index) => {
		const key = `${keyPrefix}-${index}`;

		if (node.kind === "token") {
			return (
				<span key={key} style={node.token.color ? { color: node.token.color } : undefined}>
					{node.token.content}
				</span>
			);
		}

		if (node.kind === "style") {
			const Tag = STYLE_TAGS[node.style];
			return <Tag key={key}>{renderTree(node.children, key)}</Tag>;
		}

		return (
			<Tooltip
				key={key}
				content={node.content}
				className="border-slate-200 bg-slate-200 text-slate-800 [&_svg]:bg-slate-200 [&_svg]:fill-slate-200"
			>
				{renderTree(node.children, key)}
			</Tooltip>
		);
	});

// 라인별로 트리를 분리해 <span className="line">로 감싸기 위한 보조 함수.
const splitTreeByLines = (nodes: TreeNode[]) => {
	const lines: TreeNode[][] = [];
	let currentLine: TreeNode[] = [];

	const pushLine = () => {
		lines.push(currentLine);
		currentLine = [];
	};

	for (const node of nodes) {
		if (node.kind === "token") {
			if (node.token.content === "\n") {
				pushLine();
				continue;
			}
			currentLine.push(node);
			continue;
		}

		const childLines = splitTreeByLines(node.children);

		if (childLines.length === 1) {
			if (childLines[0].length > 0) {
				currentLine.push({ ...node, children: childLines[0] });
			}
			continue;
		}

		for (let i = 0; i < childLines.length; i += 1) {
			const childLine = childLines[i];
			if (childLine.length > 0) {
				currentLine.push({ ...node, children: childLine });
			}
			if (i < childLines.length - 1) {
				pushLine();
			}
		}
	}

	lines.push(currentLine);
	return lines;
};

export const Codeblock = async ({ code, annotations, lang, useLineNumber, meta }: CodeblockProps) => {
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
	const lines = splitTreeByLines(tree);

	const filePath = meta
		.match(/title="(.+?)"/)?.[1]
		?.trim()
		?.split("/");

	const showTitlebar = filePath && filePath.length >= 0;

	return (
		<div className="group relative flex flex-col">
			{showTitlebar && (
				<div className="flex items-center gap-1 rounded-t-xl bg-slate-600 px-3 py-1.5 text-slate-300 text-sm">
					{filePath.map((folder, index, arr) => {
						const isFile = arr.length - 1 === index;

						return isFile ? (
							<span key={folder} className="inline-flex items-center gap-1 font-semibold text-slate-50">
								{folder}
							</span>
						) : (
							<>
								<span key={folder} className="inline-flex items-center gap-1">
									<Folder size={16} className="mt-1 stroke-2" />
									{folder}
								</span>
								/
							</>
						);
					})}
				</div>
			)}
			<pre className={cn("overflow-x-auto whitespace-pre rounded-xl", showTitlebar && "m-0! rounded-t-none")}>
				<code>
					{lines.map((line, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: 뷰어 역할로 항목의 추가, 삭제, 순서 변경이 이루어지지 않으므로 사용
						<span key={`line-${index}`} className={cn(useLineNumber && "line")}>
							{renderTree(line, `line-${index}`)}
							{index < lines.length - 1 ? "\n" : null}
						</span>
					))}
				</code>
			</pre>
			<CopyButton text={codeStr} className="lg:hidden lg:group-hover:block" />
		</div>
	);
};
