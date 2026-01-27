export const EDITOR_LANG_OPTION = [
	{ label: "Plain Text", value: "txt" },

	// 웹 생태계 (각자의 개성이 강해 분리 권장)
	{ label: "TypeScript", value: "typescript" },
	{ label: "JavaScript", value: "javascript" },
	{ label: "React", value: "tsx" },
	{ label: "Vue", value: "vue" },
	{ label: "Svelte", value: "svelte" },

	// 마크업 & 스타일
	{ label: "HTML", value: "html" },
	{ label: "CSS", value: "css" },
	{ label: "SCSS", value: "scss" },
	{ label: "PostCSS", value: "postcss" },

	// 서버 & 시스템 (C# 분리)
	{ label: "Python", value: "python" },
	{ label: "Go", value: "go" },
	{ label: "Solidity", value: "solidity" },
	{ label: "Rust", value: "rust" },
	{ label: "Java", value: "java" },
	{ label: "Kotlin", value: "kotlin" },
	{ label: "C / C++", value: "cpp" },
	{ label: "C#", value: "csharp" },
	{ label: "Swift", value: "swift" },

	// 데이터 & 설정 (TOML 분리)
	{ label: "JSON", value: "jsonc" },
	{ label: "YAML", value: "yaml" },
	{ label: "TOML", value: "toml" },
	{ label: "CSV", value: "csv" },
	{ label: "Markdown/MDX", value: "mdx" },
	{ label: "SQL", value: "sql" },
	{ label: "GraphQL", value: "graphql" },

	// 인프라 & 도구 (PowerShell 분리)
	{ label: "Bash", value: "bash" },
	{ label: "PowerShell", value: "powershell" },
	{ label: "Dockerfile", value: "docker" },
	{ label: "Nginx", value: "nginx" },
	{ label: "Env", value: "dotenv" },
	{ label: "Mermaid", value: "mermaid" },
] as const;

export type EditorLang = (typeof EDITOR_LANG_OPTION)[number]["value"];

export const EDITOR_CODE_BLOCK_NAME = "CodeBlock";
