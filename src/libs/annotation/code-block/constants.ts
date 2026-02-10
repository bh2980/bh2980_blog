import type { AnnotationConfig } from "./types";

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
			class:
				"anno-mark-base anno-mark:content-['+'] anno-mark:text-gray-400 bg-green-400/10 border-l-2 border-l-green-400",
			scopes: ["line"],
		},
		{
			name: "minus",
			kind: "class",
			class: "anno-mark-base anno-mark:content-['-'] anno-mark:text-gray-400 bg-red-400/10 border-l-2 border-l-red-500",
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
