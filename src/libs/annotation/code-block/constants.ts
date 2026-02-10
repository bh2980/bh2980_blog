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
				"inline-block w-full anno-mark-base anno-mark:content-['+'] anno-mark:text-gray-400 bg-green-400/10 shadow-[inset_2px_0_0_0_rgba(74,222,128,1)]",
			scopes: ["line"],
		},
		{
			name: "minus",
			kind: "class",
			class:
				"inline-block w-full anno-mark-base anno-mark:content-['-'] anno-mark:text-gray-400 bg-red-400/10 shadow-[inset_2px_0_0_0_rgba(239,68,68,1)]",
			scopes: ["line"],
		},
		{
			name: "highlight",
			kind: "class",
			class: "inline-block w-full anno-mark-base bg-gray-400/20",
			scopes: ["line"],
		},
		{
			name: "warning",
			kind: "class",
			class: "underline decoration-wavy decoration-yellow-400/80",
			scopes: ["line"],
		},
		{
			name: "error",
			kind: "class",
			class: "underline decoration-wavy decoration-red-500",
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
