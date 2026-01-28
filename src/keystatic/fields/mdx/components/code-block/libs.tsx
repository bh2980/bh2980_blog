import type { ComponentType, HTMLAttributes, ReactNode } from "react";
import { codeToTokens } from "shiki";
import { Tooltip } from "@/components/mdx/tooltip";
import type { Annotation } from "@/libs/remark/remark-code-block-annotation";
import { cn } from "@/utils/cn";
import { EDITOR_CODE_BLOCK_THEME, type EditorCodeLang } from "./constants";

export type { EditorCodeLang } from "./constants";

type PositionedToken = {
	content: string;
	color?: string;
	fontStyle?: number;
	start: number;
	end: number;
};

export type AnnotationKind = "inline" | "mark" | "wrapper" | "block";

type ResolvedAnnotationBase = {
	kind: AnnotationKind;
	start: number;
	end: number;
	raw: Annotation;
	data?: Record<string, unknown>;
	order: number;
	name?: string;
};

type AnnotationWrapper = ComponentType<{
	annotation: ResolvedAnnotationBase;
	children: ReactNode;
}>;

export type ResolvedAnnotation = ResolvedAnnotationBase & {
	wrap?: AnnotationWrapper;
};

export type AnnotationRule = {
	kind: AnnotationKind;
	match: (annotation: Annotation) => boolean;
	wrap?: AnnotationWrapper;
	data?: (annotation: Annotation) => Record<string, unknown>;
	name?: string;
};

// inline/block annotation은 래핑하지 않으므로 props로만 전달된다.
export type AnnotationConfig = {
	rules: AnnotationRule[];
	getTokenProps?: (args: {
		token: PositionedToken;
		annotations: ResolvedAnnotation[];
	}) => HTMLAttributes<HTMLSpanElement> | undefined;
	getLineProps?: (args: {
		lineIndex: number;
		blockAnnotations: ResolvedAnnotation[];
		wrapperAnnotations: ResolvedAnnotation[];
	}) => HTMLAttributes<HTMLSpanElement> | undefined;
};

type TreeNode =
	| {
			kind: "token";
			token: PositionedToken;
	  }
	| {
			kind: "mark";
			annotation: ResolvedAnnotation;
			children: TreeNode[];
			start: number;
			end: number;
	  };

const NoopWrapper: AnnotationWrapper = ({ children }) => <>{children}</>;

const DelWrapper: AnnotationWrapper = ({ children }) => <del>{children}</del>;
const StrongWrapper: AnnotationWrapper = ({ children }) => <strong>{children}</strong>;
const EmWrapper: AnnotationWrapper = ({ children }) => <em>{children}</em>;
const UnderlineWrapper: AnnotationWrapper = ({ children }) => <u>{children}</u>;

const TooltipWrapper: AnnotationWrapper = ({ annotation, children }) => {
	const content = typeof annotation.data?.content === "string" ? annotation.data.content : "";
	return (
		<Tooltip
			content={content}
			className="border-slate-200 bg-slate-200 text-slate-800 [&_svg]:bg-slate-200 [&_svg]:fill-slate-200"
		>
			{children}
		</Tooltip>
	);
};

export const DEFAULT_ANNOTATION_RULES: AnnotationRule[] = [
	{
		kind: "mark",
		name: "Tooltip",
		match: (annotation) => annotation.type === "mdxJsxTextElement" && annotation.name === "Tooltip",
		data: (annotation) => ({
			content: annotation.type === "mdxJsxTextElement" ? extractTooltipContent(annotation) : "",
		}),
		wrap: TooltipWrapper,
	},
	{
		kind: "mark",
		name: "underline",
		match: (annotation) => annotation.type === "mdxJsxTextElement" && annotation.name === "u",
		wrap: UnderlineWrapper,
	},
	{
		kind: "mark",
		name: "emphasis",
		match: (annotation) => annotation.type === "emphasis",
		wrap: EmWrapper,
	},
	{
		kind: "mark",
		name: "strong",
		match: (annotation) => annotation.type === "strong",
		wrap: StrongWrapper,
	},
	{
		kind: "mark",
		name: "delete",
		match: (annotation) => annotation.type === "delete",
		wrap: DelWrapper,
	},
];

export const DEFAULT_ANNOTATION_CONFIG: AnnotationConfig = {
	rules: DEFAULT_ANNOTATION_RULES,
};

// Tooltip content 속성만 추출.
export function extractTooltipContent(annotation: Extract<Annotation, { type: "mdxJsxTextElement" }>) {
	const attr = annotation.attributes.find((a) => a.type === "mdxJsxAttribute" && a.name === "content");
	return typeof attr?.value === "string" ? attr.value : "";
}

// shiki 토큰(줄 단위)을 코드 전체 기준 start/end를 가진 토큰으로 변환.
export const buildPositionedTokens = (
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
export const splitTokensByBoundaries = (tokens: PositionedToken[], boundaries: Set<number>) => {
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

// mdast annotation을 렌더링에 필요한 형태(inline/mark/wrapper/block)로 정규화.
export const normalizeAnnotations = (annotationList: Annotation[], rules: AnnotationRule[]) => {
	const normalized: ResolvedAnnotation[] = [];

	for (const annotation of annotationList) {
		if (annotation.start >= annotation.end) continue;

		const ruleIndex = rules.findIndex((candidate) => candidate.match(annotation));
		if (ruleIndex === -1) continue;
		const rule = rules[ruleIndex];

		normalized.push({
			kind: rule.kind,
			start: annotation.start,
			end: annotation.end,
			raw: annotation,
			data: rule.data ? rule.data(annotation) : undefined,
			wrap: rule.wrap,
			order: ruleIndex,
			name: rule.name,
		});
	}

	return normalized;
};

// 정규화된 annotation을 토큰에 적용해 중첩 트리를 만든다.
export const buildAnnotationTree = (
	segments: PositionedToken[],
	annotations: ResolvedAnnotation[],
	codeLength: number,
) => {
	const root = { children: [] as TreeNode[], start: 0, end: codeLength };
	const stack: Array<{ children: TreeNode[]; start: number; end: number }> = [root];
	const startMap = new Map<number, ResolvedAnnotation[]>();

	for (const annotation of annotations) {
		const list = startMap.get(annotation.start) ?? [];
		list.push(annotation);
		startMap.set(annotation.start, list);
	}

	for (const list of startMap.values()) {
		list.sort((a, b) => (a.end !== b.end ? b.end - a.end : a.order - b.order));
	}

	for (const segment of segments) {
		const toOpen = startMap.get(segment.start);
		if (toOpen) {
			for (const annotation of toOpen) {
				const node: TreeNode = {
					kind: "mark",
					annotation,
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

export const coversRange = (annotation: ResolvedAnnotation, start: number, end: number) =>
	annotation.start <= start && annotation.end >= end;

// 트리를 재귀적으로 JSX로 변환.
export const renderTree = (
	nodes: TreeNode[],
	keyPrefix: string,
	inlineAnnotations: ResolvedAnnotation[] = [],
	getTokenProps?: AnnotationConfig["getTokenProps"],
) =>
	nodes.map((node, index) => {
		const key = `${keyPrefix}-${index}`;

		if (node.kind === "token") {
			const tokenAnnotations = inlineAnnotations.filter((annotation) =>
				coversRange(annotation, node.token.start, node.token.end),
			);
			const tokenProps = getTokenProps?.({ token: node.token, annotations: tokenAnnotations });
			const { style, className, children: _children, ...rest } = tokenProps ?? {};
			const mergedStyle = node.token.color ? { color: node.token.color, ...style } : style;

			return (
				<span key={key} style={mergedStyle} className={className} {...rest}>
					{node.token.content}
				</span>
			);
		}

		const Wrapper = node.annotation.wrap ?? NoopWrapper;
		return (
			<Wrapper key={key} annotation={node.annotation}>
				{renderTree(node.children, key, inlineAnnotations, getTokenProps)}
			</Wrapper>
		);
	});

// 라인별로 트리를 분리해 <span className="line">로 감싸기 위한 보조 함수.
export const splitTreeByLines = (nodes: TreeNode[]) => {
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

export const buildLineRanges = (codeStr: string) => {
	const ranges: Array<{ start: number; end: number }> = [];
	let lineStart = 0;

	for (let i = 0; i < codeStr.length; i += 1) {
		if (codeStr[i] === "\n") {
			ranges.push({ start: lineStart, end: i });
			lineStart = i + 1;
		}
	}

	ranges.push({ start: lineStart, end: codeStr.length });
	return ranges;
};

export const tokenizeAnnotationsFromTokens = ({
	code,
	codeblock,
	annotationList,
	annotationConfig,
}: {
	code: string;
	codeblock: { content: string; color?: string; fontStyle?: number }[][];
	annotationList: Annotation[];
	annotationConfig: AnnotationConfig;
}) => {
	const normalizedAnnotations = normalizeAnnotations(annotationList, annotationConfig.rules);
	const markAnnotations = normalizedAnnotations.filter((annotation) => annotation.kind === "mark");
	const inlineAnnotations = normalizedAnnotations.filter((annotation) => annotation.kind === "inline");
	const blockAnnotations = normalizedAnnotations.filter((annotation) => annotation.kind === "block");
	const wrapperAnnotations = normalizedAnnotations.filter((annotation) => annotation.kind === "wrapper");

	const positionedTokens = buildPositionedTokens(codeblock, code);
	const boundaries = new Set<number>();
	for (const annotation of normalizedAnnotations) {
		boundaries.add(annotation.start);
		boundaries.add(annotation.end);
	}
	const splitTokens = splitTokensByBoundaries(positionedTokens, boundaries);
	const tree = buildAnnotationTree(splitTokens, markAnnotations, code.length);
	const lines = splitTreeByLines(tree);
	const lineRanges = buildLineRanges(code);

	return {
		lines,
		lineRanges,
		inlineAnnotations,
		blockAnnotations,
		wrapperAnnotations,
	};
};

export const wrapLineWithAnnotations = (content: ReactNode, wrappers: ResolvedAnnotation[], keyPrefix: string) => {
	if (wrappers.length === 0) return content;

	const ordered = [...wrappers].sort((a, b) => {
		if (a.end !== b.end) return b.end - a.end;
		if (a.start !== b.start) return a.start - b.start;
		return a.order - b.order;
	});

	return ordered.reduceRight<ReactNode>((acc, annotation, index) => {
		const Wrapper = annotation.wrap ?? NoopWrapper;
		const key = `${keyPrefix}-wrapper-${annotation.start}-${annotation.end}-${annotation.order ?? index}`;
		return (
			<Wrapper key={key} annotation={annotation}>
				{acc}
			</Wrapper>
		);
	}, content);
};

export const renderAnnotatedLines = ({
	lines,
	lineRanges,
	useLineNumber,
	inlineAnnotations,
	blockAnnotations,
	wrapperAnnotations,
	config,
}: {
	lines: TreeNode[][];
	lineRanges: Array<{ start: number; end: number }>;
	useLineNumber: boolean;
	inlineAnnotations: ResolvedAnnotation[];
	blockAnnotations: ResolvedAnnotation[];
	wrapperAnnotations: ResolvedAnnotation[];
	config: AnnotationConfig;
}) =>
	lines.map((line, index) => {
		const lineRange = lineRanges[index] ?? { start: 0, end: 0 };
		const lineKey = `line-${lineRange.start}-${lineRange.end}`;
		const lineWrapperAnnotations = wrapperAnnotations.filter((annotation) =>
			coversRange(annotation, lineRange.start, lineRange.end),
		);
		const lineBlockAnnotations = blockAnnotations.filter((annotation) =>
			coversRange(annotation, lineRange.start, lineRange.end),
		);
		const lineProps = config.getLineProps?.({
			lineIndex: index,
			blockAnnotations: lineBlockAnnotations,
			wrapperAnnotations: lineWrapperAnnotations,
		});
		const { className, style, children: _children, ...rest } = lineProps ?? {};
		const lineContent = renderTree(line, lineKey, inlineAnnotations, config.getTokenProps);
		const wrappedLineContent = wrapLineWithAnnotations(lineContent, lineWrapperAnnotations, lineKey);

		return (
			<span key={lineKey} className={cn(useLineNumber && "line", className)} style={style} {...rest}>
				{wrappedLineContent}
				{index < lines.length - 1 ? "\n" : null}
			</span>
		);
	});

export const buildAnnotatedLinesFromTokens = ({
	code,
	codeblock,
	annotationList,
	useLineNumber,
	annotationConfig = DEFAULT_ANNOTATION_CONFIG,
}: {
	code: string;
	codeblock: { content: string; color?: string; fontStyle?: number }[][];
	annotationList: Annotation[];
	useLineNumber: boolean;
	annotationConfig?: AnnotationConfig;
}) => {
	const tokenized = tokenizeAnnotationsFromTokens({
		code,
		codeblock,
		annotationList,
		annotationConfig,
	});

	return {
		...tokenized,
		renderedLines: renderAnnotatedLines({
			lines: tokenized.lines,
			lineRanges: tokenized.lineRanges,
			useLineNumber,
			inlineAnnotations: tokenized.inlineAnnotations,
			blockAnnotations: tokenized.blockAnnotations,
			wrapperAnnotations: tokenized.wrapperAnnotations,
			config: annotationConfig,
		}),
	};
};

export const tokenizeAnnotatedCode = async ({
	code,
	lang,
	annotationList,
	annotationConfig,
}: {
	code: string;
	lang: EditorCodeLang;
	annotationList: Annotation[];
	annotationConfig: AnnotationConfig;
}) => {
	const { tokens: codeblock, ...tokenMeta } = await codeToTokens(code, { lang, theme: EDITOR_CODE_BLOCK_THEME });
	const tokenized = tokenizeAnnotationsFromTokens({
		code,
		codeblock,
		annotationList,
		annotationConfig,
	});

	return {
		tokenMeta,
		...tokenized,
	};
};

export const buildAnnotatedLines = async ({
	code,
	lang,
	annotationList,
	useLineNumber,
	annotationConfig = DEFAULT_ANNOTATION_CONFIG,
}: {
	code: string;
	lang: EditorCodeLang;
	annotationList: Annotation[];
	useLineNumber: boolean;
	annotationConfig?: AnnotationConfig;
}) => {
	const { tokens: codeblock, ...tokenMeta } = await codeToTokens(code, { lang, theme: EDITOR_CODE_BLOCK_THEME });
	const annotated = buildAnnotatedLinesFromTokens({
		code,
		codeblock,
		annotationList,
		useLineNumber,
		annotationConfig,
	});

	return {
		tokenMeta,
		...annotated,
	};
};
