export const EDITOR_LANG_OPTION = [
	{ label: "Plain Text", value: "text" },

	// 웹 생태계 (각자의 개성이 강해 분리 권장)
	{ label: "TypeScript", value: "ts-tags" }, // 기본
	{ label: "JavaScript", value: "javascript" }, // 기본
	{ label: "React", value: "tsx" }, // 기본
	{ label: "Vue", value: "vue" },
	{ label: "Svelte", value: "svelte" },

	// 마크업 & 스타일
	{ label: "HTML", value: "html" },
	{ label: "CSS", value: "css" }, // 기본
	{ label: "SCSS", value: "scss" }, // 기본
	{ label: "PostCSS", value: "postcss" },

	// 서버 & 시스템 (C# 분리)
	{ label: "Python", value: "python" }, // 기본
	{ label: "Go", value: "go" },
	{ label: "Solidity", value: "solidity" }, // 기본
	{ label: "Rust", value: "rust" },
	{ label: "Java", value: "java" },
	{ label: "Kotlin", value: "kotlin" },
	{ label: "C / C++", value: "cpp" },
	{ label: "C#", value: "csharp" },
	{ label: "Swift", value: "swift" },

	// 데이터 & 설정 (TOML 분리)
	{ label: "JSON", value: "jsonc" }, // 기본
	{ label: "YAML", value: "yaml" }, // 기본
	{ label: "TOML", value: "toml" },
	{ label: "CSV", value: "csv" },
	{ label: "Markdown/MDX", value: "mdx" },
	{ label: "SQL", value: "sql" }, // 기본
	{ label: "GraphQL", value: "graphql" },

	// 인프라 & 도구 (PowerShell 분리)
	{ label: "Bash", value: "bash" }, // 기본
	{ label: "PowerShell", value: "powershell" },
	{ label: "Dockerfile", value: "docker" },
	{ label: "Nginx", value: "nginx" },
	{ label: "Env", value: "dotenv" },
] as const;

export type EditorCodeLang = (typeof EDITOR_LANG_OPTION)[number]["value"];

export const EDITOR_CODE_BLOCK_NAME = "CodeBlock";
export const EDITOR_CODE_BLOCK_THEME = "one-dark-pro" as const;

export const EDITOR_LANG_DEFAULTS = [
	"text",
	"ts-tags",
	"javascript",
	"tsx",
	"css",
	"scss",
	"python",
	"solidity",
	"jsonc",
	"yaml",
	"sql",
	"bash",
] as const satisfies readonly EditorCodeLang[];

export const EDITOR_LANG_GROUPS = [
	{ label: "웹 생태계", values: ["vue", "svelte"] },
	{ label: "마크업 & 스타일", values: ["html", "postcss"] },
	{
		label: "서버 & 시스템",
		values: ["go", "rust", "java", "kotlin", "cpp", "csharp", "swift"],
	},
	{ label: "데이터 & 설정", values: ["toml", "csv", "mdx", "graphql"] },
	{
		label: "인프라 & 도구",
		values: ["powershell", "docker", "nginx", "dotenv"],
	},
] as const satisfies ReadonlyArray<{ label: string; values: readonly EditorCodeLang[] }>;
