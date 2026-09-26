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
