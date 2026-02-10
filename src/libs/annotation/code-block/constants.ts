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
	annotations: [
		{
			name: "Tooltip",
			kind: "render",
			source: "mdx-text",
			render: "Tooltip",
			scopes: ["char", "document"],
		},
		{
			name: "strong",
			kind: "render",
			source: "mdx-text",
			render: "strong",
			scopes: ["char", "document"],
		},
		{
			name: "em",
			kind: "render",
			source: "mdx-text",
			render: "em",
			scopes: ["char", "document"],
		},
		{
			name: "del",
			kind: "render",
			source: "mdx-text",
			render: "del",
			scopes: ["char", "document"],
		},
		{
			name: "u",
			kind: "render",
			source: "mdx-text",
			render: "u",
			scopes: ["char", "document"],
		},
		{
			name: "fold",
			kind: "render",
			source: "mdx-text",
			render: "fold",
			scopes: ["char", "document"],
		},
		{
			name: "plus",
			kind: "class",
			class: "diff plus",
			scopes: ["line"],
		},
		{
			name: "minus",
			kind: "class",
			class: "diff minus",
			scopes: ["line"],
		},
		{
			name: "Collapsible",
			kind: "render",
			render: "collapse",
			scopes: ["line"],
		},
		{
			name: "collapse",
			kind: "render",
			render: "collapse",
			scopes: ["line"],
		},
	],
};

export const codeFenceAnnotationConfig: AnnotationConfig = {
	...annotationConfig,
};
