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
			source: "mdx-text",
			render: "strong",
		},
		{
			name: "em",
			source: "mdx-text",
			render: "em",
		},
		{
			name: "del",
			source: "mdx-text",
			render: "del",
		},
		{
			name: "u",
			source: "mdx-text",
			render: "u",
		},
	],
	lineWrap: [
		{
			name: "Collapsible",
			source: "mdx-flow",
			render: "Collapsible",
		},
	],
};

export const codeFenceAnnotationConfig: AnnotationConfig = {
	...annotationConfig,
	tagOverrides: {
		inlineClass: "dec",
		inlineWrap: "mark",
		lineClass: "line",
		lineWrap: "block",
	},
};
