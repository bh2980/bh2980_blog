import type { ANNOTATION_TYPE_DEFINITION } from "./constants";

export type Range = {
	start: number;
	end: number;
};

export type AnnotationTypePair = {
	[K in keyof typeof ANNOTATION_TYPE_DEFINITION]: {
		type: K;
		typeId: (typeof ANNOTATION_TYPE_DEFINITION)[K]["typeId"];
		tag: (typeof ANNOTATION_TYPE_DEFINITION)[K]["tag"];
	};
}[keyof typeof ANNOTATION_TYPE_DEFINITION];

export type AnnotationAttr = { name: string; value: string };

export type Annotation = AnnotationTypePair & {
	source: "mdast" | "mdx-text" | "mdx-flow";
	name: string;
	range: Range;
	priority: number;
	attributes?: AnnotationAttr[];
};

export type AnnotationType = Annotation["type"];
export type AnnotationSource = Annotation["source"];

export type AnnotationRegistryItem = Omit<Annotation, "range" | "attributes"> & AnnotationTypePair;
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
}

export type InlineAnnotation = Extract<Annotation, { type: "inlineClass" | "inlineWrap" }>;
export type LineAnnotation = Extract<Annotation, { type: "lineClass" | "lineWrap" }>;

export type Line = { value: string; annotations: InlineAnnotation[] };

export type CodeBlockDocument = {
	annotations: LineAnnotation[];
	lines: Array<Line>;
};
