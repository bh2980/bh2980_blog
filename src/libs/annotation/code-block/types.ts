import type { Paragraph, PhrasingContent } from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import type { EDITOR_CODE_BLOCK_NAME } from "@/keystatic/fields/mdx/components/code-block/constants";
import type { ANNOTATION_TYPE_DEFINITION } from "./constants";

export type CodeBlockRoot = MdxJsxFlowElement & { name: typeof EDITOR_CODE_BLOCK_NAME };

export type Range = {
	start: number;
	end: number;
};

export type AnnotationTypePair = {
	[K in keyof typeof ANNOTATION_TYPE_DEFINITION]: {
		type: K;
		typeId: (typeof ANNOTATION_TYPE_DEFINITION)[K]["typeId"];
		tag: string;
	};
}[keyof typeof ANNOTATION_TYPE_DEFINITION];

export type AnnotationAttr = { name: string; value: unknown };

export type Annotation = AnnotationTypePair & {
	source: "mdast" | "mdx-text" | "mdx-flow";
	name: string;
	range: Range;
	priority: number; // 교차 겹침 시 well nested 정책 우선 순위
	order: number; // 작성 순서
	attributes?: AnnotationAttr[];
};

export type AnnotationType = Annotation["type"];
export type AnnotationSource = Annotation["source"];
export type AnnotationTagOverrides = Partial<Record<AnnotationType, string>>;

export type AnnotationRegistryItem = Omit<Annotation, "range" | "attributes" | "order"> & AnnotationTypePair;
export type AnnotationRegistry = Map<string, AnnotationRegistryItem>;

export type AnnotationConfigItemBase = Pick<Annotation, "name" | "source">;

export type ClassAnnotationConfigItem = AnnotationConfigItemBase & {
	class: string;
};

export type RenderAnnotationConfigItem = AnnotationConfigItemBase & {
	render: string;
};

export type AnnotationConfigItem = ClassAnnotationConfigItem | RenderAnnotationConfigItem;

export interface AnnotationConfig {
	inlineClass?: ClassAnnotationConfigItem[];
	inlineWrap?: RenderAnnotationConfigItem[];
	lineClass?: ClassAnnotationConfigItem[];
	lineWrap?: RenderAnnotationConfigItem[];
	tagOverrides?: AnnotationTagOverrides;
}

export type InlineAnnotation = Extract<Annotation, { type: "inlineClass" | "inlineWrap" }>;
export type LineAnnotation = Extract<Annotation, { type: "lineClass" | "lineWrap" }>;

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
	anno: Annotation; // 원본 참조 or 동일 구조
};

// children을 가지는 PhrasingContent만 추출 (text 제외)
export type PhrasingParent = Extract<PhrasingContent, { children: PhrasingContent[] }>;

// 스택에 올릴 수 있는 노드(= children을 직접 push 할 대상)
export type MdastNodeLike = Paragraph | MdxJsxTextElement | PhrasingParent;
