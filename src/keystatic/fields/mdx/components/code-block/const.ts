export const EDITOR_LANG_OPTION = [
	{ label: "Plain Text", value: "txt" },

	{ label: "TypeScript", value: "typescript" },
	{ label: "JavaScript", value: "javascript" },
	{ label: "TSX", value: "tsx" },
	{ label: "JSX", value: "jsx" },

	{ label: "HTML", value: "html" },
	{ label: "CSS", value: "css" },
	{ label: "SCSS", value: "scss" },

	{ label: "Python", value: "python" },
	{ label: "Solidity", value: "solidity" },
	{ label: "Go", value: "go" },
	{ label: "Rust", value: "rust" },
	{ label: "Java", value: "java" },

	{ label: "JSON", value: "json" },
	{ label: "YAML", value: "yaml" },
	{ label: "Markdown", value: "markdown" },

	{ label: "SQL", value: "sql" },
	{ label: "GraphQL", value: "graphql" },

	{ label: "Shell Script", value: "shellscript" },
	{ label: "Dockerfile", value: "docker" },
] as const;

export type EditorLang = (typeof EDITOR_LANG_OPTION)[number]["value"];

export const EDITOR_CODE_BLOCK_NAME = "CodeBlock";
