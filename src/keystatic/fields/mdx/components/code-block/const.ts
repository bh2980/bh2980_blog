import type { IconType } from "react-icons";
import { FaDatabase, FaFileCsv } from "react-icons/fa6";
import { FiFileText } from "react-icons/fi";
import { RiJavaFill, RiTerminalBoxLine } from "react-icons/ri";
import {
	SiCplusplus,
	SiCss3,
	SiDocker,
	SiDotenv,
	SiDotnet,
	SiGnubash,
	SiGo,
	SiGraphql,
	SiHtml5,
	SiJavascript,
	SiJson,
	SiKotlin,
	SiMdx,
	SiNginx,
	SiPostcss,
	SiPython,
	SiReact,
	SiRust,
	SiSass,
	SiSolidity,
	SiSvelte,
	SiSwift,
	SiToml,
	SiTypescript,
	SiVuedotjs,
	SiYaml,
} from "react-icons/si";

export const EDITOR_LANG_OPTION = [
	{ label: "TypeScript", value: "ts-tags", depth: 1, icon: SiTypescript },
	{ label: "React", value: "tsx", depth: 1, icon: SiReact },
	{ label: "SCSS", value: "scss", depth: 1, icon: SiSass },
	{ label: "Python", value: "python", depth: 1, icon: SiPython },
	{ label: "Solidity", value: "solidity", depth: 1, icon: SiSolidity },
	{ label: "JSON", value: "jsonc", depth: 1, icon: SiJson },
	{ label: "YAML", value: "yaml", depth: 1, icon: SiYaml },
	{ label: "Bash", value: "bash", depth: 1, icon: SiGnubash },
	{ label: "Plain Text", value: "text", depth: 1, icon: FiFileText },

	{ label: "JavaScript", value: "javascript", depth: 2, group: "웹 생태계", icon: SiJavascript },
	{ label: "Vue", value: "vue", depth: 2, group: "웹 생태계", icon: SiVuedotjs },
	{ label: "Svelte", value: "svelte", depth: 2, group: "웹 생태계", icon: SiSvelte },

	{ label: "HTML", value: "html", depth: 2, group: "마크업 & 스타일", icon: SiHtml5 },
	{ label: "CSS", value: "css", depth: 2, group: "마크업 & 스타일", icon: SiCss3 },
	{ label: "PostCSS", value: "postcss", depth: 2, group: "마크업 & 스타일", icon: SiPostcss },

	{ label: "Go", value: "go", depth: 2, group: "서버 & 시스템", icon: SiGo },
	{ label: "Rust", value: "rust", depth: 2, group: "서버 & 시스템", icon: SiRust },
	{ label: "Java", value: "java", depth: 2, group: "서버 & 시스템", icon: RiJavaFill },
	{ label: "Kotlin", value: "kotlin", depth: 2, group: "서버 & 시스템", icon: SiKotlin },
	{ label: "C / C++", value: "cpp", depth: 2, group: "서버 & 시스템", icon: SiCplusplus },
	{ label: "C#", value: "csharp", depth: 2, group: "서버 & 시스템", icon: SiDotnet },
	{ label: "Swift", value: "swift", depth: 2, group: "서버 & 시스템", icon: SiSwift },

	{ label: "TOML", value: "toml", depth: 2, group: "데이터 & 설정", icon: SiToml },
	{ label: "CSV", value: "csv", depth: 2, group: "데이터 & 설정", icon: FaFileCsv },
	{ label: "Markdown/MDX", value: "mdx", depth: 2, group: "데이터 & 설정", icon: SiMdx },
	{ label: "SQL", value: "sql", depth: 2, group: "데이터 & 설정", icon: FaDatabase },
	{ label: "GraphQL", value: "graphql", depth: 2, group: "데이터 & 설정", icon: SiGraphql },

	{ label: "PowerShell", value: "powershell", depth: 2, group: "인프라 & 도구", icon: RiTerminalBoxLine },
	{ label: "Dockerfile", value: "docker", depth: 2, group: "인프라 & 도구", icon: SiDocker },
	{ label: "Nginx", value: "nginx", depth: 2, group: "인프라 & 도구", icon: SiNginx },
	{ label: "Env", value: "dotenv", depth: 2, group: "인프라 & 도구", icon: SiDotenv },
] as const satisfies ReadonlyArray<{
	label: string;
	value: string;
	depth: 1 | 2;
	group?: string;
	icon: IconType;
}>;

export type EditorCodeLang = (typeof EDITOR_LANG_OPTION)[number]["value"];
export type EditorLangOption = (typeof EDITOR_LANG_OPTION)[number];

export const EDITOR_CODE_BLOCK_NAME = "CodeBlock";
export const EDITOR_CODE_BLOCK_THEME = "one-dark-pro" as const;
