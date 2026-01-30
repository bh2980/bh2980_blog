// src/keystatic/fields/mdx-components/editor-code-block.constants.ts

export const EDITOR_LANG_OPTIONS = [
	{ label: "TypeScript", value: "typescript" },
	{ label: "JavaScript", value: "javascript" },
	{ label: "TSX", value: "tsx" },
	{ label: "JSX", value: "jsx" },

	{ label: "JSON", value: "json" },
	{ label: "YAML", value: "yaml" },
	{ label: "Markdown", value: "markdown" },
	{ label: "HTML", value: "markup" },
	{ label: "CSS", value: "css" },
	{ label: "SCSS", value: "scss" },

	{ label: "Bash", value: "bash" },

	{ label: "Python", value: "python" },
	{ label: "Go", value: "go" },
	{ label: "Rust", value: "rust" },
	{ label: "Java", value: "java" },

	{ label: "SQL", value: "sql" },
	{ label: "GraphQL", value: "graphql" },

	{ label: "Dockerfile", value: "docker" },
	{ label: "Plain Text", value: "text" },
] as const;

export type EditorLang = (typeof EDITOR_LANG_OPTIONS)[number]["value"];

export type CodeBlockValue = {
	lang: EditorLang;
	meta: string;
	value: string;
};
