import type { AnnotationConfig } from "./types";

export enum AnnotationTypeEnum {
	inlineClass = 0,
	inlineWrap,
	lineClass,
	lineWrap,
}

export const ANNOTATION_TYPE_DEFINITION = {
	inlineClass: { typeId: AnnotationTypeEnum.inlineClass, tag: "inClass" },
	inlineWrap: { typeId: AnnotationTypeEnum.inlineWrap, tag: "inWrap" },
	lineClass: { typeId: AnnotationTypeEnum.lineClass, tag: "lnClass" },
	lineWrap: { typeId: AnnotationTypeEnum.lineWrap, tag: "lnWrap" },
} as const;

export const annotationConfig: AnnotationConfig = {
	inlineClass: [],
	inlineWrap: [
		{
			name: "Tooltip",
			source: "mdx-text",
			render: "Tooltip",
		},
		{
			name: "strong",
			source: "mdast",
			render: "strong",
		},
		{
			name: "emphasis",
			source: "mdast",
			render: "em",
		},
		{
			name: "delete",
			source: "mdast",
			render: "del",
		},
		{
			name: "u",
			source: "mdx-text",
			render: "u",
		},
	],
	lineClass: [],
	lineWrap: [
		{
			name: "Collapsible",
			source: "mdx-flow",
			render: "Collapsible",
		},
	],
};
