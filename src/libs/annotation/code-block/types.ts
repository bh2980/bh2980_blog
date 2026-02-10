import type { Paragraph, PhrasingContent } from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import type { EDITOR_CODE_BLOCK_NAME } from "@/keystatic/fields/mdx/components/code-block/constants";

export type CodeBlockRoot = MdxJsxFlowElement & { name: typeof EDITOR_CODE_BLOCK_NAME };

export type Range = {
	start: number;
	end: number;
};

export type AnnotationAttr = { name: string; value: unknown };

type AnnotationBase = {
	scope: AnnotationScope;
	name: string;
	range: Range;
	priority: number; // 교차 겹침 시 well nested 정책 우선 순위
	order: number; // 작성 순서
	class?: string;
	render?: string;
	attributes?: AnnotationAttr[];
};

export type InlineAnnotationSource = "mdast" | "mdx-text";
export type InlineAnnotation = AnnotationBase & {
	scope: "char" | "document";
	source: InlineAnnotationSource;
};

export type LineAnnotation = AnnotationBase & {
	scope: "line";
};

export type CodeBlockAnnotation = InlineAnnotation | LineAnnotation;

export type AnnotationScope = "char" | "line" | "document";
export type AnnotationKind = "class" | "render";

export type AnnotationRegistryItem = {
	name: string;
	kind: AnnotationKind;
	class?: string;
	render?: string;
	source: InlineAnnotationSource;
	scopes: AnnotationScope[];
	priority: number;
};

export type AnnotationRegistry = Map<string, AnnotationRegistryItem>;

type ClassAnnotationConfigItem = {
	name: string;
	kind: "class";
	class: string;
	source?: InlineAnnotationSource;
	scopes?: AnnotationScope[];
};

type RenderAnnotationConfigItem = {
	name: string;
	kind: "render";
	render: string;
	source?: InlineAnnotationSource;
	scopes?: AnnotationScope[];
};

export type AnnotationConfigItem = ClassAnnotationConfigItem | RenderAnnotationConfigItem;

export interface AnnotationConfig {
	annotations?: AnnotationConfigItem[];
}

export type Line = { value: string; annotations: InlineAnnotation[] };

export type CodeBlockMetaValue = string | boolean;

export type CodeBlockDocument = {
	lang: string;
	meta: Record<string, CodeBlockMetaValue>;
	annotations: LineAnnotation[];
	lines: Array<Line>;
};

export type EventKind = "open" | "close";

export type AnnotationEvent = {
	pos: number; // line offset
	kind: EventKind; // 같은 pos면 close 먼저
	anno: CodeBlockAnnotation; // 원본 참조 or 동일 구조
};

// children을 가지는 PhrasingContent만 추출 (text 제외)
export type PhrasingParent = Extract<PhrasingContent, { children: PhrasingContent[] }>;

// 스택에 올릴 수 있는 노드(= children을 직접 push 할 대상)
export type MdastNodeLike = Paragraph | MdxJsxTextElement | PhrasingParent;
